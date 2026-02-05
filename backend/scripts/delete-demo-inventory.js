/**
 * Delete demo/placeholder categories and drinks (e.g. Coca Cola, Coffee, Tusker, etc.)
 * from both DEV and PROD databases.
 *
 * Criteria:
 *   - Any drink whose image is a placeholder: image LIKE 'https://via.placeholder.com/%'
   *   - Any category whose image is a placeholder: image LIKE 'https://via.placeholder.com/%'
 *
 * Usage (from project root):
 *   node backend/scripts/delete-demo-inventory.js
 */

const { Client } = require('pg');

const DEV_DB = {
  name: 'DEV',
  host: '34.41.187.250',
  port: 5432,
  user: 'dialadrink_app',
  password: 'o61yqm5fLiTwWnk5',
  database: 'dialadrink_dev',
};

const PROD_DB = {
  name: 'PROD',
  host: '35.223.10.1',
  port: 5432,
  user: 'dialadrink_app',
  password: 'E7A3IIa60hFD3bkGH1XAiryvB',
  database: 'dialadrink_prod',
};

async function cleanDemoData(cfg) {
  const client = new Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    ssl: { require: true, rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log(`\n=== Cleaning demo inventory in ${cfg.name} (${cfg.database}) ===`);

    const catBefore = await client.query('SELECT id, name, image FROM categories ORDER BY id');
    const drinksBefore = await client.query(
      'SELECT id, name, "categoryId", image FROM drinks ORDER BY id LIMIT 50'
    );
    console.log(`Before: categories=${catBefore.rowCount}, sample drinks=${drinksBefore.rowCount}`);

    await client.query('BEGIN');

    // Delete drinks with placeholder images
    const delDrinks = await client.query(
      "DELETE FROM drinks WHERE image ILIKE 'https://via.placeholder.com/%' RETURNING id, name"
    );
    console.log(`Deleted ${delDrinks.rowCount} demo drinks with placeholder images.`);

    // Delete categories with placeholder images (and cascade to related drinks)
    const delCats = await client.query(
      "DELETE FROM categories WHERE image ILIKE 'https://via.placeholder.com/%' RETURNING id, name"
    );
    if (delCats.rowCount > 0) {
      console.log('Deleted demo categories with placeholder images:');
      delCats.rows.forEach((c) => console.log(`  - ${c.id}: ${c.name}`));
    } else {
      console.log('No demo categories with placeholder images found.');
    }

    await client.query('COMMIT');

    const catAfter = await client.query('SELECT id, name, image FROM categories ORDER BY id');
    const drinksAfter = await client.query(
      'SELECT id, name, "categoryId", image FROM drinks ORDER BY id LIMIT 10'
    );

    console.log(
      `After: categories=${catAfter.rowCount}, sample drinks:\n` +
        drinksAfter.rows.map((d) => `${d.id}:${d.name} (cat ${d.categoryid})`).join('\n')
    );
  } catch (err) {
    console.error(`❌ Error cleaning ${cfg.name}:`, err.message);
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // ignore
    }
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  await cleanDemoData(DEV_DB);
  await cleanDemoData(PROD_DB);
  console.log('\n✅ Demo/placeholder inventory cleanup complete.');
}

main().catch((e) => {
  console.error('Fatal error in delete-demo-inventory:', e);
  process.exit(1);
});

