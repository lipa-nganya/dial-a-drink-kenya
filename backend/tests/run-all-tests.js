/**
 * Run all tests sequentially
 */

const { testPosPaymentMethods } = require('./test-pos-payment-methods');
const { testAssignRider } = require('./test-assign-rider');
const { testCompletedOrdersFilter } = require('./test-completed-orders-filter');
const { testWalkinOrder } = require('./test-walkin-order');
const { testCancelledOrderStock } = require('./test-cancelled-order-stock');
const { testStaffPurchaseCashAtHand } = require('./test-staff-purchase-cash-at-hand');
const { testLoanPenaltyCreation } = require('./test-loan-penalty-creation');
const { testLoanDeductionAutomation } = require('./test-loan-deduction-automation');
const { testTransactionDescriptionFormatting } = require('./test-transaction-description-formatting');
const { testAdminPenaltyWithdrawal } = require('./test-admin-penalty-withdrawal');

const tests = [
  { name: 'POS Payment Methods', fn: testPosPaymentMethods },
  { name: 'Assign Rider', fn: testAssignRider },
  { name: 'Completed Orders Filter', fn: testCompletedOrdersFilter },
  { name: 'Walk-in Order', fn: testWalkinOrder },
  { name: 'Cancelled Order Stock', fn: testCancelledOrderStock },
  { name: 'Staff Purchase Cash at Hand', fn: testStaffPurchaseCashAtHand },
  { name: 'Loan/Penalty Creation', fn: testLoanPenaltyCreation },
  { name: 'Loan Deduction Automation', fn: testLoanDeductionAutomation },
  { name: 'Transaction Description Formatting', fn: testTransactionDescriptionFormatting },
  { name: 'Admin Penalty and Withdrawal', fn: testAdminPenaltyWithdrawal }
];

async function runAllTests() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🧪 RUNNING ALL TESTS');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const results = [];
  
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(`\n[${i + 1}/${tests.length}] Running: ${test.name}`);
    console.log('─────────────────────────────────────────────────────────');
    
    try {
      const result = await test.fn();
      results.push({ name: test.name, success: result.success, error: result.error });
      
      if (result.success) {
        console.log(`✅ ${test.name}: PASSED`);
      } else {
        console.log(`❌ ${test.name}: FAILED - ${result.error}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: FAILED - ${error.message}`);
      results.push({ name: test.name, success: false, error: error.message });
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  results.forEach((result, index) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${index + 1}. ${result.name}: ${status}`);
    if (!result.success) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  console.log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed`);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
