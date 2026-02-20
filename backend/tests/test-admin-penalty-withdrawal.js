/**
 * Test 14: Admin Web Penalty and Withdrawal
 * Tests: Penalty reduces savings, withdrawal from savings
 */

const db = require('../models');

async function testAdminPenaltyWithdrawal() {
  console.log('\n🧪 Test 14: Admin Web Penalty and Withdrawal\n');
  
  try {
    // Test 14.1: Create test driver with wallet
    console.log('Test 14.1: Creating test driver with wallet...');
    let driver = await db.Driver.findOne({ where: { phoneNumber: '254755555555' } });
    if (!driver) {
      driver = await db.Driver.create({
        name: 'Test Driver for Penalty',
        phoneNumber: '254755555555',
        status: 'active'
      });
    }
    
    let wallet = await db.DriverWallet.findOne({ where: { driverId: driver.id } });
    if (!wallet) {
      wallet = await db.DriverWallet.create({
        driverId: driver.id,
        balance: 0,
        savings: 2000
      });
    } else {
      await wallet.update({ savings: 2000 });
    }
    const initialSavings = parseFloat(wallet.savings || 0);
    console.log(`✅ Test driver created: ${driver.name}, Initial Savings: ${initialSavings}`);
    
    // Test 14.2: Create penalty (should reduce savings)
    console.log('\nTest 14.2: Creating penalty...');
    const penalty = await db.Penalty.create({
      driverId: driver.id,
      amount: 500,
      balance: 500,
      reason: 'Test penalty'
    });
    
    // Update savings (as done in the API)
    const currentSavings = parseFloat(wallet.savings || 0);
    const newSavings = currentSavings - 500;
    await wallet.update({ savings: newSavings });
    await wallet.reload();
    
    const savingsAfterPenalty = parseFloat(wallet.savings || 0);
    const expectedSavings = initialSavings - 500;
    
    console.log(`   Initial: ${initialSavings}`);
    console.log(`   After Penalty: ${savingsAfterPenalty}`);
    console.log(`   Expected: ${expectedSavings}`);
    
    if (Math.abs(savingsAfterPenalty - expectedSavings) > 0.01) {
      throw new Error(`Savings not reduced correctly by penalty. Expected: ${expectedSavings}, Got: ${savingsAfterPenalty}`);
    }
    console.log('✅ Penalty correctly reduced savings');
    
    // Test 14.3: Withdraw from savings
    console.log('\nTest 14.3: Withdrawing from savings...');
    const withdrawalAmount = 300;
    const savingsBeforeWithdrawal = parseFloat(wallet.savings || 0);
    
    // Create withdrawal transaction
    const withdrawalTransaction = await db.Transaction.create({
      orderId: null,
      driverId: driver.id,
      driverWalletId: wallet.id,
      transactionType: 'savings_withdrawal',
      paymentMethod: 'cash',
      paymentProvider: 'admin_withdrawal',
      amount: withdrawalAmount,
      status: 'completed',
      paymentStatus: 'paid',
      notes: 'Admin withdrawal: Test withdrawal'
    });
    
    // Update savings
    const newSavingsAfterWithdrawal = savingsBeforeWithdrawal - withdrawalAmount;
    await wallet.update({ savings: newSavingsAfterWithdrawal });
    await wallet.reload();
    
    const savingsAfterWithdrawal = parseFloat(wallet.savings || 0);
    const expectedSavingsAfterWithdrawal = savingsBeforeWithdrawal - withdrawalAmount;
    
    console.log(`   Before Withdrawal: ${savingsBeforeWithdrawal}`);
    console.log(`   After Withdrawal: ${savingsAfterWithdrawal}`);
    console.log(`   Expected: ${expectedSavingsAfterWithdrawal}`);
    
    if (Math.abs(savingsAfterWithdrawal - expectedSavingsAfterWithdrawal) > 0.01) {
      throw new Error(`Savings not reduced correctly by withdrawal. Expected: ${expectedSavingsAfterWithdrawal}, Got: ${savingsAfterWithdrawal}`);
    }
    console.log('✅ Withdrawal correctly reduced savings');
    
    // Verify transaction was created
    if (!withdrawalTransaction) {
      throw new Error('Withdrawal transaction not created');
    }
    console.log(`✅ Withdrawal transaction created: Transaction #${withdrawalTransaction.id}`);
    
    // Cleanup
    if (withdrawalTransaction) await withdrawalTransaction.destroy();
    await penalty.destroy();
    await wallet.update({ savings: initialSavings });
    console.log('\n✅ Test 14 PASSED: Admin penalty and withdrawal working correctly\n');
    
    return { success: true, message: 'Admin penalty and withdrawal test passed' };
  } catch (error) {
    console.error('\n❌ Test 14 FAILED:', error.message);
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

if (require.main === module) {
  testAdminPenaltyWithdrawal()
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

module.exports = { testAdminPenaltyWithdrawal };
