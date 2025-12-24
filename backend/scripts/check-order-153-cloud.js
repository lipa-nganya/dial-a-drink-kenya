/**
 * Check Order 153 on cloud database via API
 */

const https = require('https');

const checkOrder153 = () => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'dialadrink-backend-910510650031.us-central1.run.app',
      path: '/api/mpesa/transaction-status/153',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('Order 153 Transaction Status:');
          console.log(JSON.stringify(json, null, 2));
          resolve(json);
        } catch (e) {
          console.error('Error parsing response:', e);
          console.log('Raw response:', data);
          reject(e);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });

    req.end();
  });
};

checkOrder153().catch(console.error);













