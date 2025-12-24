const db = require('../models');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

async function scrapeCorrectBaileysCream() {
  try {
    console.log('Scraping the CORRECT Bailey\'s Cream image...');

    const url = 'https://www.dialadrinkkenya.com/search/bailey-s-cream';
    console.log(`Fetching from: ${url}`);
    
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 20000
    });
    
    const $ = cheerio.load(data);
    
    // Find the main product image - look for images with Bailey's Cream in alt or title
    let imageUrl = null;
    
    // Try multiple strategies to find the product image
    const imgSelectors = [
      'img[alt*="Bailey\'s Cream"]',
      'img[alt*="Baileys Cream"]',
      'img[title*="Bailey\'s Cream"]',
      '.product-image img',
      '.product-img img',
      'img.img-fluid[src*="bailey"]',
      'img[src*="cloudinary"]'
    ];

    for (const selector of imgSelectors) {
      const imgs = $(selector);
      if (imgs.length > 0) {
        for (let i = 0; i < imgs.length; i++) {
          const src = $(imgs[i]).attr('src') || $(imgs[i]).data('src');
          if (src && src.includes('cloudinary') && !src.includes('placeholder')) {
            imageUrl = src;
            console.log(`Found image with selector: ${selector}`);
            break;
          }
        }
        if (imageUrl) break;
      }
    }

    if (!imageUrl) {
      // Try to find any product image on the page
      const allImgs = $('img[src*="cloudinary"]');
      console.log(`Found ${allImgs.length} Cloudinary images on page`);
      if (allImgs.length > 0) {
        // Get the first main product image (usually the largest one)
        imageUrl = $(allImgs[0]).attr('src') || $(allImgs[0]).data('src');
      }
    }

    if (!imageUrl) {
      console.log('❌ Could not find image on the page');
      console.log('Page title:', $('title').text());
      return;
    }

    // Clean Cloudinary URL to get full resolution
    imageUrl = imageUrl.replace(/\/c_fit,f_auto,h_\d+,w_\d+\//, '/');
    imageUrl = imageUrl.replace(/\/c_fill,f_auto,h_\d+,w_\d+\//, '/');
    imageUrl = imageUrl.replace(/\/c_scale,f_auto,h_\d+,w_\d+\//, '/');
    
    console.log(`Downloading from: ${imageUrl}`);

    // Download image
    const frontendImagesDir = path.join(__dirname, '../../frontend/public/images');
    if (!fs.existsSync(frontendImagesDir)) {
      fs.mkdirSync(frontendImagesDir, { recursive: true });
    }

    const imagePath = path.join(frontendImagesDir, 'baileys-cream.jpg');
    
    const imageResponse = await axios({
      url: imageUrl,
      responseType: 'stream',
      timeout: 20000
    });

    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(imagePath);
      imageResponse.data.pipe(writer);
      writer.on('finish', () => {
        console.log(`✅ Image saved to: ${imagePath}`);
        resolve();
      });
      writer.on('error', reject);
    });

    // Verify it's not the same as Original Irish Cream
    const fileSize = fs.statSync(imagePath).size;
    console.log(`Image file size: ${fileSize} bytes`);

    // Update database
    const result = await db.Drink.update(
      { image: '/images/baileys-cream.jpg' },
      { 
        where: { 
          name: 'Bailey\'s Cream'
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

scrapeCorrectBaileysCream();





























