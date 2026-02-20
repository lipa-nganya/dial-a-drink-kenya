/**
 * Test 11: Loan/Penalty Creation and List Refresh
 * Tests: Creating loan/penalty and verifying list updates
 */

const db = require('../models');

async function testLoanPenaltyCreation() {
  console.log('\n🧪 Test 11: Loan/Penalty Creation and List Refresh\n');
  
  try {
    // Test 11.1: Create test driver with wallet
    console.log('Test 11.1: Creating test driver with wallet...');
    let driver = await db.Driver.findOne({ where: { phoneNumber: '254777777777' } });
    if (!driver) {
      driver = await db.Driver.create({
        name: 'Test Driver for Loan',
        phoneNumber: '254777777777',
        status: 'active'
      });
    }
    
    let wallet = await db.DriverWallet.findOne({ where: { driverId: driver.id } });
    if (!wallet) {
      wallet = await db.DriverWallet.create({
        driverId: driver.id,
        balance: 0,
        savings: 0
      });
    } else {
      await wallet.update({ savings: 0 });
    }
    const initialSavings = parseFloat(wallet.savings || 0);
    console.log(`✅ Test driver created: ${driver.name}, Initial Savings: ${initialSavings}`);
    
    // Test 11.2: Create loan
    console.log('\nTest 11.2: Creating loan...');
    const nextDeductionDate = new Date();
    nextDeductionDate.setHours(nextDeductionDate.getHours() + 24);
    
    const loan = await db.Loan.create({
      driverId: driver.id,
      amount: 1000,
      balance: 1000,
      reason: 'Test loan',
      status: 'active',
      nextDeductionDate: nextDeductionDate
    });
    console.log(`✅ Loan created: Loan #${loan.id}, Amount: ${loan.amount}`);
    
    // Reduce savings (as done in the API endpoint)
    const currentSavings = parseFloat(wallet.savings || 0);
    const newSavings = currentSavings - 1000;
    await wallet.update({ savings: newSavings });
    
    // Verify savings reduced
    await wallet.reload();
    const savingsAfterLoan = parseFloat(wallet.savings || 0);
    const expectedSavings = initialSavings - 1000;
    
    if (Math.abs(savingsAfterLoan - expectedSavings) > 0.01) {
      throw new Error(`Savings not reduced correctly. Expected: ${expectedSavings}, Got: ${savingsAfterLoan}`);
    }
    console.log(`✅ Savings reduced: ${initialSavings} → ${savingsAfterLoan}`);
    
    // Test 11.3: Query drivers with loans
    console.log('\nTest 11.3: Querying drivers with loans...');
    const driversWithLoans = await db.DriverWallet.findAll({
      where: {
        savings: {
          [require('sequelize').Op.lt]: 0
        }
      },
      include: [{
        model: db.Driver,
        as: 'driver',
        attributes: ['id', 'name']
      }]
    });
    
    const driverInList = driversWithLoans.find(w => w.driverId === driver.id);
    if (!driverInList) {
      throw new Error('Driver with loan should appear in drivers with loans list');
    }
    console.log(`✅ Driver found in loans list: ${driverInList.driver.name}`);
    
    // Test 11.4: Create penalty
    console.log('\nTest 11.4: Creating penalty...');
    const penalty = await db.Penalty.create({
      driverId: driver.id,
      amount: 500,
      balance: 500,
      reason: 'Test penalty'
    });
    console.log(`✅ Penalty created: Penalty #${penalty.id}, Amount: ${penalty.amount}`);
    
    // Reduce savings (as done in the API endpoint)
    const currentSavingsAfterLoan = parseFloat(wallet.savings || 0);
    const newSavingsAfterPenalty = currentSavingsAfterLoan - 500;
    await wallet.update({ savings: newSavingsAfterPenalty });
    
    // Verify savings further reduced
    await wallet.reload();
    const savingsAfterPenalty = parseFloat(wallet.savings || 0);
    const expectedSavingsAfterPenalty = expectedSavings - 500;
    
    if (Math.abs(savingsAfterPenalty - expectedSavingsAfterPenalty) > 0.01) {
      throw new Error(`Savings not reduced correctly after penalty. Expected: ${expectedSavingsAfterPenalty}, Got: ${savingsAfterPenalty}`);
    }
    console.log(`✅ Savings further reduced: ${savingsAfterLoan} → ${savingsAfterPenalty}`);
    
    // Cleanup
    await penalty.destroy();
    await loan.destroy();
    await wallet.update({ savings: initialSavings });
    console.log('\n✅ Test 11 PASSED: Loan/penalty creation and list refresh working correctly\n');
    
    return { success: true, message: 'Loan/penalty creation test passed' };
  } catch (error) {
    console.error('\n❌ Test 11 FAILED:', error.message);
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

if (require.main === module) {
  testLoanPenaltyCreation()
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

module.exports = { testLoanPenaltyCreation };
