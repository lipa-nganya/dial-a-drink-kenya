const db = require('../models');

/**
 * Update gin subcategories:
 * 1. Remove "All Gin" subcategory
 * 2. Create appropriate subcategories based on website (London Dry Gin, Pink Gin, Flavoured Gin)
 * 3. Assign gins to correct subcategories
 */
async function updateGinSubcategories() {
  try {
    console.log('🍸 Starting gin subcategory update...\n');

    // Get Gin category
    const ginCategory = await db.Category.findOne({ where: { name: 'Gin' } });
    if (!ginCategory) {
      console.error('❌ Gin category not found!');
      return;
    }

    console.log(`✅ Found Gin category (ID: ${ginCategory.id})\n`);

    // Get all current gin subcategories
    const currentSubcategories = await db.SubCategory.findAll({
      where: { categoryId: ginCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`📋 Found ${currentSubcategories.length} current gin subcategories:`);
    currentSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    console.log('');

    // New subcategories based on gin types from https://www.dialadrinkkenya.com/gin
    const newSubcategories = [
      'London Dry Gin',
      'Pink Gin',
      'Flavoured Gin'
    ];

    console.log('➕ Creating/verifying gin subcategories...');
    let created = 0;
    let alreadyExisted = 0;

    for (const subcategoryName of newSubcategories) {
      try {
        // Check if subcategory already exists
        const existingSubcategory = await db.SubCategory.findOne({
          where: { 
            name: subcategoryName, 
            categoryId: ginCategory.id 
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
              categoryId: ginCategory.id
            },
            defaults: {
              name: subcategoryName,
              categoryId: ginCategory.id,
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
        categoryId: ginCategory.id, 
        isActive: true,
        name: { [db.Sequelize.Op.ne]: 'All Gin' }
      },
      order: [['name', 'ASC']]
    });

    // Get all gins
    const gins = await db.Drink.findAll({
      where: { categoryId: ginCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`\n🍸 Found ${gins.length} gins to assign\n`);

    console.log(`📋 Available subcategories for assignment:`);
    allSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    console.log('');

    let assigned = 0;
    let skipped = 0;
    let errors = 0;

    for (const gin of gins) {
      try {
        const ginName = gin.name.toLowerCase();
        const ginDescription = (gin.description || '').toLowerCase();
        const combinedText = `${ginName} ${ginDescription}`;
        let matchedSubcategory = null;

        // Match based on type in name/description
        // Pink Gin - highest priority (check for "pink" first)
        if (combinedText.includes('pink') || ginName.includes('pink')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Pink Gin');
        }
        // Flavoured Gin (flavored, flavoured, or specific flavors like cucumber, lemon, orange, etc.)
        else if (combinedText.includes('flavoured') || combinedText.includes('flavored') ||
                 combinedText.includes('cucumber') || combinedText.includes('lemon') ||
                 combinedText.includes('lime') || combinedText.includes('orange') ||
                 combinedText.includes('berry') || combinedText.includes('raspberry') ||
                 combinedText.includes('strawberry') || combinedText.includes('mango') ||
                 combinedText.includes('seville') || combinedText.includes('rosa') ||
                 combinedText.includes('limone') || combinedText.includes('blood orange') ||
                 combinedText.includes('mediterranean') || combinedText.includes('rangpur') ||
                 combinedText.includes('malacca') || combinedText.includes('sunset') ||
                 combinedText.includes('amazonia') || combinedText.includes('orbium') ||
                 combinedText.includes('midsummer') || combinedText.includes('sherry cask') ||
                 combinedText.includes('spiced') || combinedText.includes('triple berry') ||
                 combinedText.includes('wild berry') || combinedText.includes('jasmine') ||
                 combinedText.includes('fig') || combinedText.includes('hendrick') ||
                 combinedText.includes('malfy') || combinedText.includes('gunpowder') ||
                 combinedText.includes('whitley neill') || combinedText.includes('aviation') ||
                 combinedText.includes('monkey') || combinedText.includes('suntory') ||
                 combinedText.includes('sakurao') || combinedText.includes('four pillars')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Flavoured Gin');
        }
        // London Dry Gin (default for most traditional gins)
        else if (combinedText.includes('london dry') || combinedText.includes('dry gin') ||
                 ginName.includes('tanqueray') || ginName.includes('beefeater') ||
                 ginName.includes('gordon') || ginName.includes('bombay') ||
                 ginName.includes('gibson') || ginName.includes('greenall') ||
                 ginName.includes('hayman') || ginName.includes('antidote') ||
                 ginName.includes('bulldog') || ginName.includes('broker') ||
                 ginName.includes('seagram') || ginName.includes('zafiro') ||
                 ginName.includes('gin society') || ginName.includes('kensington') ||
                 ginName.includes('stretton') || ginName.includes('bloedlemoen') ||
                 ginName.includes('agnes arber') || ginName.includes('star of bombay')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'London Dry Gin');
        }

        if (matchedSubcategory) {
          // Only update if different from current
          if (gin.subCategoryId !== matchedSubcategory.id) {
            await gin.update({ subCategoryId: matchedSubcategory.id });
            console.log(`✅ "${gin.name}" → ${matchedSubcategory.name}`);
            assigned++;
          } else {
            console.log(`⏭️  "${gin.name}" already assigned to ${matchedSubcategory.name}`);
            skipped++;
          }
        } else {
          // Default to London Dry Gin if no match (most common gin type)
          const londonDrySubcategory = allSubcategories.find(s => s.name === 'London Dry Gin');
          if (londonDrySubcategory) {
            if (gin.subCategoryId !== londonDrySubcategory.id) {
              await gin.update({ subCategoryId: londonDrySubcategory.id });
              console.log(`✅ "${gin.name}" → London Dry Gin (default)`);
              assigned++;
            } else {
              console.log(`⏭️  "${gin.name}" already assigned to London Dry Gin`);
              skipped++;
            }
          } else {
            console.log(`⚠️  "${gin.name}" - No subcategory match found`);
            skipped++;
          }
        }
      } catch (error) {
        console.error(`❌ Error processing "${gin.name}":`, error.message);
        errors++;
      }
    }

    // Now remove "All Gin" subcategory after reassigning drinks
    console.log('\n🗑️  Removing "All Gin" subcategory...');
    const allGinSubcategory = await db.SubCategory.findOne({
      where: { 
        name: 'All Gin', 
        categoryId: ginCategory.id 
      }
    });
    
    if (allGinSubcategory) {
      // Check if any drinks are still using this subcategory
      const drinksCount = await db.Drink.count({
        where: { subCategoryId: allGinSubcategory.id }
      });

      if (drinksCount > 0) {
        console.log(`  ⚠️  "All Gin" still has ${drinksCount} drinks assigned. Setting subCategoryId to null...`);
        await db.Drink.update(
          { subCategoryId: null },
          { where: { subCategoryId: allGinSubcategory.id } }
        );
      }

      await allGinSubcategory.destroy();
      console.log(`  ✅ Removed: "All Gin"`);
    } else {
      console.log(`  ⏭️  "All Gin" subcategory not found`);
    }

    console.log('');

    // Show final list of gin subcategories
    const finalSubcategories = await db.SubCategory.findAll({
      where: { categoryId: ginCategory.id, isActive: true },
      order: [['name', 'ASC']]
    });

    console.log(`📊 Final gin subcategories (${finalSubcategories.length}):`);
    finalSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });

    console.log(`\n\n📊 Summary:`);
    console.log(`  ➕ Created: ${created}`);
    console.log(`  ⏭️  Already existed: ${alreadyExisted}`);
    console.log(`  🗑️  Removed: ${allGinSubcategory ? 1 : 0}`);
    console.log(`  ✅ Assigned: ${assigned}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`\n🎉 Gin subcategory update completed!`);

  } catch (error) {
    console.error('❌ Error updating gin subcategories:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  updateGinSubcategories()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { updateGinSubcategories };

