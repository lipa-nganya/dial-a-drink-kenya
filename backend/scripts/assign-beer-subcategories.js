const db = require('../models');

/**
 * Assign beers to appropriate subcategories based on their names and characteristics
 */
async function assignBeerSubcategories() {
  try {
    console.log('🍺 Starting beer subcategory assignment...\n');

    // Get Beer category
    const beerCategory = await db.Category.findOne({ where: { name: 'Beer' } });
    if (!beerCategory) {
      console.error('❌ Beer category not found!');
      return;
    }

    console.log(`✅ Found Beer category (ID: ${beerCategory.id})\n`);

    // Get all beer subcategories
    const subcategories = await db.SubCategory.findAll({
      where: { categoryId: beerCategory.id, isActive: true },
      order: [['name', 'ASC']]
    });

    console.log(`📋 Found ${subcategories.length} beer subcategories:`);
    subcategories.forEach(sub => {
      console.log(`  - ${sub.name} (ID: ${sub.id})`);
    });
    console.log('');

    // Create a mapping of keywords to subcategory IDs
    const subcategoryMap = {};
    
    // Map beer types based on name patterns
    const beerTypeMappings = {
      'Cider Beer': ['cider', 'smirnoff ice', 'savanna', 'tusker cider', 'hunters gold cider', 'snapp'],
      'Lager Beer': ['lager', 'tusker lager', 'pilsner', 'heineken', 'windhoek', 'whitecap', 'balozi', 'guinness', 'stella artois', 'budweiser', 'carlsberg', 'peroni', 'corona', 'desperados', 'tuborg', 'castel', 'castle lite', 'atlas', 'ruhr gold', 'obolon', 'hike'],
      'Malt Beer': ['malt', 'tusker malt', 'summit malt'],
      'Draught Beer': ['draught', 'windhoek draught'],
      'Strong Beer': ['strong', 'oettinger superforte', 'atlas ultra', 'atlas 12', 'gold seal', 'curonia', 'o j 12%', 'abv 8%', 'abv 8.9%', 'abv 9%', 'abv 12%', 'abv 14%', 'abv 16%', 'k.o', 'k.o beer', 'manyatta', 'bateleur', 'bila shaka', 'cliff hanger', 'sandtrap', 'karibrew', 'golden rump', 'bila shaka'],
      'Non-alcoholic Beers': ['non-alcoholic', 'non alcoholic', '0.0', '0%', 'abv 0%', 'bavaria 0.0', 'coolberg', 'gluten free'],
      'craft beer': ['craft', 'bateleur', 'bila shaka', '254', 'niaje', 'samburu', 'amberseli', 'hopsmith', 'capitan', 'cliff hanger', 'sandtrap']
    };

    // Build the mapping
    subcategories.forEach(sub => {
      const lowerName = sub.name.toLowerCase();
      
      // Check type mappings
      for (const [type, keywords] of Object.entries(beerTypeMappings)) {
        if (lowerName === type.toLowerCase()) {
          keywords.forEach(keyword => {
            if (!subcategoryMap[keyword]) {
              subcategoryMap[keyword] = [];
            }
            subcategoryMap[keyword].push({ id: sub.id, name: sub.name, priority: 1 });
          });
        }
      }
    });

    // Get all beers
    const beers = await db.Drink.findAll({
      where: { categoryId: beerCategory.id },
      order: [['name', 'ASC']]
    });

    console.log(`\n🍺 Found ${beers.length} beers to process\n`);

    let assigned = 0;
    let skipped = 0;
    let errors = 0;

    for (const beer of beers) {
      try {
        const beerName = beer.name.toLowerCase();
        const beerDescription = (beer.description || '').toLowerCase();
        const combinedText = `${beerName} ${beerDescription}`;
        let matchedSubcategory = null;
        let highestPriority = 999;

        // Check ABV for Strong Beer and Non-alcoholic Beers
        if (beer.abv !== null && beer.abv !== undefined) {
          if (beer.abv >= 8.0) {
            const strongBeer = subcategories.find(s => s.name.toLowerCase() === 'strong beer');
            if (strongBeer) {
              matchedSubcategory = { id: strongBeer.id, name: strongBeer.name, priority: 1 };
            }
          } else if (beer.abv === 0 || beer.abv === 0.0) {
            const nonAlcoholic = subcategories.find(s => s.name.toLowerCase() === 'non-alcoholic beers');
            if (nonAlcoholic) {
              matchedSubcategory = { id: nonAlcoholic.id, name: nonAlcoholic.name, priority: 1 };
            }
          }
        }

        // Try to match against subcategory map (only if not already matched by ABV)
        if (!matchedSubcategory) {
          for (const [keyword, matches] of Object.entries(subcategoryMap)) {
            if (combinedText.includes(keyword)) {
              // Find the highest priority match (lower number = higher priority)
              for (const match of matches) {
                if (match.priority < highestPriority) {
                  highestPriority = match.priority;
                  matchedSubcategory = match;
                }
              }
            }
          }
        }

        // If no match found, try direct name matching with subcategories
        if (!matchedSubcategory) {
          for (const sub of subcategories) {
            const subName = sub.name.toLowerCase();
            
            // Check if beer name contains subcategory name or vice versa
            if (beerName.includes(subName) || subName.includes(beerName.split(' ')[0])) {
              matchedSubcategory = { id: sub.id, name: sub.name, priority: 2 };
              break;
            }
          }
        }

          // Additional specific matching rules
        if (!matchedSubcategory) {
          // Cider detection
          if (beerName.includes('cider') || beerName.includes('smirnoff ice') || beerName.includes('savanna')) {
            const ciderBeer = subcategories.find(s => s.name.toLowerCase() === 'cider beer');
            if (ciderBeer) {
              matchedSubcategory = { id: ciderBeer.id, name: ciderBeer.name, priority: 2 };
            }
          }
          // Pils detection (Pilsner is a type of lager)
          else if (beerName.includes('pils') || beerName.includes('oettinger')) {
            const lagerBeer = subcategories.find(s => s.name.toLowerCase() === 'lager beer');
            if (lagerBeer) {
              matchedSubcategory = { id: lagerBeer.id, name: lagerBeer.name, priority: 2 };
            }
          }
          // Lager detection (most common type) - default for most beers
          else if (beerName.includes('lager') || beerName.includes('pilsner') || beerName.includes('heineken') || 
                   beerName.includes('tusker') || beerName.includes('whitecap') || beerName.includes('balozi') ||
                   beerName.includes('guinness') || beerName.includes('stella') || beerName.includes('budweiser') ||
                   beerName.includes('carlsberg') || beerName.includes('peroni') || beerName.includes('corona') ||
                   beerName.includes('bavaria') || beerName.includes('jack daniel')) {
            const lagerBeer = subcategories.find(s => s.name.toLowerCase() === 'lager beer');
            if (lagerBeer) {
              matchedSubcategory = { id: lagerBeer.id, name: lagerBeer.name, priority: 2 };
            }
          }
          // Malt detection
          else if (beerName.includes('malt') || beerName.includes('summit malt')) {
            const maltBeer = subcategories.find(s => s.name.toLowerCase() === 'malt beer');
            if (maltBeer) {
              matchedSubcategory = { id: maltBeer.id, name: maltBeer.name, priority: 2 };
            }
          }
          // Draught detection
          else if (beerName.includes('draught') || beerName.includes('draft')) {
            const draughtBeer = subcategories.find(s => s.name.toLowerCase() === 'draught beer');
            if (draughtBeer) {
              matchedSubcategory = { id: draughtBeer.id, name: draughtBeer.name, priority: 2 };
            }
          }
          // Craft beer detection (Kenyan craft beers)
          else if (beerName.includes('bateleur') || beerName.includes('bila shaka') || beerName.includes('254') ||
                   beerName.includes('niaje') || beerName.includes('samburu') || beerName.includes('amberseli') ||
                   beerName.includes('hopsmith') || beerName.includes('capitan') || beerName.includes('cliff hanger') ||
                   beerName.includes('sandtrap')) {
            const craftBeer = subcategories.find(s => s.name.toLowerCase() === 'craft beer');
            if (craftBeer) {
              matchedSubcategory = { id: craftBeer.id, name: craftBeer.name, priority: 2 };
            }
          }
          // Default to Lager Beer if no other match (most beers are lagers)
          else {
            const lagerBeer = subcategories.find(s => s.name.toLowerCase() === 'lager beer');
            if (lagerBeer) {
              matchedSubcategory = { id: lagerBeer.id, name: lagerBeer.name, priority: 3 };
            }
          }
        }

        if (matchedSubcategory) {
          // Only update if different from current
          if (beer.subCategoryId !== matchedSubcategory.id) {
            await beer.update({ subCategoryId: matchedSubcategory.id });
            console.log(`✅ "${beer.name}" → ${matchedSubcategory.name}`);
            assigned++;
          } else {
            console.log(`⏭️  "${beer.name}" already assigned to ${matchedSubcategory.name}`);
            skipped++;
          }
        } else {
          console.log(`⚠️  "${beer.name}" - No subcategory match found`);
          skipped++;
        }
      } catch (error) {
        console.error(`❌ Error processing "${beer.name}":`, error.message);
        errors++;
      }
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`  ✅ Assigned: ${assigned}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`\n🎉 Beer subcategory assignment completed!`);

  } catch (error) {
    console.error('❌ Error assigning beer subcategories:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  assignBeerSubcategories()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { assignBeerSubcategories };

