/**
 * Remove all Cloudinary URLs from the production database
 * Downloads images and uploads to Cloud Storage using gcloud commands
 * 
 * Usage (from backend/):
 *   node scripts/remove-cloudinary-urls-gcloud.js
 */

const { Client } = require('pg');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLOUD_STORAGE_BUCKET = 'dialadrink-production-images';
const CLOUD_STORAGE_BASE_URL = 'https://storage.googleapis.com/dialadrink-production-images/products';
const TEMP_DIR = path.join(os.tmpdir(), 'cloudinary-migration');

// Database connection
const dbClient = new Client({
  host: '35.223.10.1',
  port: 5432,
  user: 'dialadrink_app',
  password: 'E7A3IIa60hFD3bkGH1XAiryvB',
  database: 'dialadrink_prod',
  ssl: { require: true, rejectUnauthorized: false }
});

function getFilenameFromUrl(url, prefix = '') {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    let filename = pathParts[pathParts.length - 1];
    
    // Clean up filename
    filename = filename.split('?')[0];
    
    // Ensure it has an extension
    if (!filename.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
      const extMatch = url.match(/\.(jpg|jpeg|png|webp|gif)/i);
      filename = extMatch ? `image_${Date.now()}.${extMatch[1]}` : `image_${Date.now()}.jpg`;
    }
    
    return prefix + filename;
  } catch (e) {
    return prefix + `image_${Date.now()}.jpg`;
  }
}

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(filepath);
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
      
      file.on('error', (err) => {
        fs.unlink(filepath, () => {});
        reject(err);
      });
    });

    request.on('error', reject);
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

async function uploadToCloudStorage(filepath, filename) {
  try {
    const gsPath = `gs://${CLOUD_STORAGE_BUCKET}/products/${filename}`;
    
    // Use gcloud storage cp command
    execSync(`gcloud storage cp "${filepath}" "${gsPath}" --project dialadrink-production`, {
      stdio: 'pipe'
    });
    
    return `${CLOUD_STORAGE_BASE_URL}/${filename}`;
  } catch (error) {
    throw new Error(`Failed to upload to Cloud Storage: ${error.message}`);
  }
}

