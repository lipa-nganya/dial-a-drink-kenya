const db = require('../models');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

async function scrapeBaileysDelightImage() {
  try {
    console.log('Scraping Bailey\'s Delight image from Dial a Drink Kenya...');

    const url = 'https://www.dialadrinkkenya.com/search/bailey-s-delight';
    console.log(`Fetching from: ${url}`);
    
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 20000
    });
    
    const $ = cheerio.load(data);
    
    // Look for the main product image
    let imageUrl = null;
    
    const imgSelectors = [
      'img[alt*="Bailey\'s Delight"]',
      'img[alt*="Baileys Delight"]',
      'img[alt*="Delight"]',
      '.product-image img',
      '.product-img img',
      'img.img-fluid[src*="cloudinary"]',
      'img[src*="cloudinary"]'
    ];

    for (const selector of imgSelectors) {
      const imgs = $(selector);
      if (imgs.length > 0) {
        for (let i = 0; i < imgs.length; i++) {
          const src = $(imgs[i]).attr('src') || $(imgs[i]).data('src');
          if (src && src.includes('cloudinary') && !src.includes('logo') && !src.includes('placeholder')) {
            imageUrl = src;
            console.log(`Found image with selector: ${selector}`);
            break;
          }
        }
        if (imageUrl) break;
      }
    }

    if (!imageUrl) {
      // Try to find product images by checking for larger cloudinary images
      const allImgs = $('img[src*="cloudinary"]');
      for (let i = 0; i < allImgs.length; i++) {
        const src = $(allImgs[i]).attr('src') || $(allImgs[i]).data('src');
        if (src && src.includes('cloudinary') && !src.includes('logo') && 
            (src.includes('bailey') || src.includes('delight') || src.includes('products/'))) {
          imageUrl = src;
          console.log(`Found product image: ${src}`);
          break;
        }
      }
    }

    if (!imageUrl) {
      console.log('❌ Could not find image on the page');
      return;
    }

    // Clean Cloudinary URL to get full resolution
    imageUrl = imageUrl.replace(/\/c_fit,f_auto,h_\d+,w_\d+\//, '/');
    imageUrl = imageUrl.replace(/\/c_fill,f_auto,h_\d+,w_\d+\//, '/');
    imageUrl = imageUrl.replace(/\/c_scale,f_auto,h_\d+,w_\d+\//, '/');
    imageUrl = imageUrl.replace(/\/c_fit,w_\d+,h_\d+\//, '/');
    
    console.log(`Downloading from: ${imageUrl}`);

    // Download image
    const frontendImagesDir = path.join(__dirname, '../../frontend/public/images');
    if (!fs.existsSync(frontendImagesDir)) {
      fs.mkdirSync(frontendImagesDir, { recursive: true });
    }

    const imagePath = path.join(frontendImagesDir, 'baileys-delight.jpg');
    
    const imageResponse = await axios({
      url: imageUrl,
      responseType: 'stream',
      timeout: 20000
    });

    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(imagePath);
      imageResponse.data.pipe(writer);
      writer.on('finish', () => {
        const stats = fs.statSync(imagePath);
        console.log(`✅ Image saved to: ${imagePath}`);
        console.log(`   File size: ${stats.size} bytes`);
        resolve();
      });
      writer.on('error', reject);
    });

    // Update database
    const result = await db.Drink.update(
      { image: '/images/baileys-delight.jpg' },
      { 
        where: { 
          name: 'Bailey\'s Delight'
        }
      }
    );

    console.log(`✅ Database updated. Rows affected: ${result[0]}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
    }
  } finally {
    await db.sequelize.close();
  }
}

scrapeBaileysDelightImage();





























