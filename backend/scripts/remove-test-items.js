/**
 * Script to remove test items from the development database
 */

const { Client } = require('pg');

// Use external connection for local script
// Get IP from: gcloud sql instances describe dialadrink-db-dev --format="get(ipAddresses[0].ipAddress)" --project dialadrink-production
const DB_IP = process.env.DEV_DB_IP || '34.41.187.250';
const DB_USER = 'dialadrink_app';
const DB_PASSWORD = 'o61yqm5fLiTwWnk5';
const DB_NAME = 'dialadrink_dev';
const DB_PORT = 5432;

console.log('🔍 Connecting to development database...');
console.log(`   Host: ${DB_IP}`);
console.log(`   Database: ${DB_NAME}`);

// Connect using pg client directly
const client = new Client({
  host: DB_IP,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
});

async function removeTestItems() {
  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Find test items
    const result = await client.query(`
      SELECT id, name, "categoryId" 
      FROM drinks 
      WHERE name ILIKE '%test%' 
      ORDER BY id
    `);

    const testItems = result.rows;
    console.log(`\n📋 Found ${testItems.length} test items:`);
    testItems.forEach(item => {
      console.log(`   - ID: ${item.id}, Name: ${item.name}, Category: ${item.categoryId}`);
    });

    if (testItems.length === 0) {
      console.log('\n✅ No test items found. Nothing to delete.');
      await client.end();
      return;
    }

    // Get IDs to delete
    const ids = testItems.map(item => item.id);
    console.log(`\n🗑️  Deleting ${ids.length} test items...`);

    // Delete test items
    const deleteResult = await client.query(`
      DELETE FROM drinks 
      WHERE id = ANY($1::int[])
      RETURNING id, name
    `, [ids]);

    console.log(`\n✅ Successfully deleted ${deleteResult.rows.length} test items:`);
    deleteResult.rows.forEach(item => {
      console.log(`   - Deleted: ID ${item.id}, Name: ${item.name}`);
    });

    // Verify deletion
    const verifyResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM drinks 
      WHERE name ILIKE '%test%'
    `);

    console.log(`\n✅ Verification: ${verifyResult.rows[0].count} test items remaining`);

    await client.end();
    console.log('\n✅ Script completed successfully');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    await client.end().catch(() => {});
    process.exit(1);
  }
}

removeTestItems();
