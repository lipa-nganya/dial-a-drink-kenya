const db = require('../models');

(async () => {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection established');
    
    const tx = await db.Transaction.findByPk(273, {
      attributes: ['id', 'transactionType', 'orderId', 'amount', 'status', 'paymentStatus', 'driverId', 'driverWalletId', 'notes', 'createdAt']
    });
    
    if (tx) {
      const txData = tx.toJSON();
      console.log('\n📊 Transaction #273 Details:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Transaction Type: ${txData.transactionType || '(null/empty)'}`);
      console.log(`Order ID: ${txData.orderId || 'N/A'}`);
      console.log(`Amount: ${txData.amount || 'N/A'}`);
      console.log(`Status: ${txData.status || 'N/A'}`);
      console.log(`Payment Status: ${txData.paymentStatus || 'N/A'}`);
      console.log(`Driver ID: ${txData.driverId || 'N/A'}`);
      console.log(`Driver Wallet ID: ${txData.driverWalletId || 'N/A'}`);
      console.log(`Notes: ${txData.notes || 'N/A'}`);
      console.log(`Created: ${txData.createdAt || 'N/A'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      if (!txData.transactionType) {
        console.log('\n⚠️  WARNING: transactionType is null or empty!');
      }
    } else {
      console.log('❌ Transaction #273 not found');
    }
    
    await db.sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();












