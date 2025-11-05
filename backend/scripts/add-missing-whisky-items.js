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

async function scrapeWhiskyCategoryPage() {
  try {
    console.log('🔍 Scraping whisky category page from dialadrinkkenya.com...\n');
    
    const url = 'https://www.dialadrinkkenya.com/category/whisky';
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const products = [];
    const seenNames = new Set();
    
    // Method 1: Look for h3.modal-title which contains product names
    $('h3.modal-title').each((i, el) => {
      const name = $(el).text().trim();
      if (name && name.length > 3 && name.length < 100) {
        const normalized = normalizeName(name);
        if (!seenNames.has(normalized)) {
          seenNames.add(normalized);
          
          // Find associated product container
          const $container = $(el).closest('[class*="product"], .mobile-product-card, [class*="card"]');
          if ($container.length === 0) {
            // Try parent
            const $parent = $(el).parent().parent();
            extractProductInfo($parent, name, products);
          } else {
            extractProductInfo($container, name, products);
          }
        }
      }
    });
    
    // Method 2: Look in product-info divs
    $('.product-info').each((i, el) => {
      const $el = $(el);
      
      // Find product name in modal-title or nearby
      let name = $el.find('h3.modal-title').text().trim();
      
      if (!name || name.length < 3) {
        // Try finding in subtitle or nearby text
        const subtitle = $el.find('.product-subtitle').text().trim();
        if (subtitle && subtitle.length > 3 && subtitle.length < 100) {
          name = subtitle;
        }
      }
      
      if (name && name.length > 3 && name.length < 100) {
        const normalized = normalizeName(name);
        if (!seenNames.has(normalized)) {
          seenNames.add(normalized);
          extractProductInfo($el.closest('[class*="product"], .mobile-product-card'), name, products);
        }
      }
    });
    
    // Method 3: Extract from price-option data attributes
    $('[data-product]').each((i, el) => {
      const $el = $(el);
      const productId = $el.attr('data-product');
      const qty = $el.attr('data-qty');
      const price = parseFloat($el.attr('data-price') || 0);
      
      // Find product name - look for modal-title with same product ID
      const $title = $(`[data-product="${productId}"]`).closest('[class*="product"]').find('h3.modal-title');
      const name = $title.text().trim();
      
      if (name && name.length > 3) {
        const normalized = normalizeName(name);
        const existing = products.find(p => normalizeName(p.name) === normalized);
        
        if (existing) {
          // Update with capacity/pricing info if needed
          if (!existing.capacity && qty) {
            existing.capacity = qty;
          }
          if (!existing.price || price > existing.price) {
            existing.price = price;
          }
        } else if (!seenNames.has(normalized)) {
          seenNames.add(normalized);
          products.push({
            name: name,
            price: price,
            capacity: qty,
            abv: null,
            image: null
          });
        }
      }
    });
    
    console.log(`Extracted ${products.length} unique whisky products\n`);
    
    return products;
    
  } catch (error) {
    console.error('Error scraping category page:', error.message);
    return [];
  }
}

function extractProductInfo($container, name, products) {
  if (!$container || $container.length === 0) return;
  
  // Find price
  let price = null;
  const priceMatch = $container.text().match(/KES\s*([\d,]+)/);
  if (priceMatch) {
    price = parseFloat(priceMatch[1].replace(/,/g, ''));
  }
  
  // Check data-price attribute
  const dataPrice = $container.find('[data-price]').first().attr('data-price');
  if (dataPrice && !price) {
    price = parseFloat(dataPrice);
  }
  
  // Find capacity
  let capacity = null;
  const capacityMatch = $container.text().match(/(\d+\.?\d*\s*(?:ML|ml|Litre|L|litre|litres|Litres))/i);
  if (capacityMatch) {
    capacity = capacityMatch[1];
  }
  
  // Check data-qty attribute
  const dataQty = $container.find('[data-qty]').first().attr('data-qty');
  if (dataQty && !capacity) {
    capacity = dataQty;
  }
  
  // Extract ABV
  let abv = null;
  const abvMatch = $container.text().match(/ABV\s*(\d+\.?\d*)/i);
  if (abvMatch) {
    abv = parseFloat(abvMatch[1]);
  }
  
  // Find image
  const $img = $container.find('img[src*="cloudinary"]').first();
  let imageUrl = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src');
  imageUrl = cleanCloudinaryUrl(imageUrl);
  
  const normalized = normalizeName(name);
  const existing = products.find(p => normalizeName(p.name) === normalized);
  
  if (!existing) {
    products.push({
      name: name,
      price: price,
      capacity: capacity,
      abv: abv,
      image: imageUrl && !imageUrl.includes('logo') ? imageUrl : null
    });
  } else {
    // Update existing with better data
    if (!existing.price && price) existing.price = price;
    if (!existing.capacity && capacity) existing.capacity = capacity;
    if (!existing.abv && abv) existing.abv = abv;
    if (!existing.image && imageUrl && !imageUrl.includes('logo')) existing.image = imageUrl;
  }
}

