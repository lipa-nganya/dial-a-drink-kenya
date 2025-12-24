const db = require('../models');

async function createDriverAndWallet(driverId, driverName = null, phoneNumber = null) {
  try {
    // Check if driver already exists
    let driver = await db.Driver.findByPk(driverId);
    
    if (!driver) {
      // Create driver if it doesn't exist
      if (!driverName) {
        driverName = `Driver ${driverId}`;
      }
      if (!phoneNumber) {
        phoneNumber = `000000000${driverId}`;
      }
      
      driver = await db.Driver.create({
        id: driverId,
        name: driverName,
        phoneNumber: phoneNumber,
        status: 'inactive'
      });
      console.log(`✅ Created driver: ${driver.name} (ID: ${driverId})`);
    } else {
      console.log(`✅ Found existing driver: ${driver.name} (ID: ${driverId})`);
    }

    // Check if wallet already exists
    const existingWallet = await db.DriverWallet.findOne({
      where: { driverId }
    });

    if (existingWallet) {
      console.log(`⚠️  Wallet already exists for driver ID ${driverId}`);
      console.log(`   Wallet ID: ${existingWallet.id}`);
      console.log(`   Balance: KES ${parseFloat(existingWallet.balance || 0).toFixed(2)}`);
      return { driver, wallet: existingWallet };
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

    return { driver, wallet };
  } catch (error) {
    console.error('❌ Error creating driver/wallet:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  const driverId = parseInt(process.argv[2] || '4', 10);
  const driverName = process.argv[3] || null;
  const phoneNumber = process.argv[4] || null;
  
  createDriverAndWallet(driverId, driverName, phoneNumber)
    .then(() => {
      console.log('✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed:', error);
      process.exit(1);
    });
}

module.exports = createDriverAndWallet;












