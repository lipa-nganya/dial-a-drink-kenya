require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { Sequelize } = require('sequelize');
const { Client } = require('pg');

// Local database connection
const LOCAL_DB_URL = process.env.DATABASE_URL || 
  'postgresql://maria@localhost:5432/dialadrink';

// Development database connection
const DEV_DB_URL = 'postgresql://dialadrink_app:o61yqm5fLiTwWnk5@34.41.187.250:5432/dialadrink_dev?sslmode=require';

console.log('🚀 Copying data from local database to development Cloud SQL database');
console.log('=====================================================================\n');

// Connect to local database
const localClient = new Client({
  connectionString: LOCAL_DB_URL
});

// Connect to dev database
const devClient = new Client({
  connectionString: DEV_DB_URL,
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
});

async function copyData() {
  try {
    // Connect to databases
    console.log('🔌 Connecting to local database...');
    await localClient.connect();
    console.log('✅ Local database connected\n');

    console.log('🔌 Connecting to development database...');
    await devClient.connect();
    console.log('✅ Development database connected\n');

    // First, initialize schema on dev database
    console.log('📦 Initializing schema on development database...');
    const db = require('../models');
    
    // Temporarily set DATABASE_URL to dev database
    const originalDbUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = DEV_DB_URL;
    
    // Re-initialize models with dev database
    delete require.cache[require.resolve('../models')];
    const devDb = require('../models');
    
    // Sync schema
    await devDb.sequelize.sync({ force: false, alter: false });
    console.log('✅ Schema initialized\n');

    // Get list of tables from local database
    const tablesResult = await localClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'pg_%'
      AND table_name NOT LIKE '_prisma%'
      ORDER BY table_name;
    `);

    const tables = tablesResult.rows.map(row => row.table_name);
    console.log(`📋 Found ${tables.length} tables to copy\n`);

    // Copy data from each table
    for (const table of tables) {
      try {
        console.log(`📦 Copying ${table}...`);
        
        // Get data from local
        const dataResult = await localClient.query(`SELECT * FROM "${table}"`);
        const rows = dataResult.rows;
        
        if (rows.length === 0) {
          console.log(`   ⏭️  ${table}: No data to copy\n`);
          continue;
        }

        // Get column names
        const columns = Object.keys(rows[0]);
        const columnList = columns.map(col => `"${col}"`).join(', ');
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        // Clear existing data (optional - comment out if you want to append)
        await devClient.query(`TRUNCATE TABLE "${table}" CASCADE`);

        // Insert data in batches
        const batchSize = 100;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          
          for (const row of batch) {
            const values = columns.map(col => row[col]);
            try {
              await devClient.query(
                `INSERT INTO "${table}" (${columnList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
                values
              );
            } catch (insertError) {
              // Skip rows that fail (e.g., foreign key constraints)
              if (!insertError.message.includes('violates foreign key constraint')) {
                console.warn(`   ⚠️  Error inserting row in ${table}: ${insertError.message}`);
              }
            }
          }
        }

        const countResult = await devClient.query(`SELECT COUNT(*) as count FROM "${table}"`);
        const count = countResult.rows[0].count;
        console.log(`   ✅ ${table}: ${count} rows copied\n`);
      } catch (error) {
        console.error(`   ❌ Error copying ${table}: ${error.message}\n`);
      }
    }

    console.log('✅ Data copy complete!\n');

    // Verify counts
    console.log('🔍 Verifying row counts...\n');
    const verifyTables = ['categories', 'subcategories', 'brands', 'drinks', 'Users', 'Orders'];
    
    for (const table of verifyTables) {
      try {
        const localCount = await localClient.query(`SELECT COUNT(*) as count FROM "${table}"`);
        const devCount = await devClient.query(`SELECT COUNT(*) as count FROM "${table}"`);
        console.log(`   ${table}: Local=${localCount.rows[0].count}, Dev=${devCount.rows[0].count}`);
      } catch (error) {
        // Table might not exist
      }
    }

    // Restore original DATABASE_URL
    if (originalDbUrl) {
      process.env.DATABASE_URL = originalDbUrl;
    }

    console.log('\n✅ Migration complete!');
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    await localClient.end();
    await devClient.end();
  }
}

copyData()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
