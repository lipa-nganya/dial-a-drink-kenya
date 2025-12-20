const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../models');

/**
 * Scrape subcategories from dialadrinkkenya.com
 */
async function scrapeSubcategoriesFromWebsite() {
  try {
    console.log('🌐 Scraping subcategories from dialadrinkkenya.com...');
    
    // Define category URLs to check
    const categoryUrls = {
      'Whisky': 'https://www.dialadrinkkenya.com/whisky',
      'Vodka': 'https://www.dialadrinkkenya.com/vodka',
      'Wine': 'https://www.dialadrinkkenya.com/wine',
      'Champagne': 'https://www.dialadrinkkenya.com/champagne',
      'Brandy': 'https://www.dialadrinkkenya.com/brandy',
      'Cognac': 'https://www.dialadrinkkenya.com/cognac',
      'Beer': 'https://www.dialadrinkkenya.com/beer',
      'Tequila': 'https://www.dialadrinkkenya.com/tequila',
      'Rum': 'https://www.dialadrinkkenya.com/rum',
      'Gin': 'https://www.dialadrinkkenya.com/gin',
      'Liqueur': 'https://www.dialadrinkkenya.com/liqueur',
      'Vapes': 'https://www.dialadrinkkenya.com/vapes',
      'Smokes': 'https://www.dialadrinkkenya.com/smokes',
    };

    const subcategoriesMap = {};

    for (const [categoryName, url] of Object.entries(categoryUrls)) {
      try {
        console.log(`\n📂 Checking ${categoryName}...`);
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 15000
        });

        const $ = cheerio.load(response.data);
        
        // Look for subcategory links or filters
        const subcategoryLinks = [];
        
        // Try multiple selectors for subcategories
        $('a[href*="subcategory"], a[href*="filter"], .subcategory, .filter-item, [class*="subcategory"], [class*="filter"]').each((i, elem) => {
          const text = $(elem).text().trim();
          const href = $(elem).attr('href') || '';
          
          if (text && text.length > 2 && text.length < 50) {
            // Check if it's a subcategory link
            if (href.includes('subcategory') || href.includes('filter') || 
                $(elem).hasClass('subcategory') || $(elem).hasClass('filter-item')) {
              subcategoryLinks.push(text);
            }
          }
        });

        // Also check for product subcategories based on product names
        const productSubcategories = new Set();
        $('.product, [class*="product"], .drink-item').each((i, elem) => {
          const productName = $(elem).find('h2, h3, .product-name, [class*="name"]').text().trim();
          // Extract subcategory from product name or attributes
          const subcategoryAttr = $(elem).attr('data-subcategory') || 
                                 $(elem).find('[data-subcategory]').attr('data-subcategory');
          if (subcategoryAttr) {
            productSubcategories.add(subcategoryAttr);
          }
        });

        // Combine found subcategories
        const foundSubcategories = [...new Set([...subcategoryLinks, ...Array.from(productSubcategories)])];
        
        if (foundSubcategories.length > 0) {
          subcategoriesMap[categoryName] = foundSubcategories;
          console.log(`  ✅ Found ${foundSubcategories.length} subcategories:`, foundSubcategories);
        } else {
          console.log(`  ⚠️  No subcategories found for ${categoryName}`);
        }

        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`  ❌ Error scraping ${categoryName}:`, error.message);
      }
    }

    return subcategoriesMap;
  } catch (error) {
    console.error('Error scraping subcategories:', error);
    return {};
  }
}

/**
 * Define comprehensive subcategories based on standard alcohol categories
 */
function getStandardSubcategories() {
  return {
    'Whisky': [
      'All Whiskys',
      'Single Malt',
      'Blended Scotch',
      'Irish Whisky',
      'Bourbon Whisky',
      'Tennessee Whisky',
      'Rye Whisky',
      'Japanese Whisky'
    ],
    'Vodka': [
      'All Vodka',
      'Flavoured Vodka',
      'Unflavoured Vodka',
      'Premium Vodka'
    ],
    'Wine': [
      'All Wine',
      'Red Wine',
      'White Wine',
      'Rose Wine',
      'Sparkling Wine',
      'Dessert Wine'
    ],
    'Champagne': [
      'All Champagne',
      'Rose Champagne',
      'Sparkling Wine',
      'Premium Champagne'
    ],
    'Brandy': [
      'All Brandy',
      'VS',
      'VSOP',
      'XO',
      'Premium Brandy'
    ],
    'Cognac': [
      'All Cognac',
      'VS',
      'VSOP',
      'XO',
      'Premium Cognac'
    ],
    'Beer': [
      'All Beer',
      'Lager',
      'Ale',
      'Stout',
      'Cider',
      'Malt',
      'Draught'
    ],
    'Tequila': [
      'All Tequila',
      'Blanco/Silver',
      'Reposado',
      'Añejo',
      'Gold Tequila'
    ],
    'Rum': [
      'All Rum',
      'White Rum',
      'Dark Rum',
      'Spiced Rum',
      'Premium Rum'
    ],
    'Gin': [
      'All Gin',
      'London Dry Gin',
      'Flavoured Gin',
      'Premium Gin'
    ],
    'Liqueur': [
      'All Liqueur',
      'Cream Liqueur',
      'Fruit Liqueur',
      'Herbal Liqueur',
      'Coffee Liqueur'
    ],
    'Vapes': [
      'All Vapes',
      'Disposable Vapes',
      'Refillable Vapes',
      'Vape Pods'
    ],
    'Smokes': [
      'All Smokes',
      'Cigarettes',
      'Cigars',
      'Rolling Papers',
      'Nicotine Pouches',
      'Other'
    ]
  };
}

/**
 * Sync subcategories to database
 */
async function syncSubcategories() {
  try {
    console.log('🔄 Starting subcategory sync...\n');

    // Get all categories
    const categories = await db.Category.findAll({
      order: [['name', 'ASC']]
    });

    console.log(`Found ${categories.length} categories in database\n`);

    // Try to scrape from website first
    const scrapedSubcategories = await scrapeSubcategoriesFromWebsite();
    
    // Use standard subcategories as fallback/enhancement
    const standardSubcategories = getStandardSubcategories();

    let totalCreated = 0;
    let totalUpdated = 0;

    for (const category of categories) {
      const categoryName = category.name;
      console.log(`\n📁 Processing category: ${categoryName} (ID: ${category.id})`);

      // Get subcategories from scraped data or standard list
      let subcategoriesToAdd = scrapedSubcategories[categoryName] || 
                              standardSubcategories[categoryName] || 
                              [];

      // If we have both scraped and standard, merge them
      if (scrapedSubcategories[categoryName] && standardSubcategories[categoryName]) {
        subcategoriesToAdd = [...new Set([
          ...standardSubcategories[categoryName],
          ...scrapedSubcategories[categoryName]
        ])];
      }

      if (subcategoriesToAdd.length === 0) {
        console.log(`  ⚠️  No subcategories defined for ${categoryName}`);
        continue;
      }

      console.log(`  📋 Subcategories to sync: ${subcategoriesToAdd.join(', ')}`);

      for (const subcategoryName of subcategoriesToAdd) {
        try {
          // Check if subcategory already exists
          const [subcategory, created] = await db.SubCategory.findOrCreate({
            where: {
              name: subcategoryName,
              categoryId: category.id
            },
            defaults: {
              name: subcategoryName,
              categoryId: category.id,
              isActive: true
            }
          });

          if (created) {
            console.log(`  ➕ Created: "${subcategoryName}"`);
            totalCreated++;
          } else {
            // Update if inactive
            if (!subcategory.isActive) {
              await subcategory.update({ isActive: true });
              console.log(`  🔄 Reactivated: "${subcategoryName}"`);
              totalUpdated++;
            } else {
              console.log(`  ✅ Already exists: "${subcategoryName}"`);
            }
          }
        } catch (error) {
          console.error(`  ❌ Error processing "${subcategoryName}":`, error.message);
        }
      }
    }

    console.log(`\n\n🎉 Subcategory sync completed!`);
    console.log(`📊 Total created: ${totalCreated}`);
    console.log(`🔄 Total updated: ${totalUpdated}`);

    // Show summary
    const allSubcategories = await db.SubCategory.findAll({
      include: [{
        model: db.Category,
        as: 'category'
      }],
      order: [['categoryId', 'ASC'], ['name', 'ASC']]
    });

    console.log('\n📋 All subcategories by category:');
    const grouped = {};
    allSubcategories.forEach(sub => {
      const catName = sub.category?.name || 'Unknown';
      if (!grouped[catName]) grouped[catName] = [];
      grouped[catName].push(sub.name);
    });

    for (const [catName, subs] of Object.entries(grouped)) {
      console.log(`\n  ${catName}:`);
      subs.forEach(sub => console.log(`    - ${sub}`));
    }

  } catch (error) {
    console.error('❌ Error syncing subcategories:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  syncSubcategories()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { syncSubcategories, getStandardSubcategories };

