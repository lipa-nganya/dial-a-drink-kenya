/**
 * Fetch tags from the legacy Dial A Drink MySQL table tec_products_tags
 * and sync them to local PostgreSQL drinks (match by product name).
 *
 * Requires the legacy MySQL database (e.g. from "dial a drink database.sql")
 * to be running. Set env vars or .env:
 *
 *   LEGACY_MYSQL_HOST=localhost
 *   LEGACY_MYSQL_USER=root
 *   LEGACY_MYSQL_PASSWORD=...
 *   LEGACY_MYSQL_DATABASE=bhyazahm_drinksdelivery
 *
 * Optional: LEGACY_MYSQL_PORT=3306
 *
 * If you only have "dial a drink database.sql", import it into MySQL first:
 *   mysql -u root -p bhyazahm_drinksdelivery < "/Users/maria/Documents/dial a drink database.sql"
 *
 * Run: node scripts/sync-tags-from-tec-products-tags.js
 *  or: npm run sync-tags-from-tec
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const db = require('../models');

const LEGACY_HOST = process.env.LEGACY_MYSQL_HOST || 'localhost';
const LEGACY_USER = process.env.LEGACY_MYSQL_USER || 'root';
const LEGACY_PASSWORD = process.env.LEGACY_MYSQL_PASSWORD || '';
const LEGACY_DATABASE = process.env.LEGACY_MYSQL_DATABASE || 'bhyazahm_drinksdelivery';
const LEGACY_PORT = parseInt(process.env.LEGACY_MYSQL_PORT || '3306', 10);

/**
 * Parse tags string (varchar 255) into array of strings.
 * Handles comma-separated, semicolon-separated, or single value.
 */
function parseTagsString(tagsStr) {
  if (tagsStr == null || String(tagsStr).trim() === '') return [];
  const s = String(tagsStr).trim();
  return s
    .split(/[,;]+/)
    .map(t => t.trim())
    .filter(Boolean);
}

/**
 * Normalize product name for matching (lowercase, trim, collapse spaces).
 */
function normalizeName(name) {
  if (name == null) return '';
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Find local drink by product name (and optionally product_id if we had a mapping).
 */
function findLocalDrink(tecRow, localDrinks) {
  const tecName = normalizeName(tecRow.product_name);
  if (!tecName) return null;

  // Exact match first
  let match = localDrinks.find(d => normalizeName(d.name) === tecName);
  if (match) return { drink: match, matchType: 'name' };

  // Relaxed: trim extra spaces / punctuation
  const tecNameClean = tecName.replace(/['']/g, "'");
  match = localDrinks.find(d => normalizeName(d.name).replace(/['']/g, "'") === tecNameClean);
  if (match) return { drink: match, matchType: 'name' };

  return null;
}

/**
 * Update local drink tags (merge with existing or replace).
 */
async function updateLocalDrinkTags(drink, tagsArray) {
  const tags = Array.isArray(tagsArray) ? tagsArray.filter(t => t && String(t).trim()) : [];
  if (tags.length === 0) return { updated: false };

  await drink.update({ tags });
  return { updated: true, count: tags.length };
}

async function run() {
  console.log('🚀 Sync tags from tec_products_tags (legacy MySQL) to local drinks\n');

  let legacyConnection;
  try {
    // 1) Connect to legacy MySQL
    console.log(`📡 Connecting to legacy MySQL: ${LEGACY_HOST}:${LEGACY_PORT}/${LEGACY_DATABASE}...`);
    legacyConnection = await mysql.createConnection({
      host: LEGACY_HOST,
      port: LEGACY_PORT,
      user: LEGACY_USER,
      password: LEGACY_PASSWORD,
      database: LEGACY_DATABASE
    });

    const [rows] = await legacyConnection.execute(
      'SELECT id, product_id, product_name, tags FROM tec_products_tags WHERE (tags IS NOT NULL AND TRIM(tags) != "")'
    );
    console.log(`✅ Fetched ${rows.length} rows from tec_products_tags\n`);

    if (rows.length === 0) {
      console.log('⚠️  No rows with tags in tec_products_tags. Nothing to sync.');
      await legacyConnection.end();
      process.exit(0);
      return;
    }

    // 2) Load local drinks
    const localDrinks = await db.Drink.findAll({
      attributes: ['id', 'name', 'slug', 'tags']
    });
    console.log(`📦 Loaded ${localDrinks.length} local drinks\n`);

    // 3) Match and update
    console.log('🔄 Matching and updating tags...\n');
    const stats = { matched: 0, updated: 0, skipped: 0, notFound: 0 };

    for (const tecRow of rows) {
      const tagsArray = parseTagsString(tecRow.tags);
      if (tagsArray.length === 0) {
        stats.skipped++;
        continue;
      }

      const found = findLocalDrink(tecRow, localDrinks);
      if (!found) {
        console.log(`⚠️  Not found locally: "${tecRow.product_name}"`);
        stats.notFound++;
        continue;
      }

      stats.matched++;
      const { drink, matchType } = found;
      const result = await updateLocalDrinkTags(drink, tagsArray);
      if (result.updated) {
        console.log(`✅ ${drink.name} (${result.count} tags) [matched by ${matchType}]`);
        stats.updated++;
      } else {
        stats.skipped++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 SYNC SUMMARY');
    console.log('='.repeat(60));
    console.log(`tec_products_tags rows with tags: ${rows.length}`);
    console.log(`Matched to local drink: ${stats.matched}`);
    console.log(`Updated: ${stats.updated}`);
    console.log(`Skipped: ${stats.skipped}`);
    console.log(`Not found locally: ${stats.notFound}`);
    console.log('='.repeat(60));
    console.log('\n✅ Done.');
    await legacyConnection.end();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    if (err.code === 'ECONNREFUSED') {
      console.error('\n💡 Ensure the legacy MySQL server is running and LEGACY_MYSQL_* env vars are set.');
      console.error('   Example: LEGACY_MYSQL_HOST=127.0.0.1 LEGACY_MYSQL_USER=root LEGACY_MYSQL_PASSWORD=xxx LEGACY_MYSQL_DATABASE=bhyazahm_drinksdelivery');
    }
    if (legacyConnection) await legacyConnection.end().catch(() => {});
    process.exit(1);
  }
}

run();
