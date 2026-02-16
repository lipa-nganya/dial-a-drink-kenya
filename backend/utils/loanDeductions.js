const db = require('../models');
const { Op } = require('sequelize');

/**
 * Process loan deductions for all drivers with negative savings
 * Loans and penalties are represented as negative savings - as long as savings is negative, loan recovery should happen
 * Penalties are treated as part of the loan and are recovered together with loans
 * This function should be called periodically (e.g., every 15 minutes)
 * 
 * For each driver with negative savings (which includes both loans and penalties):
 * - Reduce savings by loanDeductionAmount (makes it more negative, or less negative if close to zero)
 * - Increase driver cash at hand by loanDeductionAmount
 * - Create 2 transactions: savings_withdrawal and cash_settlement
 * - Both loans and penalties are recovered together from the total negative savings balance
 */
async function processLoanDeductions() {
  try {
    console.log('💰 Starting loan deduction processing...');
    console.log(`   Current time: ${new Date().toISOString()}`);
    
    // Get loan deduction settings
    const frequencySetting = await db.Settings.findOne({ 
      where: { key: 'loanDeductionFrequency' } 
    });
    const amountSetting = await db.Settings.findOne({ 
      where: { key: 'loanDeductionAmount' } 
    });
    
    console.log(`   Frequency setting:`, frequencySetting ? `Found (value: ${frequencySetting.value})` : 'NOT FOUND');
    console.log(`   Amount setting:`, amountSetting ? `Found (value: ${amountSetting.value})` : 'NOT FOUND');
    
    if (!frequencySetting || !amountSetting) {
      console.log('⚠️  Loan deduction settings not found. Skipping loan deductions.');
      return { processed: 0, errors: [] };
    }
    
    // Parse frequency - can be total minutes (number) or hours (legacy format)
    let deductionFrequencyMinutes = 0;
    const frequencyValue = frequencySetting.value;
    
    // Try to parse as JSON first (new format: {days, hours, minutes})
    try {
      const parsed = JSON.parse(frequencyValue);
      if (parsed && typeof parsed === 'object') {
        // New format: {days, hours, minutes}
        const days = parseInt(parsed.days || 0);
        const hours = parseInt(parsed.hours || 0);
        const minutes = parseInt(parsed.minutes || 0);
        deductionFrequencyMinutes = (days * 24 * 60) + (hours * 60) + minutes;
      } else if (typeof parsed === 'number') {
        // Total minutes as number
        deductionFrequencyMinutes = parsed;
      }
    } catch (e) {
      // Not JSON, try as number (could be hours in legacy format or total minutes)
      const numericValue = parseFloat(frequencyValue);
      if (!isNaN(numericValue)) {
        // If value is > 1000, assume it's already in minutes, otherwise assume hours (legacy)
        deductionFrequencyMinutes = numericValue > 1000 ? numericValue : numericValue * 60;
      }
    }
    
    // Default to 24 hours (1440 minutes) if invalid
    if (deductionFrequencyMinutes <= 0) {
      deductionFrequencyMinutes = 24 * 60; // 24 hours default
    }
    
    const deductionAmount = parseFloat(amountSetting.value) || 0;
    
    if (deductionAmount <= 0) {
      console.log(`⚠️  Loan deduction amount is 0 or invalid (${deductionAmount}). Skipping loan deductions.`);
      return { processed: 0, errors: [] };
    }
    
    const hours = Math.floor(deductionFrequencyMinutes / 60);
    const minutes = deductionFrequencyMinutes % 60;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    
    let frequencyDisplay = '';
    if (days > 0) frequencyDisplay += `${days} day${days > 1 ? 's' : ''} `;
    if (remainingHours > 0) frequencyDisplay += `${remainingHours} hour${remainingHours > 1 ? 's' : ''} `;
    if (minutes > 0) frequencyDisplay += `${minutes} minute${minutes > 1 ? 's' : ''}`;
    if (!frequencyDisplay) frequencyDisplay = '0 minutes';
    
    console.log(`   Settings: Frequency = ${frequencyDisplay.trim()} (${deductionFrequencyMinutes} minutes), Amount = KES ${deductionAmount.toFixed(2)}`);
    
    // Get all drivers with negative savings (these have loans)
    const driversWithLoans = await db.DriverWallet.findAll({
      where: {
        savings: {
          [Op.lt]: 0
        }
      },
      include: [{
        model: db.Driver,
        as: 'driver',
        attributes: ['id', 'name', 'phoneNumber', 'cashAtHand']
      }]
    });
    
    console.log(`   Found ${driversWithLoans.length} driver(s) with negative savings (have loans)`);
    
    if (driversWithLoans.length === 0) {
      console.log('✅ No drivers with loans (negative savings)');
      return { processed: 0, errors: [] };
    }
    
    const errors = [];
    let processedCount = 0;
    
    for (const wallet of driversWithLoans) {
      try {
        const dbTransaction = await db.sequelize.transaction();
        
        try {
          const driverId = wallet.driverId;
          const driver = wallet.driver;
          
          if (!driver) {
            throw new Error(`Driver ${driverId} not found`);
          }
          
          // Count how many loan recovery deductions have been made for this driver
          const previousDeductions = await db.Transaction.count({
            where: {
              driverId: driverId,
              transactionType: 'savings_withdrawal',
              paymentProvider: 'loan_recovery'
            },
            transaction: dbTransaction
          });
          const deductionNumber = previousDeductions + 1;
          
          // Current savings is negative (this is the loan amount)
          const currentSavings = parseFloat(wallet.savings || 0);
          const loanAmount = Math.abs(currentSavings); // The absolute value is the loan amount
          
          // Reduce savings by deduction amount (makes it more negative, or less negative if close to zero)
          const newSavings = currentSavings - deductionAmount;
          
          console.log(`   BEFORE UPDATE - Driver ${driverId}:`);
          console.log(`     Savings (loan): KES ${currentSavings.toFixed(2)} (loan amount: KES ${loanAmount.toFixed(2)})`);
          console.log(`     Cash at hand: KES ${parseFloat(driver.cashAtHand || 0).toFixed(2)}`);
          console.log(`     Deduction amount: KES ${deductionAmount.toFixed(2)}`);
          console.log(`     Deduction number: #${deductionNumber}`);
          
          await wallet.update({ savings: newSavings }, { transaction: dbTransaction });
          
          // Reload to verify update
          await wallet.reload({ transaction: dbTransaction });
          const verifiedSavings = parseFloat(wallet.savings || 0);
          console.log(`   ✅ Updated savings: KES ${currentSavings.toFixed(2)} → KES ${verifiedSavings.toFixed(2)} (expected: ${newSavings.toFixed(2)})`);
          
          // Create TWO transactions atomically - savings reduction and cash at hand increase
          const savingsNotes = `Loan Recovery #${deductionNumber} (KES ${deductionAmount.toFixed(2)})`;
          const cashNotes = `Loan Recovery #${deductionNumber} (KES ${deductionAmount.toFixed(2)})`;
          
          console.log(`   Creating 2 Loan Recovery transactions for Driver ${driverId}, deduction #${deductionNumber}:`);
          console.log(`     - Savings reduction: -KES ${deductionAmount.toFixed(2)}`);
          console.log(`     - Cash at hand increase: +KES ${deductionAmount.toFixed(2)}`);
          
          // Transaction 1: Savings withdrawal (reduces savings - makes it more negative)
          let savingsTx;
          try {
            savingsTx = await db.Transaction.create({
              orderId: null,
              driverId: driverId,
              driverWalletId: wallet.id,
              transactionType: 'savings_withdrawal',
              paymentMethod: 'cash',
              paymentProvider: 'loan_recovery',
              amount: -deductionAmount, // Negative amount for savings withdrawal
              status: 'completed',
              paymentStatus: 'paid',
              notes: savingsNotes
            }, { transaction: dbTransaction });
            console.log(`   ✅ Created Loan Recovery savings withdrawal transaction #${savingsTx.id}: -KES ${deductionAmount.toFixed(2)}`);
          } catch (txError) {
            console.error(`   ❌ Error creating Loan Recovery savings withdrawal transaction: ${txError.message}`);
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
            console.log(`   ✅ Created Loan Recovery cash at hand transaction #${cashTx.id}: +KES ${deductionAmount.toFixed(2)}`);
          } catch (cashTxError) {
            console.error(`   ❌ CRITICAL: Error creating Loan Recovery cash at hand transaction: ${cashTxError.message}`);
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
          
          console.log(`   ✅ Both Loan Recovery transactions created successfully:`);
          console.log(`     - Savings reduction #${savingsTx.id}: -KES ${deductionAmount.toFixed(2)}`);
          console.log(`     - Cash at hand increase #${cashTx.id}: +KES ${deductionAmount.toFixed(2)}`);
          
          // Update cash at hand (increase by deduction amount)
          const currentCashAtHand = parseFloat(driver.cashAtHand || 0);
          const newCashAtHand = currentCashAtHand + deductionAmount;
          await driver.update({ cashAtHand: newCashAtHand }, { transaction: dbTransaction });
          
          // Reload to verify update
          await driver.reload({ transaction: dbTransaction });
          const verifiedCashAtHand = parseFloat(driver.cashAtHand || 0);
          console.log(`   ✅ Updated cash at hand: KES ${currentCashAtHand.toFixed(2)} → KES ${verifiedCashAtHand.toFixed(2)} (expected: ${newCashAtHand.toFixed(2)})`);
          
          await dbTransaction.commit();
          processedCount++;
          
          console.log(`✅ Processed loan recovery deduction for Driver ${driverId} (deduction #${deductionNumber})`);
        } catch (error) {
          await dbTransaction.rollback();
          throw error;
        }
      } catch (error) {
        console.error(`❌ Error processing loan recovery for driver ${wallet.driverId}:`, error);
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

module.exports = {
  processLoanDeductions
};
