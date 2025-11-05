const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../models');

function normalizeName(name) {
  return name.toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/&/g, 'and')
    .replace(/[.,]/g, '');
}

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

async function scrapeWineFromWebsite() {
  try {
    console.log('🔍 Scraping wine items from dialadrinkkenya.com...\n');
    
    const url = 'https://www.dialadrinkkenya.com/search?query=wine';
    const response = await axios.get(url, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const products = [];
    const seenNames = new Set();
    
    // Extract from JSON-LD script tags (same structure as whisky)
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const jsonText = $(el).html();
        if (!jsonText || !jsonText.includes('"name"')) return;
        
        const data = JSON.parse(jsonText);
        
        if (data.name && typeof data.name === 'string' && data.name.length > 3) {
          const normalized = normalizeName(data.name);
          
          if (!seenNames.has(normalized)) {
            seenNames.add(normalized);
            
            // Extract price from priceOptions or price
            let price = null;
            let capacity = null;
            
            if (data.priceOptions && data.priceOptions.length > 0) {
              const sortedOptions = data.priceOptions
                .filter(opt => opt.price && opt.inStock !== false)
                .sort((a, b) => (b.price || 0) - (a.price || 0));
              
              if (sortedOptions.length > 0) {
                price = sortedOptions[0].price;
                capacity = sortedOptions[0].quantity || sortedOptions[0].optionText;
              }
            } else if (data.price) {
              price = data.price;
              capacity = data.quantity;
            }
            
            // Extract image
            let imageUrl = null;
            if (data.image) {
              if (typeof data.image === 'string') {
                imageUrl = cleanCloudinaryUrl(data.image);
              } else if (data.image.secure_url) {
                imageUrl = cleanCloudinaryUrl(data.image.secure_url);
              } else if (data.image.url) {
                imageUrl = cleanCloudinaryUrl(data.image.url);
              }
            }
            
            const abv = data.alcoholContent || null;
            
            // Only add if it's a real product
            if (price || (data.name.length > 5 && !data.name.includes('Dial a Drink'))) {
              products.push({
                name: data.name.trim(),
                price: price,
                capacity: capacity,
                abv: abv,
                image: imageUrl && !imageUrl.includes('logo') ? imageUrl : null
              });
            }
          }
        }
      } catch (error) {
        // Skip invalid JSON
      }
    });
    
    // Also extract from h3.modal-title (fallback)
    $('h3.modal-title').each((i, el) => {
      const name = $(el).text().trim();
      if (name && name.length > 3 && name.length < 100) {
        const normalized = normalizeName(name);
        if (!seenNames.has(normalized)) {
          seenNames.add(normalized);
          
          // Find container for price/image
          const $container = $(el).closest('[class*="product"], .mobile-product-card');
          
          let price = null;
          const priceMatch = $container.text().match(/KES\s*([\d,]+)/);
          if (priceMatch) {
            price = parseFloat(priceMatch[1].replace(/,/g, ''));
          }
          
          const dataPrice = $container.find('[data-price]').first().attr('data-price');
          if (dataPrice && !price) {
            price = parseFloat(dataPrice);
          }
          
          let capacity = null;
          const capacityMatch = $container.text().match(/(\d+\.?\d*\s*(?:ML|ml|Litre|L|litre|litres|Litres|Twinpack))/i);
          if (capacityMatch) {
            capacity = capacityMatch[1];
          }
          
          const dataQty = $container.find('[data-qty]').first().attr('data-qty');
          if (dataQty && !capacity) {
            capacity = dataQty;
          }
          
          let abv = null;
          const abvMatch = $container.text().match(/ABV\s*(\d+\.?\d*)/i);
          if (abvMatch) {
            abv = parseFloat(abvMatch[1]);
          }
          
          const $img = $container.find('img[src*="cloudinary"]').first();
          let imageUrl = $img.attr('src') || $img.attr('data-src');
          imageUrl = cleanCloudinaryUrl(imageUrl);
          
          const existing = products.find(p => normalizeName(p.name) === normalized);
          if (!existing && (price || name.length > 5)) {
            products.push({
              name: name,
              price: price,
              capacity: capacity,
              abv: abv,
              image: imageUrl && !imageUrl.includes('logo') ? imageUrl : null
            });
          }
        }
      }
    });
    
    console.log(`Extracted ${products.length} unique wine products\n`);
    
    return products;
    
  } catch (error) {
    console.error('Error scraping category page:', error.message);
    return [];
  }
}

