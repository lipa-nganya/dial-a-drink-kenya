/**
 * Download ONLY the Cloudinary images that are still referenced in the DB
 * (for which we don't already have a matching local file in public/images/products).
 *
 * Usage (from backend/):
 *   node scripts/download-remaining-cloudinary-images.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { Client } = require('pg');

const PRODUCTS_DIR = path.join(__dirname, '../public/images/products');

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
    return parts[parts.length - 1] || 'image';
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
  console.log('📥 Downloading remaining Cloudinary images directly into public/images/products...\n');

  ensureDir(PRODUCTS_DIR);

  await dbClient.connect();
  console.log('✅ Connected to database\n');

  const result = await dbClient.query(`
    SELECT DISTINCT image
    FROM drinks
    WHERE image LIKE 'https://res.cloudinary.com/%'
    ORDER BY image
  `);

  const urls = result.rows.map((r) => r.image).filter(Boolean);
  console.log(`Found ${urls.length} distinct Cloudinary URLs still in DB\n`);

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    const filename = getFilenameFromUrl(url);
    const destPath = path.join(PRODUCTS_DIR, filename);

    if (fs.existsSync(destPath)) {
      console.log(
        `[${i + 1}/${urls.length}] Skipping (already exists in products dir): ${filename}`
      );
      skipped += 1;
      continue;
    }

    console.log(`[${i + 1}/${urls.length}] Downloading: ${url}`);

    try {
      await downloadFile(url, destPath);
      console.log(`   ✅ Saved as: ${destPath}`);
      downloaded += 1;
    } catch (err) {
      console.error(`   ❌ Failed: ${err.message}`);
      failed += 1;
    }
  }

  await dbClient.end();

  console.log('\n=== Remaining Download Summary ===');
  console.log(`✅ Newly downloaded: ${downloaded}`);
  console.log(`⏭️  Already present in products dir: ${skipped}`);
  console.log(`❌ Failed to download: ${failed}`);
}

main()
  .then(() => {
    console.log('\n✅ Finished downloading remaining Cloudinary images');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });

