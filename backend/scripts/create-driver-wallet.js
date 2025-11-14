const db = require('../models');

async function createDriverWallet(driverId, skipDriverCheck = false) {
  try {
    // Check if driver exists (unless skipDriverCheck is true)
    let driver = null;
    if (!skipDriverCheck) {
      driver = await db.Driver.findByPk(driverId);
      if (!driver) {
        console.error(`❌ Driver with ID ${driverId} does not exist`);
        console.log(`   Creating wallet anyway (driver may be created later)...`);
      } else {
        console.log(`✅ Found driver: ${driver.name} (ID: ${driverId})`);
      }
    }

    // Check if wallet already exists
    const existingWallet = await db.DriverWallet.findOne({
      where: { driverId }
    });

    if (existingWallet) {
      console.log(`⚠️  Wallet already exists for driver ID ${driverId}`);
      console.log(`   Wallet ID: ${existingWallet.id}`);
      console.log(`   Balance: KES ${parseFloat(existingWallet.balance || 0).toFixed(2)}`);
      return existingWallet;
    }

    // Create wallet
    const wallet = await db.DriverWallet.create({
      driverId,
      balance: 0,
      totalTipsReceived: 0,
      totalTipsCount: 0,
      totalDeliveryPay: 0,
      totalDeliveryPayCount: 0
    });

    console.log(`✅ Created wallet for driver ID ${driverId}`);
    console.log(`   Wallet ID: ${wallet.id}`);
    console.log(`   Balance: KES ${parseFloat(wallet.balance).toFixed(2)}`);
    if (driver) {
      console.log(`   Driver: ${driver.name}`);
    }

    return wallet;
  } catch (error) {
    console.error('❌ Error creating driver wallet:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  const driverId = parseInt(process.argv[2] || '4', 10);
  const skipCheck = process.argv[3] === '--skip-check';
  
  createDriverWallet(driverId, skipCheck)
    .then(() => {
      console.log('✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed:', error);
      process.exit(1);
    });
}

module.exports = createDriverWallet;
