const db = require('../models');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

async function scrapeCorrectBaileysCreamImage() {
  try {
    console.log('Scraping correct Bailey\'s Cream image from Dial a Drink Kenya...');

    const searchUrl = 'https://www.dialadrinkkenya.com/search/bailey-s-cream';
    const { data } = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(data);
    
    // Look for the main product image
    let imageUrl = null;
    const selectors = [
      'img[alt*="Bailey\'s Cream"]',
      'img[alt*="Bailey\'s"]',
      'img[alt*="Cream"]',
      '.product-image img',
      '.product-img img',
      'img.img-fluid',
      'img[src*="cloudinary"]'
    ];

    for (const selector of selectors) {
      const imgElement = $(selector).first();
      if (imgElement.length) {
        imageUrl = imgElement.attr('src') || imgElement.data('src');
        if (imageUrl && !imageUrl.includes('placeholder')) {
          console.log(`Found image using selector: ${selector}`);
          break;
        }
      }
    }

    if (!imageUrl) {
      console.log('❌ No image found for Bailey\'s Cream');
      return;
    }

    // Clean Cloudinary URL if present
    imageUrl = imageUrl.replace(/\/c_fit,f_auto,h_\d+,w_\d+\//, '/');
    imageUrl = imageUrl.replace(/\/c_fill,f_auto,h_\d+,w_\d+\//, '/');
    imageUrl = imageUrl.replace(/\/c_scale,f_auto,h_\d+,w_\d+\//, '/');

    console.log(`Downloading image from: ${imageUrl}`);

    // Ensure frontend images directory exists
    const frontendImagesDir = path.join(__dirname, '../../frontend/public/images');
    if (!fs.existsSync(frontendImagesDir)) {
      fs.mkdirSync(frontendImagesDir, { recursive: true });
    }

    const imageFileName = 'baileys-cream.jpg';
    const imagePath = path.join(frontendImagesDir, imageFileName);

    const imageResponse = await axios({
      url: imageUrl,
      responseType: 'stream',
      timeout: 15000
    });

    await new Promise((resolve, reject) => {
      imageResponse.data.pipe(fs.createWriteStream(imagePath))
        .on('finish', () => {
          console.log(`✅ Image saved as: ${imageFileName}`);
          resolve();
        })
        .on('error', reject);
    });

    // Update database
    const updated = await db.Drink.update(
      { image: `/images/${imageFileName}` },
      { 
        where: { 
          name: { [db.Sequelize.Op.iLike]: 'Bailey\'s Cream' }
        }
      }
    );

    if (updated[0] > 0) {
      console.log(`✅ Successfully updated Bailey's Cream image in database`);
    } else {
      console.log(`❌ No Bailey's Cream entry found in database`);
    }

  } catch (error) {
    console.error('Error scraping Bailey\'s Cream image:', error.message);
  } finally {
    await db.sequelize.close();
  }
}

scrapeCorrectBaileysCreamImage();





























