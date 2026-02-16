// Test script to manually trigger loan deductions
const { processLoanDeductions } = require('./utils/loanDeductions');

async function testLoanDeductions() {
  console.log('🧪 Testing loan deduction processing...');
  try {
    const result = await processLoanDeductions();
    console.log('✅ Test completed:', result);
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testLoanDeductions();
