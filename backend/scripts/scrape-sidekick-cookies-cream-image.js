const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const db = require('../models');

async function scrapeSidekickCookiesCreamImage() {
  try {
    console.log('Scraping Sidekick Cookies & Cream image from Dial a Drink Kenya...');
    
    const url = 'https://www.dialadrinkkenya.com/search/sidekick-cookies-cream';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    // Look for the product image
    let imageUrl = null;
    
    // Try different selectors to find the image
    const selectors = [
      'img[src*="sidekick"]',
      'img[src*="cookies"]',
      'img[src*="cream"]',
      '.product-image img',
      '.product-img img',
      'img[alt*="Sidekick"]',
      'img[alt*="Cookies"]',
      'img[alt*="Cream"]'
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
      console.log('No image found with selectors, trying to find any product image...');
      const allImages = $('img[src*="cloudinary"]');
      if (allImages.length > 0) {
        imageUrl = allImages.first().attr('src');
        console.log(`Found Cloudinary image: ${imageUrl}`);
      }
    }

    if (!imageUrl) {
      console.log('No image found on the page');
      return;
    }

    // Clean up Cloudinary URL to get larger image
    if (imageUrl.includes('cloudinary.com')) {
      imageUrl = imageUrl.replace(/\/c_fit,f_auto,h_\d+,w_\d+\//, '/');
      imageUrl = imageUrl.replace(/\/c_fill,f_auto,h_\d+,w_\d+\//, '/');
      imageUrl = imageUrl.replace(/\/c_scale,f_auto,h_\d+,w_\d+\//, '/');
      console.log(`Cleaned image URL: ${imageUrl}`);
    }

    // Download the image
    const imageResponse = await axios.get(imageUrl, { responseType: 'stream' });
    const imagePath = path.join(__dirname, '../public/images/sidekick-cookies-cream.jpg');
    
    const writer = fs.createWriteStream(imagePath);
    imageResponse.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log(`Image saved as: sidekick-cookies-cream.jpg`);

    // Update database
    console.log('Updating database with image path...');
    
    const drink = await db.Drink.findOne({
      where: {
        name: {
          [db.Sequelize.Op.iLike]: '%Sidekick Cookies & Cream%'
        }
      }
    });

    if (drink) {
      await drink.update({
        image: '/images/sidekick-cookies-cream.jpg'
      });
      console.log(`✅ Updated database: ${drink.name} with image path: /images/sidekick-cookies-cream.jpg`);
    } else {
      console.log('❌ Drink not found in database');
    }

    console.log('Sidekick Cookies & Cream image scraping completed successfully');

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await db.sequelize.close();
  }
}

scrapeSidekickCookiesCreamImage()
  .then(() => {
    console.log('Operation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
