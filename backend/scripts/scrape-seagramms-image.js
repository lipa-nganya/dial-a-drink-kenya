const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const db = require('../models');

async function scrapeSeagrammsImage() {
  try {
    console.log('Scraping Seagramm\'s image from Dial a Drink Kenya...');
    
    // Try different search URLs
    const urls = [
      'https://www.dialadrinkkenya.com/search/seagramm-s',
      'https://www.dialadrinkkenya.com/search/seagramms-gin',
      'https://www.dialadrinkkenya.com/search/seagram-gin',
      'https://www.dialadrinkkenya.com/seagramms-gin',
      'https://www.dialadrinkkenya.com/seagram-gin'
    ];

    let imageUrl = null;
    let $ = null;

    for (const url of urls) {
      try {
        console.log(`Trying URL: ${url}`);
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          timeout: 10000
        });
        $ = cheerio.load(response.data);
        
        // Try multiple selectors
        const selectors = [
          'img[src*="seagramm"]',
          'img[alt*="Seagramm"]',
          'img[alt*="Seagram"]',
          'img[src*="seagram"]',
          '.product-image img',
          '.product-detail img',
          '.product-img img',
          'img[src*="product"]',
          'img[src*="gin"]',
          'img[class*="product"]',
          'img[class*="image"]'
        ];

        for (const selector of selectors) {
          const imgs = $(selector);
          imgs.each((i, img) => {
            const src = $(img).attr('src') || $(img).attr('data-src');
            if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('placeholder')) {
              if (src.includes('seagramm') || src.includes('seagram') || src.includes('product') || src.includes('gin')) {
                imageUrl = src;
                console.log(`Found image with selector "${selector}": ${imageUrl}`);
                return false;
              }
            }
          });
          if (imageUrl) break;
        }

        if (imageUrl) break;
      } catch (error) {
        console.log(`Failed to fetch ${url}: ${error.message}`);
        continue;
      }
    }

    if (!imageUrl) {
      console.log('No suitable image found. Product may not be listed on Dial a Drink Kenya.');
      console.log('You may need to provide a specific URL or use a different image source.');
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

    const filename = 'seagramms.jpg';
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
          [db.Sequelize.Op.iLike]: '%Seagramm%'
        }
      }
    });

    if (drink) {
      const imagePath = `/images/${filename}`;
      drink.image = imagePath;
      await drink.save();
      console.log(`✅ Updated database: ${drink.name} with image path: ${imagePath}`);
    } else {
      console.log('⚠️  Seagramm\'s not found in database.');
    }

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await db.sequelize.close();
  }
}

scrapeSeagrammsImage()
  .then(() => {
    console.log('Seagramm\'s image scraping completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
