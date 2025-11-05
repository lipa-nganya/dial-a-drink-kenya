const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../models');

async function importLiqueursFromDialADrink() {
  try {
    console.log('Scraping liqueurs from Dial a Drink Kenya...');
    
    const url = 'https://www.dialadrinkkenya.com/liqueurs';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    // Find the liqueurs category
    const liqueursCategory = await db.Category.findOne({
      where: {
        name: {
          [db.Sequelize.Op.iLike]: '%liqueur%'
        }
      }
    });

    if (!liqueursCategory) {
      console.log('Liqueurs category not found');
      return;
    }

    console.log(`Using liqueurs category ID: ${liqueursCategory.id}`);

    const liqueurs = [];
    
    // Extract product information from the page
    $('.product-item, .product-card, [class*="product"]').each((index, element) => {
      const $el = $(element);
      
      // Try different selectors to find product information
      const name = $el.find('h3, h4, .product-name, [class*="name"]').first().text().trim() ||
                   $el.find('a').first().text().trim();
      
      const priceText = $el.find('.price, [class*="price"], .cost').text().trim();
      const price = parseFloat(priceText.replace(/[^\d.]/g, '')) || 0;
      
      const capacityText = $el.find('.capacity, [class*="capacity"], .size').text().trim() ||
                          name.match(/(\d+(?:\.\d+)?\s*(?:ml|ML|litre|Litre|L|pack|Pack))/i)?.[1] || '';
      
      const abvText = $el.find('.abv, [class*="abv"]').text().trim() ||
                     name.match(/(\d+(?:\.\d+)?%)\s*ABV/i)?.[1] || '';
      const abv = parseFloat(abvText.replace('%', '')) || null;
      
      const originText = $el.find('.origin, [class*="origin"], .country').text().trim() ||
                        name.match(/\(([^)]+)\)/)?.[1] || '';
      
      if (name && name.length > 3 && !name.includes('Add to Cart') && !name.includes('Sold out')) {
        liqueurs.push({
          name: name,
          description: `${name}${abv ? ` (ABV ${abv}%)` : ''}${originText ? `, ${originText}` : ''}`,
          price: price,
          capacity: capacityText ? [capacityText] : [],
          abv: abv,
          origin: originText,
          categoryId: liqueursCategory.id,
          isAvailable: !$el.text().includes('Sold out'),
          image: '/images/placeholder.svg'
        });
      }
    });

    // Also try to extract from the text content if the above doesn't work
    if (liqueurs.length < 10) {
      console.log('Trying alternative extraction method...');
      
      const text = $('body').text();
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      let currentProduct = null;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Look for product names (lines that don't contain common UI text)
        if (line.length > 3 && 
            !line.includes('Add to Cart') && 
            !line.includes('Sold out') && 
            !line.includes('KES') &&
            !line.includes('Dial a Drink') &&
            !line.includes('Express Delivery') &&
            !line.includes('Filter Selection') &&
            !line.includes('Grapes') &&
            !line.includes('My Cart') &&
            !line.includes('View Cart') &&
            !line.includes('Instant Checkout') &&
            !line.includes('DIAL A DRINK KENYA') &&
            !line.includes('GENERAL LINKS') &&
            !line.includes('PAYMENT METHODS') &&
            !line.includes('SOCIAL NETWORKS') &&
            !line.includes('All Rights Reserved') &&
            !line.match(/^\d+$/) && // Not just numbers
            !line.match(/^[A-Z\s]+$/) && // Not all caps
            line.match(/[a-zA-Z]/)) { // Contains letters
          
          // Check if next line contains price
          const nextLine = lines[i + 1] || '';
          const priceMatch = nextLine.match(/KES\s*([\d,]+)/);
          const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
          
          // Check for ABV in the line or nearby
          const abvMatch = line.match(/(\d+(?:\.\d+)?%)\s*ABV/i) || nextLine.match(/(\d+(?:\.\d+)?%)\s*ABV/i);
          const abv = abvMatch ? parseFloat(abvMatch[1].replace('%', '')) : null;
          
          // Check for capacity
          const capacityMatch = line.match(/(\d+(?:\.\d+)?\s*(?:ml|ML|litre|Litre|L|pack|Pack))/i) || 
                               nextLine.match(/(\d+(?:\.\d+)?\s*(?:ml|ML|litre|Litre|L|pack|Pack))/i);
          const capacity = capacityMatch ? [capacityMatch[1]] : [];
          
          // Check for origin in parentheses
          const originMatch = line.match(/\(([^)]+)\)/);
          const origin = originMatch ? originMatch[1] : '';
          
          if (price > 0 || abv || capacity.length > 0) {
            liqueurs.push({
              name: line,
              description: `${line}${abv ? ` (ABV ${abv}%)` : ''}${origin ? `, ${origin}` : ''}`,
              price: price,
              capacity: capacity,
              abv: abv,
              origin: origin,
              categoryId: liqueursCategory.id,
              isAvailable: !line.includes('Sold out'),
              image: '/images/placeholder.svg'
            });
          }
        }
      }
    }

    console.log(`\nFound ${liqueurs.length} liqueurs to import:`);
    
    // Remove duplicates and filter out invalid entries
    const uniqueLiqueurs = [];
    const seenNames = new Set();
    
    for (const liqueur of liqueurs) {
      if (liqueur.name && 
          liqueur.name.length > 3 && 
          !seenNames.has(liqueur.name.toLowerCase()) &&
          !liqueur.name.includes('Add to Cart') &&
          !liqueur.name.includes('Sold out')) {
        seenNames.add(liqueur.name.toLowerCase());
        uniqueLiqueurs.push(liqueur);
      }
    }

    console.log(`\nAfter deduplication: ${uniqueLiqueurs.length} unique liqueurs`);
    
    // Show first 10 for preview
    console.log('\nFirst 10 liqueurs:');
    uniqueLiqueurs.slice(0, 10).forEach((liqueur, index) => {
      console.log(`${index + 1}. ${liqueur.name} - KES ${liqueur.price}${liqueur.abv ? ` (${liqueur.abv}% ABV)` : ''}`);
    });

    // Import to database
    console.log('\nImporting liqueurs to database...');
    let imported = 0;
    let skipped = 0;

    for (const liqueur of uniqueLiqueurs) {
      try {
        // Check if already exists
        const existing = await db.Drink.findOne({
          where: {
            name: {
              [db.Sequelize.Op.iLike]: `%${liqueur.name}%`
            },
            categoryId: liqueursCategory.id
          }
        });

        if (existing) {
          console.log(`Skipping existing: ${liqueur.name}`);
          skipped++;
          continue;
        }

        await db.Drink.create(liqueur);
        console.log(`Imported: ${liqueur.name}`);
        imported++;
      } catch (error) {
        console.log(`Error importing ${liqueur.name}: ${error.message}`);
      }
    }

    console.log(`\nImport completed:`);
    console.log(`- Imported: ${imported}`);
    console.log(`- Skipped: ${skipped}`);
    console.log(`- Total processed: ${imported + skipped}`);

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await db.sequelize.close();
  }
}

importLiqueursFromDialADrink()
  .then(() => {
    console.log('Liqueurs import completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

