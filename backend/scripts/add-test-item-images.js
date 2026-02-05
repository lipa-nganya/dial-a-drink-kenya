/**
 * Add placeholder images for test items that are missing images
 * Uses representative images from the same category
 * 
 * Usage (from backend/):
 *   node scripts/add-test-item-images.js
 */

const { Client } = require('pg');
const { execSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLOUD_STORAGE_BUCKET = 'dialadrink-production-images';
const CLOUD_STORAGE_BASE_URL = 'https://storage.googleapis.com/dialadrink-production-images/products';
const TEMP_DIR = path.join(os.tmpdir(), 'test-item-images');

// Database connection
const dbClient = new Client({
  host: '35.223.10.1',
  port: 5432,
  user: 'dialadrink_app',
  password: 'E7A3IIa60hFD3bkGH1XAiryvB',
  database: 'dialadrink_prod',
  ssl: { require: true, rejectUnauthorized: false }
});

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : require('http');
    
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
    
    execSync(`gcloud storage cp "${filepath}" "${gsPath}" --project dialadrink-production`, {
      stdio: 'pipe'
    });
    
    return `${CLOUD_STORAGE_BASE_URL}/${filename}`;
  } catch (error) {
    throw new Error(`Failed to upload to Cloud Storage: ${error.message}`);
  }
}

async function getCategoryRepresentativeImage(categoryId) {
  // Get a drink from the same category that has an image
  const result = await dbClient.query(`
    SELECT image 
    FROM drinks 
    WHERE "categoryId" = $1 
      AND image IS NOT NULL 
      AND image != ''
      AND image LIKE '%storage.googleapis.com%'
    LIMIT 1
  `, [categoryId]);
  
  if (result.rows.length > 0) {
    return result.rows[0].image;
  }
  
  return null;
}

async function addImageToTestItem(drinkId, drinkName, categoryId) {
  try {
    console.log(`\n📥 Processing: ${drinkName} (ID: ${drinkId})...`);
    
    // Get a representative image from the same category
    const representativeImage = await getCategoryRepresentativeImage(categoryId);
    
    if (!representativeImage) {
      console.log(`   ⚠️  No representative image found in category, skipping...`);
      return { success: false, error: 'No representative image found' };
    }
    
    console.log(`   ✅ Found representative image: ${representativeImage.substring(0, 80)}...`);
    
    // Create temp directory
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
    
    // Download the representative image
    const filename = `test_${drinkId}_${drinkName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.jpg`;
    const tempFile = path.join(TEMP_DIR, filename);
    
    console.log(`   📥 Downloading representative image...`);
    await downloadImage(representativeImage, tempFile);
    const stats = fs.statSync(tempFile);
    console.log(`   ✅ Downloaded ${(stats.size / 1024).toFixed(1)}KB`);
    
    // Upload to Cloud Storage with test prefix
    const cloudStorageFilename = `test_${drinkId}_${path.basename(representativeImage).split('/').pop()}`;
    console.log(`   📤 Uploading to Cloud Storage as: ${cloudStorageFilename}`);
    
    const cloudStorageUrl = await uploadToCloudStorage(tempFile, cloudStorageFilename);
    console.log(`   ✅ Uploaded to: ${cloudStorageUrl}`);
    
    // Update database
    await dbClient.query(
      'UPDATE drinks SET image = $1 WHERE id = $2',
      [cloudStorageUrl, drinkId]
    );
    
    console.log(`   ✅ Updated database`);
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
    
    return { success: true, url: cloudStorageUrl };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🔄 Adding images to test items...\n');

  // Create temp directory
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  await dbClient.connect();
  console.log('✅ Connected to production database\n');

  // Get test items
  const result = await dbClient.query(`
    SELECT 
      d.id, 
      d.name, 
      d."categoryId",
      c.name as category_name
    FROM drinks d 
    LEFT JOIN categories c ON d."categoryId" = c.id 
    WHERE d.id IN (1826, 53, 1827)
      AND (d.image IS NULL OR d.image = '')
    ORDER BY d.id
  `);

  const testItems = result.rows;
  console.log(`Found ${testItems.length} test items without images\n`);

  if (testItems.length === 0) {
    console.log('✅ All test items already have images!');
    await dbClient.end();
    return;
  }

  let success = 0;
  let failed = 0;

  for (const item of testItems) {
    const result = await addImageToTestItem(item.id, item.name, item.categoryId);
    
    if (result.success) {
      success++;
    } else {
      failed++;
    }
    
    // Small delay between items
    if (testItems.indexOf(item) < testItems.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n=== Summary ===');
  console.log(`✅ Successfully added images: ${success}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total processed: ${testItems.length}`);

  // Verify
  const verifyResult = await dbClient.query(`
    SELECT id, name, image 
    FROM drinks 
    WHERE id IN (1826, 53, 1827)
    ORDER BY id
  `);
  
  console.log('\n🔍 Verification:');
  verifyResult.rows.forEach(d => {
    const hasImage = d.image && d.image !== '';
    console.log(`  ${d.id}: ${d.name} -> ${hasImage ? '✅ Has image' : '❌ No image'}`);
    if (hasImage) {
      console.log(`    ${d.image.substring(0, 80)}...`);
    }
  });

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
    console.log('\n✅ Test item image addition complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
