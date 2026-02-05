const { Client } = require('pg');

const dbClient = new Client({
  host: '35.223.10.1',
  port: 5432,
  user: 'dialadrink_app',
  password: 'E7A3IIa60hFD3bkGH1XAiryvB',
  database: 'dialadrink_prod',
  ssl: { require: true, rejectUnauthorized: false }
});

async function main() {
  await dbClient.connect();
  
  const result = await dbClient.query(`
    SELECT 
      d.id, 
      d.name, 
      d."categoryId",
      c.name as category_name,
      d.image
    FROM drinks d 
    LEFT JOIN categories c ON d."categoryId" = c.id 
    WHERE d.id IN (1826, 53, 1827)
    ORDER BY d.id
  `);
  
  console.log('Test items details:');
  result.rows.forEach(d => {
    console.log(`\nID ${d.id}: ${d.name}`);
    console.log(`  Category: ${d.category_name || 'N/A'} (ID: ${d.categoryId || 'N/A'})`);
    console.log(`  Image: ${d.image || 'NULL'}`);
  });
  
  await dbClient.end();
}

main().catch(console.error);
