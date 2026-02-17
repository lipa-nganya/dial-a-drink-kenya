const db = require('../models');
const { Op } = require('sequelize');

/**
 * Process loan deductions for all active loans
 * Every 24 hours from when a loan was added, deduct 150 from savings and increase cash at hand by 150
 * Creates "Savings Recovery" transactions
 * This function should be called periodically (e.g., every 15 minutes)
 */
async function processLoanDeductions() {
  try {
    console.log('💰 Starting loan deduction processing...');
    console.log(`   Current time: ${new Date().toISOString()}`);
    
    const deductionAmount = 150; // Fixed amount: 150 KES
    const deductionIntervalHours = 24; // Fixed interval: 24 hours
    
    // Get all active loans where nextDeductionDate has passed
    const now = new Date();
    const activeLoans = await db.Loan.findAll({
      where: {
        status: 'active',
        nextDeductionDate: {
          [Op.lte]: now // Next deduction date has passed
        }
      },
      include: [{
        model: db.Driver,
        as: 'driver',
        attributes: ['id', 'name', 'phoneNumber', 'cashAtHand'],
        required: true
      }],
      order: [['nextDeductionDate', 'ASC']]
    });
    
    console.log(`   Found ${activeLoans.length} active loan(s) ready for deduction`);
    
    if (activeLoans.length === 0) {
      console.log('✅ No loans ready for deduction');
      return { processed: 0, errors: [] };
    }
    
    const errors = [];
    let processedCount = 0;
    
    for (const loan of activeLoans) {
      try {
        const dbTransaction = await db.sequelize.transaction();
        
        try {
          const driverId = loan.driverId;
          const driver = loan.driver;
          
          if (!driver) {
            throw new Error(`Driver ${driverId} not found`);
          }
          
          // Get or create driver wallet
          let wallet = await db.DriverWallet.findOne({
            where: { driverId: driverId },
            transaction: dbTransaction
          });
          
          if (!wallet) {
            wallet = await db.DriverWallet.create({
              driverId: driverId,
              balance: 0,
              totalTipsReceived: 0,
              totalTipsCount: 0,
              totalDeliveryPay: 0,
              totalDeliveryPayCount: 0,
              savings: 0
            }, { transaction: dbTransaction });
          }
          
          // Current savings
          const currentSavings = parseFloat(wallet.savings || 0);
          
          // Reduce savings by deduction amount (150)
          const newSavings = currentSavings - deductionAmount;
          
          // Current cash at hand
          const currentCashAtHand = parseFloat(driver.cashAtHand || 0);
          const newCashAtHand = currentCashAtHand + deductionAmount;
          
          console.log(`   BEFORE UPDATE - Loan #${loan.id}, Driver ${driverId}:`);
          console.log(`     Loan balance: KES ${parseFloat(loan.balance || 0).toFixed(2)}`);
          console.log(`     Savings: KES ${currentSavings.toFixed(2)} → KES ${newSavings.toFixed(2)}`);
          console.log(`     Cash at hand: KES ${currentCashAtHand.toFixed(2)} → KES ${newCashAtHand.toFixed(2)}`);
          console.log(`     Deduction amount: KES ${deductionAmount.toFixed(2)}`);
          
          // Update wallet savings
          await wallet.update({ savings: newSavings }, { transaction: dbTransaction });
          
          // Update driver cash at hand
          await driver.update({ cashAtHand: newCashAtHand }, { transaction: dbTransaction });
          
          // Update loan balance
          const newBalance = Math.max(0, parseFloat(loan.balance || 0) - deductionAmount);
          const loanStatus = newBalance <= 0 ? 'paid_off' : 'active';
          
          // Calculate next deduction date (24 hours from now)
          const nextDeductionDate = new Date();
          nextDeductionDate.setHours(nextDeductionDate.getHours() + deductionIntervalHours);
          
          await loan.update({
            balance: newBalance,
            status: loanStatus,
            nextDeductionDate: loanStatus === 'active' ? nextDeductionDate : null
          }, { transaction: dbTransaction });
          
          // Create TWO transactions atomically - savings reduction and cash at hand increase
          const savingsNotes = `Savings Recovery - Loan #${loan.id} (KES ${deductionAmount.toFixed(2)})`;
          const cashNotes = `Savings Recovery - Loan #${loan.id} (KES ${deductionAmount.toFixed(2)})`;
          
          console.log(`   Creating 2 Savings Recovery transactions for Loan #${loan.id}, Driver ${driverId}:`);
          console.log(`     - Savings reduction: -KES ${deductionAmount.toFixed(2)}`);
          console.log(`     - Cash at hand increase: +KES ${deductionAmount.toFixed(2)}`);
          
          // Transaction 1: Savings withdrawal (reduces savings)
          let savingsTx;
          try {
            savingsTx = await db.Transaction.create({
              orderId: null,
              driverId: driverId,
              driverWalletId: wallet.id,
              transactionType: 'savings_withdrawal',
              paymentMethod: 'cash',
              paymentProvider: 'savings_recovery',
              amount: -deductionAmount, // Negative amount for savings withdrawal
              status: 'completed',
              paymentStatus: 'paid',
              notes: savingsNotes
            }, { transaction: dbTransaction });
            console.log(`   ✅ Created Savings Recovery savings withdrawal transaction #${savingsTx.id}: -KES ${deductionAmount.toFixed(2)}`);
          } catch (txError) {
            console.error(`   ❌ Error creating Savings Recovery savings withdrawal transaction: ${txError.message}`);
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
              paymentProvider: 'savings_recovery',
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
          console.log(`     - Savings reduction #${savingsTx.id}: -KES ${deductionAmount.toFixed(2)}`);
          console.log(`     - Cash at hand increase #${cashTx.id}: +KES ${deductionAmount.toFixed(2)}`);
          console.log(`     - Loan balance: KES ${parseFloat(loan.balance || 0).toFixed(2)} → KES ${newBalance.toFixed(2)}`);
          if (loanStatus === 'paid_off') {
            console.log(`     - Loan #${loan.id} marked as paid off`);
          } else {
            console.log(`     - Next deduction scheduled for: ${nextDeductionDate.toISOString()}`);
          }
          
          await dbTransaction.commit();
          processedCount++;
          
          console.log(`✅ Processed Savings Recovery deduction for Loan #${loan.id}, Driver ${driverId}`);
        } catch (error) {
          await dbTransaction.rollback();
          throw error;
        }
      } catch (error) {
        console.error(`❌ Error processing Savings Recovery for loan ${loan.id} (driver ${loan.driverId}):`, error);
        errors.push({
          loanId: loan.id,
          driverId: loan.driverId,
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
