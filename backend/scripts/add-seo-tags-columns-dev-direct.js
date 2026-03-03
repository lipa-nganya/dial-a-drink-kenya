// Ensure dev DB has SEO columns: pageTitle, keywords, youtubeUrl, tags.
// This runs directly against whatever DATABASE_URL points to.
//
// Usage (example for dev Cloud SQL from this machine):
//   cd backend
//   NODE_TLS_REJECT_UNAUTHORIZED=0 \
//   DATABASE_URL="postgresql://dialadrink_app:o61yqm5fLiTwWnk5@34.41.187.250:5432/dialadrink_dev?sslmode=require" \
//   node scripts/add-seo-tags-columns-dev-direct.js

const { Pool } = require('pg');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not set.');
    process.exit(1);
  }

  console.log('🚀 Ensuring SEO columns exist on target DB (drinks table)...\n');

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined
  });

  try {
    console.log('🔌 Testing connection...');
    await pool.query('SELECT 1');
    console.log('   ✅ Connected\n');

    const ddl = `
DO $$
BEGIN
  -- pageTitle
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drinks' AND column_name = 'pageTitle'
  ) THEN
    ALTER TABLE drinks ADD COLUMN "pageTitle" text;
  END IF;

  -- keywords
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drinks' AND column_name = 'keywords'
  ) THEN
    ALTER TABLE drinks ADD COLUMN "keywords" text;
  END IF;

  -- youtubeUrl
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drinks' AND column_name = 'youtubeUrl'
  ) THEN
    ALTER TABLE drinks ADD COLUMN "youtubeUrl" text;
  END IF;

  -- tags
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drinks' AND column_name = 'tags'
  ) THEN
    ALTER TABLE drinks ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb;
  END IF;
END
$$;
    `;

    console.log('📝 Applying DDL to add missing columns (if needed)...');
    await pool.query(ddl);
    console.log('   ✅ Columns ensured on drinks table\n');

    console.log('✅ Done.');
  } catch (err) {
    console.error('❌ Error ensuring SEO columns:', err.message || err);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

main();

