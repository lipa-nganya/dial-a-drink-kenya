/**
 * For every drink: ensure each capacity label (capacity JSON + capacityPricing.capacity)
 * has a stockByCapacity bucket; missing buckets get the current aggregate stock value.
 * Then sets aggregate stock to the sum of buckets.
 *
 * Usage (from backend folder):
 *   npm run sync-stock-by-capacity              # dry-run (no writes; safe anywhere)
 *   npm run sync-stock-by-capacity -- --apply   # persist — ONLY allowed on local DB
 *
 * --apply refuses non-local DATABASE_URL unless ALLOW_SYNC_STOCK_APPLY=1 (emergency override).
 * Typical local: `DATABASE_URL` → localhost / 127.0.0.1, or `DB_HOST=localhost` with no URL (see `.env.local.example`).
 */
/* eslint-disable no-console */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('../models');
const { syncStockByCapacityFromCapacity } = require('../utils/syncStockByCapacityFromCapacity');

/** True when DB config targets this machine (localhost / 127.0.0.1), not cloud hosts. */
function isLocalDatabaseUrl() {
  const raw = process.env.DATABASE_URL || '';
  if (raw.trim()) {
    // Obvious remote hosts — never treat as "local" even if tunneling
    if (/\.rds\.amazonaws\.com|\.googleapis\.com|azure\.com|supabase\.co|neon\.tech|render\.com/i.test(raw)) {
      return false;
    }
    const hostMatch =
      raw.match(/(?:^|[@/])((?:localhost|127\.0\.0\.1|\[::1\]))(?::|$|[\/])/i) ||
      raw.match(/@localhost\b/i) ||
      raw.match(/@127\.0\.0\.1\b/i);
    return Boolean(hostMatch);
  }
  // Local dev often uses DB_HOST (see .env.local.example) with no DATABASE_URL
  const host = (process.env.DB_HOST || '').trim().toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function assertApplyAllowedOrExit() {
  const override =
    process.env.ALLOW_SYNC_STOCK_APPLY === '1' ||
    /^true$/i.test(process.env.ALLOW_SYNC_STOCK_APPLY || '');
  if (override) {
    console.warn('⚠️  ALLOW_SYNC_STOCK_APPLY set — applying writes despite DATABASE_URL check.');
    return;
  }
  if (!isLocalDatabaseUrl()) {
    console.error('');
    console.error('Refusing --apply: DATABASE_URL does not look like a local database.');
    console.error('Run preview-only without --apply on remote DBs, or use a local DATABASE_URL.');
    console.error('Emergency override: ALLOW_SYNC_STOCK_APPLY=1 npm run sync-stock-by-capacity -- --apply');
    console.error('');
    process.exit(1);
  }
}

async function main() {
  const apply = process.argv.includes('--apply');

  if (apply) {
    assertApplyAllowedOrExit();
  }

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
