const db = require('../models');

/**
 * Rename beer subcategories
 */
async function renameBeerSubcategories() {
  try {
    console.log('🍺 Starting beer subcategory rename...\n');

    // Get Beer category
    const beerCategory = await db.Category.findOne({ where: { name: 'Beer' } });
    if (!beerCategory) {
      console.error('❌ Beer category not found!');
      return;
    }

    console.log(`✅ Found Beer category (ID: ${beerCategory.id})\n`);

    // Define renames: old name -> new name
    const renames = [
      { oldName: 'Cider Beer', newName: 'Cider' },
      { oldName: 'Draught Beer', newName: 'Draught' },
      { oldName: 'Lager Beer', newName: 'Lagerlt' }
    ];

    console.log('🔄 Renaming subcategories...\n');

    let renamed = 0;
    let skipped = 0;
    let errors = 0;

    for (const rename of renames) {
      try {
        // Find the subcategory to rename
        const subcategory = await db.SubCategory.findOne({
          where: { 
            name: rename.oldName, 
            categoryId: beerCategory.id 
          }
        });

        if (!subcategory) {
          console.log(`  ⚠️  Subcategory "${rename.oldName}" not found, skipping...`);
          skipped++;
          continue;
        }

        // Check if new name already exists
        const existing = await db.SubCategory.findOne({
          where: { 
            name: rename.newName, 
            categoryId: beerCategory.id 
          }
        });

        if (existing) {
          console.log(`  ⚠️  Subcategory "${rename.newName}" already exists, skipping rename of "${rename.oldName}"...`);
          skipped++;
          continue;
        }

        // Rename the subcategory
        await subcategory.update({ name: rename.newName });
        console.log(`  ✅ Renamed: "${rename.oldName}" → "${rename.newName}"`);
        renamed++;

      } catch (error) {
        console.error(`  ❌ Error renaming "${rename.oldName}":`, error.message);
        errors++;
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
    console.log(`  ✅ Renamed: ${renamed}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`\n🎉 Beer subcategory rename completed!`);

  } catch (error) {
    console.error('❌ Error renaming beer subcategories:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  renameBeerSubcategories()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { renameBeerSubcategories };