async function processCloudinaryUrlForTable(item, tableName) {
  let tempFile = null;
  
  try {
    console.log(`\n📥 Processing ${tableName} ${item.id} (${item.name})...`);
    console.log(`   Cloudinary URL: ${item.image.substring(0, 80)}...`);
    
    // Remove Cloudinary transformations
    let cleanUrl = item.image
      .replace(/\/c_fit,f_auto,h_\d+,w_\d+\//, '/')
      .replace(/\/c_fill,f_auto,h_\d+,w_\d+\//, '/')
      .replace(/\/w_\d+,h_\d+,c_fit\//, '/')
      .replace(/\/c_fit\//, '/')
      .replace(/\/f_auto\//, '/')
      .split('?')[0];
    
    // Get filename with prefix
    const prefix = tableName === 'brands' ? 'brand_' : tableName === 'categories' ? 'category_' : '';
    const filename = getFilenameFromUrl(cleanUrl, prefix);
    tempFile = path.join(TEMP_DIR, filename);
    
    // Download image
    console.log(`   Downloading from: ${cleanUrl.substring(0, 80)}...`);
    await downloadImage(cleanUrl, tempFile);
    const stats = fs.statSync(tempFile);
    console.log(`   ✅ Downloaded ${(stats.size / 1024).toFixed(1)}KB`);
    
    // Upload to Cloud Storage
    console.log(`   📤 Uploading to Cloud Storage as: ${filename}`);
    const cloudStorageUrl = await uploadToCloudStorage(tempFile, filename);
    console.log(`   ✅ Uploaded to: ${cloudStorageUrl}`);
    
    // Update database
    await dbClient.query(
      `UPDATE ${tableName} SET image = $1 WHERE id = $2`,
      [cloudStorageUrl, item.id]
    );
    
    console.log(`   ✅ Updated database`);
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
    tempFile = null;
    
    return { success: true, url: cloudStorageUrl };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    
    // Clean up temp file if it exists
    if (tempFile && fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    
    // Set image to null if download/upload fails
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
  console.log('🔄 Removing Cloudinary URLs from production database...\n');

  // Create temp directory
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  await dbClient.connect();
  console.log('✅ Connected to production database\n');

  // Find all items with Cloudinary URLs
  const [drinksResult, brandsResult, categoriesResult] = await Promise.all([
    dbClient.query(`SELECT id, name, image FROM drinks WHERE image LIKE '%cloudinary.com%' ORDER BY id`),
    dbClient.query(`SELECT id, name, image FROM brands WHERE image LIKE '%cloudinary.com%' ORDER BY id`),
    dbClient.query(`SELECT id, name, image FROM categories WHERE image LIKE '%cloudinary.com%' ORDER BY id`)
  ]);

  const drinks = drinksResult.rows;
  const brands = brandsResult.rows;
  const categories = categoriesResult.rows;
  
  const total = drinks.length + brands.length + categories.length;
  
  console.log(`Found:`);
  console.log(`  Drinks: ${drinks.length} Cloudinary URLs`);
  console.log(`  Brands: ${brands.length} Cloudinary URLs`);
  console.log(`  Categories: ${categories.length} Cloudinary URLs`);
  console.log(`  Total: ${total} Cloudinary URLs\n`);

  if (total === 0) {
    console.log('✅ No Cloudinary URLs found!');
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
    
    const result = await processCloudinaryUrlForTable(drink, 'drinks');
    
    if (result.success) {
      success++;
    } else {
      failed++;
    }
    
    if (processed < total) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Process brands
  for (let i = 0; i < brands.length; i++) {
    const brand = brands[i];
    processed++;
    console.log(`\n[${processed}/${total}] Processing brand ${brand.id}...`);
    
    const result = await processCloudinaryUrlForTable(brand, 'brands');
    
    if (result.success) {
      success++;
    } else {
      failed++;
    }
    
    if (processed < total) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Process categories
  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    processed++;
    console.log(`\n[${processed}/${total}] Processing category ${category.id}...`);
    
    const result = await processCloudinaryUrlForTable(category, 'categories');
    
    if (result.success) {
      success++;
    } else {
      failed++;
    }
    
    if (processed < total) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n=== Summary ===');
  console.log(`✅ Successfully migrated: ${success}`);
  console.log(`❌ Failed (set to NULL): ${failed}`);
  console.log(`📊 Total processed: ${total}`);

  // Verify no Cloudinary URLs remain
  const [drinksVerify, brandsVerify, categoriesVerify] = await Promise.all([
    dbClient.query(`SELECT COUNT(*) as count FROM drinks WHERE image LIKE '%cloudinary.com%'`),
    dbClient.query(`SELECT COUNT(*) as count FROM brands WHERE image LIKE '%cloudinary.com%'`),
    dbClient.query(`SELECT COUNT(*) as count FROM categories WHERE image LIKE '%cloudinary.com%'`)
  ]);
  
  const remaining = parseInt(drinksVerify.rows[0].count) + 
                    parseInt(brandsVerify.rows[0].count) + 
                    parseInt(categoriesVerify.rows[0].count);
  
  console.log(`\n🔍 Verification:`);
  console.log(`  Drinks: ${drinksVerify.rows[0].count} Cloudinary URLs remaining`);
  console.log(`  Brands: ${brandsVerify.rows[0].count} Cloudinary URLs remaining`);
  console.log(`  Categories: ${categoriesVerify.rows[0].count} Cloudinary URLs remaining`);
  console.log(`  Total remaining: ${remaining}`);

  // Clean up temp directory
  try {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup errors
  }

  await dbClient.end();
}

main()
  .then(() => {
    console.log('\n✅ Cloudinary URL removal complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
