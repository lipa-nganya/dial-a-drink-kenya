require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { Client } = require('pg');

// Local database
const LOCAL_DB = {
  host: 'localhost',
  port: 5432,
  database: 'dialadrink',
  user: 'maria'
};

// Dev database
const DEV_DB = {
  host: '34.41.187.250',
  port: 5432,
  database: 'dialadrink_dev',
  user: 'dialadrink_app',
  password: 'o61yqm5fLiTwWnk5',
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
};

const localClient = new Client(LOCAL_DB);
const devClient = new Client(DEV_DB);

async function copyData() {
  try {
    console.log('🔌 Connecting to databases...');
    await localClient.connect();
    console.log('✅ Local database connected');
    
    await devClient.connect();
    console.log('✅ Dev database connected');
    
    // Verify connection
    const dbInfo = await devClient.query('SELECT current_database(), current_schema()');
    console.log(`   Database: ${dbInfo.rows[0].current_database}, Schema: ${dbInfo.rows[0].current_schema}`);
    
    // List tables
    const devTables = await devClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
      LIMIT 10
    `);
    console.log(`   Sample tables: ${devTables.rows.map(t => t.table_name).join(', ')}\n`);

    // Get list of tables
    const tablesResult = await localClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'pg_%'
      AND table_name NOT LIKE '_prisma%'
      ORDER BY table_name;
    `);

    const tables = tablesResult.rows.map(r => r.table_name);
    console.log(`📋 Found ${tables.length} tables\n`);

    // Copy each table
    for (const table of tables) {
      try {
        console.log(`📦 Copying ${table}...`);
        
        // Try to query the table to see if it exists (will throw if it doesn't)
        let tableExists = true;
        try {
          await devClient.query(`SELECT 1 FROM "${table}" LIMIT 1`);
        } catch (err) {
          if (err.message.includes('does not exist') || err.message.includes('relation')) {
            tableExists = false;
          } else {
            throw err; // Re-throw if it's a different error
          }
        }

        if (!tableExists) {
          console.log(`   ⏭️  ${table}: Table doesn't exist in dev, skipping\n`);
          continue;
        }

        // Get data from local
        const data = await localClient.query(`SELECT * FROM "${table}"`);
        
        if (data.rows.length === 0) {
          console.log(`   ✅ ${table}: 0 rows (empty)\n`);
          continue;
        }

        // Get column names
        const columns = Object.keys(data.rows[0]);
        const columnList = columns.map(c => `"${c}"`).join(', ');
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        // Clear existing data
        await devClient.query(`TRUNCATE TABLE "${table}" CASCADE`);

        // Insert in batches
        const batchSize = 50;
        let inserted = 0;
        let errors = 0;

        for (let i = 0; i < data.rows.length; i += batchSize) {
          const batch = data.rows.slice(i, i + batchSize);
          
          for (const row of batch) {
            const values = columns.map(col => {
              const val = row[col];
              // Handle null, undefined, and special types
              if (val === null || val === undefined) return null;
              if (Buffer.isBuffer(val)) return val.toString();
              if (typeof val === 'object') return JSON.stringify(val);
              return val;
            });

            try {
              await devClient.query(
                `INSERT INTO "${table}" (${columnList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
                values
              );
              inserted++;
            } catch (err) {
              errors++;
              if (errors <= 5) {
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

    // Verify
    console.log('🔍 Verifying...\n');
    const verifyTables = ['categories', 'subcategories', 'brands', 'drinks'];
    for (const table of verifyTables) {
      try {
        const localCount = await localClient.query(`SELECT COUNT(*) as c FROM "${table}"`);
        const devCount = await devClient.query(`SELECT COUNT(*) as c FROM "${table}"`);
        console.log(`   ${table}: Local=${localCount.rows[0].c}, Dev=${devCount.rows[0].c}`);
      } catch (e) {
        // Skip if table doesn't exist
      }
    }

    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await localClient.end();
    await devClient.end();
  }
}

copyData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
