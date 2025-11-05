const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../models');

// Helper to clean Cloudinary URL and get full resolution
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

// Extract image from search page
async function getImageFromSearch(drinkName) {
  const searchMethods = [];
  
  // Method 1: Exact name as slug
  const searchSlug = drinkName.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/'/g, '')
    .replace(/[^a-z0-9-]/g, '');
  searchMethods.push(`/search/${searchSlug}`);
  
  // Method 2: Search query
  searchMethods.push(`/search?query=${encodeURIComponent(drinkName)}`);
  
  // Method 3: Try without brand suffixes (e.g., "Absolut Citron" -> "citron")
  const words = drinkName.toLowerCase().split(' ').filter(w => w.length > 2);
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
      const drinkNameLower = drinkName.toLowerCase();
      
      // Look for Cloudinary product images, prioritize by alt text match
      const cloudinaryImages = [];
      const matchedImages = [];
      
      $('img[src*="cloudinary.com"], img[data-src*="cloudinary.com"]').each((i, img) => {
        const src = $(img).attr('src') || $(img).attr('data-src');
        const alt = ($(img).attr('alt') || '').toLowerCase();
        
        if (src && src.includes('products')) {
          // Check if alt text matches the drink name
          if (alt && (alt.includes(drinkNameLower) || drinkNameLower.includes(alt))) {
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

async function scrapeMissingVodkaImages() {
  try {
    console.log('🔍 Scraping missing vodka images from Dial a Drink Kenya...\n');
    
    await db.sequelize.authenticate();
    console.log('Database connected\n');
    
    const vodkaCategory = await db.Category.findOne({ where: { name: 'Vodka' } });
    if (!vodkaCategory) {
      console.error('Vodka category not found!');
      return;
    }
    
    // Get all vodka items without images
    const vodkasWithoutImages = await db.Drink.findAll({
      where: {
        categoryId: vodkaCategory.id,
        [db.Sequelize.Op.or]: [
          { image: null },
          { image: '' }
        ]
      },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']]
    });
    
    console.log(`Found ${vodkasWithoutImages.length} vodka items without images\n`);
    console.log('Starting image scraping...\n');
    
    let updated = 0;
    let failed = 0;
    
    // Process in batches to avoid overwhelming the server
    for (let i = 0; i < vodkasWithoutImages.length; i++) {
      const vodka = vodkasWithoutImages[i];
      process.stdout.write(`[${i + 1}/${vodkasWithoutImages.length}] ${vodka.name}... `);
      
      const imageUrl = await getImageFromSearch(vodka.name);
      
      if (imageUrl) {
        try {
          await vodka.update({ image: imageUrl });
          console.log(`✅`);
          updated++;
        } catch (error) {
          console.log(`❌ DB Error: ${error.message}`);
          failed++;
        }
      } else {
        console.log(`✗ Not found`);
        failed++;
      }
      
      // Add a small delay between requests to be respectful
      if (i < vodkasWithoutImages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 800)); // 0.8 second delay
      }
    }
    
    console.log(`\n✅ Scraping completed!`);
    console.log(`- Updated: ${updated}`);
    console.log(`- Failed: ${failed}`);
    console.log(`- Total processed: ${vodkasWithoutImages.length}`);
    
  } catch (error) {
    console.error('Error scraping vodka images:', error);
  } finally {
    await db.sequelize.close();
  }
}

scrapeMissingVodkaImages()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

