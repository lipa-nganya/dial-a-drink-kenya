const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const db = require('../models');

async function scrapeTanquerayGinImage() {
  try {
    console.log('Scraping Tanqueray Gin image from Dial a Drink Kenya...');
    
    const url = 'https://www.dialadrinkkenya.com/tanqueray-gin';
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
      'img[src*="tanqueray"]',
      'img[alt*="Tanqueray"]',
      'img[alt*="Gin"]',
      '.product-image img',
      '.product-detail img',
      '.product-img img',
      'img[src*="product"]',
      'img[src*="gin"]'
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
        if (src && (src.includes('tanqueray') || src.includes('gin') || src.includes('product'))) {
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
      imageUrl = 'https://www.dialadrinkkenya.com' + imageUrl;
    } else if (!imageUrl.startsWith('http')) {
      imageUrl = 'https://www.dialadrinkkenya.com/' + imageUrl;
    }

    // If it's a Cloudinary URL, try to get a larger version
    if (imageUrl.includes('cloudinary.com')) {
      // Remove size constraints from Cloudinary URL
      imageUrl = imageUrl.replace(/\/c_fit,f_auto,h_\d+,w_\d+\//, '/');
      imageUrl = imageUrl.replace(/\/c_fill,f_auto,h_\d+,w_\d+\//, '/');
      imageUrl = imageUrl.replace(/\/w_\d+,h_\d+,c_fit\//, '/');
      imageUrl = imageUrl.replace(/\/c_fit\//, '/');
      console.log(`Using larger Cloudinary image: ${imageUrl}`);
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
    const filename = 'tanqueray-gin.jpg';
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
          [db.Sequelize.Op.iLike]: '%Tanqueray Gin%'
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
    console.error('Error scraping Tanqueray Gin image:', error.message);
    throw error;
  } finally {
    await db.sequelize.close();
  }
}

// Run the scraper
scrapeTanquerayGinImage()
  .then(() => {
    console.log('Tanqueray Gin image scraping completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to scrape Tanqueray Gin image:', error);
    process.exit(1);
  });