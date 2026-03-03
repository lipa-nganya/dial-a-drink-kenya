const db = require('../models');
const { applyStopDeduction } = require('../utils/walletCredits');

async function applyStopDeductionFor428() {
  try {
    console.log('Applying stop deduction for Order 428...');
    
    const result = await applyStopDeduction(428);
    
    console.log('\n=== RESULT ===');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.applied) {
      console.log(`\n✅ Stop deduction applied successfully!`);
      console.log(`   Amount: KES ${result.stopDeductionAmount}`);
      console.log(`   Savings before: KES ${result.savingsBefore}`);
      console.log(`   Savings after: KES ${result.savingsAfter}`);
      console.log(`   Transaction ID: ${result.transactionId}`);
    } else {
      console.log(`\n⚠️  Stop deduction not applied: ${result.reason}`);
      if (result.transactionId) {
        console.log(`   Existing transaction ID: ${result.transactionId}`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

applyStopDeductionFor428();
