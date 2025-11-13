/**
 * Script to fix delivery fee transactions for a specific order
 * Can be run on cloud dev server via Cloud Run exec or similar
 * 
 * Usage: node scripts/fix-order-delivery-fee-cloud.js <orderId>
 */

const db = require('../models');
const { ensureDeliveryFeeSplit } = require('../utils/deliveryFeeTransactions');

const orderId = process.argv[2] ? parseInt(process.argv[2], 10) : null;

if (!orderId || isNaN(orderId)) {
  console.error('❌ Please provide a valid order ID');
  console.error('Usage: node scripts/fix-order-delivery-fee-cloud.js <orderId>');
  process.exit(1);
}

(async () => {
  try {
    console.log(`🔧 Fixing delivery fee transactions for Order ${orderId}...\n`);

    const order = await db.Order.findByPk(orderId, {
      include: [
        { model: db.Transaction, as: 'transactions' },
        { model: db.Driver, as: 'driver', attributes: ['id', 'name', 'phoneNumber'] }
      ]
    });

    if (!order) {
      console.error(`❌ Order ${orderId} not found`);
      process.exit(1);
    }

    console.log('=== ORDER INFO ===');
    console.log('ID:', order.id);
    console.log('Driver ID:', order.driverId);
    console.log('Driver:', order.driver ? order.driver.name : 'None');
    console.log('Payment Status:', order.paymentStatus);
    console.log('Status:', order.status);
    console.log('');

    // Get all delivery_pay transactions
    const deliveryTxs = (order.transactions || []).filter(tx => tx.transactionType === 'delivery_pay');
    console.log(`Found ${deliveryTxs.length} delivery_pay transactions:\n`);

    deliveryTxs.forEach(tx => {
      console.log(`TX #${tx.id}:`);
      console.log(`  Amount: KES ${tx.amount}`);
      console.log(`  Driver ID: ${tx.driverId || 'null'}`);
      console.log(`  Driver Wallet ID: ${tx.driverWalletId || 'null'}`);
      console.log(`  Status: ${tx.status}`);
      console.log(`  Payment Status: ${tx.paymentStatus}`);
      console.log('');
    });

    // Cancel incorrect driver transactions (wrong amount or not linked to wallet)
    console.log('🧹 Cleaning up incorrect transactions...\n');

    const { getOrderFinancialBreakdown } = require('../utils/orderFinancials');
    const breakdown = await getOrderFinancialBreakdown(orderId);
    const deliveryFeeAmount = parseFloat(breakdown.deliveryFee) || 0;

    const [driverPayEnabledSetting, driverPayAmountSetting] = await Promise.all([
      db.Settings.findOne({ where: { key: 'driverPayPerDeliveryEnabled' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'driverPayPerDeliveryAmount' } }).catch(() => null)
    ]);

    const driverPayEnabled = driverPayEnabledSetting?.value === 'true';
    const configuredDriverPay = parseFloat(driverPayAmountSetting?.value || '0');
    const expectedDriverPayAmount = driverPayEnabled && configuredDriverPay > 0
      ? Math.min(deliveryFeeAmount, configuredDriverPay)
      : 0;
    const expectedMerchantAmount = Math.max(deliveryFeeAmount - expectedDriverPayAmount, 0);

    console.log(`Expected split: Merchant KES ${expectedMerchantAmount.toFixed(2)}, Driver KES ${expectedDriverPayAmount.toFixed(2)}\n`);

    // Cancel driver transactions with wrong amounts or not linked to wallet
    for (const tx of deliveryTxs) {
      if (tx.driverId === order.driverId) {
        const txAmount = parseFloat(tx.amount || 0);
        const isWrongAmount = Math.abs(txAmount - expectedDriverPayAmount) > 0.01;
        const isNotLinked = tx.driverWalletId == null;

        if (isWrongAmount || isNotLinked) {
          console.log(`❌ Found incorrect driver transaction TX #${tx.id}:`);
          console.log(`   Amount: KES ${txAmount.toFixed(2)} (expected: KES ${expectedDriverPayAmount.toFixed(2)})`);
          console.log(`   Wallet Linked: ${tx.driverWalletId != null}`);
          await tx.update({
            status: 'cancelled',
            paymentStatus: 'cancelled',
            amount: 0,
            notes: `${tx.notes || ''}\nCancelled - incorrect amount or not linked to wallet.`.trim()
          });
          console.log(`✅ Cancelled TX #${tx.id}\n`);
        }
      }
    }

    // Cancel merchant transactions with wrong amounts
    for (const tx of deliveryTxs) {
      if (tx.driverId == null && tx.driverWalletId == null) {
        const txAmount = parseFloat(tx.amount || 0);
        const isWrongAmount = Math.abs(txAmount - expectedMerchantAmount) > 0.01;
        const isPending = tx.status !== 'completed';

        if (isWrongAmount || (isPending && order.paymentStatus === 'paid')) {
          console.log(`❌ Found incorrect merchant transaction TX #${tx.id}:`);
          console.log(`   Amount: KES ${txAmount.toFixed(2)} (expected: KES ${expectedMerchantAmount.toFixed(2)})`);
          console.log(`   Status: ${tx.status} (should be completed)`);
          await tx.update({
            status: 'cancelled',
            paymentStatus: 'cancelled',
            amount: 0,
            notes: `${tx.notes || ''}\nCancelled - incorrect amount or status.`.trim()
          });
          console.log(`✅ Cancelled TX #${tx.id}\n`);
        }
      }
    }

    // Now run ensureDeliveryFeeSplit to create correct transactions
    console.log('🔄 Running ensureDeliveryFeeSplit to create correct transactions...\n');
    const result = await ensureDeliveryFeeSplit(order, {
      context: `fix-order-${orderId}`,
      requirePayment: true,
      reloadOrder: true
    });

    console.log('=== RESULT ===');
    console.log('Delivery Fee:', result.deliveryFee);
    console.log('Driver Pay Amount:', result.driverPayAmount);
    console.log('Merchant Amount:', result.merchantAmount);
    console.log('Driver Transaction ID:', result.driverTransactionId);
    console.log('Merchant Transaction ID:', result.merchantTransactionId);
    console.log('Driver Wallet ID:', result.driverWalletId);
    console.log('');

    // Reload order to check final state
    await order.reload({
      include: [
        { model: db.Transaction, as: 'transactions' }
      ]
    });

    const finalDeliveryTxs = (order.transactions || []).filter(tx => tx.transactionType === 'delivery_pay' && tx.status !== 'cancelled');
    console.log('=== FINAL STATE ===');
    console.log(`Driver Pay Credited: ${order.driverPayCredited}`);
    console.log(`Driver Pay Amount: ${order.driverPayAmount}`);
    console.log(`\nFinal delivery_pay transactions (${finalDeliveryTxs.length}):\n`);

    finalDeliveryTxs.forEach(tx => {
      console.log(`TX #${tx.id}:`);
      console.log(`  Amount: KES ${tx.amount}`);
      console.log(`  Driver ID: ${tx.driverId || 'null'}`);
      console.log(`  Driver Wallet ID: ${tx.driverWalletId || 'null'}`);
      console.log(`  Status: ${tx.status}`);
      console.log(`  Payment Status: ${tx.paymentStatus}`);
      console.log('');
    });

    // Check driver wallet
    if (order.driverId && result.driverWalletId) {
      const wallet = await db.DriverWallet.findByPk(result.driverWalletId);
      if (wallet) {
        console.log('=== DRIVER WALLET ===');
        console.log('Balance:', wallet.balance);
        console.log('Total Delivery Pay:', wallet.totalDeliveryPay);
        console.log('Delivery Pay Count:', wallet.totalDeliveryPayCount);
      }
    }

    console.log(`\n✅ Order ${orderId} delivery fee transactions fixed!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();

