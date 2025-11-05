const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../models');

// Map of drink names to their search URLs
const drinksToUpdate = [
  { name: 'Absolute Apeach', url: 'https://www.dialadrinkkenya.com/search/absolute-apeach' },
  { name: 'Absolute Oak', url: 'https://www.dialadrinkkenya.com/search/absolute-oak' },
  { name: 'Absolute Pears', url: 'https://www.dialadrinkkenya.com/search/absolute-pears' },
  { name: 'Absolute Pepper', url: 'https://www.dialadrinkkenya.com/search/absolute-pepper' },
  { name: 'Absolute Unique', url: 'https://www.dialadrinkkenya.com/search/absolute-unique' },
  { name: 'Absolute mango', url: 'https://www.dialadrinkkenya.com/search/absolute-mango' },
  { name: 'Beluga Celebration', url: 'https://www.dialadrinkkenya.com/search/beluga-celebration' },
  { name: 'Beluga Gold', url: 'https://www.dialadrinkkenya.com/search/beluga-gold' },
  { name: 'Beluga Noble Silver', url: 'https://www.dialadrinkkenya.com/search/beluga-noble-silver' }
];

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

async function getImageFromPage(url, drinkName) {
  try {
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // Look for product images - prioritize images with the product name in alt or src
    const productImages = $('img').filter((i, el) => {
      const src = $(el).attr('src') || '';
      const alt = ($(el).attr('alt') || '').toLowerCase();
      const drinkNameLower = drinkName.toLowerCase();
      
      return src.includes('cloudinary.com') && 
             (src.includes('product') || 
              alt.includes(drinkNameLower.split(' ')[0]) ||
              alt.includes(drinkNameLower.split(' ')[1]));
    });
    
    // Get the first matching image
    if (productImages.length > 0) {
      const imageUrl = productImages.first().attr('src');
      return cleanCloudinaryUrl(imageUrl);
    }
    
    // Fallback: look for any Cloudinary product image
    const anyProductImage = $('img[src*="cloudinary.com"][src*="product"]').first().attr('src');
    if (anyProductImage) {
      return cleanCloudinaryUrl(anyProductImage);
    }
    
    // Last resort: any Cloudinary image
    const anyCloudinaryImage = $('img[src*="cloudinary.com/dyc0ieeyu"]').first().attr('src');
    if (anyCloudinaryImage && !anyCloudinaryImage.includes('logo')) {
      return cleanCloudinaryUrl(anyCloudinaryImage);
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    return null;
  }
}

async function updateVodkaImages() {
  try {
    console.log('🖼️  Updating vodka images from dialadrinkkenya.com...\n');
    await db.sequelize.authenticate();
    console.log('Database connected\n');

    const vodkaCategory = await db.Category.findOne({ where: { name: 'Vodka' } });
    if (!vodkaCategory) {
      console.error('Vodka category not found!');
      return;
    }

    let updated = 0;
    let failed = 0;

    for (let i = 0; i < drinksToUpdate.length; i++) {
      const { name, url } = drinksToUpdate[i];
      process.stdout.write(`[${i + 1}/${drinksToUpdate.length}] ${name}... `);

      // Find the drink
      const drink = await db.Drink.findOne({
        where: {
          name: name,
          categoryId: vodkaCategory.id
        }
      });

      if (!drink) {
        console.log('❌ Not found in database');
        failed++;
        continue;
      }

      // Get image URL
      const imageUrl = await getImageFromPage(url, name);

      if (imageUrl) {
        try {
          await drink.update({ image: imageUrl });
          console.log('✅');
          updated++;
        } catch (error) {
          console.log(`❌ DB Error: ${error.message}`);
          failed++;
        }
      } else {
        console.log('✗ No image found');
        failed++;
      }

      // Add delay to avoid overwhelming the server
      if (i < drinksToUpdate.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }

    console.log(`\n✅ Image update complete!`);
    console.log(`- Updated: ${updated}`);
    console.log(`- Failed: ${failed}`);
    console.log(`- Total processed: ${drinksToUpdate.length}`);

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

