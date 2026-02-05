/**
 * Move all downloaded Cloudinary images into the backend static directory
 * and update drink image URLs from Cloudinary to local /images paths.
 *
 * Prerequisite:
 *   - Run `node scripts/download-cloudinary-images.js` first
 *
 * Usage (from backend/):
 *   node scripts/move-cloudinary-to-static.js
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Source: where download-cloudinary-images.js saved files
const SOURCE_DIR = path.join(__dirname, '../tmp/cloudinary-images');
// Destination: served by Express as /images
const DEST_DIR = path.join(__dirname, '../public/images/products');

const dbClient = new Client({
  host: '34.41.187.250',
  port: 5432,
  user: 'dialadrink_app',
  password: 'o61yqm5fLiTwWnk5',
  database: 'dialadrink_dev',
  ssl: { require: true, rejectUnauthorized: false }
});

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getFilenameFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/');
    const last = parts[parts.length - 1] || 'image';
    return last;
  } catch (e) {
    return 'image';
  }
}

async function main() {
  console.log('🧱 Moving Cloudinary images into static directory and updating DB...\n');

  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`❌ Source directory does not exist: ${SOURCE_DIR}`);
    process.exit(1);
  }

  ensureDir(DEST_DIR);

  // First, copy all files from SOURCE_DIR to DEST_DIR (if not already there)
  const files = fs.readdirSync(SOURCE_DIR);
  console.log(`Found ${files.length} files in ${SOURCE_DIR}`);

  let copied = 0;
  for (const file of files) {
    const src = path.join(SOURCE_DIR, file);
    const dest = path.join(DEST_DIR, file);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
      copied += 1;
    }
  }
  console.log(`📁 Copied ${copied} new files into ${DEST_DIR}\n`);

  // Now update DB image paths
  await dbClient.connect();
  console.log('✅ Connected to database\n');

  const result = await dbClient.query(`
    SELECT id, image
    FROM drinks
    WHERE image LIKE 'https://res.cloudinary.com/%'
    ORDER BY id
  `);

  console.log(`Found ${result.rows.length} drinks with Cloudinary image URLs\n`);

  let updated = 0;
  let skipped = 0;

  for (const row of result.rows) {
    const { id, image } = row;
    const filename = getFilenameFromUrl(image);
    const destPath = path.join(DEST_DIR, filename);
    const newUrl = `/images/products/${filename}`;

    if (!fs.existsSync(destPath)) {
      console.warn(
        `⚠️  File for drink ${id} not found in DEST_DIR: ${filename} (keeping Cloudinary URL)`
      );
      skipped += 1;
      continue;
    }

    await dbClient.query(
      'UPDATE drinks SET image = $1 WHERE id = $2',
      [newUrl, id]
    );
    updated += 1;
  }

  console.log('\n=== Summary ===');
  console.log(`✅ Updated drinks to local /images paths: ${updated}`);
  console.log(`⏭️  Skipped (no local file found): ${skipped}`);
  console.log(`📁 Static directory: ${DEST_DIR}`);

  await dbClient.end();
}

main()
  .then(() => {
    console.log('\n✅ Finished moving Cloudinary images to static directory');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });

