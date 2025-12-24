const db = require('../models');

/**
 * Update champagne subcategories:
 * 1. Remove "All Champagne" subcategory
 * 2. Create appropriate subcategories based on website (Rose Champagne, Sparkling Wine, Brut, Crémant)
 * 3. Assign champagnes to correct subcategories
 */
async function updateChampagneSubcategories() {
  try {
    console.log('🍾 Starting champagne subcategory update...\n');

    // Get Champagne category
    const champagneCategory = await db.Category.findOne({ where: { name: 'Champagne' } });
    if (!champagneCategory) {
      console.error('❌ Champagne category not found!');
      return;
    }

    console.log(`✅ Found Champagne category (ID: ${champagneCategory.id})\n`);

    // Get all current champagne subcategories
    const currentSubcategories = await db.SubCategory.findAll({
      where: { categoryId: champagneCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`📋 Found ${currentSubcategories.length} current champagne subcategories:`);
    currentSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    console.log('');

    // New subcategories based on website filters from https://www.dialadrinkkenya.com/champagne
    const newSubcategories = [
      'Rose Champagne',
      'Sparkling Wine',
      'Brut',
      'Crémant'
    ];

    console.log('➕ Creating/verifying champagne subcategories...');
    let created = 0;
    let alreadyExisted = 0;

    for (const subcategoryName of newSubcategories) {
      try {
        // Check if subcategory already exists
        const existingSubcategory = await db.SubCategory.findOne({
          where: { 
            name: subcategoryName, 
            categoryId: champagneCategory.id 
          }
        });

        if (existingSubcategory) {
          console.log(`  ⏭️  "${subcategoryName}" already exists`);
          alreadyExisted++;
        } else {
          // Create subcategory using findOrCreate to handle any edge cases
          const [newSubcategory, wasCreated] = await db.SubCategory.findOrCreate({
            where: {
              name: subcategoryName,
              categoryId: champagneCategory.id
            },
            defaults: {
              name: subcategoryName,
              categoryId: champagneCategory.id,
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

    // Get all champagnes
    const champagnes = await db.Drink.findAll({
      where: { categoryId: champagneCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`\n🍾 Found ${champagnes.length} champagnes to assign\n`);

    // Get all subcategories after creation (excluding "All Champagne" for assignment)
    const allSubcategories = await db.SubCategory.findAll({
      where: { 
        categoryId: champagneCategory.id, 
        isActive: true,
        name: { [db.Sequelize.Op.ne]: 'All Champagne' }
      },
      order: [['name', 'ASC']]
    });

    let assigned = 0;
    let skipped = 0;
    let errors = 0;

    for (const champagne of champagnes) {
      try {
        const champagneName = champagne.name.toLowerCase();
        const champagneDescription = (champagne.description || '').toLowerCase();
        const combinedText = `${champagneName} ${champagneDescription}`;
        let matchedSubcategory = null;

        // Match based on type in name/description
        // Rose Champagne - highest priority (check for "rose" first)
        if (combinedText.includes('rose') || combinedText.includes('rosé') || champagneName.includes('rose')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Rose Champagne');
        }
        // Crémant (sparkling wine from specific regions)
        else if (combinedText.includes('crémant') || combinedText.includes('cremant') || 
                 combinedText.includes('cremant')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Crémant');
        }
        // Sparkling Wine (prosecco, cava, or explicitly labeled as sparkling)
        else if (combinedText.includes('sparkling') || combinedText.includes('prosecco') ||
                 combinedText.includes('cava') || combinedText.includes('celebration sparkling')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Sparkling Wine');
        }
        // Brut (most common champagne type) - check for brut in name
        else if (champagneName.includes('brut') || combinedText.includes(' brut') || 
                 combinedText.includes('brut ') || combinedText.includes('brut reserve') ||
                 combinedText.includes('brut rose') || combinedText.includes('imperial brut')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Brut');
        }

        if (matchedSubcategory) {
          // Only update if different from current
          if (champagne.subCategoryId !== matchedSubcategory.id) {
            await champagne.update({ subCategoryId: matchedSubcategory.id });
            console.log(`✅ "${champagne.name}" → ${matchedSubcategory.name}`);
            assigned++;
          } else {
            console.log(`⏭️  "${champagne.name}" already assigned to ${matchedSubcategory.name}`);
            skipped++;
          }
        } else {
          // Default to Premium Champagne if no match (for Brut and other champagnes)
          const premiumSubcategory = allSubcategories.find(s => s.name === 'Premium Champagne');
          if (premiumSubcategory) {
            if (champagne.subCategoryId !== premiumSubcategory.id) {
              await champagne.update({ subCategoryId: premiumSubcategory.id });
              console.log(`✅ "${champagne.name}" → Premium Champagne (default)`);
              assigned++;
            } else {
              console.log(`⏭️  "${champagne.name}" already assigned to Premium Champagne`);
              skipped++;
            }
          } else {
            console.log(`⚠️  "${champagne.name}" - No subcategory match found`);
            skipped++;
          }
        }
      } catch (error) {
        console.error(`❌ Error processing "${champagne.name}":`, error.message);
        errors++;
      }
    }

    // Now remove "All Champagne" subcategory after reassigning drinks
    console.log('\n🗑️  Removing "All Champagne" subcategory...');
    const allChampagneSubcategory = await db.SubCategory.findOne({
      where: { 
        name: 'All Champagne', 
        categoryId: champagneCategory.id 
      }
    });
    
    if (allChampagneSubcategory) {
      // Check if any drinks are still using this subcategory
      const drinksCount = await db.Drink.count({
        where: { subCategoryId: allChampagneSubcategory.id }
      });

      if (drinksCount > 0) {
        console.log(`  ⚠️  "All Champagne" still has ${drinksCount} drinks assigned. Setting subCategoryId to null...`);
        await db.Drink.update(
          { subCategoryId: null },
          { where: { subCategoryId: allChampagneSubcategory.id } }
        );
      }

      await allChampagneSubcategory.destroy();
      console.log(`  ✅ Removed: "All Champagne"`);
    } else {
      console.log(`  ⏭️  "All Champagne" subcategory not found`);
    }

    console.log('');

    // Show final list of champagne subcategories
    const finalSubcategories = await db.SubCategory.findAll({
      where: { categoryId: champagneCategory.id, isActive: true },
      order: [['name', 'ASC']]
    });

    console.log(`📊 Final champagne subcategories (${finalSubcategories.length}):`);
    finalSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });

    console.log(`\n\n📊 Summary:`);
    console.log(`  ➕ Created: ${created}`);
    console.log(`  ⏭️  Already existed: ${alreadyExisted}`);
    console.log(`  🗑️  Removed: ${allChampagneSubcategory ? 1 : 0}`);
    console.log(`  ✅ Assigned: ${assigned}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`\n🎉 Champagne subcategory update completed!`);

  } catch (error) {
    console.error('❌ Error updating champagne subcategories:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  updateChampagneSubcategories()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { updateChampagneSubcategories };

