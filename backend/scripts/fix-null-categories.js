/**
 * Fix Items with Null CategoryId
 * 
 * Re-transforms items that have null categoryId and assigns proper categories.
 */

const fs = require('fs');
const path = require('path');
const db = require('../models');

async function fixNullCategories() {
  try {
    console.log('🔌 Connecting to database...');
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful\n');

    // Read data files
    const transformedPath = path.join(process.cwd(), 'new-inventory-transformed-v3.json');
    const originalPath = path.join(process.cwd(), 'new-inventory-raw.json');

    const transformed = JSON.parse(fs.readFileSync(transformedPath, 'utf8'));
    const original = JSON.parse(fs.readFileSync(originalPath, 'utf8'));

    // Get categories
    const categories = await db.Category.findAll();
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.name.toLowerCase()] = cat;
    });

    const categoryNameMappings = {
      'Liqueurs': 'Liqueur',
      'Beers': 'Beer',
      'Mixer spirit': 'Soft Drinks'
    };

    // Helper function to infer category from name/tags
    function inferCategory(name, tags) {
      const nameLower = (name || '').toLowerCase();
      const tagsStr = (tags || []).join(' ').toLowerCase();
      const combined = `${nameLower} ${tagsStr}`;
      
      // Category inference rules
      if (combined.includes('wine') || combined.includes('sauvignon') || combined.includes('chardonnay') || 
          combined.includes('pinot') || combined.includes('merlot') || combined.includes('cabernet') ||
          combined.includes('shiraz') || combined.includes('malbec') || combined.includes('rose') ||
          combined.includes('rosé') || combined.includes('moscato') || combined.includes('sparkling')) {
        return 'Wine';
      }
      if (combined.includes('water') || combined.includes('sparkling water') || combined.includes('soda') ||
          combined.includes('juice') || combined.includes('soft drink')) {
        return 'Soft Drinks';
      }
      if (combined.includes('whisky') || combined.includes('whiskey') || combined.includes('scotch')) {
        return 'Whisky';
      }
      if (combined.includes('vodka')) {
        return 'Vodka';
      }
      if (combined.includes('gin')) {
        return 'Gin';
      }
      if (combined.includes('rum')) {
        return 'Rum';
      }
      if (combined.includes('tequila')) {
        return 'Tequila';
      }
      if (combined.includes('champagne') || combined.includes('prosecco') || combined.includes('cuvée')) {
        return 'Champagne';
      }
      if (combined.includes('brandy')) {
        return 'Brandy';
      }
      if (combined.includes('cognac')) {
        return 'Cognac';
      }
      if (combined.includes('beer') || combined.includes('lager') || combined.includes('ale')) {
        return 'Beer';
      }
      if (combined.includes('liqueur')) {
        return 'Liqueur';
      }
      if (combined.includes('vermouth')) {
        return 'Liqueur'; // Vermouth is a liqueur
      }
      if (combined.includes('condom') || combined.includes('cork') || combined.includes('screw') ||
          combined.includes('lighter') || combined.includes('rolling paper') || combined.includes('paper')) {
        return 'Smokes'; // Accessories go to Smokes category
      }
      if (combined.includes('chocolate') || combined.includes('candy')) {
        return 'Soft Drinks'; // Chocolates/candy
      }
      
      // Default to Wine if it's unclear (most items are wine)
      if (nameLower.length > 0) {
        return 'Wine';
      }
      
      return null;
    }

    // Fix items with null categoryId
    let fixed = 0;
    for (let i = 0; i < transformed.drinks.length && i < original.length; i++) {
      const drink = transformed.drinks[i];
      if (!drink.categoryId) {
        const orig = original[i];
        const fields = orig.fields || orig;
        let catName = null;
        
        // Try to get from category field
        const cat = fields.category;
        if (cat) {
          catName = typeof cat === 'object' ? cat.name : cat;
        }
        
        // If still no category, infer from name/tags
        if (!catName) {
          catName = inferCategory(drink.name, fields.tags);
        }
        
        if (catName) {
          const mappedName = categoryNameMappings[catName] || catName;
          
          if (mappedName && categoryMap[mappedName.toLowerCase()]) {
            drink.categoryId = categoryMap[mappedName.toLowerCase()].id;
            fixed++;
          }
        }
      }
    }

    console.log(`✅ Fixed ${fixed} items with null categoryId\n`);

    // Save updated transformed data
    fs.writeFileSync(transformedPath, JSON.stringify(transformed, null, 2), 'utf8');
    console.log(`💾 Updated ${transformedPath}\n`);

    console.log('✅ Done! Re-run the import script.');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await db.sequelize.close();
  }
}

fixNullCategories();
