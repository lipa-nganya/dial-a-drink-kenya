/**
 * Force all remaining Cloudinary image URLs in drinks.image
 * to use local static paths: /images/products/<filename-from-url>
 *
 * NOTE: This does not check that the file actually exists on disk.
 * We already downloaded as many as possible; any that still 404 on
 * Cloudinary will need manual image upload later.
 *
 * Usage (from backend/):
 *   node scripts/force-local-image-paths.js
 */

const { Client } = require('pg');

const dbClient = new Client({
  host: '34.41.187.250',
  port: 5432,
  user: 'dialadrink_app',
  password: 'o61yqm5fLiTwWnk5',
  database: 'dialadrink_dev',
  ssl: { require: true, rejectUnauthorized: false }
});

function getFilenameFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/');
    return parts[parts.length - 1] || 'image';
  } catch (e) {
    return 'image';
  }
}

async function main() {
  console.log('🔄 Forcing remaining Cloudinary URLs to local /images/products paths...\n');

  await dbClient.connect();
  console.log('✅ Connected to database\n');

  const result = await dbClient.query(`
    SELECT id, image
    FROM drinks
    WHERE image LIKE 'https://res.cloudinary.com/%'
    ORDER BY id
  `);

  const rows = result.rows;
  console.log(`Found ${rows.length} drinks still using Cloudinary URLs\n`);

  let updated = 0;

  for (const row of rows) {
    const { id, image } = row;
    const filename = getFilenameFromUrl(image);
    const newPath = `/images/products/${filename}`;

    await dbClient.query(
      'UPDATE drinks SET image = $1 WHERE id = $2',
      [newPath, id]
    );
    updated += 1;
  }

  console.log(`✅ Updated ${updated} drinks to local static paths`);

  await dbClient.end();
}

main()
  .then(() => {
    console.log('\n✅ force-local-image-paths completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });

