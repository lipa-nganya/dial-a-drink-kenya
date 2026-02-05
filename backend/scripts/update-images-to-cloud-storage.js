/**
 * Update drink image URLs from local paths to Cloud Storage URLs
 * 
 * Usage (from backend/):
 *   node scripts/update-images-to-cloud-storage.js
 */

const { Client } = require('pg');

const CLOUD_STORAGE_BASE_URL = 'https://storage.googleapis.com/dialadrink-production-images/products';

// Database connection - use Cloud SQL proxy or direct connection
// For local execution, use the public IP with SSL
const dbClient = new Client({
  host: '35.223.10.1', // Production database public IP
  port: 5432,
  user: 'dialadrink_app',
  password: 'E7A3IIa60hFD3bkGH1XAiryvB',
  database: 'dialadrink_prod',
  ssl: { require: true, rejectUnauthorized: false }
});

function getFilenameFromPath(path) {
  if (!path) return null;
  // Extract filename from paths like:
  // - /images/products/filename.jpg
  // - /images/products/subdir/filename.jpg
  // - images/products/filename.jpg
  const match = path.match(/\/([^\/]+\.(jpg|jpeg|png|webp|gif))$/i);
  return match ? match[1] : null;
}

async function main() {
  console.log('🔄 Updating drink image URLs to Cloud Storage...\n');

  await dbClient.connect();
  console.log('✅ Connected to production database\n');

  // Get all drinks with local image paths
  const result = await dbClient.query(`
    SELECT id, name, image
    FROM drinks
    WHERE image IS NOT NULL 
      AND image != ''
      AND (image LIKE '/images/products/%' OR image LIKE 'images/products/%')
    ORDER BY id
  `);

  console.log(`Found ${result.rows.length} drinks with local image paths\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const drink of result.rows) {
    try {
      const filename = getFilenameFromPath(drink.image);
      
      if (!filename) {
        console.log(`⚠️  Skipping drink ${drink.id} (${drink.name}): Could not extract filename from ${drink.image}`);
        skipped++;
        continue;
      }

      const cloudStorageUrl = `${CLOUD_STORAGE_BASE_URL}/${filename}`;

      await dbClient.query(
        'UPDATE drinks SET image = $1 WHERE id = $2',
        [cloudStorageUrl, drink.id]
      );

      updated++;
      
      if (updated % 100 === 0) {
        console.log(`   Updated ${updated} drinks...`);
      }
    } catch (error) {
      console.error(`   ❌ Error updating drink ${drink.id} (${drink.name}): ${error.message}`);
      errors++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`✅ Updated: ${updated}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`\n🌐 Cloud Storage base URL: ${CLOUD_STORAGE_BASE_URL}`);

  await dbClient.end();
}

main()
  .then(() => {
    console.log('\n✅ Image URL update complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Update failed:', error);
    process.exit(1);
  });
