/**
 * Migrate all local image paths to Cloud Storage
 * Handles brands, drinks, and categories with local image paths
 * 
 * Usage (from backend/):
 *   node scripts/migrate-all-local-images-to-cloud-storage.js
 */

const { Client } = require('pg');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CLOUD_STORAGE_BUCKET = 'dialadrink-production-images';
const CLOUD_STORAGE_BASE_URL = 'https://storage.googleapis.com/dialadrink-production-images/products';
const BACKEND_DIR = path.join(__dirname, '..');
const PUBLIC_IMAGES_DIR = path.join(BACKEND_DIR, 'public', 'images');

// Database connection
const dbClient = new Client({
  host: '35.223.10.1',
  port: 5432,
  user: 'dialadrink_app',
  password: 'E7A3IIa60hFD3bkGH1XAiryvB',
  database: 'dialadrink_prod',
  ssl: { require: true, rejectUnauthorized: false }
});

function getLocalFilePath(imagePath) {
  // Remove leading slash if present
  let cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
  
  // If path starts with 'images/', it's relative to public/
  if (cleanPath.startsWith('images/')) {
    return path.join(BACKEND_DIR, 'public', cleanPath);
  }
  
  // Otherwise, try relative to backend directory
  return path.join(BACKEND_DIR, cleanPath);
}

function getCloudStorageFilename(imagePath, tableName) {
  // Extract filename from path
  const filename = path.basename(imagePath);
  
  // Add prefix based on table
  const prefix = tableName === 'brands' ? 'brand_' : 
                 tableName === 'categories' ? 'category_' : '';
  
  return prefix + filename;
}

async function uploadToCloudStorage(localFilePath, filename) {
  try {
    const gsPath = `gs://${CLOUD_STORAGE_BUCKET}/products/${filename}`;
    
    // Use gcloud storage cp command
    execSync(`gcloud storage cp "${localFilePath}" "${gsPath}" --project dialadrink-production`, {
      stdio: 'pipe'
    });
    
    return `${CLOUD_STORAGE_BASE_URL}/${filename}`;
  } catch (error) {
    throw new Error(`Failed to upload to Cloud Storage: ${error.message}`);
  }
}

async function processLocalImage(item, tableName) {
  try {
    console.log(`\n📥 Processing ${tableName} ${item.id} (${item.name})...`);
    console.log(`   Local path: ${item.image}`);
    
    // Get local file path
    const localFilePath = getLocalFilePath(item.image);
    
    // Check if file exists
    if (!fs.existsSync(localFilePath)) {
      console.log(`   ⚠️  File not found: ${localFilePath}`);
      // Set to null if file doesn't exist
      await dbClient.query(
        `UPDATE ${tableName} SET image = NULL WHERE id = $1`,
        [item.id]
      );
      console.log(`   ⚠️  Set image to NULL`);
      return { success: false, error: 'File not found' };
    }
    
    // Get file stats
    const stats = fs.statSync(localFilePath);
    console.log(`   ✅ File found: ${(stats.size / 1024).toFixed(1)}KB`);
    
    // Get Cloud Storage filename
    const filename = getCloudStorageFilename(item.image, tableName);
    console.log(`   📤 Uploading to Cloud Storage as: ${filename}`);
    
    // Upload to Cloud Storage
    const cloudStorageUrl = await uploadToCloudStorage(localFilePath, filename);
    console.log(`   ✅ Uploaded to: ${cloudStorageUrl}`);
    
    // Update database
    await dbClient.query(
      `UPDATE ${tableName} SET image = $1 WHERE id = $2`,
      [cloudStorageUrl, item.id]
    );
    
    console.log(`   ✅ Updated database`);
    
    return { success: true, url: cloudStorageUrl };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    
    // Set image to null if upload fails
    try {
      await dbClient.query(
        `UPDATE ${tableName} SET image = NULL WHERE id = $1`,
        [item.id]
      );
      console.log(`   ⚠️  Set image to NULL`);
    } catch (dbError) {
      console.error(`   ❌ Failed to update database: ${dbError.message}`);
    }
    
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🔄 Migrating all local images to Cloud Storage...\n');

  await dbClient.connect();
  console.log('✅ Connected to production database\n');

  // Find all items with local image paths (not Cloud Storage, not Cloudinary)
  const [drinksResult, brandsResult, categoriesResult] = await Promise.all([
    dbClient.query(`
      SELECT id, name, image 
      FROM drinks 
      WHERE image IS NOT NULL 
        AND image != ''
        AND image NOT LIKE '%storage.googleapis.com%'
        AND image NOT LIKE '%cloudinary.com%'
        AND image NOT LIKE 'http%'
      ORDER BY id
    `),
    dbClient.query(`
      SELECT id, name, image 
      FROM brands 
      WHERE image IS NOT NULL 
        AND image != ''
        AND image NOT LIKE '%storage.googleapis.com%'
        AND image NOT LIKE '%cloudinary.com%'
        AND image NOT LIKE 'http%'
      ORDER BY id
    `),
    dbClient.query(`
      SELECT id, name, image 
      FROM categories 
      WHERE image IS NOT NULL 
        AND image != ''
        AND image NOT LIKE '%storage.googleapis.com%'
        AND image NOT LIKE '%cloudinary.com%'
        AND image NOT LIKE 'http%'
      ORDER BY id
    `)
  ]);

  const drinks = drinksResult.rows;
  const brands = brandsResult.rows;
  const categories = categoriesResult.rows;
  
  const total = drinks.length + brands.length + categories.length;
  
  console.log(`Found:`);
  console.log(`  Drinks: ${drinks.length} with local paths`);
  console.log(`  Brands: ${brands.length} with local paths`);
  console.log(`  Categories: ${categories.length} with local paths`);
  console.log(`  Total: ${total} items to migrate\n`);

  if (total === 0) {
    console.log('✅ No local image paths found!');
    await dbClient.end();
    return;
  }

  let success = 0;
  let failed = 0;
  let processed = 0;

  // Process drinks
  for (let i = 0; i < drinks.length; i++) {
    const drink = drinks[i];
    processed++;
    console.log(`\n[${processed}/${total}] Processing drink ${drink.id}...`);
    
    const result = await processLocalImage(drink, 'drinks');
    
    if (result.success) {
      success++;
    } else {
      failed++;
    }
    
    if (processed < total) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Process brands
  for (let i = 0; i < brands.length; i++) {
    const brand = brands[i];
    processed++;
    console.log(`\n[${processed}/${total}] Processing brand ${brand.id}...`);
    
    const result = await processLocalImage(brand, 'brands');
    
    if (result.success) {
      success++;
    } else {
      failed++;
    }
    
    if (processed < total) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Process categories
  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    processed++;
    console.log(`\n[${processed}/${total}] Processing category ${category.id}...`);
    
    const result = await processLocalImage(category, 'categories');
    
    if (result.success) {
      success++;
    } else {
      failed++;
    }
    
    if (processed < total) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log('\n=== Summary ===');
  console.log(`✅ Successfully migrated: ${success}`);
  console.log(`❌ Failed (set to NULL): ${failed}`);
  console.log(`📊 Total processed: ${total}`);

  // Verify all images are in Cloud Storage or null
  const [drinksVerify, brandsVerify, categoriesVerify] = await Promise.all([
    dbClient.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN image LIKE '%storage.googleapis.com%' THEN 1 END) as cloud_storage,
        COUNT(CASE WHEN image LIKE '%cloudinary.com%' THEN 1 END) as cloudinary,
        COUNT(CASE WHEN image IS NOT NULL AND image != '' AND image NOT LIKE '%storage.googleapis.com%' AND image NOT LIKE '%cloudinary.com%' THEN 1 END) as other
      FROM drinks
    `),
    dbClient.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN image LIKE '%storage.googleapis.com%' THEN 1 END) as cloud_storage,
        COUNT(CASE WHEN image LIKE '%cloudinary.com%' THEN 1 END) as cloudinary,
        COUNT(CASE WHEN image IS NOT NULL AND image != '' AND image NOT LIKE '%storage.googleapis.com%' AND image NOT LIKE '%cloudinary.com%' THEN 1 END) as other
      FROM brands
    `),
    dbClient.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN image LIKE '%storage.googleapis.com%' THEN 1 END) as cloud_storage,
        COUNT(CASE WHEN image LIKE '%cloudinary.com%' THEN 1 END) as cloudinary,
        COUNT(CASE WHEN image IS NOT NULL AND image != '' AND image NOT LIKE '%storage.googleapis.com%' AND image NOT LIKE '%cloudinary.com%' THEN 1 END) as other
      FROM categories
    `)
  ]);
  
  console.log(`\n🔍 Final Verification:`);
  console.log(`\nDrinks:`);
  console.log(`  Total: ${drinksVerify.rows[0].total}`);
  console.log(`  Cloud Storage: ${drinksVerify.rows[0].cloud_storage}`);
  console.log(`  Cloudinary: ${drinksVerify.rows[0].cloudinary}`);
  console.log(`  Other/Null: ${drinksVerify.rows[0].other}`);
  
  console.log(`\nBrands:`);
  console.log(`  Total: ${brandsVerify.rows[0].total}`);
  console.log(`  Cloud Storage: ${brandsVerify.rows[0].cloud_storage}`);
  console.log(`  Cloudinary: ${brandsVerify.rows[0].cloudinary}`);
  console.log(`  Other/Null: ${brandsVerify.rows[0].other}`);
  
  console.log(`\nCategories:`);
  console.log(`  Total: ${categoriesVerify.rows[0].total}`);
  console.log(`  Cloud Storage: ${categoriesVerify.rows[0].cloud_storage}`);
  console.log(`  Cloudinary: ${categoriesVerify.rows[0].cloudinary}`);
  console.log(`  Other/Null: ${categoriesVerify.rows[0].other}`);

  const totalCloudinary = parseInt(drinksVerify.rows[0].cloudinary) + 
                          parseInt(brandsVerify.rows[0].cloudinary) + 
                          parseInt(categoriesVerify.rows[0].cloudinary);
  
  if (totalCloudinary === 0) {
    console.log(`\n✅ No Cloudinary URLs remaining!`);
  } else {
    console.log(`\n⚠️  Warning: ${totalCloudinary} Cloudinary URLs still exist!`);
  }

  await dbClient.end();
}

main()
  .then(() => {
    console.log('\n✅ Local image migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
