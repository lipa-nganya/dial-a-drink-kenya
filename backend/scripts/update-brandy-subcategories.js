const db = require('../models');

/**
 * Update brandy subcategories:
 * 1. Remove "All Brandy" subcategory
 * 2. Create appropriate subcategories based on website (VSOP, XO, VS, etc.)
 * 3. Assign brandies to correct subcategories
 */
async function updateBrandySubcategories() {
  try {
    console.log('🍷 Starting brandy subcategory update...\n');

    // Get Brandy category
    const brandyCategory = await db.Category.findOne({ where: { name: 'Brandy' } });
    if (!brandyCategory) {
      console.error('❌ Brandy category not found!');
      return;
    }

    console.log(`✅ Found Brandy category (ID: ${brandyCategory.id})\n`);

    // Get all current brandy subcategories
    const currentSubcategories = await db.SubCategory.findAll({
      where: { categoryId: brandyCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`📋 Found ${currentSubcategories.length} current brandy subcategories:`);
    currentSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    console.log('');

    // New subcategories based on brandy classifications from https://www.dialadrinkkenya.com/brandy
    // Note: VSOP, XO, VS already exist, so we'll just verify them
    const newSubcategories = [
      'Blended Scotch'
    ];

    console.log('➕ Creating/verifying brandy subcategories...');
    let created = 0;
    let alreadyExisted = 0;

    for (const subcategoryName of newSubcategories) {
      try {
        // Check if subcategory already exists
        const existingSubcategory = await db.SubCategory.findOne({
          where: { 
            name: subcategoryName, 
            categoryId: brandyCategory.id 
          }
        });

        if (existingSubcategory) {
          console.log(`  ⏭️  "${subcategoryName}" already exists`);
          alreadyExisted++;
        } else {
          // Create subcategory
          await db.SubCategory.create({
            name: subcategoryName,
            categoryId: brandyCategory.id,
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

    // Get all brandies
    const brandies = await db.Drink.findAll({
      where: { categoryId: brandyCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`\n🍷 Found ${brandies.length} brandies to assign\n`);

    // Get all subcategories after creation (excluding "All Brandy" for assignment)
    const allSubcategories = await db.SubCategory.findAll({
      where: { 
        categoryId: brandyCategory.id, 
        isActive: true,
        name: { [db.Sequelize.Op.ne]: 'All Brandy' }
      },
      order: [['name', 'ASC']]
    });

    let assigned = 0;
    let skipped = 0;
    let errors = 0;

    for (const brandy of brandies) {
      try {
        const brandyName = brandy.name.toLowerCase();
        const brandyDescription = (brandy.description || '').toLowerCase();
        const combinedText = `${brandyName} ${brandyDescription}`;
        let matchedSubcategory = null;

        // Match based on classification in name/description
        // XO (Extra Old) - highest priority
        if (combinedText.includes(' xo') || combinedText.includes('xo ') || combinedText.includes(' x.o') || 
            brandyName.includes('remy martin') && combinedText.includes('xo') ||
            brandyName.includes('camus xo') || brandyName.includes('kwv xo') || brandyName.includes('godet xo')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'XO');
        }
        // VSOP (Very Superior Old Pale)
        else if (combinedText.includes(' vsop') || combinedText.includes('vsop ') || combinedText.includes(' v.s.o.p') ||
                 brandyName.includes('vsop') || brandyDescription.includes('vsop')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'VSOP');
        }
        // VS (Very Special)
        else if (combinedText.includes(' vs ') || combinedText.includes(' vs.') || 
                 brandyName.includes(' vs') || brandyDescription.includes(' vs ') ||
                 brandyName.includes('camus vs')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'VS');
        }
        // Blended Scotch (check if it exists in Brandy category)
        else if (combinedText.includes('blended scotch') || brandyName.includes('imperial blue') ||
                 brandyName.includes('mcdowell')) {
          const blendedScotch = allSubcategories.find(s => s.name === 'Blended Scotch');
          if (blendedScotch) {
            matchedSubcategory = blendedScotch;
          }
        }

        if (matchedSubcategory) {
          // Only update if different from current
          if (brandy.subCategoryId !== matchedSubcategory.id) {
            await brandy.update({ subCategoryId: matchedSubcategory.id });
            console.log(`✅ "${brandy.name}" → ${matchedSubcategory.name}`);
            assigned++;
          } else {
            console.log(`⏭️  "${brandy.name}" already assigned to ${matchedSubcategory.name}`);
            skipped++;
          }
        } else {
          // Default to VSOP if no match (most common brandy classification)
          const vsopSubcategory = allSubcategories.find(s => s.name === 'VSOP');
          if (vsopSubcategory) {
            if (brandy.subCategoryId !== vsopSubcategory.id) {
              await brandy.update({ subCategoryId: vsopSubcategory.id });
              console.log(`✅ "${brandy.name}" → VSOP (default)`);
              assigned++;
            } else {
              console.log(`⏭️  "${brandy.name}" already assigned to VSOP`);
              skipped++;
            }
          } else {
            console.log(`⚠️  "${brandy.name}" - No subcategory match found`);
            skipped++;
          }
        }
      } catch (error) {
        console.error(`❌ Error processing "${brandy.name}":`, error.message);
        errors++;
      }
    }

    console.log('');

    // Show final list of brandy subcategories
    const finalSubcategories = await db.SubCategory.findAll({
      where: { categoryId: brandyCategory.id, isActive: true },
      order: [['name', 'ASC']]
    });

    console.log(`📊 Final brandy subcategories (${finalSubcategories.length}):`);
    finalSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });

    // Now remove "All Brandy" subcategory after reassigning drinks
    console.log('\n🗑️  Removing "All Brandy" subcategory...');
    const allBrandySubcategory = await db.SubCategory.findOne({
      where: { 
        name: 'All Brandy', 
        categoryId: brandyCategory.id 
      }
    });
    
    if (allBrandySubcategory) {
      // Check if any drinks are still using this subcategory
      const drinksCount = await db.Drink.count({
        where: { subCategoryId: allBrandySubcategory.id }
      });

      if (drinksCount > 0) {
        console.log(`  ⚠️  "All Brandy" still has ${drinksCount} drinks assigned. Setting subCategoryId to null...`);
        await db.Drink.update(
          { subCategoryId: null },
          { where: { subCategoryId: allBrandySubcategory.id } }
        );
      }

      await allBrandySubcategory.destroy();
      console.log(`  ✅ Removed: "All Brandy"`);
    } else {
      console.log(`  ⏭️  "All Brandy" subcategory not found`);
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`  ➕ Created: ${created}`);
    console.log(`  ⏭️  Already existed: ${alreadyExisted}`);
    console.log(`  🗑️  Removed: ${allBrandySubcategory ? 1 : 0}`);
    console.log(`  ✅ Assigned: ${assigned}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`\n🎉 Brandy subcategory update completed!`);

  } catch (error) {
    console.error('❌ Error updating brandy subcategories:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  updateBrandySubcategories()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { updateBrandySubcategories };

