/**
 * Add images to categories by using representative drink images
 * Downloads a representative drink image and uploads it as a category image
 * 
 * Usage (from backend/):
 *   node scripts/add-category-images.js
 */

const { Client } = require('pg');
const { execSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLOUD_STORAGE_BUCKET = 'dialadrink-production-images';
const CLOUD_STORAGE_BASE_URL = 'https://storage.googleapis.com/dialadrink-production-images/products';
const TEMP_DIR = path.join(os.tmpdir(), 'category-images');

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
  // Get multiple drinks from the category that have Cloud Storage images
  const result = await dbClient.query(`
    SELECT image 
    FROM drinks 
    WHERE "categoryId" = $1 
      AND image IS NOT NULL 
      AND image != ''
      AND image LIKE '%storage.googleapis.com%'
    ORDER BY id
    LIMIT 10
  `, [categoryId]);
  
  if (result.rows.length > 0) {
    // Return the first image (we'll try multiple if download fails)
    return result.rows.map(row => row.image);
  }
  
  return [];
}

async function addImageToCategory(categoryId, categoryName) {
  try {
    console.log(`\n📥 Processing: ${categoryName} (ID: ${categoryId})...`);
    
    // Get representative images from drinks in this category
    const representativeImages = await getCategoryRepresentativeImage(categoryId);
    
    if (representativeImages.length === 0) {
      console.log(`   ⚠️  No representative image found in category, skipping...`);
      return { success: false, error: 'No representative image found' };
    }
    
    // Create temp directory
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }
    
    // Try each image until one works
    let downloadedImage = null;
    let downloadedFile = null;
    
    for (let i = 0; i < representativeImages.length; i++) {
      const imageUrl = representativeImages[i];
      console.log(`   📥 Trying image ${i + 1}/${representativeImages.length}: ${imageUrl.substring(0, 80)}...`);
      
      try {
        const filename = `category_${categoryId}_${categoryName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${i}.jpg`;
        const tempFile = path.join(TEMP_DIR, filename);
        
        await downloadImage(imageUrl, tempFile);
        const stats = fs.statSync(tempFile);
        
        // Verify file is not empty
        if (stats.size > 0) {
          console.log(`   ✅ Downloaded ${(stats.size / 1024).toFixed(1)}KB`);
          downloadedImage = imageUrl;
          downloadedFile = tempFile;
          break;
        } else {
          console.log(`   ⚠️  Downloaded file is empty, trying next...`);
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }
        }
      } catch (error) {
        console.log(`   ⚠️  Failed to download: ${error.message}, trying next...`);
        continue;
      }
    }
    
    if (!downloadedImage || !downloadedFile) {
      console.log(`   ❌ All image attempts failed`);
      return { success: false, error: 'All image downloads failed' };
    }
    
    // Get file extension from downloaded image
    const originalExt = downloadedImage.match(/\.(jpg|jpeg|png|webp|gif)$/i);
    const ext = originalExt ? originalExt[1] : 'jpg';
    const cloudStorageFilename = `category_${categoryId}_${categoryName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}.${ext}`;
    
    // Rename temp file if needed to match extension
    const finalTempFile = downloadedFile.replace(/\.jpg$/, `.${ext}`);
    if (downloadedFile !== finalTempFile && fs.existsSync(downloadedFile)) {
      fs.renameSync(downloadedFile, finalTempFile);
    }
    
    console.log(`   📤 Uploading to Cloud Storage as: ${cloudStorageFilename}`);
    
    const cloudStorageUrl = await uploadToCloudStorage(
      finalTempFile, 
      cloudStorageFilename
    );
    console.log(`   ✅ Uploaded to: ${cloudStorageUrl}`);
    
    // Update database
    await dbClient.query(
      'UPDATE categories SET image = $1 WHERE id = $2',
      [cloudStorageUrl, categoryId]
    );
    
    console.log(`   ✅ Updated database`);
    
    // Clean up temp files
    if (fs.existsSync(finalTempFile)) {
      fs.unlinkSync(finalTempFile);
    }
    if (fs.existsSync(downloadedFile) && downloadedFile !== finalTempFile) {
      fs.unlinkSync(downloadedFile);
    }
    
    return { success: true, url: cloudStorageUrl };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🔄 Adding images to categories...\n');

  // Create temp directory
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  await dbClient.connect();
  console.log('✅ Connected to production database\n');

  // Get all categories
  const result = await dbClient.query(`
    SELECT id, name, image
    FROM categories
    WHERE "isActive" = true
    ORDER BY id
  `);

  const categories = result.rows;
  console.log(`Found ${categories.length} active categories\n`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const category of categories) {
    // Skip if already has an image
    if (category.image && category.image !== '') {
      console.log(`\n⏭️  Skipping ${category.name} (ID: ${category.id}) - already has image`);
      skipped++;
      continue;
    }
    
    const result = await addImageToCategory(category.id, category.name);
    
    if (result.success) {
      success++;
    } else {
      failed++;
    }
    
    // Small delay between items
    if (categories.indexOf(category) < categories.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n=== Summary ===');
  console.log(`✅ Successfully added images: ${success}`);
  console.log(`⏭️  Skipped (already have images): ${skipped}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total processed: ${categories.length}`);

  // Verify
  const verifyResult = await dbClient.query(`
    SELECT id, name, image 
    FROM categories
    WHERE "isActive" = true
    ORDER BY id
  `);
  
  console.log('\n🔍 Verification:');
  verifyResult.rows.forEach(cat => {
    const hasImage = cat.image && cat.image !== '';
    console.log(`  ${cat.id}: ${cat.name} -> ${hasImage ? '✅ Has image' : '❌ No image'}`);
    if (hasImage) {
      console.log(`    ${cat.image.substring(0, 80)}...`);
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
    console.log('\n✅ Category image addition complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
