/**
 * Update development database image URLs to Cloud Storage URLs
 * 
 * This script updates all drinks, brands, and categories in the development database
 * to use Cloud Storage URLs instead of local paths or missing images.
 * 
 * Usage (from backend/):
 *   node scripts/update-dev-images-to-cloud-storage.js
 */

const { Client } = require('pg');

const CLOUD_STORAGE_BASE_URL = 'https://storage.googleapis.com/dialadrink-production-images/products';

// Development database connection
const DEV_HOST = '34.41.187.250';
const DEV_PORT = 5432;
const DEV_USER = 'dialadrink_app';
const DEV_PASSWORD = 'o61yqm5fLiTwWnk5';
const DEV_DB = 'dialadrink_dev';

const dbClient = new Client({
  host: DEV_HOST,
  port: DEV_PORT,
  user: DEV_USER,
  password: DEV_PASSWORD,
  database: DEV_DB,
  ssl: { require: true, rejectUnauthorized: false }
});

function getFilenameFromPath(path) {
  if (!path) return null;
  // Extract filename from paths like:
  // - /images/products/filename.jpg
  // - /images/products/subdir/filename.jpg
  // - images/products/filename.jpg
  // - https://storage.googleapis.com/.../filename.jpg (already Cloud Storage)
  const match = path.match(/\/([^\/]+\.(jpg|jpeg|png|webp|gif))$/i);
  return match ? match[1] : null;
}

async function updateTableImages(tableName, tableDisplayName) {
  console.log(`\n🔄 Updating ${tableDisplayName} images...\n`);

  // Get all items with local image paths or null images
  const result = await dbClient.query(`
    SELECT id, name, image
    FROM ${tableName}
    WHERE image IS NOT NULL 
      AND image != ''
      AND (
        image LIKE '/images/%' 
        OR image LIKE 'images/%'
        OR image NOT LIKE 'https://storage.googleapis.com/%'
      )
    ORDER BY id
  `);

  console.log(`Found ${result.rows.length} ${tableDisplayName.toLowerCase()} with local/missing image paths\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of result.rows) {
    try {
      const filename = getFilenameFromPath(item.image);
      
      if (!filename) {
        // Try to get filename from Cloud Storage URL if it's already there but wrong bucket
        if (item.image.includes('storage.googleapis.com')) {
          const urlMatch = item.image.match(/\/([^\/]+\.(jpg|jpeg|png|webp|gif))$/i);
          if (urlMatch) {
            const cloudStorageUrl = `${CLOUD_STORAGE_BASE_URL}/${urlMatch[1]}`;
            await dbClient.query(
              `UPDATE ${tableName} SET image = $1 WHERE id = $2`,
              [cloudStorageUrl, item.id]
            );
            updated++;
            continue;
          }
        }
        
        console.log(`⚠️  Skipping ${tableDisplayName.toLowerCase()} ${item.id} (${item.name}): Could not extract filename from ${item.image}`);
        skipped++;
        continue;
      }

      const cloudStorageUrl = `${CLOUD_STORAGE_BASE_URL}/${filename}`;

      await dbClient.query(
        `UPDATE ${tableName} SET image = $1 WHERE id = $2`,
        [cloudStorageUrl, item.id]
      );

      updated++;
      
      if (updated % 50 === 0) {
        console.log(`   Updated ${updated} ${tableDisplayName.toLowerCase()}...`);
      }
    } catch (error) {
      console.error(`   ❌ Error updating ${tableDisplayName.toLowerCase()} ${item.id} (${item.name}): ${error.message}`);
      errors++;
    }
  }

  console.log(`\n=== ${tableDisplayName} Summary ===`);
  console.log(`✅ Updated: ${updated}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);

  return { updated, skipped, errors };
}

async function main() {
  console.log('🔄 Updating development database image URLs to Cloud Storage...\n');
  console.log(`🌐 Cloud Storage base URL: ${CLOUD_STORAGE_BASE_URL}\n`);

  try {
    await dbClient.connect();
    console.log('✅ Connected to development database\n');

    // Update drinks
    const drinksResult = await updateTableImages('drinks', 'Drinks');

    // Update brands
    const brandsResult = await updateTableImages('brands', 'Brands');

    // Update categories
    const categoriesResult = await updateTableImages('categories', 'Categories');

    console.log('\n=== Overall Summary ===');
    console.log(`✅ Drinks updated: ${drinksResult.updated}`);
    console.log(`✅ Brands updated: ${brandsResult.updated}`);
    console.log(`✅ Categories updated: ${categoriesResult.updated}`);
    console.log(`\n⏭️  Total skipped: ${drinksResult.skipped + brandsResult.skipped + categoriesResult.skipped}`);
    console.log(`❌ Total errors: ${drinksResult.errors + brandsResult.errors + categoriesResult.errors}`);
    console.log(`\n🌐 Cloud Storage base URL: ${CLOUD_STORAGE_BASE_URL}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await dbClient.end();
  }
}

main()
  .then(() => {
    console.log('\n✅ Development image URL update complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Update failed:', error);
    process.exit(1);
  });
