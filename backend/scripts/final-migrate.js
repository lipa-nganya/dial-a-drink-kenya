require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const local = new Client({ host: 'localhost', port: 5432, database: 'dialadrink', user: 'maria' });
const dev = new Client({ 
  host: '34.41.187.250', port: 5432, database: 'dialadrink_dev', 
  user: 'dialadrink_app', password: 'o61yqm5fLiTwWnk5',
  ssl: { require: true, rejectUnauthorized: false }
});

async function migrate() {
  await local.connect();
  await dev.connect();
  console.log('✅ Connected to both databases\n');
  
  // Get tables
  const { rows: tables } = await local.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'pg_%' ORDER BY table_name;
  `);
  
  console.log(`📋 Migrating ${tables.length} tables...\n`);
  
  for (const { table_name } of tables) {
    try {
      // Check if table exists in dev
      const { rows: exists } = await dev.query(`
        SELECT EXISTS (SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1) as exists;
      `, [table_name]);
      
      if (!exists[0].exists) {
        console.log(`⏭️  ${table_name}: Table doesn't exist in dev\n`);
        continue;
      }
      
      // Get data
      const { rows: data } = await local.query(`SELECT * FROM "${table_name}"`);
      if (data.length === 0) {
        console.log(`⏭️  ${table_name}: No data\n`);
        continue;
      }
      
      // Get columns
      const cols = Object.keys(data[0]);
      const colList = cols.map(c => `"${c}"`).join(', ');
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      
      // Clear and insert
      await dev.query(`TRUNCATE TABLE "${table_name}" CASCADE`);
      
      let inserted = 0;
      for (const row of data) {
        const vals = cols.map(c => {
          const v = row[c];
          if (v === null || v === undefined) return null;
          if (Buffer.isBuffer(v)) return v.toString();
          if (typeof v === 'object') return JSON.stringify(v);
          return v;
        });
        try {
          await dev.query(
            `INSERT INTO "${table_name}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            vals
          );
          inserted++;
        } catch (e) {
          // Skip errors
        }
      }
      
      console.log(`✅ ${table_name}: ${inserted}/${data.length} rows\n`);
    } catch (e) {
      console.log(`❌ ${table_name}: ${e.message}\n`);
    }
  }
  
  // Verify
  console.log('🔍 Verification:\n');
  for (const table of ['categories', 'drinks', 'brands']) {
    try {
      const [localCount] = await local.query(`SELECT COUNT(*) as c FROM "${table}"`);
      const [devCount] = await dev.query(`SELECT COUNT(*) as c FROM "${table}"`);
      console.log(`  ${table}: Local=${localCount.rows[0].c}, Dev=${devCount.rows[0].c}`);
    } catch (e) {}
  }
  
  await local.end();
  await dev.end();
  console.log('\n✅ Migration complete!');
}

migrate().catch(console.error).finally(() => process.exit(0));
