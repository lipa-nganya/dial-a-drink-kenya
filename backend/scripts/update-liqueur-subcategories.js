const db = require('../models');

/**
 * Update liqueur subcategories:
 * 1. Remove "All Liqueur" subcategory
 * 2. Create appropriate subcategories based on website (Cream Liqueur, Bitters, Triple Sec, etc.)
 * 3. Assign liqueurs to correct subcategories
 */
async function updateLiqueurSubcategories() {
  try {
    console.log('🍹 Starting liqueur subcategory update...\n');

    // Get Liqueur category
    const liqueurCategory = await db.Category.findOne({ where: { name: 'Liqueur' } });
    if (!liqueurCategory) {
      console.error('❌ Liqueur category not found!');
      return;
    }

    console.log(`✅ Found Liqueur category (ID: ${liqueurCategory.id})\n`);

    // Get all current liqueur subcategories
    const currentSubcategories = await db.SubCategory.findAll({
      where: { categoryId: liqueurCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`📋 Found ${currentSubcategories.length} current liqueur subcategories:`);
    currentSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    console.log('');

    // New subcategories based on liqueur types from https://www.dialadrinkkenya.com/liqueurs
    const newSubcategories = [
      'Cream Liqueur',
      'Bitters',
      'Triple Sec',
      'Coffee Liqueur',
      'Fruit Liqueur',
      'Sambuca',
      'Vermouth',
      'Syrup'
    ];

    console.log('➕ Creating/verifying liqueur subcategories...');
    let created = 0;
    let alreadyExisted = 0;

    for (const subcategoryName of newSubcategories) {
      try {
        // Check if subcategory already exists
        const existingSubcategory = await db.SubCategory.findOne({
          where: { 
            name: subcategoryName, 
            categoryId: liqueurCategory.id 
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
              categoryId: liqueurCategory.id
            },
            defaults: {
              name: subcategoryName,
              categoryId: liqueurCategory.id,
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
        categoryId: liqueurCategory.id, 
        isActive: true,
        name: { [db.Sequelize.Op.ne]: 'All Liqueur' }
      },
      order: [['name', 'ASC']]
    });

    // Get all liqueurs
    const liqueurs = await db.Drink.findAll({
      where: { categoryId: liqueurCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`\n🍹 Found ${liqueurs.length} liqueurs to assign\n`);

    console.log(`📋 Available subcategories for assignment:`);
    allSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    console.log('');

    let assigned = 0;
    let skipped = 0;
    let errors = 0;

    for (const liqueur of liqueurs) {
      try {
        const liqueurName = liqueur.name.toLowerCase();
        const liqueurDescription = (liqueur.description || '').toLowerCase();
        const combinedText = `${liqueurName} ${liqueurDescription}`;
        let matchedSubcategory = null;

        // Match based on type in name/description
        // Syrup - highest priority (check for "syrup" first)
        if (combinedText.includes('syrup') || combinedText.includes('puree')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Syrup');
        }
        // Cream Liqueur
        else if (combinedText.includes('cream') || combinedText.includes('bailey') ||
                 combinedText.includes('amarula') || combinedText.includes('bumbu cream') ||
                 combinedText.includes('sheridan') || combinedText.includes('sidekick')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Cream Liqueur');
        }
        // Bitters
        else if (combinedText.includes('bitters') || combinedText.includes('jägermeister') ||
                 combinedText.includes('jagermeister') || combinedText.includes('underberg') ||
                 combinedText.includes('angostura') || combinedText.includes('fernet')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Bitters');
        }
        // Triple Sec / Curacao
        else if (combinedText.includes('triple sec') || combinedText.includes('curacao') ||
                 combinedText.includes('cointreau') || combinedText.includes('grand marnier')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Triple Sec');
        }
        // Coffee Liqueur
        else if (combinedText.includes('coffee') || combinedText.includes('kahlua') ||
                 combinedText.includes('tia maria') || combinedText.includes('patron xo cafe') ||
                 combinedText.includes('espresso') || combinedText.includes('cafe liqueur') ||
                 combinedText.includes('kahawa')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Coffee Liqueur');
        }
        // Sambuca
        else if (combinedText.includes('sambuca') || combinedText.includes('zappa')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Sambuca');
        }
        // Vermouth
        else if (combinedText.includes('vermouth') || combinedText.includes('martini') ||
                 combinedText.includes('campari') || combinedText.includes('pernod') ||
                 combinedText.includes('ricard')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Vermouth');
        }
        // Fruit Liqueur (limoncello, fruit flavors, etc.)
        else if (combinedText.includes('limoncello') || combinedText.includes('limon') ||
                 combinedText.includes('fruit') || combinedText.includes('elderflower') ||
                 combinedText.includes('sour apple') || combinedText.includes('peppermint') ||
                 combinedText.includes('vanilla') || combinedText.includes('hazelnut') ||
                 combinedText.includes('raspberry') || combinedText.includes('strawberry') ||
                 combinedText.includes('southern comfort') || combinedText.includes('disaronno') ||
                 combinedText.includes('frangelico') || combinedText.includes('luxardo')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Fruit Liqueur');
        }

        if (matchedSubcategory) {
          // Only update if different from current
          if (liqueur.subCategoryId !== matchedSubcategory.id) {
            await liqueur.update({ subCategoryId: matchedSubcategory.id });
            console.log(`✅ "${liqueur.name}" → ${matchedSubcategory.name}`);
            assigned++;
          } else {
            console.log(`⏭️  "${liqueur.name}" already assigned to ${matchedSubcategory.name}`);
            skipped++;
          }
        } else {
          // Default to Fruit Liqueur if no match (most common liqueur type)
          const fruitLiqueurSubcategory = allSubcategories.find(s => s.name === 'Fruit Liqueur');
          if (fruitLiqueurSubcategory) {
            if (liqueur.subCategoryId !== fruitLiqueurSubcategory.id) {
              await liqueur.update({ subCategoryId: fruitLiqueurSubcategory.id });
              console.log(`✅ "${liqueur.name}" → Fruit Liqueur (default)`);
              assigned++;
            } else {
              console.log(`⏭️  "${liqueur.name}" already assigned to Fruit Liqueur`);
              skipped++;
            }
          } else {
            console.log(`⚠️  "${liqueur.name}" - No subcategory match found`);
            skipped++;
          }
        }
      } catch (error) {
        console.error(`❌ Error processing "${liqueur.name}":`, error.message);
        errors++;
      }
    }

    // Now remove "All Liqueur" subcategory after reassigning drinks
    console.log('\n🗑️  Removing "All Liqueur" subcategory...');
    const allLiqueurSubcategory = await db.SubCategory.findOne({
      where: { 
        name: 'All Liqueur', 
        categoryId: liqueurCategory.id 
      }
    });
    
    if (allLiqueurSubcategory) {
      // Check if any drinks are still using this subcategory
      const drinksCount = await db.Drink.count({
        where: { subCategoryId: allLiqueurSubcategory.id }
      });

      if (drinksCount > 0) {
        console.log(`  ⚠️  "All Liqueur" still has ${drinksCount} drinks assigned. Setting subCategoryId to null...`);
        await db.Drink.update(
          { subCategoryId: null },
          { where: { subCategoryId: allLiqueurSubcategory.id } }
        );
      }

      await allLiqueurSubcategory.destroy();
      console.log(`  ✅ Removed: "All Liqueur"`);
    } else {
      console.log(`  ⏭️  "All Liqueur" subcategory not found`);
    }

    console.log('');

    // Show final list of liqueur subcategories
    const finalSubcategories = await db.SubCategory.findAll({
      where: { categoryId: liqueurCategory.id, isActive: true },
      order: [['name', 'ASC']]
    });

    console.log(`📊 Final liqueur subcategories (${finalSubcategories.length}):`);
    finalSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });

    console.log(`\n\n📊 Summary:`);
    console.log(`  ➕ Created: ${created}`);
    console.log(`  ⏭️  Already existed: ${alreadyExisted}`);
    console.log(`  🗑️  Removed: ${allLiqueurSubcategory ? 1 : 0}`);
    console.log(`  ✅ Assigned: ${assigned}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`\n🎉 Liqueur subcategory update completed!`);

  } catch (error) {
    console.error('❌ Error updating liqueur subcategories:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  updateLiqueurSubcategories()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { updateLiqueurSubcategories };

