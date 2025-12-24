const db = require('../models');

/**
 * Update tequila subcategories:
 * 1. Remove "All Tequila" subcategory
 * 2. Create "Flavoured Tequila" if needed
 * 3. Assign tequilas to correct subcategories
 */
async function updateTequilaSubcategories() {
  try {
    console.log('🍹 Starting tequila subcategory update...\n');

    // Get Tequila category
    const tequilaCategory = await db.Category.findOne({ where: { name: 'Tequila' } });
    if (!tequilaCategory) {
      console.error('❌ Tequila category not found!');
      return;
    }

    console.log(`✅ Found Tequila category (ID: ${tequilaCategory.id})\n`);

    // Get all current tequila subcategories
    const currentSubcategories = await db.SubCategory.findAll({
      where: { categoryId: tequilaCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`📋 Found ${currentSubcategories.length} current tequila subcategories:`);
    currentSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    console.log('');

    // Create "Flavoured Tequila" if it doesn't exist
    console.log('➕ Creating/verifying "Flavoured Tequila" subcategory...');
    let flavouredTequilaSubcategory = await db.SubCategory.findOne({
      where: { 
        name: 'Flavoured Tequila', 
        categoryId: tequilaCategory.id 
      }
    });

    if (!flavouredTequilaSubcategory) {
      try {
        const [newSubcategory, wasCreated] = await db.SubCategory.findOrCreate({
          where: {
            name: 'Flavoured Tequila',
            categoryId: tequilaCategory.id
          },
          defaults: {
            name: 'Flavoured Tequila',
            categoryId: tequilaCategory.id,
            isActive: true
          }
        });
        
        if (wasCreated) {
          console.log(`  ✅ Created: "Flavoured Tequila"`);
          flavouredTequilaSubcategory = newSubcategory;
        } else {
          flavouredTequilaSubcategory = newSubcategory;
        }
      } catch (error) {
        console.error(`  ❌ Error creating "Flavoured Tequila":`, error.message);
      }
    } else {
      console.log(`  ⏭️  "Flavoured Tequila" already exists`);
    }
    console.log('');

    // Get all tequilas
    const tequilas = await db.Drink.findAll({
      where: { categoryId: tequilaCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`\n🍹 Found ${tequilas.length} tequilas to assign\n`);

    // Get all subcategories after creation (excluding "All Tequila")
    const allSubcategories = await db.SubCategory.findAll({
      where: { 
        categoryId: tequilaCategory.id, 
        isActive: true,
        name: { [db.Sequelize.Op.ne]: 'All Tequila' }
      },
      order: [['name', 'ASC']]
    });

    console.log(`📋 Available subcategories for assignment:`);
    allSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    console.log('');

    // Map for consolidating similar subcategories
    const subcategoryMap = {
      'Añejo': 'Anejo Tequila',
      'Blanco/Silver': 'Silver Tequila',
      'Reposado': 'Reposado Tequila'
    };

    let assigned = 0;
    let skipped = 0;
    let errors = 0;
    let consolidated = 0;

    for (const tequila of tequilas) {
      try {
        const tequilaName = tequila.name.toLowerCase();
        const tequilaDescription = (tequila.description || '').toLowerCase();
        const combinedText = `${tequilaName} ${tequilaDescription}`;
        let matchedSubcategory = null;

        // Match based on type in name/description
        // Flavoured Tequila - check first
        if (combinedText.includes('flavoured') || combinedText.includes('flavored') ||
            combinedText.includes('chilli') || combinedText.includes('chili') ||
            combinedText.includes('chocolate') || combinedText.includes('strawberry') ||
            combinedText.includes('lime') || combinedText.includes('orange') ||
            combinedText.includes('mango') || combinedText.includes('pineapple') ||
            combinedText.includes('coconut') || combinedText.includes('peach')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Flavoured Tequila') ||
                              flavouredTequilaSubcategory;
        }
        // Mezcal Tequila
        else if (combinedText.includes('mezcal') || combinedText.includes('curado')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Mezcal Tequila');
        }
        // Anejo Tequila
        else if (combinedText.includes('anejo') || combinedText.includes('añejo') ||
                 combinedText.includes('añejo') || tequilaName.includes('anejo')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Anejo Tequila') ||
                              allSubcategories.find(s => s.name === 'Añejo');
        }
        // Reposado Tequila
        else if (combinedText.includes('reposado') || tequilaName.includes('reposado')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Reposado Tequila') ||
                              allSubcategories.find(s => s.name === 'Reposado');
        }
        // Silver/Blanco Tequila
        else if (combinedText.includes('silver') || combinedText.includes('blanco') ||
                 combinedText.includes('white') || tequilaName.includes('silver') ||
                 tequilaName.includes('blanco')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Silver Tequila') ||
                              allSubcategories.find(s => s.name === 'Blanco/Silver');
        }
        // Gold Tequila
        else if (combinedText.includes('gold') || tequilaName.includes('gold')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Gold Tequila');
        }

        // If currently assigned to a subcategory that should be consolidated, reassign
        if (tequila.subCategoryId) {
          const currentSub = allSubcategories.find(s => s.id === tequila.subCategoryId);
          if (currentSub && subcategoryMap[currentSub.name]) {
            const targetSub = allSubcategories.find(s => s.name === subcategoryMap[currentSub.name]);
            if (targetSub && tequila.subCategoryId !== targetSub.id) {
              await tequila.update({ subCategoryId: targetSub.id });
              console.log(`🔄 "${tequila.name}" → ${targetSub.name} (consolidated from ${currentSub.name})`);
              consolidated++;
              continue;
            }
          }
        }

        if (matchedSubcategory) {
          // Only update if different from current
          if (tequila.subCategoryId !== matchedSubcategory.id) {
            await tequila.update({ subCategoryId: matchedSubcategory.id });
            console.log(`✅ "${tequila.name}" → ${matchedSubcategory.name}`);
            assigned++;
          } else {
            console.log(`⏭️  "${tequila.name}" already assigned to ${matchedSubcategory.name}`);
            skipped++;
          }
        } else {
          // Default to Silver Tequila if no match
          const silverSubcategory = allSubcategories.find(s => s.name === 'Silver Tequila') ||
                                   allSubcategories.find(s => s.name === 'Blanco/Silver');
          if (silverSubcategory) {
            if (tequila.subCategoryId !== silverSubcategory.id) {
              await tequila.update({ subCategoryId: silverSubcategory.id });
              console.log(`✅ "${tequila.name}" → ${silverSubcategory.name} (default)`);
              assigned++;
            } else {
              console.log(`⏭️  "${tequila.name}" already assigned to ${silverSubcategory.name}`);
              skipped++;
            }
          } else {
            console.log(`⚠️  "${tequila.name}" - No subcategory match found`);
            skipped++;
          }
        }
      } catch (error) {
        console.error(`❌ Error processing "${tequila.name}":`, error.message);
        errors++;
      }
    }

    // Now remove "All Tequila" subcategory after reassigning drinks
    console.log('\n🗑️  Removing "All Tequila" subcategory...');
    const allTequilaSubcategory = await db.SubCategory.findOne({
      where: { 
        name: 'All Tequila', 
        categoryId: tequilaCategory.id 
      }
    });
    
    if (allTequilaSubcategory) {
      // Check if any drinks are still using this subcategory
      const drinksCount = await db.Drink.count({
        where: { subCategoryId: allTequilaSubcategory.id }
      });

      if (drinksCount > 0) {
        console.log(`  ⚠️  "All Tequila" still has ${drinksCount} drinks assigned. Setting subCategoryId to null...`);
        await db.Drink.update(
          { subCategoryId: null },
          { where: { subCategoryId: allTequilaSubcategory.id } }
        );
      }

      await allTequilaSubcategory.destroy();
      console.log(`  ✅ Removed: "All Tequila"`);
    } else {
      console.log(`  ⏭️  "All Tequila" subcategory not found`);
    }

    console.log('');

    // Show final list of tequila subcategories
    const finalSubcategories = await db.SubCategory.findAll({
      where: { categoryId: tequilaCategory.id, isActive: true },
      order: [['name', 'ASC']]
    });

    console.log(`📊 Final tequila subcategories (${finalSubcategories.length}):`);
    finalSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });

    console.log(`\n\n📊 Summary:`);
    console.log(`  ➕ Created: ${flavouredTequilaSubcategory ? 1 : 0}`);
    console.log(`  🗑️  Removed: ${allTequilaSubcategory ? 1 : 0}`);
    console.log(`  ✅ Assigned: ${assigned}`);
    console.log(`  🔄 Consolidated: ${consolidated}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`\n🎉 Tequila subcategory update completed!`);

  } catch (error) {
    console.error('❌ Error updating tequila subcategories:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  updateTequilaSubcategories()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { updateTequilaSubcategories };

