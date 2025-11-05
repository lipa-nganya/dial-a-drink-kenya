const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../models');

function cleanCloudinaryUrl(url) {
  if (!url) return null;
  
  if (url.startsWith('//')) {
    url = 'https:' + url;
  } else if (url.startsWith('/')) {
    url = 'https://www.dialadrinkkenya.com' + url;
  }
  
  if (url.includes('cloudinary.com')) {
    url = url.replace(/\/c_fit[^\/]*\//g, '/');
    url = url.replace(/\/c_fill[^\/]*\//g, '/');
    url = url.replace(/\/w_\d+[^\/]*\//g, '/');
    url = url.replace(/\/h_\d+[^\/]*\//g, '/');
    url = url.replace(/\/f_auto[^\/]*\//g, '/');
    if (!url.includes('/v1/') && !url.includes('/v')) {
      url = url.replace('/image/upload/', '/image/upload/v1/');
    }
  }
  
  return url;
}

async function getImageFromPage(pageUrl, drinkName) {
  try {
    const response = await axios.get(pageUrl, { timeout: 10000 });
    const $ = cheerio.load(response.data);

    let imageUrl = null;

    // Look for product image in JSON-LD - prioritize product images, skip logos
    $('script[type="application/ld+json"], script[class="json"]').each((i, el) => {
      try {
        const jsonText = $(el).html();
        if (!jsonText || !jsonText.includes('"name"')) return;
        
        const data = JSON.parse(jsonText);
        
        // Check if this JSON-LD is for the product (has matching name)
        const nameMatch = data.name && 
          (data.name.toLowerCase().includes(drinkName.toLowerCase().split(' ')[0]) ||
           drinkName.toLowerCase().includes(data.name.toLowerCase().split(' ')[0]));
        
        if (nameMatch) {
          if (data.image) {
            let url = null;
            if (typeof data.image === 'string') {
              url = data.image;
            } else if (data.image.secure_url) {
              url = data.image.secure_url;
            } else if (data.image.url) {
              url = data.image.url;
            }
            
            // Skip logos
            if (url && !url.includes('logo') && (url.includes('product') || url.includes('products'))) {
              imageUrl = cleanCloudinaryUrl(url);
              return false; // Break loop
            }
          }
        }
      } catch (error) {
        // Skip invalid JSON
      }
    });

    // Fallback: Look for product images in the page (avoid logos)
    if (!imageUrl || imageUrl.includes('logo')) {
      $('img[src*="cloudinary"]').each((i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
        if (src && !src.includes('logo') && (src.includes('product') || src.includes('products'))) {
          const alt = $(el).attr('alt') || '';
          // Prefer images with product-related alt text or in product containers
          const parent = $(el).closest('[class*="product"], [class*="main"], [id*="product"]');
          if (parent.length > 0 || alt.toLowerCase().includes(drinkName.toLowerCase().split(' ')[0])) {
            imageUrl = cleanCloudinaryUrl(src);
            return false; // Break loop
          }
        }
      });
    }

    // Last resort: any cloudinary image that's not a logo
    if (!imageUrl || imageUrl.includes('logo')) {
      const $img = $('img[src*="cloudinary.com"][src*="product"]').not('[src*="logo"]').first();
      if ($img.length > 0) {
        imageUrl = cleanCloudinaryUrl($img.attr('src') || $img.attr('data-src'));
      }
    }

    return imageUrl && !imageUrl.includes('logo') ? imageUrl : null;
  } catch (error) {
    console.error(`Error fetching ${pageUrl}: ${error.message}`);
    return null;
  }
}

async function updateWineImages() {
  try {
    console.log('🖼️  Updating wine images...\n');
    await db.sequelize.authenticate();
    console.log('Database connected\n');

    const wineCategory = await db.Category.findOne({ where: { name: 'Wine' } });
    if (!wineCategory) {
      console.error('Wine category not found!');
      return;
    }

    // Items to update images
    const itemsToUpdate = [
      { name: 'Cellar Cask Red', url: 'https://www.dialadrinkkenya.com/cellar-cask-red-wine' },
      { name: 'Cellar Cask White', url: 'https://www.dialadrinkkenya.com/cellar-cask-wine-bottle-750ml' },
      { name: 'Choco Secco White wine', url: 'https://www.dialadrinkkenya.com/search/choco-secco-white-wine' },
      { name: 'Choco Toffee Red wine', url: 'https://www.dialadrinkkenya.com/search/choco-toffee-red-wine' },
      { name: 'Cono Sur 20 Barrels Cabernet Sauvignon', url: 'https://www.dialadrinkkenya.com/search/cono-sur-20-barrels-cabernet-sauvignon' }
    ];

    let updatedCount = 0;
    let failedCount = 0;

    console.log('Updating images...\n');
    for (let i = 0; i < itemsToUpdate.length; i++) {
      const { name, url } = itemsToUpdate[i];
      process.stdout.write(`[${i + 1}/${itemsToUpdate.length}] ${name}... `);

      const drink = await db.Drink.findOne({
        where: { 
          name: { [db.Sequelize.Op.iLike]: name },
          categoryId: wineCategory.id 
        }
      });

      if (!drink) {
        console.log(`✗ Drink not found in DB`);
        failedCount++;
        continue;
      }

      const imageUrl = await getImageFromPage(url, name);

      if (imageUrl) {
        await drink.update({ image: imageUrl });
        console.log(`✅`);
        updatedCount++;
      } else {
        console.log(`✗ No image found`);
        failedCount++;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
    }

    console.log(`\n✅ Completed!`);
    console.log(`- Images updated: ${updatedCount}`);
    console.log(`- Images failed: ${failedCount}`);

  } catch (error) {
    console.error('Error updating wine images:', error);
  } finally {
    await db.sequelize.close();
  }
}

updateWineImages()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

