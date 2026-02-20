/**
 * Test 12: Loan Deduction Automation
 * Tests: Auto-deduct 150 every 24 hours, create Savings Recovery transaction
 */

const db = require('../models');
const { processLoanDeductions } = require('../utils/loanDeductions');

async function testLoanDeductionAutomation() {
  console.log('\n🧪 Test 12: Loan Deduction Automation\n');
  
  try {
    // Test 12.1: Create test driver with wallet and loan
    console.log('Test 12.1: Creating test driver with loan...');
    let driver = await db.Driver.findOne({ where: { phoneNumber: '254766666666' } });
    if (!driver) {
      driver = await db.Driver.create({
        name: 'Test Driver for Deduction',
        phoneNumber: '254766666666',
        status: 'active',
        cashAtHand: 0
      });
    } else {
      await driver.update({ cashAtHand: 0 });
    }
    
    let wallet = await db.DriverWallet.findOne({ where: { driverId: driver.id } });
    if (!wallet) {
      wallet = await db.DriverWallet.create({
        driverId: driver.id,
        balance: 0,
        savings: -1000 // Negative savings = loan
      });
    } else {
      await wallet.update({ savings: -1000 });
    }
    
    const initialSavings = parseFloat(wallet.savings || 0);
    const initialCashAtHand = parseFloat(driver.cashAtHand || 0);
    
    // Create loan with nextDeductionDate in the past (ready for deduction)
    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 1); // 1 hour ago
    
    const loan = await db.Loan.create({
      driverId: driver.id,
      amount: 1000,
      balance: 1000,
      reason: 'Test loan for deduction',
      status: 'active',
      nextDeductionDate: pastDate
    });
    
    console.log(`✅ Test setup complete:`);
    console.log(`   Driver: ${driver.name}`);
    console.log(`   Initial Savings: ${initialSavings}`);
    console.log(`   Initial Cash at Hand: ${initialCashAtHand}`);
    console.log(`   Loan Balance: ${loan.balance}`);
    console.log(`   Next Deduction Date: ${loan.nextDeductionDate}`);
    
    // Test 12.2: Process loan deductions
    console.log('\nTest 12.2: Processing loan deductions...');
    const result = await processLoanDeductions();
    console.log(`✅ Deduction processing result:`, result);
    
    if (result.processed === 0) {
      throw new Error('No loans were processed');
    }
    
    // Test 12.3: Verify savings reduced by 150
    console.log('\nTest 12.3: Verifying savings reduction...');
    await wallet.reload();
    const newSavings = parseFloat(wallet.savings || 0);
    const expectedSavings = initialSavings - 150;
    
    console.log(`   Initial: ${initialSavings}`);
    console.log(`   New: ${newSavings}`);
    console.log(`   Expected: ${expectedSavings}`);
    
    if (Math.abs(newSavings - expectedSavings) > 0.01) {
      throw new Error(`Savings not reduced correctly. Expected: ${expectedSavings}, Got: ${newSavings}`);
    }
    console.log('✅ Savings correctly reduced by 150');
    
    // Test 12.4: Verify cash at hand increased by 150
    console.log('\nTest 12.4: Verifying cash at hand increase...');
    await driver.reload();
    const newCashAtHand = parseFloat(driver.cashAtHand || 0);
    const expectedCashAtHand = initialCashAtHand + 150;
    
    console.log(`   Initial: ${initialCashAtHand}`);
    console.log(`   New: ${newCashAtHand}`);
    console.log(`   Expected: ${expectedCashAtHand}`);
    
    if (Math.abs(newCashAtHand - expectedCashAtHand) > 0.01) {
      throw new Error(`Cash at hand not increased correctly. Expected: ${expectedCashAtHand}, Got: ${newCashAtHand}`);
    }
    console.log('✅ Cash at hand correctly increased by 150');
    
    // Test 12.5: Verify Savings Recovery transactions created
    console.log('\nTest 12.5: Verifying Savings Recovery transactions...');
    const savingsTx = await db.Transaction.findOne({
      where: {
        driverId: driver.id,
        transactionType: 'savings_withdrawal',
        paymentProvider: 'savings_recovery'
      }
    });
    
    const cashTx = await db.Transaction.findOne({
      where: {
        driverId: driver.id,
        transactionType: 'cash_settlement',
        paymentProvider: 'savings_recovery'
      }
    });
    
    if (!savingsTx) {
      throw new Error('Savings withdrawal transaction not created');
    }
    if (!cashTx) {
      throw new Error('Cash settlement transaction not created');
    }
    
    console.log(`✅ Savings Recovery transactions created:`);
    console.log(`   Savings Withdrawal: Transaction #${savingsTx.id}, Amount: ${savingsTx.amount}`);
    console.log(`   Cash Settlement: Transaction #${cashTx.id}, Amount: ${cashTx.amount}`);
    
    // Test 12.6: Verify loan balance reduced
    console.log('\nTest 12.6: Verifying loan balance reduction...');
    await loan.reload();
    const newBalance = parseFloat(loan.balance || 0);
    const expectedBalance = 1000 - 150;
    
    if (Math.abs(newBalance - expectedBalance) > 0.01) {
      throw new Error(`Loan balance not reduced correctly. Expected: ${expectedBalance}, Got: ${newBalance}`);
    }
    console.log(`✅ Loan balance reduced: 1000 → ${newBalance}`);
    
    // Cleanup
    if (savingsTx) await savingsTx.destroy();
    if (cashTx) await cashTx.destroy();
    await loan.destroy();
    await wallet.update({ savings: 0 });
    await driver.update({ cashAtHand: 0 });
    console.log('\n✅ Test 12 PASSED: Loan deduction automation working correctly\n');
    
    return { success: true, message: 'Loan deduction automation test passed' };
  } catch (error) {
    console.error('\n❌ Test 12 FAILED:', error.message);
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

if (require.main === module) {
  testLoanDeductionAutomation()
    .then(result => {
      if (result.success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { testLoanDeductionAutomation };
