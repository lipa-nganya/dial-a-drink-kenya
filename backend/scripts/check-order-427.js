const db = require('../models');

async function checkOrder427() {
  try {
    // Find driver "Mar Loc 2"
    const drivers = await db.Driver.findAll({
      where: {
        [db.Sequelize.Op.or]: [
          { name: { [db.Sequelize.Op.like]: '%Mar Loc 2%' } },
          { name: { [db.Sequelize.Op.like]: '%Mar Loc%' } }
        ]
      },
      attributes: ['id', 'name', 'phoneNumber', 'cashAtHand']
    });
    
    console.log('\n=== DRIVER "Mar Loc 2" ===');
    console.log(JSON.stringify(drivers, null, 2));
    
    // Find order 427
    const order = await db.Order.findByPk(427, {
      attributes: [
        'id', 'customerName', 'customerPhone', 'totalAmount',
        'paymentMethod', 'paymentType', 'status', 'paymentStatus', 'driverId',
        'isStop', 'stopDeductionAmount', 'createdAt', 'updatedAt'
      ]
    });
    
    console.log('\n=== ORDER 427 ===');
    console.log(JSON.stringify(order, null, 2));
    
    // Get all cash_settlement transactions for order 427
    const cashSettlementTransactions = await db.Transaction.findAll({
      where: {
        orderId: 427,
        transactionType: 'cash_settlement'
      },
      order: [['createdAt', 'DESC']],
      limit: 10,
      attributes: [
        'id', 'orderId', 'driverId', 'transactionType', 'amount',
        'paymentMethod', 'paymentProvider', 'status', 'paymentStatus',
        'notes', 'createdAt', 'updatedAt'
      ]
    });
    
    console.log('\n=== CASH SETTLEMENT TRANSACTIONS FOR ORDER 427 (Latest 3) ===');
    const latest3 = cashSettlementTransactions.slice(0, 3);
    latest3.forEach((t, idx) => {
      console.log(`\n--- Transaction ${idx + 1} (ID: ${t.id}) ---`);
      console.log(`Created: ${t.createdAt}`);
      console.log(`Amount: KES ${parseFloat(t.amount).toFixed(2)}`);
      console.log(`Type: ${t.transactionType}`);
      console.log(`Payment Method: ${t.paymentMethod || 'N/A'}`);
      console.log(`Payment Provider: ${t.paymentProvider || 'N/A'}`);
      console.log(`Status: ${t.status}`);
      console.log(`Notes: ${t.notes || 'N/A'}`);
    });
    
    // Get all transactions for order 427 (all types)
    const allTransactions = await db.Transaction.findAll({
      where: {
        orderId: 427
      },
      order: [['createdAt', 'DESC']],
      attributes: [
        'id', 'orderId', 'driverId', 'transactionType', 'amount',
        'paymentMethod', 'paymentProvider', 'status', 'paymentStatus',
        'notes', 'createdAt', 'updatedAt'
      ]
    });
    
    console.log('\n=== ALL TRANSACTIONS FOR ORDER 427 ===');
    allTransactions.forEach((t, idx) => {
      console.log(`\n--- Transaction ${idx + 1} (ID: ${t.id}) ---`);
      console.log(`Created: ${t.createdAt}`);
      console.log(`Type: ${t.transactionType}`);
      console.log(`Amount: KES ${parseFloat(t.amount).toFixed(2)}`);
      console.log(`Notes: ${t.notes || 'N/A'}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkOrder427();
