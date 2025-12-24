const { Client } = require('pg');

async function createWalletForDriver(driverId) {
  const client = new Client({
    host: '136.111.27.173',
    port: 5432,
    database: 'dialadrink',
    user: 'dialadrink_app',
    password: 'Thewayofthew0lf',
    ssl: {
      rejectUnauthorized: false // Cloud SQL uses self-signed certificates
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Cloud SQL');

    // Check if driver exists
    const driverCheck = await client.query('SELECT id, name FROM drivers WHERE id = $1', [driverId]);
    if (driverCheck.rows.length === 0) {
      console.error(`❌ Driver with ID ${driverId} does NOT exist in the database`);
      process.exit(1);
    }
    console.log(`✅ Found driver: ${driverCheck.rows[0].name} (ID: ${driverId})`);

    // Check if wallet already exists
    const walletCheck = await client.query('SELECT id, "driverId", balance FROM driver_wallets WHERE "driverId" = $1', [driverId]);
    if (walletCheck.rows.length > 0) {
      console.log(`⚠️  Wallet already exists for driver ID ${driverId}`);
      console.log(`   Wallet ID: ${walletCheck.rows[0].id}`);
      console.log(`   Balance: KES ${parseFloat(walletCheck.rows[0].balance || 0).toFixed(2)}`);
      return;
    }

    // Create wallet
    const result = await client.query(`
      INSERT INTO driver_wallets ("driverId", balance, "totalTipsReceived", "totalTipsCount", "totalDeliveryPay", "totalDeliveryPayCount", "createdAt", "updatedAt")
      VALUES ($1, 0, 0, 0, 0, 0, NOW(), NOW())
      RETURNING id, "driverId", balance
    `, [driverId]);

    console.log(`✅ Created wallet for driver ID ${driverId}`);
    console.log(`   Wallet ID: ${result.rows[0].id}`);
    console.log(`   Balance: KES ${parseFloat(result.rows[0].balance).toFixed(2)}`);
    console.log(`   Driver: ${driverCheck.rows[0].name}`);

  } catch (error) {
    console.error('❌ Error creating driver wallet:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run if called directly
if (require.main === module) {
  const driverId = parseInt(process.argv[2] || '4', 10);
  
  if (!driverId) {
    console.error('Usage: node create-wallet-cloud-direct.js <driverId>');
    process.exit(1);
  }
  
  createWalletForDriver(driverId)
    .then(() => {
      console.log('✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed:', error);
      process.exit(1);
    });
}

module.exports = createWalletForDriver;












