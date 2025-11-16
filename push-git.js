const { execSync } = require('child_process');
const fs = require('fs');

console.log('=== Git Push Script ===\n');

try {
  process.chdir('/Users/maria/dial-a-drink');
  
  console.log('1. Checking git status...');
  const status = execSync('git status', { encoding: 'utf-8' });
  console.log(status);
  
  console.log('\n2. Adding files...');
  execSync('git add backend/routes/admin.js backend/routes/mpesa.js admin-frontend/src/pages/Transactions.js admin-frontend/src/pages/AdminOverview.js admin-frontend/src/utils/chipStyles.js', { encoding: 'utf-8' });
  console.log('Files added');
  
  console.log('\n3. Checking staged files...');
  const staged = execSync('git status --short', { encoding: 'utf-8' });
  console.log(staged);
  
  console.log('\n4. Committing...');
  const commitMsg = `Fix: Transaction type display and STK push for Cloud Run

- Add transaction type normalization in backend endpoints
- Fix frontend transaction type display with proper fallbacks
- Fix STK push to detect Cloud Run and send real payments
- Ensure all transactions display proper types`;
  
  execSync(`git commit -m "${commitMsg}"`, { encoding: 'utf-8' });
  console.log('Commit successful');
  
  console.log('\n5. Pushing to GitHub...');
  const pushOutput = execSync('git push origin main', { encoding: 'utf-8' });
  console.log(pushOutput);
  
  console.log('\n6. Latest commit:');
  const log = execSync('git log --oneline -1', { encoding: 'utf-8' });
  console.log(log);
  
  console.log('\n✅ SUCCESS: Changes pushed to GitHub!');
  
} catch (error) {
  console.error('\n❌ ERROR:', error.message);
  if (error.stdout) console.error('STDOUT:', error.stdout);
  if (error.stderr) console.error('STDERR:', error.stderr);
  process.exit(1);
}



