const db = require('../models');

/**
 * Update rum subcategories:
 * 1. Remove "All Rum" subcategory
 * 2. Create appropriate subcategories based on website (White Rum, Dark Rum, Gold Rum, Spiced Rum)
 * 3. Assign rums to correct subcategories
 */
async function updateRumSubcategories() {
  try {
    console.log('🥃 Starting rum subcategory update...\n');

    // Get Rum category
    const rumCategory = await db.Category.findOne({ where: { name: 'Rum' } });
    if (!rumCategory) {
      console.error('❌ Rum category not found!');
      return;
    }

    console.log(`✅ Found Rum category (ID: ${rumCategory.id})\n`);

    // Get all current rum subcategories
    const currentSubcategories = await db.SubCategory.findAll({
      where: { categoryId: rumCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`📋 Found ${currentSubcategories.length} current rum subcategories:`);
    currentSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    console.log('');

    // New subcategories based on rum types from https://www.dialadrinkkenya.com/rum
    const newSubcategories = [
      'White Rum',
      'Dark Rum',
      'Gold Rum'
    ];

    console.log('➕ Creating/verifying rum subcategories...');
    let created = 0;
    let alreadyExisted = 0;

    for (const subcategoryName of newSubcategories) {
      try {
        // Check if subcategory already exists
        const existingSubcategory = await db.SubCategory.findOne({
          where: { 
            name: subcategoryName, 
            categoryId: rumCategory.id 
          }
        });

        if (existingSubcategory) {
          console.log(`  ⏭️  "${subcategoryName}" already exists`);
          alreadyExisted++;
        } else {
          // Create subcategory using findOrCreate
          const [newSubcategory, wasCreated] = await db.SubCategory.findOrCreate({
            where: {
              name: subcategoryName,
              categoryId: rumCategory.id
            },
            defaults: {
              name: subcategoryName,
              categoryId: rumCategory.id,
              isActive: true
            }
          });
          
          if (wasCreated) {
            console.log(`  ✅ Created: "${subcategoryName}"`);
            created++;
          } else {
            console.log(`  ⏭️  "${subcategoryName}" already exists (found via findOrCreate)`);
            alreadyExisted++;
          }
        }
      } catch (error) {
        console.error(`  ❌ Error processing "${subcategoryName}":`, error.message);
      }
    }

    console.log('');

    // Refresh subcategories list after creation
    const allSubcategories = await db.SubCategory.findAll({
      where: { 
        categoryId: rumCategory.id, 
        isActive: true,
        name: { [db.Sequelize.Op.ne]: 'All Rum' }
      },
      order: [['name', 'ASC']]
    });

    // Get all rums
    const rums = await db.Drink.findAll({
      where: { categoryId: rumCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`\n🥃 Found ${rums.length} rums to assign\n`);

    console.log(`📋 Available subcategories for assignment:`);
    allSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    console.log('');

    let assigned = 0;
    let skipped = 0;
    let errors = 0;

    for (const rum of rums) {
      try {
        const rumName = rum.name.toLowerCase();
        const rumDescription = (rum.description || '').toLowerCase();
        const combinedText = `${rumName} ${rumDescription}`;
        let matchedSubcategory = null;

        // Match based on type in name/description
        // Spiced Rum - check first
        if (combinedText.includes('spiced') || rumName.includes('spiced')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Spiced Rum');
        }
        // White Rum (assign to Premium Rum since White Rum subcategory exists in Liqueur)
        else if (combinedText.includes('white rum') || combinedText.includes('white') ||
                 rumName.includes('white') || rumDescription.includes('white rum') ||
                 rumName.includes('carta blanca') || rumName.includes('silver')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Premium Rum');
        }
        // Dark Rum (assign to Premium Rum since Dark Rum subcategory exists in Liqueur)
        else if (combinedText.includes('dark rum') || combinedText.includes('dark') ||
                 rumName.includes('dark') || rumDescription.includes('dark rum') ||
                 combinedText.includes('black rum') || rumName.includes('black') ||
                 rumName.includes('black barrel')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Premium Rum');
        }
        // Gold Rum (amber, aged, etc.)
        else if (combinedText.includes('gold rum') || combinedText.includes('gold') ||
                 rumName.includes('gold') || rumDescription.includes('gold rum') ||
                 combinedText.includes('amber') || combinedText.includes('aged') ||
                 combinedText.includes('premium') || rumName.includes('premium')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Gold Rum') || 
                              allSubcategories.find(s => s.name === 'Premium Rum');
        }

        if (matchedSubcategory) {
          // Only update if different from current
          if (rum.subCategoryId !== matchedSubcategory.id) {
            await rum.update({ subCategoryId: matchedSubcategory.id });
            console.log(`✅ "${rum.name}" → ${matchedSubcategory.name}`);
            assigned++;
          } else {
            console.log(`⏭️  "${rum.name}" already assigned to ${matchedSubcategory.name}`);
            skipped++;
          }
        } else {
          // Default to Premium Rum or Gold Rum if no match
          const premiumSubcategory = allSubcategories.find(s => s.name === 'Premium Rum');
          const goldSubcategory = allSubcategories.find(s => s.name === 'Gold Rum');
          const defaultSubcategory = premiumSubcategory || goldSubcategory;
          
          if (defaultSubcategory) {
            if (rum.subCategoryId !== defaultSubcategory.id) {
              await rum.update({ subCategoryId: defaultSubcategory.id });
              console.log(`✅ "${rum.name}" → ${defaultSubcategory.name} (default)`);
              assigned++;
            } else {
              console.log(`⏭️  "${rum.name}" already assigned to ${defaultSubcategory.name}`);
              skipped++;
            }
          } else {
            console.log(`⚠️  "${rum.name}" - No subcategory match found`);
            skipped++;
          }
        }
      } catch (error) {
        console.error(`❌ Error processing "${rum.name}":`, error.message);
        errors++;
      }
    }

    // Now remove "All Rum" subcategory after reassigning drinks
    console.log('\n🗑️  Removing "All Rum" subcategory...');
    const allRumSubcategory = await db.SubCategory.findOne({
      where: { 
        name: 'All Rum', 
        categoryId: rumCategory.id 
      }
    });
    
    if (allRumSubcategory) {
      // Check if any drinks are still using this subcategory
      const drinksCount = await db.Drink.count({
        where: { subCategoryId: allRumSubcategory.id }
      });

      if (drinksCount > 0) {
        console.log(`  ⚠️  "All Rum" still has ${drinksCount} drinks assigned. Setting subCategoryId to null...`);
        await db.Drink.update(
          { subCategoryId: null },
          { where: { subCategoryId: allRumSubcategory.id } }
        );
      }

      await allRumSubcategory.destroy();
      console.log(`  ✅ Removed: "All Rum"`);
    } else {
      console.log(`  ⏭️  "All Rum" subcategory not found`);
    }

    console.log('');

    // Show final list of rum subcategories
    const finalSubcategories = await db.SubCategory.findAll({
      where: { categoryId: rumCategory.id, isActive: true },
      order: [['name', 'ASC']]
    });

    console.log(`📊 Final rum subcategories (${finalSubcategories.length}):`);
    finalSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });

    console.log(`\n\n📊 Summary:`);
    console.log(`  ➕ Created: ${created}`);
    console.log(`  ⏭️  Already existed: ${alreadyExisted}`);
    console.log(`  🗑️  Removed: ${allRumSubcategory ? 1 : 0}`);
    console.log(`  ✅ Assigned: ${assigned}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`\n🎉 Rum subcategory update completed!`);

  } catch (error) {
    console.error('❌ Error updating rum subcategories:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  updateRumSubcategories()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { updateRumSubcategories };

