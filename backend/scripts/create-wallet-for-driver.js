const db = require('../models');

/**
 * Create wallet for an existing driver (does NOT create the driver)
 */
async function createWalletForDriver(driverId) {
  try {
    // Check if driver exists - REQUIRED
    const driver = await db.Driver.findByPk(driverId);
    if (!driver) {
      console.error(`❌ Driver with ID ${driverId} does NOT exist in the database`);
      console.error(`   Please create the driver first, or check if you're connected to the correct database`);
      process.exit(1);
    }

    console.log(`✅ Found driver: ${driver.name} (ID: ${driverId})`);

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
    console.log(`   Driver: ${driver.name}`);

    return wallet;
  } catch (error) {
    console.error('❌ Error creating driver wallet:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  const driverId = parseInt(process.argv[2] || '4', 10);
  
  if (!driverId) {
    console.error('Usage: node create-wallet-for-driver.js <driverId>');
    process.exit(1);
  }
  
  createWalletForDriver(driverId)
    .then(() => {
      console.log('✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed:', error);
      process.exit(1);
    });
}

module.exports = createWalletForDriver;












