/**
 * Remove all Cloudinary URLs from the production database
 * 
 * This script:
 * 1. Finds all drinks with Cloudinary image URLs
 * 2. Attempts to download the image and upload to Cloud Storage
 * 3. Updates the database with the new Cloud Storage URL
 * 4. If download fails, sets image to null
 * 
 * Usage (from backend/):
 *   node scripts/remove-cloudinary-urls.js
 */

const { Client } = require('pg');
const https = require('https');
const http = require('http');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs');

const CLOUD_STORAGE_BUCKET = 'dialadrink-production-images';
const CLOUD_STORAGE_BASE_URL = 'https://storage.googleapis.com/dialadrink-production-images/products';

// Database connection
const dbClient = new Client({
  host: '35.223.10.1',
  port: 5432,
  user: 'dialadrink_app',
  password: 'E7A3IIa60hFD3bkGH1XAiryvB',
  database: 'dialadrink_prod',
  ssl: { require: true, rejectUnauthorized: false }
});

// Cloud Storage client
const storage = new Storage({
  projectId: 'dialadrink-production'
});

function getFilenameFromUrl(url) {
  try {
    // Extract filename from Cloudinary URL
    // Example: https://res.cloudinary.com/xxx/image/upload/v1234567890/filename.jpg
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const filename = pathParts[pathParts.length - 1];
    
    // Clean up filename - remove any query params or transformations
    const cleanFilename = filename.split('?')[0];
    
    // Ensure it has an extension
    if (!cleanFilename.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
      // Try to get extension from URL or default to jpg
      const extMatch = url.match(/\.(jpg|jpeg|png|webp|gif)/i);
      return extMatch ? `image_${Date.now()}.${extMatch[1]}` : `image_${Date.now()}.jpg`;
    }
    
    return cleanFilename;
  } catch (e) {
    return `image_${Date.now()}.jpg`;
  }
}

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
    });

    request.on('error', reject);
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

async function uploadToCloudStorage(buffer, filename) {
  const bucket = storage.bucket(CLOUD_STORAGE_BUCKET);
  const file = bucket.file(`products/${filename}`);
  
  await file.save(buffer, {
    metadata: {
      contentType: filename.endsWith('.webp') ? 'image/webp' :
                   filename.endsWith('.png') ? 'image/png' :
                   filename.endsWith('.gif') ? 'image/gif' : 'image/jpeg',
      cacheControl: 'public, max-age=31536000',
    },
    public: true
  });
  
  return `${CLOUD_STORAGE_BASE_URL}/${filename}`;
}


async function processCloudinaryUrlForTable(item, tableName) {
  try {
    console.log(`\n📥 Processing ${tableName} ${item.id} (${item.name})...`);
    console.log(`   Cloudinary URL: ${item.image.substring(0, 80)}...`);
    
    // Remove Cloudinary transformations for better quality
    let cleanUrl = item.image
      .replace(/\/c_fit,f_auto,h_\d+,w_\d+\//, '/')
      .replace(/\/c_fill,f_auto,h_\d+,w_\d+\//, '/')
      .replace(/\/w_\d+,h_\d+,c_fit\//, '/')
      .replace(/\/c_fit\//, '/')
      .replace(/\/f_auto\//, '/')
      .split('?')[0]; // Remove query params
    
    // Download image
    console.log(`   Downloading from: ${cleanUrl.substring(0, 80)}...`);
    const imageBuffer = await downloadImage(cleanUrl);
    console.log(`   ✅ Downloaded ${(imageBuffer.length / 1024).toFixed(1)}KB`);
    
    // Get filename - use table name prefix for brands/categories
    const prefix = tableName === 'brands' ? 'brand_' : tableName === 'categories' ? 'category_' : '';
    const filename = prefix + getFilenameFromUrl(cleanUrl);
    console.log(`   📤 Uploading to Cloud Storage as: ${filename}`);
    
    // Upload to Cloud Storage
    const cloudStorageUrl = await uploadToCloudStorage(imageBuffer, filename);
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
