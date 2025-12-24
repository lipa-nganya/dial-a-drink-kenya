const db = require('../models');

(async () => {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection established\n');
    
    const txIds = [271, 272, 273];
    
    for (const txId of txIds) {
      const tx = await db.Transaction.findByPk(txId, {
        attributes: ['id', 'transactionType', 'orderId', 'amount', 'status', 'paymentStatus', 'driverId', 'driverWalletId', 'notes']
      });
      
      if (tx) {
        const txData = tx.toJSON();
        console.log(`📊 Transaction #${txId}:`);
        console.log(`   transactionType: ${txData.transactionType === null ? 'NULL' : txData.transactionType === undefined ? 'UNDEFINED' : `"${txData.transactionType}"`}`);
        console.log(`   orderId: ${txData.orderId}`);
        console.log(`   driverId: ${txData.driverId}`);
        console.log(`   driverWalletId: ${txData.driverWalletId}`);
        console.log(`   amount: ${txData.amount}`);
        console.log(`   status: ${txData.status}`);
        console.log('');
      } else {
        console.log(`❌ Transaction #${txId} not found\n`);
      }
    }
    
    await db.sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();












