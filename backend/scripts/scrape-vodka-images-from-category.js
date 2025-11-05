const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../models');

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

function normalizeName(name) {
  return name.toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/&/g, 'and')
    .replace(/[.,]/g, '');
}

async function scrapeVodkaCategoryPage() {
  try {
    console.log('🔍 Scraping vodka category page from dialadrinkkenya.com...\n');
    
    const url = 'https://www.dialadrinkkenya.com/category/vodka';
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const productMap = new Map();
    
    // Find all product cards/items on the page
    $('[class*="product"], [class*="card"]').each((i, el) => {
      const $el = $(el);
      
      // Try to find product name - look for common patterns
      let productName = null;
      
      // Method 1: Look for h1, h2, h3, h4 with product name
      const headings = $el.find('h1, h2, h3, h4, h5, h6, .product-name, .title, [class*="name"]').first();
      if (headings.length > 0) {
        productName = headings.text().trim();
      }
      
      // Method 2: Look in the entire card text
      if (!productName || productName.length < 3) {
        const text = $el.text();
        // Try to extract product name from structured text
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5 && l.length < 100);
        for (const line of lines) {
          // Look for lines that might be product names (usually first or have ABV info nearby)
          if (line.match(/^[A-Z][a-zA-Z\s&]+$/) && !line.includes('KES') && !line.includes('%')) {
            productName = line;
            break;
          }
        }
      }
      
      // Find image
      const $img = $el.find('img').first();
      let imageUrl = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src');
      
      if (productName && imageUrl && imageUrl.includes('cloudinary')) {
        const normalized = normalizeName(productName);
        const cleanedUrl = cleanCloudinaryUrl(imageUrl);
        
        if (cleanedUrl && !cleanedUrl.includes('logo')) {
          // Only store if we don't have it or if this one is better
          if (!productMap.has(normalized) || cleanedUrl.includes('product')) {
            productMap.set(normalized, { name: productName, image: cleanedUrl });
          }
        }
      }
    });
    
    // Alternative: Look for all images with product names in alt text or nearby text
    $('img[src*="cloudinary"]').each((i, el) => {
      const $img = $(el);
      const src = $img.attr('src') || $img.attr('data-src');
      
      if (!src || src.includes('logo')) return;
      
      // Try to find associated product name
      let productName = null;
      
      // Check alt text
      const alt = $img.attr('alt') || '';
      if (alt.length > 5 && alt.length < 100) {
        productName = alt.trim();
      }
      
      // Check parent elements
      if (!productName) {
        const parent = $img.parent();
        const text = parent.text().trim();
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5 && l.length < 100);
        if (lines.length > 0) {
          productName = lines[0];
        }
      }
      
      // Check nearby siblings
      if (!productName) {
        const siblings = $img.siblings();
        siblings.each((i, sib) => {
          const text = $(sib).text().trim();
          if (text.length > 5 && text.length < 100 && text.match(/^[A-Z]/)) {
            productName = text;
            return false;
          }
        });
      }
      
      if (productName) {
        const normalized = normalizeName(productName);
        const cleanedUrl = cleanCloudinaryUrl(src);
        
        if (cleanedUrl && !cleanedUrl.includes('logo')) {
          if (!productMap.has(normalized) || cleanedUrl.includes('product')) {
            productMap.set(normalized, { name: productName, image: cleanedUrl });
          }
        }
      }
    });
    
    console.log(`Found ${productMap.size} products with images on the page\n`);
    
    return productMap;
    
  } catch (error) {
    console.error('Error scraping category page:', error.message);
    return new Map();
  }
}

async function updateVodkaImages() {
  try {
    await db.sequelize.authenticate();
    console.log('Database connected\n');

    const vodkaCategory = await db.Category.findOne({ where: { name: 'Vodka' } });
    if (!vodkaCategory) {
      console.error('Vodka category not found!');
      return;
    }

    // Get all vodkas without proper images
    const vodkasWithoutImages = await db.Drink.findAll({
      where: {
        categoryId: vodkaCategory.id,
        [db.Sequelize.Op.or]: [
          { image: null },
          { image: '' },
          { image: { [db.Sequelize.Op.like]: '/images/%' } }
        ]
      },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']]
    });

    console.log(`Found ${vodkasWithoutImages.length} vodka items missing images\n`);

    // Scrape the category page
    const productMap = await scrapeVodkaCategoryPage();

    if (productMap.size === 0) {
      console.log('⚠️  No products found on category page. Cannot update images.');
      return;
    }

    let updated = 0;
    let notFound = 0;

    console.log('Updating images...\n');

    for (let i = 0; i < vodkasWithoutImages.length; i++) {
      const vodka = vodkasWithoutImages[i];
      const normalized = normalizeName(vodka.name);
      
      process.stdout.write(`[${i + 1}/${vodkasWithoutImages.length}] ${vodka.name}... `);

      // Try exact match
      let match = productMap.get(normalized);
      
      // Try partial matches
      if (!match) {
        for (const [key, value] of productMap.entries()) {
          // Check if names are very similar (one contains the other)
          if (normalized.includes(key) || key.includes(normalized)) {
            const longer = normalized.length > key.length ? normalized : key;
            const shorter = normalized.length > key.length ? key : normalized;
            // If 80% match, use it
            if (shorter.length / longer.length >= 0.8) {
              match = value;
              break;
            }
          }
        }
      }
      
      // Try brand-only matches (e.g., "Grey Goose Vodka" matches "Grey Goose")
      if (!match) {
        const words = normalized.split(' ').filter(w => w.length > 2);
        if (words.length >= 2) {
          const brand = words.slice(0, 2).join(' ');
          for (const [key, value] of productMap.entries()) {
            if (key.startsWith(brand) || brand.startsWith(key.split(' ').slice(0, 2).join(' '))) {
              match = value;
              break;
            }
          }
        }
      }

      if (match && match.image) {
        try {
          await vodka.update({ image: match.image });
          console.log('✅');
          updated++;
        } catch (error) {
          console.log(`❌ DB Error: ${error.message}`);
          notFound++;
        }
      } else {
        console.log('✗ Not found on website');
        notFound++;
      }
    }

    console.log(`\n✅ Image update complete!`);
    console.log(`- Updated: ${updated}`);
    console.log(`- Not found on website: ${notFound}`);
    console.log(`- Total processed: ${vodkasWithoutImages.length}`);

  } catch (error) {
    console.error('Error updating vodka images:', error);
  } finally {
    await db.sequelize.close();
  }
}

updateVodkaImages()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

