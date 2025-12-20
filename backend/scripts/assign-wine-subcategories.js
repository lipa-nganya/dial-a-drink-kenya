const db = require('../models');

/**
 * Assign wines to appropriate subcategories based on their names
 */
async function assignWineSubcategories() {
  try {
    console.log('🍷 Starting wine subcategory assignment...\n');

    // Get Wine category (ID 7)
    const wineCategory = await db.Category.findOne({ where: { name: 'Wine' } });
    if (!wineCategory) {
      console.error('❌ Wine category not found!');
      return;
    }

    console.log(`✅ Found Wine category (ID: ${wineCategory.id})\n`);

    // Get all wine subcategories
    const subcategories = await db.SubCategory.findAll({
      where: { categoryId: wineCategory.id, isActive: true },
      order: [['name', 'ASC']]
    });

    console.log(`📋 Found ${subcategories.length} wine subcategories:`);
    subcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    console.log('');

    // Create a mapping of keywords to subcategory IDs
    const subcategoryMap = {};
    
    // Map specific varietals first (more specific)
    const varietalMappings = {
      'Sauvignon Blanc': ['sauvignon blanc', 'sauvignon', 'sauvignon blanco'],
      'Pinot Grigio': ['pinot grigio', 'pinot gris'],
      'Pinot Noir': ['pinot noir'],
      'Chardonnay': ['chardonnay'],
      'Malbec': ['malbec'],
      'Shiraz': ['shiraz', 'syrah'],
      'Cabernet Sauvignon': ['cabernet sauvignon', 'cabernet'],
      'Merlot': ['merlot'],
      'Riesling': ['riesling'],
      'Moscato': ['moscato'],
      'Tempranillo': ['tempranillo'],
      'Pinotage': ['pinotage'],
      'Chenin Blanc': ['chenin blanc', 'chenin'],
      'Semilion': ['semilion', 'semillon'],
      'Cabernet Merlot': ['cabernet merlot', 'merlot'],
      'Port wine': ['port', 'porto'],
      'Brut': ['brut', 'crémant', 'cremant', 'sparkling'],
      'Dessert Wine': ['dessert', 'sweet wine', 'late harvest', 'demi sec']
    };

    // Map wine types (less specific, fallback)
    const typeMappings = {
      'Red Wine': ['red', 'rouge', 'tinto', 'rosso'],
      'White Wine': ['white', 'blanc', 'blanco', 'bianco', 'bianco nobile'],
      'Rose Wine': ['rose', 'rosé', 'rosado', 'rosato', 'pink']
    };

    // Build the mapping
    subcategories.forEach(sub => {
      const lowerName = sub.name.toLowerCase();
      
      // Check varietal mappings
      for (const [varietal, keywords] of Object.entries(varietalMappings)) {
        if (lowerName.includes(varietal.toLowerCase())) {
          keywords.forEach(keyword => {
            if (!subcategoryMap[keyword]) {
              subcategoryMap[keyword] = [];
            }
            subcategoryMap[keyword].push({ id: sub.id, name: sub.name, priority: 1 }); // Priority 1 = specific varietal
          });
        }
      }

      // Check type mappings
      for (const [type, keywords] of Object.entries(typeMappings)) {
        if (lowerName.includes(type.toLowerCase())) {
          keywords.forEach(keyword => {
            if (!subcategoryMap[keyword]) {
              subcategoryMap[keyword] = [];
            }
            subcategoryMap[keyword].push({ id: sub.id, name: sub.name, priority: 2 }); // Priority 2 = type
          });
        }
      }
    });

    // Get all wines
    const wines = await db.Drink.findAll({
      where: { categoryId: wineCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`\n🍷 Found ${wines.length} wines to process\n`);

    let assigned = 0;
    let skipped = 0;
    let errors = 0;

    for (const wine of wines) {
      try {
        const wineName = wine.name.toLowerCase();
        let matchedSubcategory = null;
        let highestPriority = 999;

        // Try to match against subcategory map
        for (const [keyword, matches] of Object.entries(subcategoryMap)) {
          if (wineName.includes(keyword)) {
            // Find the highest priority match (lower number = higher priority)
            for (const match of matches) {
              if (match.priority < highestPriority) {
                highestPriority = match.priority;
                matchedSubcategory = match;
              }
            }
          }
        }

        // If no match found, try direct name matching with subcategories
        if (!matchedSubcategory) {
          for (const sub of subcategories) {
            const subName = sub.name.toLowerCase();
            // Skip generic categories
            if (subName.includes('all wine') || subName.includes('all wines')) {
              continue;
            }
            
            // Check if wine name contains subcategory name (for varietals)
            if (wineName.includes(subName) || subName.includes(wineName.split(' ')[0])) {
              matchedSubcategory = { id: sub.id, name: sub.name, priority: 1 };
              break;
            }
          }
        }

        // If still no match, try to infer from common patterns
        if (!matchedSubcategory) {
          // Check for Chardonnay (white wine varietal)
          if (wineName.includes('chardonnay')) {
            const whiteWine = subcategories.find(s => s.name.toLowerCase() === 'white wine');
            if (whiteWine) {
              matchedSubcategory = { id: whiteWine.id, name: whiteWine.name, priority: 2 };
            }
          }
          // Check for Shiraz/Syrah (red wine varietal)
          else if (wineName.includes('shiraz') || wineName.includes('syrah')) {
            const redWine = subcategories.find(s => s.name.toLowerCase() === 'red wine');
            if (redWine) {
              matchedSubcategory = { id: redWine.id, name: redWine.name, priority: 2 };
            }
          }
          // Check for Viognier (white wine varietal)
          else if (wineName.includes('viognier')) {
            const whiteWine = subcategories.find(s => s.name.toLowerCase() === 'white wine');
            if (whiteWine) {
              matchedSubcategory = { id: whiteWine.id, name: whiteWine.name, priority: 2 };
            }
          }
          // Check for Torrontes (white wine varietal)
          else if (wineName.includes('torrontes') || wineName.includes('torrontés')) {
            const whiteWine = subcategories.find(s => s.name.toLowerCase() === 'white wine');
            if (whiteWine) {
              matchedSubcategory = { id: whiteWine.id, name: whiteWine.name, priority: 2 };
            }
          }
          // Check for Margaux (red wine from Bordeaux)
          else if (wineName.includes('margaux')) {
            const redWine = subcategories.find(s => s.name.toLowerCase() === 'red wine');
            if (redWine) {
              matchedSubcategory = { id: redWine.id, name: redWine.name, priority: 2 };
            }
          }
          // Check for Tawny (Port wine)
          else if (wineName.includes('tawny') && wineName.includes('port')) {
            const portWine = subcategories.find(s => s.name.toLowerCase() === 'port wine');
            if (portWine) {
              matchedSubcategory = { id: portWine.id, name: portWine.name, priority: 2 };
            }
          }
          // Check for Ruby (Port wine)
          else if (wineName.includes('ruby') && wineName.includes('port')) {
            const portWine = subcategories.find(s => s.name.toLowerCase() === 'port wine');
            if (portWine) {
              matchedSubcategory = { id: portWine.id, name: portWine.name, priority: 2 };
            }
          }
          // Check for red wine indicators
          else if (wineName.includes('red') || wineName.includes('rouge') || wineName.includes('tinto') || wineName.includes('rosso') || wineName.includes('claret')) {
            const redWine = subcategories.find(s => s.name.toLowerCase() === 'red wine');
            if (redWine) {
              matchedSubcategory = { id: redWine.id, name: redWine.name, priority: 2 };
            }
          }
          // Check for white wine indicators
          else if (wineName.includes('white') || wineName.includes('blanc') || wineName.includes('blanco') || wineName.includes('bianco') || wineName.includes('soave')) {
            const whiteWine = subcategories.find(s => s.name.toLowerCase() === 'white wine');
            if (whiteWine) {
              matchedSubcategory = { id: whiteWine.id, name: whiteWine.name, priority: 2 };
            }
          }
          // Check for rose wine indicators
          else if (wineName.includes('rose') || wineName.includes('rosé') || wineName.includes('rosado') || wineName.includes('rosato') || wineName.includes('pink')) {
            const roseWine = subcategories.find(s => s.name.toLowerCase() === 'rose wine');
            if (roseWine) {
              matchedSubcategory = { id: roseWine.id, name: roseWine.name, priority: 2 };
            }
          }
          // Check for sparkling/champagne indicators
          else if (wineName.includes('sparkling') || wineName.includes('champagne') || wineName.includes('crémant') || wineName.includes('cremant') || wineName.includes('brut')) {
            const brut = subcategories.find(s => s.name.toLowerCase() === 'brut');
            if (brut) {
              matchedSubcategory = { id: brut.id, name: brut.name, priority: 2 };
            }
          }
        }

        if (matchedSubcategory) {
          // Only update if different from current
          if (wine.subCategoryId !== matchedSubcategory.id) {
            await wine.update({ subCategoryId: matchedSubcategory.id });
            console.log(`✅ "${wine.name}" → ${matchedSubcategory.name}`);
            assigned++;
          } else {
            console.log(`⏭️  "${wine.name}" already assigned to ${matchedSubcategory.name}`);
            skipped++;
          }
        } else {
          console.log(`⚠️  "${wine.name}" - No subcategory match found`);
          skipped++;
        }
      } catch (error) {
        console.error(`❌ Error processing "${wine.name}":`, error.message);
        errors++;
      }
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`  ✅ Assigned: ${assigned}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`\n🎉 Wine subcategory assignment completed!`);

  } catch (error) {
    console.error('❌ Error assigning wine subcategories:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  assignWineSubcategories()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { assignWineSubcategories };

