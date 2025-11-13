/**
 * Script to retroactively credit delivery fee payment for a specific order
 * Usage: node scripts/fix-order-delivery-pay.js <orderId>
 */

const db = require('../models');
const { getOrderFinancialBreakdown } = require('../utils/orderFinancials');

async function fixOrderDeliveryPay(orderId) {
  try {
    console.log(`🔍 Checking Order #${orderId}...`);
    
    const order = await db.Order.findByPk(orderId, {
      include: [
        { model: db.Transaction, as: 'transactions' },
        { model: db.Driver, as: 'driver' }
      ]
    });

    if (!order) {
      console.error(`❌ Order #${orderId} not found`);
      process.exit(1);
    }

    console.log(`📋 Order Details:`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Payment Status: ${order.paymentStatus}`);
    console.log(`   Driver ID: ${order.driverId}`);
    console.log(`   Driver Pay Credited: ${order.driverPayCredited}`);
    console.log(`   Driver Pay Amount: ${order.driverPayAmount || 0}`);

    if (!order.driverId) {
      console.error(`❌ Order #${orderId} has no driver assigned`);
      process.exit(1);
    }

    if (order.paymentStatus !== 'paid') {
      console.error(`❌ Order #${orderId} payment status is not 'paid' (current: ${order.paymentStatus})`);
      process.exit(1);
    }

    // Get driver pay settings
    const [driverPayEnabledSetting, driverPayAmountSetting] = await Promise.all([
      db.Settings.findOne({ where: { key: 'driverPayPerDeliveryEnabled' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'driverPayPerDeliveryAmount' } }).catch(() => null)
    ]);

    const isDriverPayEnabled = driverPayEnabledSetting?.value === 'true';
    const configuredDriverPayAmount = parseFloat(driverPayAmountSetting?.value || '0');

    if (!isDriverPayEnabled || configuredDriverPayAmount <= 0) {
      console.error(`❌ Driver pay is not enabled or amount is 0`);
      console.error(`   Enabled: ${isDriverPayEnabled}`);
      console.error(`   Amount: ${configuredDriverPayAmount}`);
      process.exit(1);
    }

    // Get delivery fee from order breakdown
    const breakdown = await getOrderFinancialBreakdown(orderId);
    const deliveryFee = parseFloat(breakdown.deliveryFee) || 0;
    const driverPayAmount = Math.min(deliveryFee, configuredDriverPayAmount);

    console.log(`💰 Financial Breakdown:`);
    console.log(`   Delivery Fee: KES ${deliveryFee.toFixed(2)}`);
    console.log(`   Driver Pay Amount: KES ${driverPayAmount.toFixed(2)}`);

    if (driverPayAmount <= 0) {
      console.error(`❌ Driver pay amount is 0 or negative`);
      process.exit(1);
    }

    // Check if already credited
    const driverWallet = await db.DriverWallet.findOne({ where: { driverId: order.driverId } });
    if (!driverWallet) {
      console.error(`❌ Driver wallet not found for driver #${order.driverId}`);
      process.exit(1);
    }

    // Check for existing delivery pay transaction
    const existingTransaction = await db.Transaction.findOne({
      where: {
        orderId: orderId,
        transactionType: 'delivery_pay',
        driverId: order.driverId,
        driverWalletId: driverWallet.id,
        status: 'completed'
      }
    });

    if (existingTransaction) {
      console.log(`⚠️  Delivery pay transaction already exists and is completed:`);
      console.log(`   Transaction ID: ${existingTransaction.id}`);
      console.log(`   Amount: KES ${existingTransaction.amount}`);
      console.log(`   Status: ${existingTransaction.status}`);
      console.log(`   Wallet Balance: KES ${parseFloat(driverWallet.balance).toFixed(2)}`);
      console.log(`   Total Delivery Pay: KES ${parseFloat(driverWallet.totalDeliveryPay || 0).toFixed(2)}`);
      console.log(`   Delivery Pay Count: ${driverWallet.totalDeliveryPayCount || 0}`);
      
      if (order.driverPayCredited) {
        console.log(`✅ Order already marked as credited. No action needed.`);
        process.exit(0);
      } else {
        console.log(`⚠️  Order not marked as credited, but transaction exists. Updating order...`);
        await order.update({
          driverPayCredited: true,
          driverPayCreditedAt: existingTransaction.createdAt || new Date(),
          driverPayAmount: driverPayAmount
        });
        console.log(`✅ Order updated to reflect credited status.`);
        process.exit(0);
      }
    }

    // Credit the wallet
    console.log(`💳 Crediting wallet...`);
    const oldBalance = parseFloat(driverWallet.balance) || 0;
    const oldTotalDeliveryPay = parseFloat(driverWallet.totalDeliveryPay || 0);
    const oldCount = driverWallet.totalDeliveryPayCount || 0;

    await driverWallet.update({
      balance: oldBalance + driverPayAmount,
      totalDeliveryPay: oldTotalDeliveryPay + driverPayAmount,
      totalDeliveryPayCount: oldCount + 1
    });

    // Create or update delivery pay transaction
    let deliveryTransaction = await db.Transaction.findOne({
      where: {
        orderId: orderId,
        transactionType: 'delivery_pay',
        driverId: order.driverId
      }
    });

    const paymentTransaction = await db.Transaction.findOne({
      where: {
        orderId: orderId,
        transactionType: 'payment',
        status: 'completed'
      },
      order: [['createdAt', 'DESC']]
    });

    const transactionPayload = {
      orderId: orderId,
      transactionType: 'delivery_pay',
      paymentMethod: paymentTransaction?.paymentMethod || 'mobile_money',
      paymentProvider: paymentTransaction?.paymentProvider || 'mpesa',
      amount: driverPayAmount,
      status: 'completed',
      paymentStatus: 'paid',
      receiptNumber: paymentTransaction?.receiptNumber || null,
      checkoutRequestID: paymentTransaction?.checkoutRequestID || null,
      merchantRequestID: paymentTransaction?.merchantRequestID || null,
      phoneNumber: paymentTransaction?.phoneNumber || null,
      transactionDate: paymentTransaction?.transactionDate || new Date(),
      driverId: order.driverId,
      driverWalletId: driverWallet.id,
      notes: `Driver delivery fee payment for Order #${orderId} - retroactively credited`
    };

    if (deliveryTransaction) {
      await deliveryTransaction.update(transactionPayload);
      console.log(`✅ Updated existing delivery transaction #${deliveryTransaction.id}`);
    } else {
      deliveryTransaction = await db.Transaction.create(transactionPayload);
      console.log(`✅ Created new delivery transaction #${deliveryTransaction.id}`);
    }

    // Update order
    await order.update({
      driverPayCredited: true,
      driverPayCreditedAt: new Date(),
      driverPayAmount: driverPayAmount
    });

    // Reload wallet
    await driverWallet.reload();

    console.log(`✅ Successfully credited delivery pay for Order #${orderId}:`);
    console.log(`   Amount: KES ${driverPayAmount.toFixed(2)}`);
    console.log(`   Wallet balance: ${oldBalance.toFixed(2)} → ${parseFloat(driverWallet.balance).toFixed(2)}`);
    console.log(`   Total delivery pay: ${oldTotalDeliveryPay.toFixed(2)} → ${parseFloat(driverWallet.totalDeliveryPay).toFixed(2)}`);
    console.log(`   Delivery pay count: ${oldCount} → ${driverWallet.totalDeliveryPayCount}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

const orderId = process.argv[2];
if (!orderId) {
  console.error('Usage: node scripts/fix-order-delivery-pay.js <orderId>');
  process.exit(1);
}

fixOrderDeliveryPay(parseInt(orderId, 10));

