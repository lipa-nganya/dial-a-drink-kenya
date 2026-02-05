require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const localClient = new Client({
  host: 'localhost',
  port: 5432,
  database: 'dialadrink',
  user: 'maria'
});

const devClient = new Client({
  host: '34.41.187.250',
  port: 5432,
  database: 'dialadrink_dev',
  user: 'dialadrink_app',
  password: 'o61yqm5fLiTwWnk5',
  ssl: { require: true, rejectUnauthorized: false }
});

async function migrate() {
  await localClient.connect();
  await devClient.connect();
  
  const [tables] = await localClient.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'pg_%' ORDER BY table_name;
  `);
  
  console.log(`Found ${tables.length} tables`);
  for (const { table_name } of tables.slice(0, 5)) {
    const [data] = await localClient.query(`SELECT COUNT(*) as count FROM "${table_name}"`);
    console.log(`${table_name}: ${data[0].count} rows`);
  }
  
  await localClient.end();
  await devClient.end();
}

migrate().catch(console.error);
