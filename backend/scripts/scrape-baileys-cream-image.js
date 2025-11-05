const db = require('../models');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

async function scrapeBaileysCreamImage() {
  try {
    console.log('Scraping Bailey\'s Cream image from Dial a Drink Kenya...');

    // Try different search URLs
    const urls = [
      'https://www.dialadrinkkenya.com/search/baileys-cream',
      'https://www.dialadrinkkenya.com/search/baileys-original-irish-cream',
      'https://www.dialadrinkkenya.com/baileys-original-irish-cream'
    ];

    let imageUrl = null;
    let $ = null;

    for (const url of urls) {
      try {
        console.log(`Trying: ${url}`);
        const { data } = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          timeout: 10000
        });
        $ = cheerio.load(data);

        // Try multiple selectors
        const selectors = [
          'img[alt*="Baileys"]',
          'img[alt*="Bailey\'s"]',
          'img[alt*="Irish Cream"]',
          'img[alt*="Cream"]',
          'img.img-fluid.product-image',
          'img.img-fluid',
          '.product-image img',
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

        if (imageUrl) break;
      } catch (error) {
        console.log(`Error trying ${url}: ${error.message}`);
        continue;
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

    // Ensure image directory exists
    const imageDir = path.join(__dirname, '../../public/images');
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }

    const imageFileName = 'baileys-cream.jpg';
    const imagePath = path.join(imageDir, imageFileName);

    console.log(`Downloading image from: ${imageUrl}`);
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

    // Update database - target "Bailey's Cream" specifically
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
      console.log(`⚠️  No "Bailey's Cream" entry found with exact name. Checking for similar names...`);
      
      // Try updating "Baileys Original Irish Cream" as well if it exists
      const updated2 = await db.Drink.update(
        { image: `/images/${imageFileName}` },
        { 
          where: { 
            name: { [db.Sequelize.Op.iLike]: '%Baileys Original Irish Cream%' }
          }
        }
      );
      
      if (updated2[0] > 0) {
        console.log(`✅ Updated Baileys Original Irish Cream image as well`);
      }
    }

  } catch (error) {
    console.error('Error scraping Bailey\'s Cream image:', error.message);
  } finally {
    await db.sequelize.close();
  }
}

scrapeBaileysCreamImage();

