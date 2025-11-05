const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const db = require('../models');

async function scrapeGibsonBloodOrangeImage() {
  try {
    console.log('Scraping Gibson Blood Orange image from Dial a Drink Kenya...');
    
    const url = 'https://www.dialadrinkkenya.com/search/gibson-blood-orange';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    let imageUrl = null;
    
    const selectors = [
      'img[src*="gibson"]',
      'img[alt*="Gibson"]',
      'img[alt*="Blood"]',
      'img[alt*="Orange"]',
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
        if (src && (src.includes('gibson') || src.includes('blood') || src.includes('orange') || src.includes('gin') || src.includes('product'))) {
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

    const filename = 'gibson-blood-orange.jpg';
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
          [db.Sequelize.Op.iLike]: '%Gibson Blood Orange%'
        }
      }
    });

    if (drink) {
      const imagePath = `/images/${filename}`;
      drink.image = imagePath;
      await drink.save();
      console.log(`✅ Updated database: ${drink.name} with image path: ${imagePath}`);
    } else {
      console.log('⚠️  Gibson Blood Orange not found in database.');
    }

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await db.sequelize.close();
  }
}

scrapeGibsonBloodOrangeImage()
  .then(() => {
    console.log('Gibson Blood Orange image scraping completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

