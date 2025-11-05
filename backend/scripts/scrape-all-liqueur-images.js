const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const db = require('../models');

async function scrapeAllLiqueurImages() {
  try {
    console.log('Starting comprehensive liqueur image scraping...');
    
    // Get all liqueurs from database
    const liqueursCategory = await db.Category.findOne({
      where: { name: { [db.Sequelize.Op.iLike]: '%liqueur%' } }
    });

    const liqueurs = await db.Drink.findAll({
      where: { categoryId: liqueursCategory.id },
      attributes: ['id', 'name', 'image']
    });

    console.log(`Found ${liqueurs.length} liqueurs to process`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 0; i < liqueurs.length; i++) {
      const liqueur = liqueurs[i];
      console.log(`\n[${i + 1}/${liqueurs.length}] Processing: ${liqueur.name}`);
      
      // Skip if already has a custom image (not placeholder)
      if (liqueur.image && !liqueur.image.includes('placeholder')) {
        console.log(`Skipping - already has image: ${liqueur.image}`);
        skipCount++;
        continue;
      }

      try {
        // Create search URL
        const searchTerm = liqueur.name.toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        
        const searchUrl = `https://www.dialadrinkkenya.com/search/${searchTerm}`;
        console.log(`Searching: ${searchUrl}`);

        const response = await axios.get(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          timeout: 10000
        });

        const $ = cheerio.load(response.data);
        
        // Look for product image
        let imageUrl = null;
        const selectors = [
          `img[src*="${liqueur.name.toLowerCase().split(' ')[0]}"]`,
          `img[alt*="${liqueur.name}"]`,
          'img[src*="cloudinary"]',
          '.product-image img',
          '.product-img img'
        ];

        for (const selector of selectors) {
          const img = $(selector).first();
          if (img.length && img.attr('src') && !img.attr('src').includes('placeholder')) {
            imageUrl = img.attr('src');
            break;
          }
        }

        if (!imageUrl) {
          console.log(`No image found for ${liqueur.name}`);
          errorCount++;
          continue;
        }

        // Clean up Cloudinary URL
        if (imageUrl.includes('cloudinary.com')) {
          imageUrl = imageUrl.replace(/\/c_fit,f_auto,h_\d+,w_\d+\//, '/');
          imageUrl = imageUrl.replace(/\/c_fill,f_auto,h_\d+,w_\d+\//, '/');
          imageUrl = imageUrl.replace(/\/c_scale,f_auto,h_\d+,w_\d+\//, '/');
        }

        // Create filename
        const filename = liqueur.name.toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '') + '.jpg';

        // Download image
        const imageResponse = await axios.get(imageUrl, { 
          responseType: 'stream',
          timeout: 10000
        });
        
        const imagePath = path.join(__dirname, '../public/images', filename);
        const writer = fs.createWriteStream(imagePath);
        imageResponse.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });

        // Update database
        await liqueur.update({
          image: `/images/${filename}`
        });

        console.log(`✅ Success: ${liqueur.name} -> /images/${filename}`);
        successCount++;

        // Add delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.log(`❌ Error for ${liqueur.name}: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\n=== SCRAPING COMPLETE ===`);
    console.log(`✅ Successfully scraped: ${successCount}`);
    console.log(`⏭️  Skipped (already have images): ${skipCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${liqueurs.length}`);

  } catch (error) {
    console.error('Fatal error:', error.message);
    throw error;
  } finally {
    await db.sequelize.close();
  }
}

scrapeAllLiqueurImages()
  .then(() => {
    console.log('All liqueur image scraping completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
