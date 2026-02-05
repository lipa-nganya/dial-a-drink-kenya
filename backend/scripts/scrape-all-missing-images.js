const axios = require('axios');
const cheerio = require('cheerio');
const { Client } = require('pg');

// Database connection for dev
const dbClient = new Client({
  host: '34.41.187.250',
  port: 5432,
  user: 'dialadrink_app',
  password: 'o61yqm5fLiTwWnk5',
  database: 'dialadrink_dev',
  ssl: { require: true, rejectUnauthorized: false }
});

// Delay function to avoid rate limiting
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Clean product name for URL search
function cleanProductName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Clean Cloudinary URL and get full resolution
function cleanCloudinaryUrl(url) {
  if (!url) return null;
  
  // If it's a relative URL, make it absolute
  if (url.startsWith('//')) {
    url = 'https:' + url;
  } else if (url.startsWith('/')) {
    url = 'https://www.dialadrinkkenya.com' + url;
  } else if (!url.startsWith('http')) {
    url = 'https://www.dialadrinkkenya.com/' + url;
  }
  
  // Clean Cloudinary transformation parameters to get full resolution
  if (url.includes('cloudinary.com')) {
    // Remove size constraints (h_50,w_50, c_fit, etc.)
    url = url.replace(/\/c_fit[^\/]*\//g, '/');
    url = url.replace(/\/c_fill[^\/]*\//g, '/');
    url = url.replace(/\/w_\d+[^\/]*\//g, '/');
    url = url.replace(/\/h_\d+[^\/]*\//g, '/');
    url = url.replace(/\/f_auto[^\/]*\//g, '/');
    url = url.replace(/\/q_auto[^\/]*\//g, '/');
    
    // Ensure we have /v1/ in the path for full resolution
    if (!url.includes('/v1/') && !url.includes('/v')) {
      url = url.replace('/image/upload/', '/image/upload/v1/');
    }
  }
  
  return url;
}

// Search for product on dialadrinkkenya.com
async function searchProduct(productName) {
  const searchMethods = [];
  
  // Method 1: Exact name as slug
  const searchSlug = productName.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/'/g, '')
    .replace(/[^a-z0-9-]/g, '');
  searchMethods.push(`/search/${searchSlug}`);
  
  // Method 2: Search query
  searchMethods.push(`/search?query=${encodeURIComponent(productName)}`);
  
  // Method 3: Try without brand suffixes (e.g., "Absolut Citron" -> "citron")
  const words = productName.toLowerCase().split(' ').filter(w => w.length > 2);
  if (words.length > 1) {
    // Try just the flavor/variant
    const variant = words[words.length - 1];
    searchMethods.push(`/search?query=${encodeURIComponent(words[0] + ' ' + variant)}`);
    searchMethods.push(`/search/${words[0]}-${variant}`);
  }
  
  for (const searchPath of searchMethods) {
    try {
      const searchUrl = `https://www.dialadrinkkenya.com${searchPath}`;
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 15000
      });
      
      const $ = cheerio.load(response.data);
      const productNameLower = productName.toLowerCase();
      
      // Look for Cloudinary product images, prioritize by alt text match
      const cloudinaryImages = [];
      const matchedImages = [];
      
      $('img[src*="cloudinary.com"], img[data-src*="cloudinary.com"]').each((i, img) => {
        const src = $(img).attr('src') || $(img).attr('data-src');
        const alt = ($(img).attr('alt') || '').toLowerCase();
        
        if (src && src.includes('products')) {
          // Check if alt text matches the product name
          if (alt && (alt.includes(productNameLower) || productNameLower.includes(alt))) {
            matchedImages.push(src);
          } else {
            cloudinaryImages.push(src);
          }
        }
      });
      
      // Prefer matched images, then fallback to any product image
      const selectedImage = (matchedImages.length > 0 ? matchedImages : cloudinaryImages)[0];
      
      if (selectedImage) {
        const imageUrl = cleanCloudinaryUrl(selectedImage);
        if (imageUrl) {
          return imageUrl;
        }
      }
    } catch (error) {
      // Try next method
      continue;
    }
  }
  
  return null;
}

// Update drink image in database
async function updateDrinkImage(drinkId, imageUrl) {
  try {
    await dbClient.query(
      'UPDATE drinks SET image = $1 WHERE id = $2',
      [imageUrl, drinkId]
    );
    return true;
  } catch (error) {
    console.error(`Error updating drink ${drinkId}:`, error.message);
    return false;
  }
}

// Main function
async function scrapeAllMissingImages() {
  try {
    await dbClient.connect();
    console.log('✅ Connected to database\n');

    // Get all drinks with missing or local image paths
    const result = await dbClient.query(`
      SELECT id, name, image
      FROM drinks
      WHERE image IS NULL 
         OR image = ''
         OR image LIKE '/images/%'
      ORDER BY id
    `);

    console.log(`Found ${result.rows.length} drinks with missing or local images\n`);
    console.log('Starting image scraping...\n');

    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    for (let i = 0; i < result.rows.length; i++) {
      const drink = result.rows[i];
      console.log(`[${i + 1}/${result.rows.length}] Processing: ${drink.name} (ID: ${drink.id})`);

      // Skip if already has a valid Cloudinary URL
      if (drink.image && drink.image.startsWith('https://res.cloudinary.com')) {
        console.log(`  ⏭️  Skipping - already has Cloudinary URL`);
        skipCount++;
        continue;
      }

      const imageUrl = await searchProduct(drink.name);

      if (imageUrl) {
        const updated = await updateDrinkImage(drink.id, imageUrl);
        if (updated) {
          console.log(`  ✅ Updated with: ${imageUrl}`);
          successCount++;
        } else {
          console.log(`  ❌ Failed to update database`);
          failCount++;
        }
      } else {
        console.log(`  ⚠️  No image found`);
        failCount++;
      }

      // Rate limiting - wait 0.8 seconds between requests
      if (i < result.rows.length - 1) {
        await delay(800);
      }
    }

    console.log('\n=== Summary ===');
    console.log(`✅ Successfully updated: ${successCount}`);
    console.log(`⏭️  Skipped (already have Cloudinary URLs): ${skipCount}`);
    console.log(`❌ Failed/Not found: ${failCount}`);
    console.log(`📊 Total processed: ${result.rows.length}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await dbClient.end();
  }
}

// Run the script
scrapeAllMissingImages()
  .then(() => {
    console.log('\n✅ Image scraping completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
