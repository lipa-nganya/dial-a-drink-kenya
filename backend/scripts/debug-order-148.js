/**
 * Debug script to check Order 148 and all its transactions
 */

const db = require('../models');

const debugOrder148 = async () => {
  const orderId = 148;
  
  console.log(`🔍 Debugging Order #${orderId}...`);
  
  try {
    // Get order
    const order = await db.Order.findByPk(orderId);
    if (!order) {
      console.error(`❌ Order #${orderId} not found`);
      await db.sequelize.close();
      process.exit(1);
    }
    
    console.log(`\n📋 Order #${orderId}:`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Payment Status: ${order.paymentStatus}`);
    console.log(`   Total Amount: KES ${parseFloat(order.totalAmount || 0).toFixed(2)}`);
    console.log(`   Payment Method: ${order.paymentMethod}`);
    console.log(`   Driver ID: ${order.driverId || 'none'}`);
    
    // Get ALL transactions for this order
    const allTransactions = await db.Transaction.findAll({
      where: { orderId },
      order: [['createdAt', 'DESC']]
    });
    
    console.log(`\n💰 All Transactions (${allTransactions.length}):`);
    allTransactions.forEach((tx, idx) => {
      console.log(`\n   ${idx + 1}. Transaction #${tx.id}`);
      console.log(`      Type: ${tx.transactionType}`);
      console.log(`      Status: ${tx.status}`);
      console.log(`      Payment Status: ${tx.paymentStatus}`);
      console.log(`      Amount: KES ${parseFloat(tx.amount || 0).toFixed(2)}`);
      console.log(`      Receipt: ${tx.receiptNumber || 'none'}`);
      console.log(`      CheckoutRequestID: ${tx.checkoutRequestID || 'none'}`);
      console.log(`      Created: ${tx.createdAt}`);
      console.log(`      Updated: ${tx.updatedAt}`);
    });
    
    // Check what transaction-status endpoint would return
    console.log(`\n🔍 What /transaction-status/${orderId} would return:`);
    const paymentTransaction = allTransactions.find(tx => tx.transactionType === 'payment');
    
    if (paymentTransaction) {
      console.log(`   ✅ Payment transaction found: #${paymentTransaction.id}`);
      console.log(`   Status: ${paymentTransaction.status}`);
      console.log(`   Payment Status: ${paymentTransaction.paymentStatus}`);
      console.log(`   Receipt: ${paymentTransaction.receiptNumber || 'none'}`);
    } else {
      console.log(`   ❌ No payment transaction found`);
      console.log(`   Endpoint would return: status='pending'`);
    }
    
    // Check for cancelled transactions
    const cancelledTransactions = allTransactions.filter(tx => tx.status === 'cancelled');
    if (cancelledTransactions.length > 0) {
      console.log(`\n⚠️  Cancelled Transactions (${cancelledTransactions.length}):`);
      cancelledTransactions.forEach(tx => {
        console.log(`   - Transaction #${tx.id} (${tx.transactionType})`);
      });
      console.log(`   These should NOT affect payment status display.`);
    }
    
  } catch (error) {
    console.error(`❌ Error debugging Order #${orderId}:`, error);
    console.error(error.stack);
  } finally {
    await db.sequelize.close();
  }
};

debugOrder148();

