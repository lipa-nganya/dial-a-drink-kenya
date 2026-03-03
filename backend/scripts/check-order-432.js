const db = require('../models');

async function checkOrder432() {
  try {
    // Find order 432
    const order = await db.Order.findByPk(432, {
      attributes: [
        'id', 'customerName', 'customerPhone', 'totalAmount',
        'paymentMethod', 'paymentType', 'status', 'paymentStatus', 'driverId',
        'isStop', 'stopDeductionAmount', 'createdAt', 'updatedAt'
      ]
    });
    
    console.log('\n=== ORDER 432 ===');
    console.log(JSON.stringify(order, null, 2));
    
    if (!order) {
      console.log('Order 432 not found');
      process.exit(1);
    }
    
    // Get driver info
    if (order.driverId) {
      const driver = await db.Driver.findByPk(order.driverId, {
        attributes: ['id', 'name', 'phoneNumber', 'cashAtHand']
      });
      console.log('\n=== DRIVER ===');
      console.log(JSON.stringify(driver, null, 2));
      
      // Get driver wallet
      const driverWallet = await db.DriverWallet.findOne({
        where: { driverId: order.driverId },
        attributes: ['id', 'driverId', 'savings']
      });
      console.log('\n=== DRIVER WALLET ===');
      console.log(JSON.stringify(driverWallet, null, 2));
    }
    
    // Check for stop deduction transaction
    const stopDeductionTransaction = await db.Transaction.findOne({
      where: {
        orderId: 432,
        transactionType: 'delivery_fee_debit',
        paymentProvider: 'stop_deduction',
        status: { [db.Sequelize.Op.ne]: 'cancelled' }
      }
    });
    
    console.log('\n=== STOP DEDUCTION TRANSACTION ===');
    if (stopDeductionTransaction) {
      console.log(JSON.stringify(stopDeductionTransaction, null, 2));
    } else {
      console.log('No stop deduction transaction found');
    }
    
    // Get all transactions for order 432
    const allTransactions = await db.Transaction.findAll({
      where: {
        orderId: 432
      },
      order: [['createdAt', 'DESC']],
      attributes: [
        'id', 'orderId', 'driverId', 'transactionType', 'amount',
        'paymentMethod', 'paymentProvider', 'status', 'paymentStatus',
        'notes', 'createdAt', 'updatedAt'
      ]
    });
    
    console.log('\n=== ALL TRANSACTIONS FOR ORDER 432 ===');
    allTransactions.forEach((t, idx) => {
      console.log(`\n--- Transaction ${idx + 1} (ID: ${t.id}) ---`);
      console.log(`Created: ${t.createdAt}`);
      console.log(`Type: ${t.transactionType}`);
      console.log(`Amount: KES ${parseFloat(t.amount).toFixed(2)}`);
      console.log(`Payment Provider: ${t.paymentProvider || 'N/A'}`);
      console.log(`Notes: ${t.notes || 'N/A'}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkOrder432();
