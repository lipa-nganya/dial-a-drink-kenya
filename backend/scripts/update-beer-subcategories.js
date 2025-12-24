const db = require('../models');

/**
 * Update beer subcategories:
 * 1. Remove "Beer" and "All Beers" subcategories
 * 2. Add new subcategories based on website filters
 */
async function updateBeerSubcategories() {
  try {
    console.log('🍺 Starting beer subcategory update...\n');

    // Get Beer category
    const beerCategory = await db.Category.findOne({ where: { name: 'Beer' } });
    if (!beerCategory) {
      console.error('❌ Beer category not found!');
      return;
    }

    console.log(`✅ Found Beer category (ID: ${beerCategory.id})\n`);

    // Get all current beer subcategories
    const currentSubcategories = await db.SubCategory.findAll({
      where: { categoryId: beerCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`📋 Found ${currentSubcategories.length} current beer subcategories:`);
    currentSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    console.log('');

    // Subcategories to remove
    const subcategoriesToRemove = ['Beer', 'All Beers', 'All Beer', 'Craft Beer', 'Cider', 'Draught', 'Lager', 'Malt'];
    
    // Map old subcategories to new ones for reassignment
    const subcategoryMapping = {
      'Cider': 'Cider Beer',
      'Draught': 'Draught Beer',
      'Lager': 'Lager Beer',
      'Malt': 'Malt Beer'
    };

    // Remove unwanted subcategories
    console.log('🗑️  Removing unwanted subcategories...');
    for (const subcategory of currentSubcategories) {
      if (subcategoriesToRemove.includes(subcategory.name)) {
        // Check if any drinks are using this subcategory
        const drinksCount = await db.Drink.count({
          where: { subCategoryId: subcategory.id }
        });

        if (drinksCount > 0) {
          // If there's a mapping to a new subcategory, reassign drinks
          const newSubcategoryName = subcategoryMapping[subcategory.name];
          if (newSubcategoryName) {
            const newSubcategory = await db.SubCategory.findOne({
              where: { 
                name: newSubcategoryName, 
                categoryId: beerCategory.id 
              }
            });

            if (newSubcategory) {
              console.log(`  🔄 "${subcategory.name}" has ${drinksCount} drinks. Reassigning to "${newSubcategoryName}"...`);
              await db.Drink.update(
                { subCategoryId: newSubcategory.id },
                { where: { subCategoryId: subcategory.id } }
              );
              console.log(`  ✅ Reassigned ${drinksCount} drinks from "${subcategory.name}" to "${newSubcategoryName}"`);
            } else {
              console.log(`  ⚠️  "${subcategory.name}" has ${drinksCount} drinks assigned. Setting subCategoryId to null for these drinks...`);
              await db.Drink.update(
                { subCategoryId: null },
                { where: { subCategoryId: subcategory.id } }
              );
            }
          } else {
            console.log(`  ⚠️  "${subcategory.name}" has ${drinksCount} drinks assigned. Setting subCategoryId to null for these drinks...`);
            await db.Drink.update(
              { subCategoryId: null },
              { where: { subCategoryId: subcategory.id } }
            );
          }
        }

        await subcategory.destroy();
        console.log(`  ✅ Removed: "${subcategory.name}"`);
      }
    }
    console.log('');

    // New subcategories based on website filters from https://www.dialadrinkkenya.com/beers
    const newSubcategories = [
      'Cider Beer',
      'Lager Beer',
      'Malt Beer',
      'Draught Beer',
      'Strong Beer',
      'Non-alcoholic Beers',
      'craft beer'
    ];

    console.log('➕ Adding new beer subcategories...');
    let created = 0;
    let alreadyExisted = 0;

    for (const subcategoryName of newSubcategories) {
      try {
        // Check if subcategory already exists
        const existingSubcategory = await db.SubCategory.findOne({
          where: { 
            name: subcategoryName, 
            categoryId: beerCategory.id 
          }
        });

        if (existingSubcategory) {
          console.log(`  ⏭️  "${subcategoryName}" already exists`);
          alreadyExisted++;
        } else {
          // Create subcategory
          await db.SubCategory.create({
            name: subcategoryName,
            categoryId: beerCategory.id,
            isActive: true
          });
          console.log(`  ✅ Created: "${subcategoryName}"`);
          created++;
        }
      } catch (error) {
        console.error(`  ❌ Error processing "${subcategoryName}":`, error.message);
      }
    }

    console.log('');

    // Show final list of beer subcategories
    const finalSubcategories = await db.SubCategory.findAll({
      where: { categoryId: beerCategory.id, isActive: true },
      order: [['name', 'ASC']]
    });

    console.log(`📊 Final beer subcategories (${finalSubcategories.length}):`);
    finalSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });

    console.log(`\n\n📊 Summary:`);
    console.log(`  ➕ Created: ${created}`);
    console.log(`  ⏭️  Already existed: ${alreadyExisted}`);
    console.log(`  🗑️  Removed: ${subcategoriesToRemove.length}`);
    console.log(`\n🎉 Beer subcategory update completed!`);

  } catch (error) {
    console.error('❌ Error updating beer subcategories:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  updateBeerSubcategories()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { updateBeerSubcategories };

