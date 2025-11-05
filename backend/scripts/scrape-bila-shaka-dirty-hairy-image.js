const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const db = require('../models');

async function scrapeBilaShakaDirtyHairyImage() {
  try {
    console.log('Scraping Bila Shaka Dirty Hairy Copper Ale image from Chupa Chap website...');
    
    const url = 'https://chupachap.co.ke/product/dirty-hairy-copper-ale/';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    // Look for product images in various common locations
    let imageUrl = null;
    
    // Try different selectors for product images
    const selectors = [
      'img[src*="dirty"]',
      'img[alt*="Dirty"]',
      'img[alt*="Hairy"]',
      'img[alt*="Copper"]',
      'img[alt*="Ale"]',
      '.product-image img',
      '.product-detail img',
      '.product-img img',
      'img[src*="product"]',
      'img[src*="beer"]',
      'img[src*="ale"]',
      '.woocommerce-product-gallery img',
      '.wp-post-image',
      '.attachment-woocommerce_single'
    ];

    for (const selector of selectors) {
      const img = $(selector).first();
      if (img.length && img.attr('src')) {
        imageUrl = img.attr('src');
        console.log(`Found image with selector "${selector}": ${imageUrl}`);
        break;
      }
    }

    if (!imageUrl) {
      console.log('No product image found, trying to find any image...');
      const allImages = $('img[src]');
      allImages.each((i, img) => {
        const src = $(img).attr('src');
        if (src && (src.includes('dirty') || src.includes('hairy') || src.includes('copper') || src.includes('ale') || src.includes('beer') || src.includes('product'))) {
          imageUrl = src;
          console.log(`Found potential image: ${imageUrl}`);
          return false; // break
        }
      });
    }

    if (!imageUrl) {
      console.log('No suitable image found on the page');
      return;
    }

    // Make sure the URL is absolute
    if (imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    } else if (imageUrl.startsWith('/')) {
      imageUrl = 'https://chupachap.co.ke' + imageUrl;
    } else if (!imageUrl.startsWith('http')) {
      imageUrl = 'https://chupachap.co.ke/' + imageUrl;
    }

    console.log(`Final image URL: ${imageUrl}`);

    // Download the image
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Create images directory if it doesn't exist
    const imagesDir = path.join(__dirname, '../public/images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    // Save the image
    const filename = 'bila-shaka-dirty-hairy-copper-ale.jpg';
    const filepath = path.join(imagesDir, filename);
    const writer = fs.createWriteStream(filepath);
    
    imageResponse.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`Image saved as: ${filename}`);
        console.log(`Full path: ${filepath}`);
        resolve(filepath);
      });
      writer.on('error', reject);
    });

    // Update database with image path
    console.log('Updating database with image path...');
    const drink = await db.Drink.findOne({
      where: {
        name: {
          [db.Sequelize.Op.iLike]: '%Dirty Hairy%'
        }
      }
    });

    if (drink) {
      const imagePath = `/images/${filename}`;
      drink.image = imagePath;
      await drink.save();
      console.log(`✅ Updated database: ${drink.name} with image path: ${imagePath}`);
    } else {
      console.log('⚠️  Drink not found in database. Please update manually.');
    }

  } catch (error) {
    console.error('Error scraping Bila Shaka Dirty Hairy image:', error.message);
    throw error;
  } finally {
    await db.sequelize.close();
  }
}

// Run the scraper
scrapeBilaShakaDirtyHairyImage()
  .then(() => {
    console.log('Bila Shaka Dirty Hairy Copper Ale image scraping completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to scrape Bila Shaka Dirty Hairy image:', error);
    process.exit(1);
  });

