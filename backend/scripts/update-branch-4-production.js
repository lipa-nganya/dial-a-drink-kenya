/**
 * Update branch 4 address in production via API
 * This script calls the production API to update branch 4 address
 * 
 * Usage: node backend/scripts/update-branch-4-production.js [admin-token]
 * 
 * If admin-token is not provided, the script will attempt to update via the API
 * without authentication (if the endpoint allows it)
 */
const https = require('https');

const PRODUCTION_API_URL = process.env.PRODUCTION_API_URL || 'https://deliveryos-backend-p6bkgryxqa-uc.a.run.app';
const BRANCH_ID = 4;
const NEW_ADDRESS = 'Taveta Shopping Mall - M 48, Taveta Shopping Mall, Taveta Road, Nairobi';

async function updateBranchAddress() {
  const adminToken = process.argv[2];
  
  const url = `${PRODUCTION_API_URL}/api/branches/${BRANCH_ID}`;
  const data = JSON.stringify({
    address: NEW_ADDRESS
  });

  const options = {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  // Add auth header if token provided
  if (adminToken) {
    options.headers['Authorization'] = `Bearer ${adminToken}`;
  }

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'PUT',
      headers: options.headers
    }, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const result = JSON.parse(body);
            console.log(`✅ Successfully updated branch ${BRANCH_ID}:`);
            console.log(`   Address: ${result.address}`);
            resolve(result);
          } catch (e) {
            console.log(`✅ Branch updated (non-JSON response): ${body}`);
            resolve(body);
          }
        } else {
          console.error(`❌ Error updating branch: ${res.statusCode}`);
          console.error(`   Response: ${body}`);
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error(`❌ Request error: ${error.message}`);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

console.log(`🔄 Updating branch ${BRANCH_ID} address in production...`);
console.log(`   API URL: ${PRODUCTION_API_URL}`);
console.log(`   New Address: ${NEW_ADDRESS}`);
console.log('');

updateBranchAddress()
  .then(() => {
    console.log('');
    console.log('✅ Update completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('❌ Update failed:', error.message);
    console.error('');
    console.error('💡 Tip: If authentication is required, run with:');
    console.error(`   node backend/scripts/update-branch-4-production.js YOUR_ADMIN_TOKEN`);
    process.exit(1);
  });
