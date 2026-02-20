const db = require('../models');
const { Op } = require('sequelize');

/**
 * Format date and time in EAT (East Africa Time) timezone
 * EAT is UTC+3 (Africa/Nairobi)
 */
function formatEATDateTime(date = new Date()) {
  try {
    // Convert to EAT timezone (Africa/Nairobi, UTC+3)
    const options = {
      timeZone: 'Africa/Nairobi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    
    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    const hour = parts.find(p => p.type === 'hour').value;
    const minute = parts.find(p => p.type === 'minute').value;
    const second = parts.find(p => p.type === 'second').value;
    
    return `${year}-${month}-${day} ${hour}:${minute}:${second} EAT`;
  } catch (error) {
    // Fallback to simple formatting if Intl.DateTimeFormat fails
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hours = String((d.getUTCHours() + 3) % 24).padStart(2, '0'); // EAT is UTC+3
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    const seconds = String(d.getUTCSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} EAT`;
  }
}

/**
 * Get loan deduction settings from database
 * Returns { amount, frequencyInMs } with defaults if not set
 */
async function getLoanDeductionSettings() {
  try {
    // Get deduction amount
    const amountSetting = await db.Settings.findOne({ where: { key: 'loanDeductionAmount' } });
    const deductionAmount = amountSetting?.value ? parseFloat(amountSetting.value) : 150; // Default: 150 KES
    
    // Get deduction frequency
    const frequencySetting = await db.Settings.findOne({ where: { key: 'loanDeductionFrequency' } });
    let frequencyInMs = 24 * 60 * 60 * 1000; // Default: 24 hours in milliseconds
    
    if (frequencySetting?.value) {
      try {
        const frequency = JSON.parse(frequencySetting.value);
        const days = parseInt(frequency.days || 0);
        const hours = parseInt(frequency.hours || 0);
        const minutes = parseInt(frequency.minutes || 0);
        
        // Convert to milliseconds
        frequencyInMs = (days * 24 * 60 * 60 * 1000) + 
                        (hours * 60 * 60 * 1000) + 
                        (minutes * 60 * 1000);
        
        // Ensure minimum of 1 minute
        if (frequencyInMs < 60000) {
          frequencyInMs = 60000;
        }
      } catch (parseError) {
        console.warn('⚠️ Error parsing loan deduction frequency, using default:', parseError.message);
      }
    }
    
    return { deductionAmount, frequencyInMs };
  } catch (error) {
    console.warn('⚠️ Error fetching loan deduction settings, using defaults:', error.message);
    return { 
      deductionAmount: 150, 
      frequencyInMs: 24 * 60 * 60 * 1000 // 24 hours
    };
  }
}

/**
 * Calculate next deduction date based on frequency settings
 */
function calculateNextDeductionDate(frequencyInMs) {
  const nextDate = new Date();
  nextDate.setTime(nextDate.getTime() + frequencyInMs);
  return nextDate;
}

/**
 * Process loan deductions based on negative savings
 * NEW LOGIC: Loans/penalties are immediately applied to savings (negative savings = loan)
 * When savings is negative, reduce savings by deduction amount and increase cash at hand
 * Uses loan settings for deduction amount and frequency
 * Creates "Loan Recovery" transactions
 * This function should be called periodically (e.g., every 15 minutes)
 */
async function processLoanDeductions() {
  try {
    console.log('💰 Starting loan deduction processing (based on negative savings)...');
    console.log(`   Current time: ${new Date().toISOString()}`);
    
    // Get loan deduction settings
    const { deductionAmount, frequencyInMs } = await getLoanDeductionSettings();
    const frequencyHours = frequencyInMs / (60 * 60 * 1000);
    
    console.log(`   Loan deduction settings: Amount=KES ${deductionAmount.toFixed(2)}, Frequency=${frequencyHours.toFixed(2)} hours`);
    
    const now = new Date();
    
    // Get all drivers with negative savings (they have loans/penalties)
    const walletsWithNegativeSavings = await db.DriverWallet.findAll({
      where: {
        savings: {
          [Op.lt]: 0 // Savings is negative (loan/penalty exists)
        }
      },
      include: [{
        model: db.Driver,
        as: 'driver',
        attributes: ['id', 'name', 'phoneNumber', 'cashAtHand'],
        required: true
      }]
    });
    
    console.log(`   Found ${walletsWithNegativeSavings.length} driver(s) with negative savings`);
    
    if (walletsWithNegativeSavings.length === 0) {
      console.log('✅ No drivers with negative savings (no loans/penalties to process)');
      return { processed: 0, errors: [] };
    }
    
    // Get active loans to check nextDeductionDate (for timing control)
    const activeLoans = await db.Loan.findAll({
      where: {
        status: 'active',
        [Op.or]: [
          { nextDeductionDate: { [Op.lte]: now } }, // Next deduction date has passed
          { nextDeductionDate: null } // No deduction date set yet (legacy loans or needs setup)
        ]
      },
      attributes: ['id', 'driverId', 'nextDeductionDate', 'reason']
    });
    
    // Create a map of driver IDs that are ready for deduction (have active loans with passed nextDeductionDate)
    const readyDriverIds = new Set(activeLoans.map(loan => loan.driverId));
    
    // Filter to only process drivers with negative savings AND ready for deduction
    const walletsToProcess = walletsWithNegativeSavings.filter(wallet => 
      readyDriverIds.has(wallet.driverId)
    );
    
    console.log(`   Found ${walletsToProcess.length} driver(s) ready for deduction (negative savings + active loan with passed nextDeductionDate)`);
    
    if (walletsToProcess.length === 0) {
      console.log('✅ No drivers ready for deduction');
      return { processed: 0, errors: [] };
    }
    
    const errors = [];
    let processedCount = 0;
    
    for (const wallet of walletsToProcess) {
      try {
        const dbTransaction = await db.sequelize.transaction();
        
        try {
          const driverId = wallet.driverId;
          const driver = wallet.driver;
          
          if (!driver) {
            throw new Error(`Driver ${driverId} not found`);
          }
          
          // Current savings (should be negative)
          const currentSavings = parseFloat(wallet.savings || 0);
          
          if (currentSavings >= 0) {
            console.log(`   ⚠️ Skipping driver ${driverId} - savings is not negative (KES ${currentSavings.toFixed(2)})`);
            await dbTransaction.rollback();
            continue;
          }
          
          // Increase savings by deduction amount (making it less negative, moving towards 0)
          // This recovers the loan - savings moves from negative towards 0
          const newSavings = currentSavings + deductionAmount;
          
          // Current cash at hand
          const currentCashAtHand = parseFloat(driver.cashAtHand || 0);
          const newCashAtHand = currentCashAtHand + deductionAmount;
          
          // Find the active loan for this driver (for logging and updating nextDeductionDate)
          const activeLoan = activeLoans.find(loan => loan.driverId === driverId);
          const loanId = activeLoan?.id || 'N/A';
          
          console.log(`   BEFORE UPDATE - Driver ${driverId} (Loan #${loanId}):`);
          console.log(`     Savings: KES ${currentSavings.toFixed(2)} → KES ${newSavings.toFixed(2)}`);
          console.log(`     Cash at hand: KES ${currentCashAtHand.toFixed(2)} → KES ${newCashAtHand.toFixed(2)}`);
          console.log(`     Deduction amount: KES ${deductionAmount.toFixed(2)}`);
          
          // Update wallet savings
          await wallet.update({ savings: newSavings }, { transaction: dbTransaction });
          
          // Update driver cash at hand
          await driver.update({ cashAtHand: newCashAtHand }, { transaction: dbTransaction });
          
          // Update loan status and nextDeductionDate if loan exists
          if (activeLoan) {
            // If savings is now positive or zero, mark loan as paid off
            const loanStatus = newSavings >= 0 ? 'paid_off' : 'active';
            const nextDeductionDate = loanStatus === 'active' ? calculateNextDeductionDate(frequencyInMs) : null;
            
            await activeLoan.update({
              status: loanStatus,
              nextDeductionDate: nextDeductionDate,
              balance: 0 // No longer tracking balance - set to 0
            }, { transaction: dbTransaction });
            
            if (loanStatus === 'paid_off') {
              console.log(`     - Loan #${activeLoan.id} marked as paid off (savings is now positive)`);
            } else {
              console.log(`     - Next deduction scheduled for: ${nextDeductionDate?.toISOString()}`);
            }
          }
          
          // Create TWO transactions atomically - savings increase and cash at hand increase
          const transactionTime = new Date();
          const eatDateTime = formatEATDateTime(transactionTime);
          const savingsNotes = `Savings Recovery (KES ${deductionAmount.toFixed(2)}) - ${eatDateTime}`;
          const cashNotes = `Savings Recovery (KES ${deductionAmount.toFixed(2)}) - ${eatDateTime}`;
          
          console.log(`   Creating 2 Savings Recovery transactions for Driver ${driverId}:`);
          console.log(`     - Savings increase: +KES ${deductionAmount.toFixed(2)} (moving towards 0)`);
          console.log(`     - Cash at hand increase: +KES ${deductionAmount.toFixed(2)}`);
          
          // Transaction 1: Savings credit (increases savings - recovers loan)
          let savingsTx;
          try {
            savingsTx = await db.Transaction.create({
              orderId: null,
              driverId: driverId,
              driverWalletId: wallet.id,
              transactionType: 'savings_withdrawal', // Using same type for consistency
              paymentMethod: 'cash',
              paymentProvider: 'loan_recovery',
              amount: deductionAmount, // Positive amount - increases savings (makes it less negative)
              status: 'completed',
              paymentStatus: 'paid',
              notes: savingsNotes
            }, { transaction: dbTransaction });
            console.log(`   ✅ Created Savings Recovery credit transaction #${savingsTx.id}: +KES ${deductionAmount.toFixed(2)} (savings increases)`);
          } catch (txError) {
            console.error(`   ❌ Error creating Savings Recovery credit transaction: ${txError.message}`);
            console.error(`   Stack: ${txError.stack}`);
            throw txError; // Re-throw to trigger rollback
          }
          
          // Transaction 2: Cash at hand increase (increases cash at hand)
          let cashTx;
          try {
            cashTx = await db.Transaction.create({
              orderId: null,
              driverId: driverId,
              driverWalletId: wallet.id,
              transactionType: 'cash_settlement',
              paymentMethod: 'cash',
              paymentProvider: 'loan_recovery',
              amount: deductionAmount, // Positive amount for cash at hand increase
              status: 'completed',
              paymentStatus: 'paid',
              notes: cashNotes
            }, { transaction: dbTransaction });
            console.log(`   ✅ Created Savings Recovery cash at hand transaction #${cashTx.id}: +KES ${deductionAmount.toFixed(2)}`);
          } catch (cashTxError) {
            console.error(`   ❌ CRITICAL: Error creating Savings Recovery cash at hand transaction: ${cashTxError.message}`);
            console.error(`   Stack: ${cashTxError.stack}`);
            console.error(`   Transaction details:`, {
              driverId: driverId,
              driverWalletId: wallet.id,
              amount: deductionAmount,
              notes: cashNotes,
              savingsTxId: savingsTx?.id
            });
            throw cashTxError; // Re-throw to trigger rollback of all transactions
          }
          
          // Verify both transactions were created
          if (!savingsTx || !cashTx) {
            throw new Error(`Failed to create both transactions: savingsTx=${!!savingsTx}, cashTx=${!!cashTx}`);
          }
          
          console.log(`   ✅ Both Savings Recovery transactions created successfully:`);
          console.log(`     - Savings increase #${savingsTx.id}: +KES ${deductionAmount.toFixed(2)}`);
          console.log(`     - Cash at hand increase #${cashTx.id}: +KES ${deductionAmount.toFixed(2)}`);
          console.log(`     - New savings: KES ${newSavings.toFixed(2)} (was KES ${currentSavings.toFixed(2)})`);
          
          await dbTransaction.commit();
          processedCount++;
          
          console.log(`✅ Processed Loan Recovery deduction for Driver ${driverId}`);
        } catch (error) {
          await dbTransaction.rollback();
          throw error;
        }
      } catch (error) {
        console.error(`❌ Error processing Loan Recovery for driver ${wallet.driverId}:`, error);
        errors.push({
          driverId: wallet.driverId,
          error: error.message
        });
      }
    }
    
    console.log(`✅ Loan deduction processing complete: ${processedCount} processed, ${errors.length} errors`);
    return { processed: processedCount, errors };
  } catch (error) {
    console.error('❌ Error in processLoanDeductions:', error);
    return { processed: 0, errors: [{ error: error.message }] };
  }
}

/**
 * Process penalty deductions based on negative savings
 * NEW LOGIC: Penalties are immediately applied to savings (negative savings = penalty)
 * Since penalties create penalty loans, they are handled by the loan deduction process
 * This function is kept for backward compatibility but penalties are now processed via loans
 * This function now returns empty (penalties handled by processLoanDeductions)
 */
async function processPenaltyDeductions() {
  try {
    console.log('💰 Starting penalty deduction processing...');
    console.log(`   Current time: ${new Date().toISOString()}`);
    console.log(`   ℹ️ Penalties are now handled by the loan deduction process (penalties create penalty loans)`);
    console.log(`   ✅ No separate penalty processing needed`);
    return { processed: 0, errors: [] };
  } catch (error) {
    console.error('❌ Error in processPenaltyDeductions:', error);
    return { processed: 0, errors: [{ error: error.message }] };
  }
}

module.exports = {
  processLoanDeductions,
  processPenaltyDeductions,
  getLoanDeductionSettings,
  calculateNextDeductionDate
};
