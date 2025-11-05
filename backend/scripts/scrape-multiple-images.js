const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const db = require('../models');

async function scrapeAndUpdateImage(productName, searchPattern, url, filename) {
  try {
    console.log(`\nScraping ${productName} image from ${url}...`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    let imageUrl = null;
    
    const selectors = [
      `img[src*="${productName.toLowerCase().split(' ')[0]}"]`,
      `img[alt*="${productName.split(' ')[0]}"]`,
      '.product-image img',
      '.product-detail img',
      '.product-img img',
      'img[src*="product"]'
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
        if (src && (src.includes('product') || src.includes(productName.toLowerCase().split(' ')[0]))) {
          imageUrl = src;
          console.log(`Found potential image: ${imageUrl}`);
          return false;
        }
      });
    }

    if (!imageUrl) {
      console.log(`⚠️  No suitable image found for ${productName}`);
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
      console.log(`⚠️  ${productName} not found in database.`);
    }

  } catch (error) {
    console.error(`Error scraping ${productName} image:`, error.message);
  }
}

async function main() {
  try {
    // Scrape all images
    await scrapeAndUpdateImage(
      'Camus VS',
      '%Camus VS%',
      'https://www.dialadrinkkenya.com/camus-vs-cognac',
      'camus-vs.jpg'
    );

    await scrapeAndUpdateImage(
      'Don Montego VSOP',
      '%Don Montego VSOP%',
      'https://www.dialadrinkkenya.com/search/don-montego-vsop',
      'don-montego-vsop.jpg'
    );

    await scrapeAndUpdateImage(
      'Emperador Brandy',
      '%Emperador Brandy%',
      'https://www.dialadrinkkenya.com/search/emperador-brandy',
      'emperador-brandy.jpg'
    );

    await scrapeAndUpdateImage(
      'Grand Marnier',
      '%Grand Marnier%',
      'https://www.dialadrinkkenya.com/grand-marnier',
      'grand-marnier.jpg'
    );

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.sequelize.close();
  }
}

main()
  .then(() => {
    console.log('\nAll image scraping operations completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });


