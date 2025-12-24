const db = require('../models');

/**
 * Update soft drinks subcategories:
 * 1. Remove "All Soft Drinks" subcategory
 * 2. Create appropriate subcategories based on website (Energy Drinks, Tonic Waters, Iced Teas, Ginger Ales, Flavored Sodas)
 * 3. Assign soft drinks to correct subcategories
 */
async function updateSoftDrinksSubcategories() {
  try {
    console.log('🥤 Starting soft drinks subcategory update...\n');

    // Get Soft Drinks category
    const softDrinksCategory = await db.Category.findOne({ where: { name: 'Soft Drinks' } });
    if (!softDrinksCategory) {
      console.error('❌ Soft Drinks category not found!');
      return;
    }

    console.log(`✅ Found Soft Drinks category (ID: ${softDrinksCategory.id})\n`);

    // Get all current soft drinks subcategories
    const currentSubcategories = await db.SubCategory.findAll({
      where: { categoryId: softDrinksCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`📋 Found ${currentSubcategories.length} current soft drinks subcategories:`);
    currentSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    console.log('');

    // New subcategories based on soft drink types from https://www.dialadrinkkenya.com/soft-drinks
    const newSubcategories = [
      'Energy Drinks',
      'Tonic Waters',
      'Iced Teas',
      'Ginger Ales',
      'Flavored Sodas'
    ];

    console.log('➕ Creating/verifying soft drinks subcategories...');
    let created = 0;
    let alreadyExisted = 0;

    for (const subcategoryName of newSubcategories) {
      try {
        // Check if subcategory already exists
        const existingSubcategory = await db.SubCategory.findOne({
          where: { 
            name: subcategoryName, 
            categoryId: softDrinksCategory.id 
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
              categoryId: softDrinksCategory.id
            },
            defaults: {
              name: subcategoryName,
              categoryId: softDrinksCategory.id,
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
        categoryId: softDrinksCategory.id, 
        isActive: true,
        name: { [db.Sequelize.Op.ne]: 'All Soft Drinks' }
      },
      order: [['name', 'ASC']]
    });

    // Get all soft drinks
    const softDrinks = await db.Drink.findAll({
      where: { categoryId: softDrinksCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`\n🥤 Found ${softDrinks.length} soft drinks to assign\n`);

    console.log(`📋 Available subcategories for assignment:`);
    allSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    console.log('');

    let assigned = 0;
    let skipped = 0;
    let errors = 0;

    for (const softDrink of softDrinks) {
      try {
        const drinkName = softDrink.name.toLowerCase();
        const drinkDescription = (softDrink.description || '').toLowerCase();
        const combinedText = `${drinkName} ${drinkDescription}`;
        let matchedSubcategory = null;

        // Match based on type in name/description
        // Energy Drinks
        if (combinedText.includes('energy drink') || combinedText.includes('energy') ||
            drinkName.includes('monster') || drinkName.includes('red bull') ||
            drinkName.includes('rockstar') || drinkName.includes('burn') ||
            drinkName.includes('powerade') || drinkName.includes('gatorade')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Energy Drinks');
        }
        // Tonic Waters
        else if (combinedText.includes('tonic') || combinedText.includes('tonic water') ||
                 drinkName.includes('tonic') || drinkDescription.includes('tonic')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Tonic Waters');
        }
        // Iced Teas
        else if (combinedText.includes('iced tea') || combinedText.includes('ice tea') ||
                 combinedText.includes('tea') || drinkName.includes('tea')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Iced Teas');
        }
        // Ginger Ales
        else if (combinedText.includes('ginger ale') || combinedText.includes('ginger') ||
                 drinkName.includes('ginger')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Ginger Ales');
        }
        // Flavored Sodas (cola, lemonade, orange, etc.)
        else if (combinedText.includes('cola') || combinedText.includes('soda') ||
                 combinedText.includes('lemonade') || combinedText.includes('orange') ||
                 combinedText.includes('passionade') || combinedText.includes('fanta') ||
                 combinedText.includes('sprite') || combinedText.includes('coca cola') ||
                 combinedText.includes('pepsi') || combinedText.includes('7up') ||
                 combinedText.includes('schweppes') || combinedText.includes('mirinda')) {
          matchedSubcategory = allSubcategories.find(s => s.name === 'Flavored Sodas');
        }

        if (matchedSubcategory) {
          // Only update if different from current
          if (softDrink.subCategoryId !== matchedSubcategory.id) {
            await softDrink.update({ subCategoryId: matchedSubcategory.id });
            console.log(`✅ "${softDrink.name}" → ${matchedSubcategory.name}`);
            assigned++;
          } else {
            console.log(`⏭️  "${softDrink.name}" already assigned to ${matchedSubcategory.name}`);
            skipped++;
          }
        } else {
          // Default to Flavored Sodas if no match (most common soft drink type)
          const flavoredSodasSubcategory = allSubcategories.find(s => s.name === 'Flavored Sodas');
          if (flavoredSodasSubcategory) {
            if (softDrink.subCategoryId !== flavoredSodasSubcategory.id) {
              await softDrink.update({ subCategoryId: flavoredSodasSubcategory.id });
              console.log(`✅ "${softDrink.name}" → Flavored Sodas (default)`);
              assigned++;
            } else {
              console.log(`⏭️  "${softDrink.name}" already assigned to Flavored Sodas`);
              skipped++;
            }
          } else {
            console.log(`⚠️  "${softDrink.name}" - No subcategory match found`);
            skipped++;
          }
        }
      } catch (error) {
        console.error(`❌ Error processing "${softDrink.name}":`, error.message);
        errors++;
      }
    }

    // Now remove "All Soft Drinks" subcategory after reassigning drinks
    console.log('\n🗑️  Removing "All Soft Drinks" subcategory...');
    const allSoftDrinksSubcategory = await db.SubCategory.findOne({
      where: { 
        name: 'All Soft Drinks', 
        categoryId: softDrinksCategory.id 
      }
    });
    
    if (allSoftDrinksSubcategory) {
      // Check if any drinks are still using this subcategory
      const drinksCount = await db.Drink.count({
        where: { subCategoryId: allSoftDrinksSubcategory.id }
      });

      if (drinksCount > 0) {
        console.log(`  ⚠️  "All Soft Drinks" still has ${drinksCount} drinks assigned. Setting subCategoryId to null...`);
        await db.Drink.update(
          { subCategoryId: null },
          { where: { subCategoryId: allSoftDrinksSubcategory.id } }
        );
      }

      await allSoftDrinksSubcategory.destroy();
      console.log(`  ✅ Removed: "All Soft Drinks"`);
    } else {
      console.log(`  ⏭️  "All Soft Drinks" subcategory not found`);
    }

    console.log('');

    // Show final list of soft drinks subcategories
    const finalSubcategories = await db.SubCategory.findAll({
      where: { categoryId: softDrinksCategory.id, isActive: true },
      order: [['name', 'ASC']]
    });

    console.log(`📊 Final soft drinks subcategories (${finalSubcategories.length}):`);
    finalSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });

    console.log(`\n\n📊 Summary:`);
    console.log(`  ➕ Created: ${created}`);
    console.log(`  ⏭️  Already existed: ${alreadyExisted}`);
    console.log(`  🗑️  Removed: ${allSoftDrinksSubcategory ? 1 : 0}`);
    console.log(`  ✅ Assigned: ${assigned}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`\n🎉 Soft drinks subcategory update completed!`);

  } catch (error) {
    console.error('❌ Error updating soft drinks subcategories:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  updateSoftDrinksSubcategories()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { updateSoftDrinksSubcategories };