async function addMissingWineItems() {
  try {
    console.log('📦 Adding missing wine items from dialadrinkkenya.com...\n');
    await db.sequelize.authenticate();
    console.log('Database connected\n');

    const wineCategory = await db.Category.findOne({ where: { name: 'Wine' } });
    if (!wineCategory) {
      console.error('Wine category not found!');
      return;
    }

    const [wineSubCategory] = await db.SubCategory.findOrCreate({
      where: { name: 'All Wine', categoryId: wineCategory.id },
      defaults: { description: 'All types of wine', categoryId: wineCategory.id }
    });

    // First, remove duplicates
    console.log('Checking for duplicates...\n');
    const duplicates = await db.sequelize.query(`
      SELECT name, COUNT(*) as count, array_agg(id ORDER BY id) as ids
      FROM drinks
      WHERE "categoryId" = :categoryId
      GROUP BY name
      HAVING COUNT(*) > 1
    `, {
      replacements: { categoryId: wineCategory.id },
      type: db.sequelize.QueryTypes.SELECT
    });
    
    if (duplicates.length > 0) {
      console.log(`Found ${duplicates.length} duplicates, removing...`);
      for (const dup of duplicates) {
        for (let i = 1; i < dup.ids.length; i++) {
          await db.Drink.destroy({ where: { id: dup.ids[i] } });
        }
        console.log(`  Removed ${dup.ids.length - 1} duplicate(s) of: ${dup.name}`);
      }
      console.log('');
    }

    // Get existing wine items
    const existingWines = await db.Drink.findAll({
      where: { categoryId: wineCategory.id },
      attributes: ['id', 'name'],
      raw: true
    });
    
    const existingNames = new Set(existingWines.map(w => normalizeName(w.name)));
    console.log(`Current wine items in database: ${existingWines.length}\n`);

    // Scrape the website
    const websiteProducts = await scrapeWineFromWebsite();
    
    if (websiteProducts.length === 0) {
      console.log('⚠️  No products found on website.');
      return;
    }

    let added = 0;
    let skipped = 0;
    let errors = 0;

    console.log(`Adding missing items...\n`);
    for (let i = 0; i < websiteProducts.length; i++) {
      const product = websiteProducts[i];
      const normalized = normalizeName(product.name);
      
      // Skip if name is too long
      if (product.name.length > 255) {
        console.log(`⚠️  Skipping ${product.name.substring(0, 50)}... (name too long)`);
        errors++;
        continue;
      }
      
      // Check if already exists
      if (existingNames.has(normalized)) {
        skipped++;
        continue;
      }
      
      // Check for similar names (to avoid near-duplicates)
      let isSimilar = false;
      for (const existing of existingNames) {
        if (normalized.length > 10 && existing.length > 10) {
          if (normalized.includes(existing) || existing.includes(normalized)) {
            const longer = normalized.length > existing.length ? normalized : existing;
            const shorter = normalized.length > existing.length ? existing : normalized;
            if (shorter.length / longer.length >= 0.9) {
              isSimilar = true;
              break;
            }
          }
        }
      }
      
      if (isSimilar) {
        skipped++;
        continue;
      }

      try {
        await db.Drink.create({
          name: product.name.substring(0, 255),
          description: `${product.name}${product.abv ? ` (ABV ${product.abv}%)` : ''}`,
          price: (product.price || 0).toString(),
          originalPrice: (product.price || 0).toString(),
          categoryId: wineCategory.id,
          subCategoryId: wineSubCategory.id,
          capacity: product.capacity,
          capacityPricing: product.capacity ? [{ capacity: product.capacity, originalPrice: product.price || 0, currentPrice: product.price || 0 }] : null,
          abv: product.abv,
          isAvailable: product.price > 0,
          isPopular: false,
          isOnOffer: false,
          image: product.image
        });
        
        existingNames.add(normalized);
        added++;
        
        if (added % 20 === 0) {
          process.stdout.write(`Added ${added} items...\r`);
        }
      } catch (error) {
        if (error.message.includes('value too long')) {
          console.log(`⚠️  Skipping ${product.name.substring(0, 50)}... (name too long for database)`);
        } else {
          console.error(`Error adding ${product.name}:`, error.message);
        }
        errors++;
      }
    }

    const finalCount = await db.Drink.count({ where: { categoryId: wineCategory.id } });

    console.log(`\n\n✅ Completed!`);
    console.log(`- Added: ${added} new items`);
    console.log(`- Skipped (already exists): ${skipped}`);
    console.log(`- Errors: ${errors}`);
    console.log(`- Website products found: ${websiteProducts.length}`);
    console.log(`- Final database count: ${finalCount}`);

  } catch (error) {
    console.error('Error adding missing wine items:', error);
  } finally {
    await db.sequelize.close();
  }
}

addMissingWineItems()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

