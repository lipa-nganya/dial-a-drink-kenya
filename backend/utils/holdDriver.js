const db = require('../models');

/**
 * Get or create the HOLD Driver
 * This is a special driver used as a placeholder for orders that don't have a real driver assigned yet.
 * It ensures there's always a driverId/walletId available when payment happens.
 */
const getOrCreateHoldDriver = async () => {
  try {
    // Try to find existing HOLD driver
    let holdDriver = await db.Driver.findOne({
      where: {
        name: 'HOLD Driver',
        phoneNumber: '0000000000' // Special phone number for HOLD driver
      }
    });

    if (!holdDriver) {
      // Create HOLD driver if it doesn't exist
      holdDriver = await db.Driver.create({
        name: 'HOLD Driver',
        phoneNumber: '0000000000',
        status: 'inactive', // Always inactive
        pushToken: null
      });
      console.log('✅ Created HOLD Driver (ID: ' + holdDriver.id + ')');
    }

    // Ensure HOLD driver has a wallet
    let holdDriverWallet = await db.DriverWallet.findOne({
      where: { driverId: holdDriver.id }
    });

    if (!holdDriverWallet) {
      holdDriverWallet = await db.DriverWallet.create({
        driverId: holdDriver.id,
        balance: 0,
        totalTipsReceived: 0,
        totalTipsCount: 0,
        totalDeliveryPay: 0,
        totalDeliveryPayCount: 0
      });
      console.log('✅ Created HOLD Driver Wallet (ID: ' + holdDriverWallet.id + ')');
    }

    return {
      driver: holdDriver,
      wallet: holdDriverWallet
    };
  } catch (error) {
    console.error('❌ Error getting/creating HOLD Driver:', error);
    throw error;
  }
};

/**
 * Check if a driver is the HOLD driver
 */
const isHoldDriver = (driverId) => {
  // We'll check by name/phoneNumber when we have the driver instance
  // For now, we'll use a helper that checks the ID after fetching
  return false; // Will be checked dynamically
};

module.exports = {
  getOrCreateHoldDriver,
  isHoldDriver
};