async function addMissingWhiskyItems() {
  try {
    console.log('📦 Adding missing whisky items from dialadrinkkenya.com...\n');
    await db.sequelize.authenticate();
    console.log('Database connected\n');

    const whiskyCategory = await db.Category.findOne({ where: { name: 'Whisky' } });
    if (!whiskyCategory) {
      console.error('Whisky category not found!');
      return;
    }

    const [whiskySubCategory] = await db.SubCategory.findOrCreate({
      where: { name: 'All Whisky', categoryId: whiskyCategory.id },
      defaults: { description: 'All types of whisky', categoryId: whiskyCategory.id }
    });

    // Get existing whisky items
    const existingWhiskies = await db.Drink.findAll({
      where: { categoryId: whiskyCategory.id },
      attributes: ['id', 'name'],
      raw: true
    });
    
    const existingNames = new Set(existingWhiskies.map(w => normalizeName(w.name)));
    console.log(`Current whisky items in database: ${existingWhiskies.length}\n`);

    // Scrape the category page
    const websiteProducts = await scrapeWhiskyCategoryPage();
    
    if (websiteProducts.length === 0) {
      console.log('⚠️  No products found on category page.');
      return;
    }

    let added = 0;
    let skipped = 0;
    let duplicatesRemoved = 0;

    // First, check for and remove duplicates in database
    console.log('Checking for duplicates in database...\n');
    const nameGroups = {};
    existingWhiskies.forEach(w => {
      const normalized = normalizeName(w.name);
      if (!nameGroups[normalized]) {
        nameGroups[normalized] = [];
      }
      nameGroups[normalized].push(w);
    });
    
    for (const [normalized, items] of Object.entries(nameGroups)) {
      if (items.length > 1) {
        console.log(`Found duplicate: ${items[0].name} (${items.length} occurrences)`);
        // Keep the first one, delete the rest
        for (let i = 1; i < items.length; i++) {
          await db.Drink.destroy({ where: { id: items[i].id } });
          duplicatesRemoved++;
        }
        console.log(`  Removed ${items.length - 1} duplicate(s)`);
      }
    }

    // Add missing items
    console.log(`\nAdding missing items...\n`);
    for (const product of websiteProducts) {
      const normalized = normalizeName(product.name);
      
      // Check if already exists
      if (existingNames.has(normalized)) {
        skipped++;
        continue;
      }
      
      // Check for similar names (to avoid near-duplicates)
      let isSimilar = false;
      for (const existing of existingNames) {
        // Check if one name contains the other (but not too short)
        if (normalized.length > 10 && existing.length > 10) {
          if (normalized.includes(existing) || existing.includes(normalized)) {
            const longer = normalized.length > existing.length ? normalized : existing;
            const shorter = normalized.length > existing.length ? existing : normalized;
            // If 90%+ match, consider it a duplicate
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
          name: product.name,
          description: `${product.name} (ABV ${product.abv || 'N/A'}%)`,
          price: (product.price || 0).toString(),
          originalPrice: (product.price || 0).toString(),
          categoryId: whiskyCategory.id,
          subCategoryId: whiskySubCategory.id,
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
        
        if (added % 10 === 0) {
          process.stdout.write(`Added ${added} items...\r`);
        }
      } catch (error) {
        console.error(`Error adding ${product.name}:`, error.message);
        skipped++;
      }
    }

    const finalCount = await db.Drink.count({ where: { categoryId: whiskyCategory.id } });

    console.log(`\n\n✅ Completed!`);
    console.log(`- Added: ${added} new items`);
    console.log(`- Skipped (already exists): ${skipped}`);
    console.log(`- Duplicates removed: ${duplicatesRemoved}`);
    console.log(`- Website products found: ${websiteProducts.length}`);
    console.log(`- Final database count: ${finalCount}`);

  } catch (error) {
    console.error('Error adding missing whisky items:', error);
  } finally {
    await db.sequelize.close();
  }
}

addMissingWhiskyItems()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
