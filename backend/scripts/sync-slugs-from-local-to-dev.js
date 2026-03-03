// Sync product slugs from local DB -> dev DB (one-time sync, no scraping).
//
// Source:  SOURCE_DATABASE_URL  (local Postgres, e.g. dialadrink on your Mac)
// Target:  DATABASE_URL         (dev Cloud SQL: dialadrink_dev)
//
// Usage:
//   cd backend
//   NODE_TLS_REJECT_UNAUTHORIZED=0 \
//   SOURCE_DATABASE_URL="postgres://postgres:password@localhost:5432/dialadrink" \
//   DATABASE_URL="postgresql://dialadrink_app:o61yqm5fLiTwWnk5@34.41.187.250:5432/dialadrink_dev?sslmode=require" \
//   node scripts/sync-slugs-from-local-to-dev.js

const { Pool } = require('pg');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`❌ Missing ${name}. Set it before running this script.`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const sourceUrl = requireEnv('SOURCE_DATABASE_URL');
  const targetUrl = requireEnv('DATABASE_URL');

  console.log('🚀 Sync product slugs from SOURCE -> DEV\n');

  const sourcePool = new Pool({ connectionString: sourceUrl });
  const targetPool = new Pool({
    connectionString: targetUrl,
    ssl: targetUrl.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined
  });

  try {
    console.log('🔌 Connecting to source (local) DB...');
    await sourcePool.query('SELECT 1');
    console.log('   ✅ Connected to source\n');

    console.log('🔌 Connecting to target (dev) DB...');
    await targetPool.query('SELECT 1');
    console.log('   ✅ Connected to target\n');

    console.log('📥 Loading source drinks (id, name, slug)...');
    const srcRes = await sourcePool.query(
      `SELECT id, name, slug FROM drinks`
    );
    const sourceDrinks = srcRes.rows;
    console.log(`   ✅ Found ${sourceDrinks.length} source drinks\n`);

    console.log('📥 Loading target drinks (id, name, slug)...');
    const tgtRes = await targetPool.query(
      `SELECT id, name, slug FROM drinks`
    );
    const targetDrinks = tgtRes.rows;
    console.log(`   ✅ Found ${targetDrinks.length} target drinks\n`);

    const byId = new Map();
    for (const d of targetDrinks) {
      byId.set(d.id, d);
    }

    let matched = 0;
    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    for (const src of sourceDrinks) {
      const target = byId.get(src.id);
      if (!target) {
        notFound++;
        console.log(`⚠️  Not found in dev: ${src.name} (id=${src.id}, slug=${src.slug || 'null'})`);
        continue;
      }

      matched++;

      const srcSlug = (src.slug || '').trim();
      if (!srcSlug) {
        skipped++;
        continue;
      }

      const tgtSlug = (target.slug || '').trim();
      if (tgtSlug === srcSlug) {
        skipped++;
        continue;
      }

      await targetPool.query(
        `UPDATE drinks SET slug = $2 WHERE id = $1`,
        [target.id, srcSlug]
      );
      updated++;
      console.log(`✅ Updated slug in dev: id=${target.id} "${target.name}" -> "${srcSlug}"`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 SLUG SYNC SUMMARY');
    console.log('='.repeat(50));
    console.log(`Source drinks:   ${sourceDrinks.length}`);
    console.log(`Matched in dev:  ${matched}`);
    console.log(`Updated slugs:   ${updated}`);
    console.log(`Skipped (same / empty slug): ${skipped}`);
    console.log(`Not found in dev: ${notFound}`);
    console.log('='.repeat(50));
    console.log('\n✅ Done syncing slugs to dev.');
  } catch (err) {
    console.error('❌ Fatal error during slug sync:', err.message || err);
    process.exitCode = 1;
  } finally {
    await sourcePool.end().catch(() => {});
    await targetPool.end().catch(() => {});
  }
}

main();

