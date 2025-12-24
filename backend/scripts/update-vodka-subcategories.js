const db = require('../models');

/**
 * Update vodka subcategories:
 * 1. Remove "All Vodka" subcategory
 * 2. Consolidate duplicate subcategories (Flavoured Vodka/Flavoured vodka)
 * 3. Assign vodkas to correct subcategories (Unflavoured Vodka, Flavoured Vodka)
 */
async function updateVodkaSubcategories() {
  try {
    console.log('🍸 Starting vodka subcategory update...\n');

    // Get Vodka category
    const vodkaCategory = await db.Category.findOne({ where: { name: 'Vodka' } });
    if (!vodkaCategory) {
      console.error('❌ Vodka category not found!');
      return;
    }

    console.log(`✅ Found Vodka category (ID: ${vodkaCategory.id})\n`);

    // Get all current vodka subcategories
    const currentSubcategories = await db.SubCategory.findAll({
      where: { categoryId: vodkaCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`📋 Found ${currentSubcategories.length} current vodka subcategories:`);
    currentSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    console.log('');

    // Get all vodkas
    const vodkas = await db.Drink.findAll({
      where: { categoryId: vodkaCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`\n🍸 Found ${vodkas.length} vodkas to assign\n`);

    // Find main subcategories (Unflavoured Vodka and Flavoured Vodka)
    const unflavouredSubcategory = await db.SubCategory.findOne({
      where: { 
        name: 'Unflavoured Vodka', 
        categoryId: vodkaCategory.id 
      }
    });

    const flavouredSubcategory = await db.SubCategory.findOne({
      where: { 
        name: 'Flavoured Vodka', 
        categoryId: vodkaCategory.id 
      }
    }) || await db.SubCategory.findOne({
      where: { 
        name: 'Flavoured vodka', 
        categoryId: vodkaCategory.id 
      }
    });

    // Get all subcategories excluding "All Vodka"
    const allSubcategories = await db.SubCategory.findAll({
      where: { 
        categoryId: vodkaCategory.id, 
        isActive: true,
        name: { [db.Sequelize.Op.ne]: 'All Vodka' }
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
    let consolidated = 0;

    for (const vodka of vodkas) {
      try {
        const vodkaName = vodka.name.toLowerCase();
        const vodkaDescription = (vodka.description || '').toLowerCase();
        const combinedText = `${vodkaName} ${vodkaDescription}`;
        let matchedSubcategory = null;

        // Match based on type in name/description
        // Flavoured Vodka - check first (more specific)
        if (combinedText.includes('flavoured') || combinedText.includes('flavored') ||
            combinedText.includes('vanilla') || combinedText.includes('citrus') ||
            combinedText.includes('lemon') || combinedText.includes('lime') ||
            combinedText.includes('orange') || combinedText.includes('mango') ||
            combinedText.includes('strawberry') || combinedText.includes('raspberry') ||
            combinedText.includes('peach') || combinedText.includes('coconut') ||
            combinedText.includes('cucumber') || combinedText.includes('apple') ||
            combinedText.includes('cherry') || combinedText.includes('grape') ||
            combinedText.includes('berry') || combinedText.includes('pineapple') ||
            combinedText.includes('watermelon') || combinedText.includes('passion') ||
            combinedText.includes('honey') || combinedText.includes('cinnamon') ||
            combinedText.includes('chocolate') || combinedText.includes('coffee')) {
          matchedSubcategory = flavouredSubcategory;
        }
        // Unflavoured Vodka (default for traditional vodkas)
        else {
          matchedSubcategory = unflavouredSubcategory;
        }

        // If currently assigned to a duplicate subcategory, consolidate
        if (vodka.subCategoryId) {
          const currentSub = allSubcategories.find(s => s.id === vodka.subCategoryId);
          if (currentSub) {
            // Consolidate "Flavoured vodka" to "Flavoured Vodka"
            if (currentSub.name === 'Flavoured vodka' && flavouredSubcategory && 
                currentSub.id !== flavouredSubcategory.id) {
              matchedSubcategory = flavouredSubcategory;
              await vodka.update({ subCategoryId: matchedSubcategory.id });
              console.log(`🔄 "${vodka.name}" → ${matchedSubcategory.name} (consolidated from ${currentSub.name})`);
              consolidated++;
              continue;
            }
            // Consolidate "Craft vodka" to appropriate category
            if (currentSub.name === 'Craft vodka') {
              matchedSubcategory = matchedSubcategory || unflavouredSubcategory;
              if (vodka.subCategoryId !== matchedSubcategory.id) {
                await vodka.update({ subCategoryId: matchedSubcategory.id });
                console.log(`🔄 "${vodka.name}" → ${matchedSubcategory.name} (consolidated from ${currentSub.name})`);
                consolidated++;
                continue;
              }
            }
          }
        }

        if (matchedSubcategory) {
          // Only update if different from current
          if (vodka.subCategoryId !== matchedSubcategory.id) {
            await vodka.update({ subCategoryId: matchedSubcategory.id });
            console.log(`✅ "${vodka.name}" → ${matchedSubcategory.name}`);
            assigned++;
          } else {
            console.log(`⏭️  "${vodka.name}" already assigned to ${matchedSubcategory.name}`);
            skipped++;
          }
        } else {
          // Default to Unflavoured Vodka if no match
          if (unflavouredSubcategory) {
            if (vodka.subCategoryId !== unflavouredSubcategory.id) {
              await vodka.update({ subCategoryId: unflavouredSubcategory.id });
              console.log(`✅ "${vodka.name}" → Unflavoured Vodka (default)`);
              assigned++;
            } else {
              console.log(`⏭️  "${vodka.name}" already assigned to Unflavoured Vodka`);
              skipped++;
            }
          } else {
            console.log(`⚠️  "${vodka.name}" - No subcategory match found`);
            skipped++;
          }
        }
      } catch (error) {
        console.error(`❌ Error processing "${vodka.name}":`, error.message);
        errors++;
      }
    }

    // Now remove "All Vodka" subcategory after reassigning drinks
    console.log('\n🗑️  Removing "All Vodka" subcategory...');
    const allVodkaSubcategory = await db.SubCategory.findOne({
      where: { 
        name: 'All Vodka', 
        categoryId: vodkaCategory.id 
      }
    });
    
    if (allVodkaSubcategory) {
      // Check if any drinks are still using this subcategory
      const drinksCount = await db.Drink.count({
        where: { subCategoryId: allVodkaSubcategory.id }
      });

      if (drinksCount > 0) {
        console.log(`  ⚠️  "All Vodka" still has ${drinksCount} drinks assigned. Setting subCategoryId to null...`);
        await db.Drink.update(
          { subCategoryId: null },
          { where: { subCategoryId: allVodkaSubcategory.id } }
        );
      }

      await allVodkaSubcategory.destroy();
      console.log(`  ✅ Removed: "All Vodka"`);
    } else {
      console.log(`  ⏭️  "All Vodka" subcategory not found`);
    }

    // Remove duplicate/consolidated subcategories
    console.log('\n🗑️  Removing duplicate subcategories...');
    const duplicateSubcategories = ['Flavoured vodka', 'Craft vodka', 'Strongest alcoholic liquor'];
    
    for (const dupName of duplicateSubcategories) {
      const dupSubcategory = await db.SubCategory.findOne({
        where: { 
          name: dupName, 
          categoryId: vodkaCategory.id 
        }
      });

      if (dupSubcategory) {
        // Check if any drinks are still using this subcategory
        const drinksCount = await db.Drink.count({
          where: { subCategoryId: dupSubcategory.id }
        });

        if (drinksCount > 0) {
          console.log(`  ⚠️  "${dupName}" has ${drinksCount} drinks. Should have been consolidated.`);
        }

        await dupSubcategory.destroy();
        console.log(`  ✅ Removed: "${dupName}"`);
      }
    }

    console.log('');

    // Show final list of vodka subcategories
    const finalSubcategories = await db.SubCategory.findAll({
      where: { categoryId: vodkaCategory.id, isActive: true },
      order: [['name', 'ASC']]
    });

    console.log(`📊 Final vodka subcategories (${finalSubcategories.length}):`);
    finalSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });

    console.log(`\n\n📊 Summary:`);
    console.log(`  🗑️  Removed: ${allVodkaSubcategory ? 1 : 0} main subcategory + duplicates`);
    console.log(`  ✅ Assigned: ${assigned}`);
    console.log(`  🔄 Consolidated: ${consolidated}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`\n🎉 Vodka subcategory update completed!`);

  } catch (error) {
    console.error('❌ Error updating vodka subcategories:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  updateVodkaSubcategories()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { updateVodkaSubcategories };

