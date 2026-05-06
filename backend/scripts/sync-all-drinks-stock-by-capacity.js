/**
 * For every drink: ensure each capacity label (capacity JSON + capacityPricing.capacity)
 * has a stockByCapacity bucket; missing buckets get the current aggregate stock value.
 * Then sets aggregate stock to the sum of buckets.
 *
 * Usage (from backend folder):
 *   node scripts/sync-all-drinks-stock-by-capacity.js           # dry-run (no writes)
 *   node scripts/sync-all-drinks-stock-by-capacity.js --apply   # persist
 */
/* eslint-disable no-console */

const db = require('../models');
const { syncStockByCapacityFromCapacity } = require('../utils/syncStockByCapacityFromCapacity');

async function main() {
  const apply = process.argv.includes('--apply');

  const drinks = await db.Drink.findAll({
    attributes: ['id', 'name', 'capacity', 'capacityPricing', 'stock', 'stockByCapacity']
  });

  let wouldChange = 0;
  let updated = 0;

  for (const d of drinks) {
    const plain = d.toJSON();
    const sync = syncStockByCapacityFromCapacity(plain);

    if (!sync.changed) continue;

    wouldChange += 1;
    console.log(
      `[${apply ? 'UPDATE' : 'DRY'}] #${plain.id} ${plain.name}: stock ${plain.stock} → ${sync.stock}, buckets ${JSON.stringify(sync.stockByCapacity)}`
    );

    if (apply) {
      await d.update({
        stockByCapacity: sync.stockByCapacity,
        stock: sync.stock
      });
      updated += 1;
    }
  }

  console.log(`\nDone. ${drinks.length} drinks scanned. ${wouldChange} ${apply ? 'updated' : 'would change'}.`);
  if (!apply) {
    console.log('Dry-run only — no rows updated. Re-run with --apply to save.');
  }

  await db.sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
