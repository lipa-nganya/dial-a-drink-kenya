const db = require('../models');

/**
 * Remove the Vapes category
 * This should only be done after all items have been moved to Smokes > Vapes
 */
async function removeVapesCategory() {
  try {
    console.log('🗑️  Starting Vapes category removal...\n');

    // Get Vapes category
    const vapesCategory = await db.Category.findOne({ where: { name: 'Vapes' } });
    if (!vapesCategory) {
      console.log('⏭️  Vapes category not found. Nothing to remove.');
      return;
    }

    console.log(`✅ Found Vapes category (ID: ${vapesCategory.id})\n`);

    // Check if there are any drinks still in this category
    const drinksCount = await db.Drink.count({
      where: { categoryId: vapesCategory.id }
    });

    if (drinksCount > 0) {
      console.error(`❌ Cannot remove Vapes category: ${drinksCount} drinks still exist in this category.`);
      console.error('   Please move all drinks to Smokes > Vapes first.');
      return;
    }

    // Check if there are any subcategories
    const subcategories = await db.SubCategory.findAll({
      where: { categoryId: vapesCategory.id }
    });

    console.log(`📋 Found ${subcategories.length} subcategories in Vapes category`);

    // Remove all subcategories first
    if (subcategories.length > 0) {
      console.log('\n🗑️  Removing subcategories...');
      for (const subcategory of subcategories) {
        // Check if any drinks are using this subcategory
        const drinksInSubcat = await db.Drink.count({
          where: { subCategoryId: subcategory.id }
        });

        if (drinksInSubcat > 0) {
          console.log(`  ⚠️  "${subcategory.name}" has ${drinksInSubcat} drinks. Setting subCategoryId to null...`);
          await db.Drink.update(
            { subCategoryId: null },
            { where: { subCategoryId: subcategory.id } }
          );
        }

        await subcategory.destroy();
        console.log(`  ✅ Removed: "${subcategory.name}"`);
      }
    }

    // Now remove the category
    console.log('\n🗑️  Removing Vapes category...');
    await vapesCategory.destroy();
    console.log(`  ✅ Removed: "Vapes" category`);

    console.log(`\n🎉 Vapes category removal completed!`);

  } catch (error) {
    console.error('❌ Error removing Vapes category:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  removeVapesCategory()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { removeVapesCategory };

