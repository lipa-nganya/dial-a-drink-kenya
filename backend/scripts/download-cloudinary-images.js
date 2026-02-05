/* 
 * Download all distinct Cloudinary product images referenced in the drinks table,
 * save them locally, then you can zip and upload the archive to Cloud Storage.
 *
 * Usage (from backend directory):
 *   node scripts/download-cloudinary-images.js
 *
 * This script ONLY downloads images; zipping and GCS upload are done via shell.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { Client } = require('pg');

// === CONFIG ===
// Local download directory (relative to backend/)
const DOWNLOAD_DIR = path.join(__dirname, '../tmp/cloudinary-images');

// Database connection (dev DB used for current inventory)
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
    // e.g. /image/upload/v1604517227/products/glenfiddich-26-years.jpg
    const parts = u.pathname.split('/');
    const last = parts[parts.length - 1] || 'image';
    return last;
  } catch (e) {
    return 'image';
  }
}

function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(filepath);

    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          fileStream.close();
          fs.unlink(filepath, () => {
            reject(
              new Error(`Request failed with status ${res.statusCode} for ${url}`)
            );
          });
          return;
        }

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(() => resolve());
        });
      })
      .on('error', (err) => {
        fileStream.close();
        fs.unlink(filepath, () => reject(err));
      })
      .setTimeout(15000, function onTimeout() {
        this.destroy(new Error('Request timeout'));
      });
  });
}

async function main() {
  console.log('📥 Downloading Cloudinary images referenced in drinks table...\n');

  ensureDir(DOWNLOAD_DIR);

  await dbClient.connect();
  console.log('✅ Connected to database\n');

  const result = await dbClient.query(`
    SELECT DISTINCT image
    FROM drinks
    WHERE image LIKE 'https://res.cloudinary.com/%'
    ORDER BY image
  `);

  const urls = result.rows
    .map((r) => r.image)
    .filter(Boolean);

  console.log(`Found ${urls.length} distinct Cloudinary image URLs\n`);

  let success = 0;
  let failed = 0;

  // Simple sequential download to avoid rate limiting / throttling issues
  // (can be optimized later with limited concurrency if needed)
  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    const filename = getFilenameFromUrl(url);
    const filepath = path.join(DOWNLOAD_DIR, filename);

    // Skip if already downloaded
    if (fs.existsSync(filepath)) {
      console.log(
        `[${i + 1}/${urls.length}] Skipping (already exists): ${filename}`
      );
      success += 1;
      continue;
    }

    console.log(`[${i + 1}/${urls.length}] Downloading: ${url}`);

    try {
      await downloadFile(url, filepath);
      console.log(`   ✅ Saved as: ${filepath}`);
      success += 1;
    } catch (err) {
      console.error(`   ❌ Failed: ${err.message}`);
      failed += 1;
    }
  }

  await dbClient.end();

  console.log('\n=== Download Summary ===');
  console.log(`✅ Successful downloads: ${success}`);
  console.log(`❌ Failed downloads: ${failed}`);
  console.log(`📁 Local directory: ${DOWNLOAD_DIR}`);
}

main()
  .then(() => {
    console.log('\n✅ Finished downloading Cloudinary images');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });

