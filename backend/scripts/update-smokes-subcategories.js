const db = require('../models');

/**
 * Update smokes subcategories:
 * 1. Remove "All Smokes" and "Smokes" subcategories
 * 2. Keep appropriate subcategories (Cigarettes, Cigars, Nicotine Pouches, Rolling Papers, Vapes)
 * 3. Assign smokes to correct subcategories
 */
async function updateSmokesSubcategories() {
  try {
    console.log('🚬 Starting smokes subcategory update...\n');

    // Get Smokes category
    const smokesCategory = await db.Category.findOne({ where: { name: 'Smokes' } });
    if (!smokesCategory) {
      console.error('❌ Smokes category not found!');
      return;
    }

    console.log(`✅ Found Smokes category (ID: ${smokesCategory.id})\n`);

    // Get all current smokes subcategories
    const currentSubcategories = await db.SubCategory.findAll({
      where: { categoryId: smokesCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`📋 Found ${currentSubcategories.length} current smokes subcategories:`);
    currentSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    console.log('');

    // Subcategories to remove
    const subcategoriesToRemove = ['All Smokes', 'Smokes', 'Cigars & Cigarettes'];

    // Remove unwanted subcategories
    console.log('🗑️  Removing unwanted subcategories...');
    for (const subcategory of currentSubcategories) {
      if (subcategoriesToRemove.includes(subcategory.name)) {
        // Check if any drinks are using this subcategory
        const drinksCount = await db.Drink.count({
          where: { subCategoryId: subcategory.id }
        });

        if (drinksCount > 0) {
          console.log(`  ⚠️  "${subcategory.name}" has ${drinksCount} drinks assigned. Will reassign them after processing...`);
        }

        await subcategory.destroy();
        console.log(`  ✅ Removed: "${subcategory.name}"`);
      }
    }
    console.log('');

    // Get all smokes
    const smokes = await db.Drink.findAll({
      where: { categoryId: smokesCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`\n🚬 Found ${smokes.length} smokes to assign\n`);

    // Get all subcategories after removal (excluding removed ones)
    const allSubcategories = await db.SubCategory.findAll({
      where: { 
        categoryId: smokesCategory.id, 
        isActive: true,
        name: { [db.Sequelize.Op.notIn]: subcategoriesToRemove }
      },
      order: [['name', 'ASC']]
    });

    console.log(`📋 Available subcategories for assignment:`);
    allSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    console.log('');

    let assigned = 0;
    let skipped = 0;
    let errors = 0;

    for (const smoke of smokes) {
      try {
        const smokeName = smoke.name.toLowerCase();
        const smokeDescription = (smoke.description || '').toLowerCase();
        const combinedText = `${smokeName} ${smokeDescription}`;
        let matchedSubcategory = null;

        // Match based on type in name/description
        // Cigarettes
        if (combinedText.includes('cigarette') || combinedText.includes('cigarettes') ||
            smokeName.includes('embassy') || smokeName.includes('marlboro') ||
            smokeName.includes('dunhill') || smokeName.includes('rothmans') ||
            smokeName.includes('pall mall') || smokeName.includes('camel') ||
            smokeName.includes('winston') || smokeName.includes('lucky strike') ||
            smokeName.includes('parliament') || smokeName.includes('benson') ||
            smokeName.includes('kent') || smokeName.includes('chesterfield')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Cigarettes');
        }
        // Cigars
        else if (combinedText.includes('cigar') || combinedText.includes('cigars') ||
                 smokeName.includes('montecristo') || smokeName.includes('kafie') ||
                 smokeName.includes('cohiba') || smokeName.includes('romeo') ||
                 smokeName.includes('davidoff')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Cigars');
        }
        // Vapes
        else if (combinedText.includes('vape') || combinedText.includes('vapes') ||
                 smokeName.includes('vape') || smokeName.includes('akso') ||
                 smokeName.includes('e-cigarette') || smokeName.includes('e-cig') ||
                 smokeName.includes('disposable')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Vapes');
        }
        // Nicotine Pouches
        else if (combinedText.includes('nicotine pouch') || combinedText.includes('nicotine pouches') ||
                 combinedText.includes('pouch') || smokeName.includes('velo') ||
                 smokeName.includes('sky nicotine') || smokeName.includes('zyn') ||
                 smokeName.includes('snus')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Nicotine Pouches');
        }
        // Rolling Papers
        else if (combinedText.includes('rolling paper') || combinedText.includes('rolling papers') ||
                 combinedText.includes('paper') || smokeName.includes('raw') ||
                 smokeName.includes('mbichwa') || smokeName.includes('wetop') ||
                 smokeName.includes('ocb') || smokeName.includes('zig zag') ||
                 smokeName.includes('rizla')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Rolling Papers');
        }

        if (matchedSubcategory) {
          // Only update if different from current
          if (smoke.subCategoryId !== matchedSubcategory.id) {
            await smoke.update({ subCategoryId: matchedSubcategory.id });
            console.log(`✅ "${smoke.name}" → ${matchedSubcategory.name}`);
            assigned++;
          } else {
            console.log(`⏭️  "${smoke.name}" already assigned to ${matchedSubcategory.name}`);
            skipped++;
          }
        } else {
          // Default to "Other" if no match
          const otherSubcategory = allSubcategories.find(s => s.name === 'Other');
          if (otherSubcategory) {
            if (smoke.subCategoryId !== otherSubcategory.id) {
              await smoke.update({ subCategoryId: otherSubcategory.id });
              console.log(`✅ "${smoke.name}" → Other (default)`);
              assigned++;
            } else {
              console.log(`⏭️  "${smoke.name}" already assigned to Other`);
              skipped++;
            }
          } else {
            console.log(`⚠️  "${smoke.name}" - No subcategory match found`);
            skipped++;
          }
        }
      } catch (error) {
        console.error(`❌ Error processing "${smoke.name}":`, error.message);
        errors++;
      }
    }

    console.log('');

    // Show final list of smokes subcategories
    const finalSubcategories = await db.SubCategory.findAll({
      where: { categoryId: smokesCategory.id, isActive: true },
      order: [['name', 'ASC']]
    });

    console.log(`📊 Final smokes subcategories (${finalSubcategories.length}):`);
    finalSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });

    console.log(`\n\n📊 Summary:`);
    console.log(`  🗑️  Removed: ${subcategoriesToRemove.length}`);
    console.log(`  ✅ Assigned: ${assigned}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`\n🎉 Smokes subcategory update completed!`);

  } catch (error) {
    console.error('❌ Error updating smokes subcategories:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  updateSmokesSubcategories()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { updateSmokesSubcategories };

