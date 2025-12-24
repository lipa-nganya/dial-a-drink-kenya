const db = require('../models');

/**
 * Update wine subcategories:
 * 1. Remove "All Wine" and "All Wines" subcategories
 * 2. Assign wines to correct subcategories (Red Wine, White Wine, Rose Wine, and varietal-specific)
 */
async function updateWineSubcategories() {
  try {
    console.log('🍷 Starting wine subcategory update...\n');

    // Get Wine category
    const wineCategory = await db.Category.findOne({ where: { name: 'Wine' } });
    if (!wineCategory) {
      console.error('❌ Wine category not found!');
      return;
    }

    console.log(`✅ Found Wine category (ID: ${wineCategory.id})\n`);

    // Get all current wine subcategories
    const currentSubcategories = await db.SubCategory.findAll({
      where: { categoryId: wineCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`📋 Found ${currentSubcategories.length} current wine subcategories:`);
    currentSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    console.log('');

    // Get all wines
    const wines = await db.Drink.findAll({
      where: { categoryId: wineCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`\n🍷 Found ${wines.length} wines to assign\n`);

    // Get all subcategories excluding "All Wine" and "All Wines"
    const allSubcategories = await db.SubCategory.findAll({
      where: { 
        categoryId: wineCategory.id, 
        isActive: true,
        name: { [db.Sequelize.Op.notIn]: ['All Wine', 'All Wines'] }
      },
      order: [['name', 'ASC']]
    });

    console.log(`📋 Available subcategories for assignment:`);
    allSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    console.log('');

    // Helper function to find subcategory by name (case-insensitive)
    const findSubcategory = (name) => {
      return allSubcategories.find(s => 
        s.name.toLowerCase() === name.toLowerCase()
      );
    };

    let assigned = 0;
    let skipped = 0;
    let errors = 0;

    for (const wine of wines) {
      try {
        const wineName = wine.name.toLowerCase();
        const wineDescription = (wine.description || '').toLowerCase();
        const combinedText = `${wineName} ${wineDescription}`;
        let matchedSubcategory = null;

        // Match based on type in name/description - check varietals first
        // Brut / Sparkling
        if (combinedText.includes('brut') || combinedText.includes('sparkling') ||
            combinedText.includes('prosecco') || combinedText.includes('champagne') ||
            combinedText.includes('cava') || combinedText.includes('cremant')) {
          matchedSubcategory = findSubcategory('Brut') || findSubcategory('Sparkling White Wine');
        }
        // Port wine
        else if (combinedText.includes('port') || combinedText.includes('porto')) {
          matchedSubcategory = findSubcategory('Port wine') || findSubcategory('Dessert Wine');
        }
        // Dessert Wine
        else if (combinedText.includes('dessert') || combinedText.includes('sweet') ||
                 combinedText.includes('muscadel') || combinedText.includes('late harvest')) {
          matchedSubcategory = findSubcategory('Dessert Wine');
        }
        // Altar Wine
        else if (combinedText.includes('altar') || combinedText.includes('sacramental')) {
          matchedSubcategory = findSubcategory('Altar Wine');
        }
        // Specific varietals - Red
        else if (combinedText.includes('cabernet sauvignon') || combinedText.includes('cab sauv')) {
          matchedSubcategory = findSubcategory('Cabernet Sauvignon') || findSubcategory('Red Wine');
        }
        else if (combinedText.includes('cabernet merlot') || combinedText.includes('cab merlot')) {
          matchedSubcategory = findSubcategory('Cabernet Merlot') || findSubcategory('Red Wine');
        }
        else if (combinedText.includes('malbec')) {
          matchedSubcategory = findSubcategory('Malbec') || findSubcategory('Red Wine');
        }
        else if (combinedText.includes('tempranillo')) {
          matchedSubcategory = findSubcategory('Tempranillo') || findSubcategory('Red Wine');
        }
        else if (combinedText.includes('pinotage')) {
          matchedSubcategory = findSubcategory('Pinotage') || findSubcategory('Red Wine');
        }
        // Specific varietals - White
        else if (combinedText.includes('sauvignon blanc') || combinedText.includes('sauv blanc')) {
          matchedSubcategory = findSubcategory('Sauvignon Blanc') || findSubcategory('White Wine');
        }
        else if (combinedText.includes('pinot grigio') || combinedText.includes('pinot gris')) {
          matchedSubcategory = findSubcategory('Pinot Grigio') || findSubcategory('White Wine');
        }
        else if (combinedText.includes('chenin blanc')) {
          matchedSubcategory = findSubcategory('Chenin Blanc') || findSubcategory('White Wine');
        }
        else if (combinedText.includes('riesling')) {
          matchedSubcategory = findSubcategory('Riesling') || findSubcategory('White Wine');
        }
        else if (combinedText.includes('semillon') || combinedText.includes('semilion')) {
          matchedSubcategory = findSubcategory('Semilion') || findSubcategory('White Wine');
        }
        else if (combinedText.includes('moscato')) {
          matchedSubcategory = findSubcategory('Moscato') || findSubcategory('White Wine');
        }
        // General categories - Rose Wine
        else if (combinedText.includes('rose') || combinedText.includes('rosé') ||
                 combinedText.includes('rosato') || combinedText.includes('pink')) {
          matchedSubcategory = findSubcategory('Rose Wine');
        }
        // General categories - Red Wine
        else if (combinedText.includes('red') || combinedText.includes('rouge') ||
                 combinedText.includes('merlot') || combinedText.includes('shiraz') ||
                 combinedText.includes('syrah') || combinedText.includes('pinot noir') ||
                 combinedText.includes('zinfandel') || combinedText.includes('sangiovese') ||
                 combinedText.includes('cabernet') || combinedText.includes('bordeaux') ||
                 combinedText.includes('burgundy') || combinedText.includes('rioja') ||
                 combinedText.includes('chardonnay') && combinedText.includes('red')) {
          matchedSubcategory = findSubcategory('Red Wine');
        }
        // General categories - White Wine
        else if (combinedText.includes('white') || combinedText.includes('blanc') ||
                 combinedText.includes('chardonnay') || combinedText.includes('viognier') ||
                 combinedText.includes('gewurztraminer') || combinedText.includes('albarino')) {
          matchedSubcategory = findSubcategory('White Wine');
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
          // Default to Red Wine if no match (most common wine type)
          const redWineSubcategory = findSubcategory('Red Wine');
          if (redWineSubcategory) {
            if (wine.subCategoryId !== redWineSubcategory.id) {
              await wine.update({ subCategoryId: redWineSubcategory.id });
              console.log(`✅ "${wine.name}" → Red Wine (default)`);
              assigned++;
            } else {
              console.log(`⏭️  "${wine.name}" already assigned to Red Wine`);
              skipped++;
            }
          } else {
            console.log(`⚠️  "${wine.name}" - No subcategory match found`);
            skipped++;
          }
        }
      } catch (error) {
        console.error(`❌ Error processing "${wine.name}":`, error.message);
        errors++;
      }
    }

    // Now remove "All Wine" and "All Wines" subcategories
    console.log('\n🗑️  Removing "All Wine" and "All Wines" subcategories...');
    const subcategoriesToRemove = ['All Wine', 'All Wines'];
    
    for (const subcategoryName of subcategoriesToRemove) {
      const subcategory = await db.SubCategory.findOne({
        where: { 
          name: subcategoryName, 
          categoryId: wineCategory.id 
        }
      });
      
      if (subcategory) {
        // Check if any drinks are still using this subcategory
        const drinksCount = await db.Drink.count({
          where: { subCategoryId: subcategory.id }
        });

        if (drinksCount > 0) {
          console.log(`  ⚠️  "${subcategoryName}" still has ${drinksCount} drinks assigned. Setting subCategoryId to null...`);
          await db.Drink.update(
            { subCategoryId: null },
            { where: { subCategoryId: subcategory.id } }
          );
        }

        await subcategory.destroy();
        console.log(`  ✅ Removed: "${subcategoryName}"`);
      } else {
        console.log(`  ⏭️  "${subcategoryName}" subcategory not found`);
      }
    }

    console.log('');

    // Show final list of wine subcategories
    const finalSubcategories = await db.SubCategory.findAll({
      where: { categoryId: wineCategory.id, isActive: true },
      order: [['name', 'ASC']]
    });

    console.log(`📊 Final wine subcategories (${finalSubcategories.length}):`);
    finalSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });

    console.log(`\n\n📊 Summary:`);
    console.log(`  🗑️  Removed: ${subcategoriesToRemove.length} subcategories`);
    console.log(`  ✅ Assigned: ${assigned}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`\n🎉 Wine subcategory update completed!`);

  } catch (error) {
    console.error('❌ Error updating wine subcategories:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  updateWineSubcategories()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { updateWineSubcategories };

