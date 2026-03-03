// Sync tags + pageTitle from a local/source database into the dev/target database.
//
// Source:  SOURCE_DATABASE_URL  (required)
// Target:  DATABASE_URL         (required, dev DB)
//
// Strategy:
// - Read drinks from source: id, name, slug, tags, pageTitle
// - For each, UPDATE target.drinks
//   - Prefer matching by id
//   - If no id match, try slug, then name (case-insensitive)
//
// Usage (example):
//   SOURCE_DATABASE_URL="postgres://local_user:pass@localhost:5432/dialadrink_local" \
//   DATABASE_URL="postgresql://dialadrink_app:***@/dialadrink_dev?host=/cloudsql/dialadrink-production:us-central1:dialadrink-db-dev" \
//   node scripts/sync-tags-from-local-to-dev.js

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

  console.log('🚀 Sync tags + pageTitle from SOURCE -> DEV\n');

  const sourcePool = new Pool({ connectionString: sourceUrl });
  const targetPool = new Pool({
    connectionString: targetUrl,
    // Allow SSL to self-signed / GCP certs when using ?sslmode=require
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

    console.log('📥 Loading drinks with tags or pageTitle from source...');
    const srcRes = await sourcePool.query(
      `SELECT id, name, slug, tags, "pageTitle"
       FROM drinks`
    );
    const sourceDrinks = srcRes.rows;
    console.log(`   ✅ Found ${sourceDrinks.length} source drinks\n`);

    if (sourceDrinks.length === 0) {
      console.log('Nothing to sync. Exiting.');
      return;
    }

    // Build lookup helpers in target
    console.log('📥 Loading target drinks index (id, slug, name)...');
    const tgtRes = await targetPool.query(
      `SELECT id, name, slug FROM drinks`
    );
    const targetDrinks = tgtRes.rows;
    console.log(`   ✅ Found ${targetDrinks.length} target drinks\n`);

    const byId = new Map();
    const bySlug = new Map();
    const byName = new Map();

    for (const d of targetDrinks) {
      byId.set(d.id, d);
      if (d.slug) bySlug.set(d.slug, d);
      const nameKey = (d.name || '').trim().toLowerCase();
      if (nameKey) byName.set(nameKey, d);
    }

    let matched = 0;
    let updated = 0;
    let notFound = 0;
    let skipped = 0;

    for (const src of sourceDrinks) {
      const nameKey = (src.name || '').trim().toLowerCase();
      let target = byId.get(src.id);
      let matchType = 'id';

      if (!target && src.slug) {
        target = bySlug.get(src.slug);
        matchType = 'slug';
      }
      if (!target && nameKey) {
        target = byName.get(nameKey);
        matchType = 'name';
      }

      if (!target) {
        notFound++;
        console.log(`⚠️  Not found in dev: ${src.name} (id=${src.id}, slug=${src.slug || 'null'})`);
        continue;
      }

      matched++;

      // Normalize tags to a JS array (or null)
      let tags = src.tags;
      const normalizeTags = (val) => {
        if (!val) return null;
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
          try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) ? parsed : null;
          } catch (_) {
            return null;
          }
        }
        // For objects (jsonb) that are not arrays, skip
        return null;
      };
      tags = normalizeTags(tags);
      const pageTitle = src.pageTitle;

      // Skip if both tags + pageTitle are null/empty
      const hasTags = Array.isArray(tags) && tags.length > 0;
      const hasTitle = pageTitle && String(pageTitle).trim().length > 0;
      if (!hasTags && !hasTitle) {
        skipped++;
        continue;
      }

      // Build UPDATE payload & compare current values
      const tgtRow = await targetPool.query(
        `SELECT tags, "pageTitle" FROM drinks WHERE id = $1`,
        [target.id]
      );
      const current = tgtRow.rows[0] || {};

      const desiredTags = hasTags ? tags : current.tags;
      const desiredTitle = hasTitle ? pageTitle : current.pageTitle;

      const normForCompare = (val) => {
        const arr = normalizeTags(val) || [];
        return arr.slice().sort();
      };
      const tagsEqual =
        JSON.stringify(normForCompare(current.tags)) ===
        JSON.stringify(normForCompare(desiredTags));
      const titleEqual = (current.pageTitle || '') === (desiredTitle || '');

      if (tagsEqual && titleEqual) {
        skipped++;
        continue;
      }

      const tagsJson = desiredTags ? JSON.stringify(desiredTags) : null;

      await targetPool.query(
        `UPDATE drinks
         SET tags = $2::jsonb,
             "pageTitle" = $3
         WHERE id = $1`,
        [target.id, tagsJson, desiredTitle || null]
      );

      updated++;
      console.log(`✅ Updated dev: ${src.name} (id=${target.id}) [match: ${matchType}]`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 SYNC SUMMARY');
    console.log('='.repeat(50));
    console.log(`Source drinks with data: ${sourceDrinks.length}`);
    console.log(`Matched in dev:         ${matched}`);
    console.log(`Updated in dev:         ${updated}`);
    console.log(`Skipped (unchanged):    ${skipped}`);
    console.log(`Not found in dev:       ${notFound}`);
    console.log('='.repeat(50));
    console.log('\n✅ Done syncing tags + page titles to dev.');
  } catch (err) {
    console.error('❌ Fatal error during sync:', err.message || err);
    process.exitCode = 1;
  } finally {
    await sourcePool.end().catch(() => {});
    await targetPool.end().catch(() => {});
  }
}

main();

