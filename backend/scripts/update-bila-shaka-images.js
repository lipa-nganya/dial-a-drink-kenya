const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const db = require('../models');

async function scrapeAndUpdateImage(productName, searchPattern, url, filename) {
  try {
    console.log(`Scraping ${productName} image from ${url}...`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    let imageUrl = null;
    
    const selectors = [
      'img[src*="bateleur"]',
      'img[alt*="Bateleur"]',
      'img[alt*="Honey"]',
      'img[alt*="Badger"]',
      'img[alt*="Blonde"]',
      'img[src*="fruity"]',
      'img[alt*="Fruity"]',
      'img[alt*="Fly"]',
      'img[alt*="Mango"]',
      'img[alt*="IPA"]',
      '.product-image img',
      '.product-detail img',
      '.product-img img',
      'img[src*="product"]',
      'img[src*="beer"]'
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
        if (src && (src.includes('product') || src.includes('beer') || src.includes('bateleur') || src.includes('fruity'))) {
          imageUrl = src;
          console.log(`Found potential image: ${imageUrl}`);
          return false;
        }
      });
    }

    if (!imageUrl) {
      console.log('No suitable image found on the page');
      return;
    }

    if (imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    } else if (imageUrl.startsWith('/')) {
      imageUrl = 'https://www.dialadrinkkenya.com' + imageUrl;
    } else if (!imageUrl.startsWith('http')) {
      imageUrl = 'https://www.dialadrinkkenya.com/' + imageUrl;
    }

    if (imageUrl.includes('cloudinary.com')) {
      imageUrl = imageUrl.replace(/\/c_fit,f_auto,h_\d+,w_\d+\//, '/');
      imageUrl = imageUrl.replace(/\/c_fill,f_auto,h_\d+,w_\d+\//, '/');
      imageUrl = imageUrl.replace(/\/w_\d+,h_\d+,c_fit\//, '/');
      imageUrl = imageUrl.replace(/\/c_fit\//, '/');
    }

    console.log(`Final image URL: ${imageUrl}`);

    const imageResponse = await axios.get(imageUrl, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const imagesDir = path.join(__dirname, '../public/images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    const filepath = path.join(imagesDir, filename);
    const writer = fs.createWriteStream(filepath);
    
    imageResponse.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`Image saved as: ${filename}`);
        resolve(filepath);
      });
      writer.on('error', reject);
    });

    console.log('Updating database with image path...');
    const drink = await db.Drink.findOne({
      where: {
        name: {
          [db.Sequelize.Op.iLike]: searchPattern
        }
      }
    });

    if (drink) {
      const imagePath = `/images/${filename}`;
      drink.image = imagePath;
      await drink.save();
      console.log(`✅ Updated database: ${drink.name} with image path: ${imagePath}`);
    } else {
      console.log('⚠️  Drink not found in database.');
    }

  } catch (error) {
    console.error(`Error scraping ${productName} image:`, error.message);
    throw error;
  }
}

async function main() {
  try {
    // Update Bila Shaka Blonde Ale image
    await scrapeAndUpdateImage(
      'Bila Shaka Blonde Ale',
      '%Bila Shaka Blonde%',
      'https://www.dialadrinkkenya.com/Bateleur%20Honey%20Badger%20Blonde',
      'bila-shaka-blonde-ale.jpg'
    );

    // Update Bila Shaka Fruity Fly-Mango IPA image
    await scrapeAndUpdateImage(
      'Bila Shaka Fruity Fly-Mango IPA',
      '%Fruity Fly%',
      'https://www.dialadrinkkenya.com/fruity-fly-mango-ipa',
      'bila-shaka-fruity-fly-mango-ipa.jpg'
    );

    // Remove Bila Shaka Wheat Beer
    console.log('Removing Bila Shaka Wheat Beer...');
    const wheatBeer = await db.Drink.findOne({
      where: {
        name: {
          [db.Sequelize.Op.iLike]: '%Bila Shaka Wheat%'
        }
      }
    });

    if (wheatBeer) {
      await wheatBeer.destroy();
      console.log(`✅ Removed: ${wheatBeer.name} (ID: ${wheatBeer.id})`);
    } else {
      console.log('⚠️  Bila Shaka Wheat Beer not found in database.');
    }

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await db.sequelize.close();
  }
}

main()
  .then(() => {
    console.log('All operations completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

