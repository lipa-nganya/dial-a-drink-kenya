const db = require('../models');

/**
 * Update cognac subcategories:
 * 1. Remove "All Cognac" subcategory
 * 2. Create appropriate subcategories based on website (VSOP, XO, VS, etc.)
 * 3. Assign cognacs to correct subcategories
 */
async function updateCognacSubcategories() {
  try {
    console.log('🥃 Starting cognac subcategory update...\n');

    // Get Cognac category
    const cognacCategory = await db.Category.findOne({ where: { name: 'Cognac' } });
    if (!cognacCategory) {
      console.error('❌ Cognac category not found!');
      return;
    }

    console.log(`✅ Found Cognac category (ID: ${cognacCategory.id})\n`);

    // Get all current cognac subcategories
    const currentSubcategories = await db.SubCategory.findAll({
      where: { categoryId: cognacCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`📋 Found ${currentSubcategories.length} current cognac subcategories:`);
    currentSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    console.log('');

    // New subcategories based on cognac classifications from https://www.dialadrinkkenya.com/cognac
    const newSubcategories = [
      'VS',
      'VSOP',
      'XO'
    ];

    console.log('➕ Creating/verifying cognac subcategories...');
    let created = 0;
    let alreadyExisted = 0;

    for (const subcategoryName of newSubcategories) {
      try {
        // Check if subcategory already exists
        const existingSubcategory = await db.SubCategory.findOne({
          where: { 
            name: subcategoryName, 
            categoryId: cognacCategory.id 
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
              categoryId: cognacCategory.id
            },
            defaults: {
              name: subcategoryName,
              categoryId: cognacCategory.id,
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
        categoryId: cognacCategory.id, 
        isActive: true,
        name: { [db.Sequelize.Op.ne]: 'All Cognac' }
      },
      order: [['name', 'ASC']]
    });

    // Get all cognacs
    const cognacs = await db.Drink.findAll({
      where: { categoryId: cognacCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`\n🥃 Found ${cognacs.length} cognacs to assign\n`);

    console.log(`📋 Available subcategories for assignment:`);
    allSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    console.log('');

    let assigned = 0;
    let skipped = 0;
    let errors = 0;

    for (const cognac of cognacs) {
      try {
        const cognacName = cognac.name.toLowerCase();
        const cognacDescription = (cognac.description || '').toLowerCase();
        const combinedText = `${cognacName} ${cognacDescription}`;
        let matchedSubcategory = null;

        // Match based on classification in name/description
        // XO (Extra Old) - highest priority
        if (combinedText.includes(' xo') || combinedText.includes('xo ') || combinedText.includes(' x.o') || 
            cognacName.includes('xo') || cognacDescription.includes('xo') ||
            cognacName.includes('hennessy xo') || cognacName.includes('martel xo') || 
            cognacName.includes('martell xo') || cognacName.includes('courvoisier xo') ||
            cognacName.includes('remy martin') && combinedText.includes('xo') ||
            cognacName.includes('camus xo') || cognacName.includes('kwv xo') || 
            cognacName.includes('godet xo') || cognacName.includes('meukow x.o') ||
            cognacName.includes('biscut xo') || cognacName.includes('gautier xo')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'XO');
        }
        // VSOP (Very Superior Old Pale)
        else if (combinedText.includes(' vsop') || combinedText.includes('vsop ') || combinedText.includes(' v.s.o.p') ||
                 cognacName.includes('vsop') || cognacDescription.includes('vsop') ||
                 cognacName.includes('hennessy vsop') || cognacName.includes('martell vsop') ||
                 cognacName.includes('courvoisier vsop') || cognacName.includes('remy martin') && combinedText.includes('vsop') ||
                 cognacName.includes('camus vsop') || cognacName.includes('dusse vsop') ||
                 cognacName.includes('meukow vsop') || cognacName.includes('hine rare vsop')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'VSOP');
        }
        // VS (Very Special)
        else if (combinedText.includes(' vs ') || combinedText.includes(' vs.') || 
                 cognacName.includes(' vs') || cognacDescription.includes(' vs ') ||
                 cognacName.includes('hennessy vs') || cognacName.includes('martell vs') ||
                 cognacName.includes('courvoisier vs') || cognacName.includes('camus vs') ||
                 cognacName.includes('biscut cognac vs') || cognacName.includes('de luze vs')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'VS');
        }
        // Special editions (Paradis, Louis XIII, Cordon Blue, etc.) - assign to XO or Premium
        else if (cognacName.includes('paradis') || cognacName.includes('louis xiii') ||
                 cognacName.includes('cordon blue') || cognacName.includes('cordon bleu') ||
                 cognacName.includes('1738') || cognacName.includes('accord royal')) {
          // Try to find Premium Cognac, otherwise XO
          const premiumSubcategory = allSubcategories.find(s => s.name === 'Premium Cognac' || s.name === 'Premium');
          matchedSubcategory = premiumSubcategory || allSubcategories.find(s => s.name === 'XO');
        }

        if (matchedSubcategory) {
          // Only update if different from current
          if (cognac.subCategoryId !== matchedSubcategory.id) {
            await cognac.update({ subCategoryId: matchedSubcategory.id });
            console.log(`✅ "${cognac.name}" → ${matchedSubcategory.name}`);
            assigned++;
          } else {
            console.log(`⏭️  "${cognac.name}" already assigned to ${matchedSubcategory.name}`);
            skipped++;
          }
        } else {
          // Default to Premium Cognac if no match (covers all cognac types)
          const premiumSubcategory = allSubcategories.find(s => s.name === 'Premium Cognac');
          if (premiumSubcategory) {
            if (cognac.subCategoryId !== premiumSubcategory.id) {
              await cognac.update({ subCategoryId: premiumSubcategory.id });
              console.log(`✅ "${cognac.name}" → Premium Cognac (default)`);
              assigned++;
            } else {
              console.log(`⏭️  "${cognac.name}" already assigned to Premium Cognac`);
              skipped++;
            }
          } else {
            console.log(`⚠️  "${cognac.name}" - No subcategory match found`);
            skipped++;
          }
        }
      } catch (error) {
        console.error(`❌ Error processing "${cognac.name}":`, error.message);
        errors++;
      }
    }

    // Now remove "All Cognac" subcategory after reassigning drinks
    console.log('\n🗑️  Removing "All Cognac" subcategory...');
    const allCognacSubcategory = await db.SubCategory.findOne({
      where: { 
        name: 'All Cognac', 
        categoryId: cognacCategory.id 
      }
    });
    
    if (allCognacSubcategory) {
      // Check if any drinks are still using this subcategory
      const drinksCount = await db.Drink.count({
        where: { subCategoryId: allCognacSubcategory.id }
      });

      if (drinksCount > 0) {
        console.log(`  ⚠️  "All Cognac" still has ${drinksCount} drinks assigned. Setting subCategoryId to null...`);
        await db.Drink.update(
          { subCategoryId: null },
          { where: { subCategoryId: allCognacSubcategory.id } }
        );
      }

      await allCognacSubcategory.destroy();
      console.log(`  ✅ Removed: "All Cognac"`);
    } else {
      console.log(`  ⏭️  "All Cognac" subcategory not found`);
    }

    console.log('');

    // Show final list of cognac subcategories
    const finalSubcategories = await db.SubCategory.findAll({
      where: { categoryId: cognacCategory.id, isActive: true },
      order: [['name', 'ASC']]
    });

    console.log(`📊 Final cognac subcategories (${finalSubcategories.length}):`);
    finalSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });

    console.log(`\n\n📊 Summary:`);
    console.log(`  ➕ Created: ${created}`);
    console.log(`  ⏭️  Already existed: ${alreadyExisted}`);
    console.log(`  🗑️  Removed: ${allCognacSubcategory ? 1 : 0}`);
    console.log(`  ✅ Assigned: ${assigned}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`\n🎉 Cognac subcategory update completed!`);

  } catch (error) {
    console.error('❌ Error updating cognac subcategories:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  updateCognacSubcategories()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { updateCognacSubcategories };

