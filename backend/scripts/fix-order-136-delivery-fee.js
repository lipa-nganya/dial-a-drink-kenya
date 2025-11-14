const db = require('../models');
const { ensureDeliveryFeeSplit } = require('../utils/deliveryFeeTransactions');

(async () => {
  try {
    console.log('🔧 Fixing delivery fee transactions for Order 136...\n');

    const order = await db.Order.findByPk(136, {
      include: [
        { model: db.Transaction, as: 'transactions' },
        { model: db.Driver, as: 'driver', attributes: ['id', 'name', 'phoneNumber'] }
      ]
    });

    if (!order) {
      console.error('❌ Order 136 not found');
      process.exit(1);
    }

    console.log('=== ORDER 136 ===');
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

    // Cancel/delete incorrect transactions
    console.log('🧹 Cleaning up incorrect transactions...\n');

    // Find the driver transaction with wrong amount
    const wrongDriverTx = deliveryTxs.find(tx => tx.driverId === order.driverId && parseFloat(tx.amount) === 2.00);
    if (wrongDriverTx) {
      console.log(`❌ Found driver transaction with wrong amount (KES 2.00): TX #${wrongDriverTx.id}`);
      await wrongDriverTx.update({
        status: 'cancelled',
        paymentStatus: 'cancelled',
        amount: 0,
        notes: `${wrongDriverTx.notes || ''}\nCancelled - wrong amount. Should be KES 1.00.`.trim()
      });
      console.log(`✅ Cancelled TX #${wrongDriverTx.id}\n`);
    }

    // Now run ensureDeliveryFeeSplit to create correct transactions
    console.log('🔄 Running ensureDeliveryFeeSplit to create correct transactions...\n');
    const result = await ensureDeliveryFeeSplit(order, {
      context: 'fix-order-136',
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

    console.log('\n✅ Order 136 delivery fee transactions fixed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();

