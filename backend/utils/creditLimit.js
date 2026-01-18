const db = require('../models');

/**
 * Check if a driver has exceeded their credit limit based on cash at hand
 * @param {number} driverId - Driver ID
 * @param {boolean} considerPendingSubmissions - If true, subtract pending cash submissions from cash at hand
 * @returns {Promise<{exceeded: boolean, cashAtHand: number, creditLimit: number, canAcceptOrders: boolean, canUpdateOrders: boolean, pendingSubmissionsAmount: number}>}
 */
async function checkDriverCreditLimit(driverId, considerPendingSubmissions = false) {
  try {
    const driver = await db.Driver.findByPk(driverId);

    if (!driver) {
      return { 
        exceeded: false, 
        cashAtHand: 0, 
        creditLimit: 0, 
        canAcceptOrders: true,
        canUpdateOrders: true,
        pendingSubmissionsAmount: 0
      };
    }

    // Get cash at hand from driver record (source of truth)
    const cashAtHand = parseFloat(driver.cashAtHand) || 0;
    
    // Credit limit (default to 0 if not set, meaning no credit allowed)
    const creditLimit = parseFloat(driver.creditLimit) || 0;
    
    // If credit limit is 0, driver cannot have any cash at hand
    // If credit limit > 0, driver can have cash at hand up to the limit
    let effectiveCashAtHand = cashAtHand;
    let pendingSubmissionsAmount = 0;

    // If considering pending submissions, subtract them from cash at hand
    if (considerPendingSubmissions) {
      const pendingSubmissions = await db.CashSubmission.findAll({
        where: {
          driverId: driverId,
          status: 'pending'
        },
        attributes: ['amount']
      });

      pendingSubmissionsAmount = pendingSubmissions.reduce((sum, submission) => {
        return sum + (parseFloat(submission.amount) || 0);
      }, 0);

      effectiveCashAtHand = cashAtHand - pendingSubmissionsAmount;
    }
    
    // Driver has exceeded limit if cash at hand > credit limit
    // If credit limit is 0, any cash at hand > 0 means exceeded
    const exceeded = creditLimit > 0 ? cashAtHand > creditLimit : cashAtHand > 0;
    const effectiveExceeded = creditLimit > 0 ? effectiveCashAtHand > creditLimit : effectiveCashAtHand > 0;

    // Driver can accept orders only if current cash at hand is within limit (no pending submissions considered)
    const canAcceptOrders = !exceeded;
    
    // Driver can update orders if:
    // 1. Current cash at hand is within limit, OR
    // 2. Current cash at hand exceeds limit BUT pending submissions would bring them within limit (effective cash at hand after pending submissions is within limit), OR
    // 3. Current cash at hand exceeds limit BUT pending submissions would bring tentative balance to 0 or below (even if still technically exceeded)
    // 
    // Note: If considerPendingSubmissions is false, we only check current state
    // If considerPendingSubmissions is true, we check if pending submissions would help
    let canUpdateOrders;
    if (!considerPendingSubmissions) {
      // Not considering pending submissions - only check current state
      canUpdateOrders = !exceeded;
    } else {
      // Considering pending submissions - allow if current state is OK OR if pending submissions would bring them within limit OR if tentative balance is 0
      if (!exceeded) {
        // Already within limit - can update
        canUpdateOrders = true;
      } else {
        // Exceeds limit - check if pending submissions would bring them within limit OR if tentative balance is 0 or below
        // If tentative balance (effectiveCashAtHand) is 0 or below, allow updates even if submission is pending
        if (effectiveCashAtHand <= 0 && pendingSubmissionsAmount > 0) {
          // Tentative balance is 0 or below - driver has submitted enough to clear their balance
          canUpdateOrders = true;
        } else {
          // Check if pending submissions would bring them within limit
          canUpdateOrders = !effectiveExceeded && pendingSubmissionsAmount > 0;
        }
      }
    }

    return {
      exceeded,
      cashAtHand,
      effectiveCashAtHand,
      creditLimit,
      canAcceptOrders,
      canUpdateOrders,
      pendingSubmissionsAmount
    };
  } catch (error) {
    console.error(`❌ Error checking credit limit for driver ${driverId}:`, error);
    console.error(`   Stack:`, error.stack);
    // On error, BLOCK driver from accepting/updating orders (fail closed for security)
    // This ensures we don't accidentally allow drivers who exceed limits
    return { 
      exceeded: true, 
      cashAtHand: 0, 
      creditLimit: 0, 
      canAcceptOrders: false,
      canUpdateOrders: false,
      pendingSubmissionsAmount: 0,
      error: error.message
    };
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
    const creditCheck = await checkDriverCreditLimit(driver.id, false);
    if (!creditCheck.exceeded) {
      eligibleDrivers.push(driver);
    } else {
      console.log(`⚠️  Driver ${driver.name} (ID: ${driver.id}) has exceeded credit limit. Cash at Hand: ${creditCheck.cashAtHand}, Limit: ${creditCheck.creditLimit}`);
    }
  }

  return eligibleDrivers;
}

module.exports = {
  checkDriverCreditLimit,
  filterDriversByCreditLimit
};







