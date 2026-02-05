require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { Sequelize } = require('sequelize');

// Local database connection
const LOCAL_DB_URL = process.env.DATABASE_URL || 
  'postgresql://maria@localhost:5432/dialadrink';

// Development database connection
const DEV_DB_URL = 'postgresql://dialadrink_app:o61yqm5fLiTwWnk5@34.41.187.250:5432/dialadrink_dev?sslmode=require';

console.log('🚀 Migrating data from local to development database');
console.log('====================================================\n');

// Create Sequelize instances
const localSequelize = new Sequelize(LOCAL_DB_URL, {
  dialect: 'postgres',
  logging: false
});

const devSequelize = new Sequelize(DEV_DB_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: false
});

async function migrateData() {
  try {
    // Connect to both databases
    console.log('🔌 Connecting to local database...');
    await localSequelize.authenticate();
    console.log('✅ Local database connected\n');

    console.log('🔌 Connecting to development database...');
    await devSequelize.authenticate();
    console.log('✅ Development database connected\n');

    // Initialize schema on dev if needed
    console.log('📦 Ensuring schema exists on dev database...');
    const devDb = require('../models');
    // Temporarily set DATABASE_URL to dev
    const originalDbUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = DEV_DB_URL;
    delete require.cache[require.resolve('../models')];
    const devModels = require('../models');
    await devModels.sequelize.sync({ force: false, alter: false });
    console.log('✅ Schema ready\n');

    // Get list of tables from local
    const [localTables] = await localSequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'pg_%'
      AND table_name NOT LIKE '_prisma%'
      ORDER BY table_name;
    `);

    const tables = localTables.map(row => row.table_name);
    console.log(`📋 Found ${tables.length} tables to migrate\n`);

    // Copy data from each table
    for (const table of tables) {
      try {
        console.log(`📦 Migrating ${table}...`);

        // Get data from local using Sequelize
        const [localData] = await localSequelize.query(`SELECT * FROM "${table}"`);
        
        if (localData.length === 0) {
          console.log(`   ⏭️  ${table}: No data to migrate\n`);
          continue;
        }

        // Check if table exists in dev
        const [devTableCheck] = await devSequelize.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          ) as exists;
        `, { bind: [table] });

        if (!devTableCheck[0].exists) {
          console.log(`   ⏭️  ${table}: Table doesn't exist in dev, skipping\n`);
          continue;
        }

        // Get column names from first row
        const columns = Object.keys(localData[0]);
        const columnList = columns.map(c => `"${c}"`).join(', ');
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        // Clear existing data
        await devSequelize.query(`TRUNCATE TABLE "${table}" CASCADE`);

        // Insert data in batches
        const batchSize = 100;
        let inserted = 0;
        let errors = 0;

        for (let i = 0; i < localData.length; i += batchSize) {
          const batch = localData.slice(i, i + batchSize);
          
          for (const row of batch) {
            const values = columns.map(col => {
              const val = row[col];
              if (val === null || val === undefined) return null;
              if (Buffer.isBuffer(val)) return val.toString();
              if (typeof val === 'object' && val !== null) return JSON.stringify(val);
              return val;
            });

            try {
              await devSequelize.query(
                `INSERT INTO "${table}" (${columnList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
                { bind: values }
              );
              inserted++;
            } catch (err) {
              errors++;
              if (errors <= 3) {
                console.warn(`   ⚠️  Row error: ${err.message.substring(0, 60)}...`);
              }
            }
          }
        }

        console.log(`   ✅ ${table}: ${inserted} rows inserted${errors > 0 ? `, ${errors} errors` : ''}\n`);
      } catch (error) {
        console.error(`   ❌ ${table}: ${error.message}\n`);
      }
    }

    // Verify counts
    console.log('🔍 Verifying migration...\n');
    const verifyTables = ['categories', 'subcategories', 'brands', 'drinks', 'Users', 'Orders'];
    
    for (const table of verifyTables) {
      try {
        const [localCount] = await localSequelize.query(`SELECT COUNT(*) as count FROM "${table}"`);
        const [devCount] = await devSequelize.query(`SELECT COUNT(*) as count FROM "${table}"`);
        console.log(`   ${table}: Local=${localCount[0].count}, Dev=${devCount[0].count}`);
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
    await localSequelize.close();
    await devSequelize.close();
  }
}

migrateData()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
