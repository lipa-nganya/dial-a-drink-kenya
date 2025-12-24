const db = require('../models');

/**
 * Update whisky subcategories:
 * 1. Remove "All Whiskies", "All Whisky", and "All Whiskys" subcategories
 * 2. Assign whiskies to correct subcategories (Single Malt, Blended Scotch, Japanese Whisky, Irish Whisky, etc.)
 */
async function updateWhiskySubcategories() {
  try {
    console.log('🥃 Starting whisky subcategory update...\n');

    // Get Whisky category
    const whiskyCategory = await db.Category.findOne({ where: { name: 'Whisky' } });
    if (!whiskyCategory) {
      console.error('❌ Whisky category not found!');
      return;
    }

    console.log(`✅ Found Whisky category (ID: ${whiskyCategory.id})\n`);

    // Get all current whisky subcategories
    const currentSubcategories = await db.SubCategory.findAll({
      where: { categoryId: whiskyCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`📋 Found ${currentSubcategories.length} current whisky subcategories:`);
    currentSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    console.log('');

    // Get all whiskies
    const whiskies = await db.Drink.findAll({
      where: { categoryId: whiskyCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`\n🥃 Found ${whiskies.length} whiskies to assign\n`);

    // Get all subcategories excluding "All Whiskies", "All Whisky", "All Whiskys"
    const allSubcategories = await db.SubCategory.findAll({
      where: { 
        categoryId: whiskyCategory.id, 
        isActive: true,
        name: { [db.Sequelize.Op.notIn]: ['All Whiskies', 'All Whisky', 'All Whiskys'] }
      },
      order: [['name', 'ASC']]
    });

    console.log(`📋 Available subcategories for assignment:`);
    allSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    console.log('');

    // Helper function to find subcategory by name (case-insensitive)
    const findSubcategory = (name) => {
      return allSubcategories.find(s => 
        s.name.toLowerCase() === name.toLowerCase()
      );
    };

    let assigned = 0;
    let skipped = 0;
    let errors = 0;
    let consolidated = 0;

    for (const whisky of whiskies) {
      try {
        const whiskyName = whisky.name.toLowerCase();
        const whiskyDescription = (whisky.description || '').toLowerCase();
        const combinedText = `${whiskyName} ${whiskyDescription}`;
        let matchedSubcategory = null;

        // Match based on type in name/description
        // Japanese Whisky - check first (very specific)
        if (combinedText.includes('japanese') || combinedText.includes('hibiki') ||
            combinedText.includes('yamazaki') || combinedText.includes('hakushu') ||
            combinedText.includes('nikka') || combinedText.includes('suntory') ||
            combinedText.includes('chita') || combinedText.includes('taketsuru')) {
          matchedSubcategory = findSubcategory('Japanese Whisky');
        }
        // Irish Whisky
        else if (combinedText.includes('irish') || combinedText.includes('jameson') ||
                 combinedText.includes('bushmills') || combinedText.includes('tullamore') ||
                 combinedText.includes('redbreast') || combinedText.includes('green spot') ||
                 combinedText.includes('yellow spot') || combinedText.includes('powers') ||
                 combinedText.includes('teeling') || combinedText.includes('writers tears')) {
          matchedSubcategory = findSubcategory('Irish Whisky') || findSubcategory('Irish');
        }
        // Tennessee Whisky
        else if (combinedText.includes('tennessee') || combinedText.includes('jack daniels') ||
                 combinedText.includes('george dickel') || combinedText.includes('prichard')) {
          matchedSubcategory = findSubcategory('Tennessee Whisky') || findSubcategory('Tennessee');
        }
        // Rye Whisky
        else if (combinedText.includes('rye') && !combinedText.includes('bourbon')) {
          matchedSubcategory = findSubcategory('Rye Whisky');
        }
        // Bourbon Whisky
        else if (combinedText.includes('bourbon') || combinedText.includes('makers mark') ||
                 combinedText.includes('wild turkey') || combinedText.includes('woodford') ||
                 combinedText.includes('buffalo trace') || combinedText.includes('four roses') ||
                 combinedText.includes('jim beam') || combinedText.includes('knob creek') ||
                 combinedText.includes('basil hayden') || combinedText.includes('booker') ||
                 combinedText.includes('eagle rare') || combinedText.includes('blanton')) {
          matchedSubcategory = findSubcategory('Bourbon Whisky');
        }
        // Single Malt
        else if (combinedText.includes('single malt') || combinedText.includes('macallan') ||
                 combinedText.includes('glenlivet') || combinedText.includes('glenfiddich') ||
                 combinedText.includes('ardbeg') || combinedText.includes('lagavulin') ||
                 combinedText.includes('laphroaig') || combinedText.includes('talisker') ||
                 combinedText.includes('highland park') || combinedText.includes('oban') ||
                 combinedText.includes('dalmore') || combinedText.includes('bowmore') ||
                 combinedText.includes('auchentoshan') || combinedText.includes('ardmore') ||
                 combinedText.includes('aberfeldy') || combinedText.includes('aberlour') ||
                 combinedText.includes('balvenie') || combinedText.includes('bruichladdich') ||
                 combinedText.includes('bunnahabhain') || combinedText.includes('caol ila') ||
                 combinedText.includes('cardhu') || combinedText.includes('clynelish') ||
                 combinedText.includes('cragganmore') || combinedText.includes('craigellachie') ||
                 combinedText.includes('dalwhinnie') || combinedText.includes('drambuie') ||
                 combinedText.includes('glenmorangie') || combinedText.includes('glenrothes') ||
                 combinedText.includes('jura') || combinedText.includes('kilchoman') ||
                 combinedText.includes('mortlach') || combinedText.includes('port ellen') ||
                 combinedText.includes('springbank') || combinedText.includes('strathisla')) {
          matchedSubcategory = findSubcategory('Single Malt');
        }
        // Blended Scotch (default for scotch whiskies)
        else if (combinedText.includes('scotch') || combinedText.includes('blended') ||
                 combinedText.includes('chivas') || combinedText.includes('johnnie walker') ||
                 combinedText.includes('ballantines') || combinedText.includes('teachers') ||
                 combinedText.includes('famous grouse') || combinedText.includes('j&b') ||
                 combinedText.includes('cutty sark') || combinedText.includes('dewars') ||
                 combinedText.includes('grant') || combinedText.includes('white horse') ||
                 combinedText.includes('black & white') || combinedText.includes('bell') ||
                 whiskyName.includes('scotch')) {
          matchedSubcategory = findSubcategory('Blended Scotch');
        }

        // If currently assigned to a duplicate subcategory, consolidate
        if (whisky.subCategoryId) {
          const currentSub = allSubcategories.find(s => s.id === whisky.subCategoryId);
          if (currentSub) {
            // Consolidate "Irish" to "Irish Whisky"
            if (currentSub.name === 'Irish' && findSubcategory('Irish Whisky') && 
                currentSub.id !== findSubcategory('Irish Whisky').id) {
              matchedSubcategory = findSubcategory('Irish Whisky');
              await whisky.update({ subCategoryId: matchedSubcategory.id });
              console.log(`🔄 "${whisky.name}" → ${matchedSubcategory.name} (consolidated from ${currentSub.name})`);
              consolidated++;
              continue;
            }
            // Consolidate "Tennessee" to "Tennessee Whisky"
            if (currentSub.name === 'Tennessee' && findSubcategory('Tennessee Whisky') && 
                currentSub.id !== findSubcategory('Tennessee Whisky').id) {
              matchedSubcategory = findSubcategory('Tennessee Whisky');
              await whisky.update({ subCategoryId: matchedSubcategory.id });
              console.log(`🔄 "${whisky.name}" → ${matchedSubcategory.name} (consolidated from ${currentSub.name})`);
              consolidated++;
              continue;
            }
          }
        }

        if (matchedSubcategory) {
          // Only update if different from current
          if (whisky.subCategoryId !== matchedSubcategory.id) {
            await whisky.update({ subCategoryId: matchedSubcategory.id });
            console.log(`✅ "${whisky.name}" → ${matchedSubcategory.name}`);
            assigned++;
          } else {
            console.log(`⏭️  "${whisky.name}" already assigned to ${matchedSubcategory.name}`);
            skipped++;
          }
        } else {
          // Default to Blended Scotch if no match (most common whisky type)
          const blendedScotchSubcategory = findSubcategory('Blended Scotch');
          if (blendedScotchSubcategory) {
            if (whisky.subCategoryId !== blendedScotchSubcategory.id) {
              await whisky.update({ subCategoryId: blendedScotchSubcategory.id });
              console.log(`✅ "${whisky.name}" → Blended Scotch (default)`);
              assigned++;
            } else {
              console.log(`⏭️  "${whisky.name}" already assigned to Blended Scotch`);
              skipped++;
            }
          } else {
            console.log(`⚠️  "${whisky.name}" - No subcategory match found`);
            skipped++;
          }
        }
      } catch (error) {
        console.error(`❌ Error processing "${whisky.name}":`, error.message);
        errors++;
      }
    }

    // Now remove "All Whiskies", "All Whisky", and "All Whiskys" subcategories
    console.log('\n🗑️  Removing "All Whiskies", "All Whisky", and "All Whiskys" subcategories...');
    const subcategoriesToRemove = ['All Whiskies', 'All Whisky', 'All Whiskys'];
    
    for (const subcategoryName of subcategoriesToRemove) {
      const subcategory = await db.SubCategory.findOne({
        where: { 
          name: subcategoryName, 
          categoryId: whiskyCategory.id 
        }
      });
      
      if (subcategory) {
        // Check if any drinks are still using this subcategory
        const drinksCount = await db.Drink.count({
          where: { subCategoryId: subcategory.id }
        });

        if (drinksCount > 0) {
          console.log(`  ⚠️  "${subcategoryName}" still has ${drinksCount} drinks assigned. Setting subCategoryId to null...`);
          await db.Drink.update(
            { subCategoryId: null },
            { where: { subCategoryId: subcategory.id } }
          );
        }

        await subcategory.destroy();
        console.log(`  ✅ Removed: "${subcategoryName}"`);
      } else {
        console.log(`  ⏭️  "${subcategoryName}" subcategory not found`);
      }
    }

    // Remove duplicate subcategories
    console.log('\n🗑️  Removing duplicate subcategories...');
    const duplicateSubcategories = ['Irish', 'Tennessee'];
    
    for (const dupName of duplicateSubcategories) {
      const dupSubcategory = await db.SubCategory.findOne({
        where: { 
          name: dupName, 
          categoryId: whiskyCategory.id 
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

    // Show final list of whisky subcategories
    const finalSubcategories = await db.SubCategory.findAll({
      where: { categoryId: whiskyCategory.id, isActive: true },
      order: [['name', 'ASC']]
    });

    console.log(`📊 Final whisky subcategories (${finalSubcategories.length}):`);
    finalSubcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });

    console.log(`\n\n📊 Summary:`);
    console.log(`  🗑️  Removed: ${subcategoriesToRemove.length} main subcategories + duplicates`);
    console.log(`  ✅ Assigned: ${assigned}`);
    console.log(`  🔄 Consolidated: ${consolidated}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`\n🎉 Whisky subcategory update completed!`);

  } catch (error) {
    console.error('❌ Error updating whisky subcategories:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  updateWhiskySubcategories()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { updateWhiskySubcategories };

