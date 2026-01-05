const db = require('../models');

/**
 * Check if a driver has exceeded their credit limit
 * @param {number} driverId - Driver ID
 * @returns {Promise<{exceeded: boolean, balance: number, creditLimit: number, debt: number}>}
 */
async function checkDriverCreditLimit(driverId) {
  try {
    const driver = await db.Driver.findByPk(driverId, {
      include: [{
        model: db.DriverWallet,
        as: 'wallet',
        required: false
      }]
    });

    if (!driver) {
      return { exceeded: false, balance: 0, creditLimit: 0, debt: 0 };
    }

    // Get wallet balance (negative balance means driver owes money)
    const wallet = driver.wallet || await db.DriverWallet.findOne({ where: { driverId } });
    const balance = wallet ? parseFloat(wallet.balance) || 0 : 0;
    
    // Credit limit (default to 0 if not set, meaning no credit allowed)
    const creditLimit = parseFloat(driver.creditLimit) || 0;
    
    // Debt is the negative of balance (if balance is -100, debt is 100)
    const debt = balance < 0 ? Math.abs(balance) : 0;
    
    // Driver has exceeded limit if debt > creditLimit
    const exceeded = creditLimit > 0 && debt > creditLimit;

    return {
      exceeded,
      balance,
      creditLimit,
      debt,
      canAcceptOrders: !exceeded
    };
  } catch (error) {
    console.error(`Error checking credit limit for driver ${driverId}:`, error);
    // On error, allow driver to accept orders (fail open)
    return { exceeded: false, balance: 0, creditLimit: 0, debt: 0, canAcceptOrders: true };
  }
}

/**
 * Filter drivers who have exceeded their credit limit
 * @param {Array} drivers - Array of driver objects
 * @returns {Promise<Array>} - Filtered array of drivers who haven't exceeded credit limit
 */
async function filterDriversByCreditLimit(drivers) {
  if (!drivers || drivers.length === 0) {
    return [];
  }

  const eligibleDrivers = [];
  
  for (const driver of drivers) {
    const creditCheck = await checkDriverCreditLimit(driver.id);
    if (!creditCheck.exceeded) {
      eligibleDrivers.push(driver);
    } else {
      console.log(`⚠️  Driver ${driver.name} (ID: ${driver.id}) has exceeded credit limit. Debt: ${creditCheck.debt}, Limit: ${creditCheck.creditLimit}`);
    }
  }

  return eligibleDrivers;
}

module.exports = {
  checkDriverCreditLimit,
  filterDriversByCreditLimit
};







