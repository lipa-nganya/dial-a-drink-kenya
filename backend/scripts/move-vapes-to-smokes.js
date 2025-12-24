const db = require('../models');

/**
 * Move all items from Vapes category to Smokes category's Vapes subcategory
 */
async function moveVapesToSmokes() {
  try {
    console.log('🚬 Starting vapes migration to Smokes category...\n');

    // Get Vapes category
    const vapesCategory = await db.Category.findOne({ where: { name: 'Vapes' } });
    if (!vapesCategory) {
      console.error('❌ Vapes category not found!');
      return;
    }

    // Get Smokes category
    const smokesCategory = await db.Category.findOne({ where: { name: 'Smokes' } });
    if (!smokesCategory) {
      console.error('❌ Smokes category not found!');
      return;
    }

    // Get Vapes subcategory in Smokes
    const vapesSubcategory = await db.SubCategory.findOne({
      where: { 
        name: 'Vapes', 
        categoryId: smokesCategory.id 
      }
    });

    if (!vapesSubcategory) {
      console.error('❌ Vapes subcategory not found in Smokes category!');
      return;
    }

    console.log(`✅ Found Vapes category (ID: ${vapesCategory.id})`);
    console.log(`✅ Found Smokes category (ID: ${smokesCategory.id})`);
    console.log(`✅ Found Vapes subcategory in Smokes (ID: ${vapesSubcategory.id})\n`);

    // Get all drinks in Vapes category
    const vapesDrinks = await db.Drink.findAll({
      where: { categoryId: vapesCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`📦 Found ${vapesDrinks.length} items in Vapes category\n`);

    let moved = 0;
    let skipped = 0;
    let errors = 0;

    for (const drink of vapesDrinks) {
      try {
        // Check if this drink already exists in Smokes category with the same name
        const existingInSmokes = await db.Drink.findOne({
          where: {
            name: drink.name,
            categoryId: smokesCategory.id,
            subCategoryId: vapesSubcategory.id
          }
        });

        if (existingInSmokes) {
          // If it already exists in Smokes > Vapes, we still move this one to consolidate
          // This ensures all items from Vapes category are in Smokes > Vapes
          console.log(`🔄 "${drink.name}" already exists in Smokes > Vapes. Moving this duplicate anyway.`);
        }

        // Update the drink to move it to Smokes category and assign to Vapes subcategory
        await drink.update({
          categoryId: smokesCategory.id,
          subCategoryId: vapesSubcategory.id
        });

        console.log(`✅ Moved "${drink.name}" to Smokes > Vapes`);
        moved++;
      } catch (error) {
        console.error(`❌ Error processing "${drink.name}":`, error.message);
        errors++;
      }
    }

    // Verify final count
    const finalCount = await db.Drink.count({
      where: {
        categoryId: smokesCategory.id,
        subCategoryId: vapesSubcategory.id
      }
    });

    console.log(`\n\n📊 Summary:`);
    console.log(`  ✅ Moved: ${moved}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`  📦 Total items in Smokes > Vapes: ${finalCount}`);
    console.log(`\n🎉 Vapes migration completed!`);

  } catch (error) {
    console.error('❌ Error moving vapes to smokes:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  moveVapesToSmokes()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { moveVapesToSmokes };

