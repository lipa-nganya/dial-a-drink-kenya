const db = require('../models');

/**
 * Script to assign brands to drinks based on product names
 * Improved matching logic to handle brand name variations
 */

// Enhanced brand name mappings - key is what appears in drink name, value is brand name to match
const brandMappings = {
  // Whisky/Whiskey brands
  'jameson': 'Jameson',
  'jack daniel': 'Jack Daniel\'s',
  'johnnie walker': 'Johnnie Walker',
  'glenfiddich': 'Glenfiddich',
  'singleton': 'Singleton',
  'jnb': 'JnB',
  'j&b': 'JnB',
  'black and white': 'Black and White',
  'monkey shoulder': 'Monkey Shoulder',
  'jim beam': 'Jim Beam',
  
  // Vodka brands
  'absolut': 'Absolut',
  'smirnoff': 'Smirnoff',
  'ciroc': 'Ciroc',
  
  // Tequila brands
  'don julio': 'Don Julio',
  'patron': 'Patron',
  'jose cuervo': 'Jose Cuervo',
  'olmeca': 'Olmeca',
  
  // Cognac/Brandy brands
  'hennessy': 'Hennessy',
  'martell': 'Martell',
  
  // Gin brands
  'tanqueray': 'Tanqueray Gin',
  'gordon': 'Gordon\'s Gin',
  'gordon\'s': 'Gordon\'s Gin',
  'beefeater': 'Beefeater Gin',
  'bombay': 'Bombay-Sapphire-Gin',
  'bombay sapphire': 'Bombay-Sapphire-Gin',
  'hendrick': 'Hendricks Gin',
  'hendricks': 'Hendricks Gin',
  
  // Wine brands
  'guv\'nor': 'The Guv\'nor',
  'mucho mas': 'Mucho Mas',
  'olepasu': 'Olepasu',
  'bitola': 'Bitola',
  'choco toffee': 'Choco Toffee',
  'bianco nobile': 'Bianco Nobile',
  
  // Beer brands
  'k.o': 'K.O',
  'ko ': 'K.O',
  'k.o ': 'K.O',
  'k.o beer': 'K.O',
};

// Function to normalize strings for matching
function normalize(str) {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

// Function to find best matching brand
function findMatchingBrand(drinkName, brands) {
  const drinkNameNorm = normalize(drinkName);
  
  // First, try brand mappings (most reliable)
  for (const [key, brandName] of Object.entries(brandMappings)) {
    if (drinkNameNorm.includes(key)) {
      const matched = brands.find(b => {
        const bNorm = normalize(b.name);
        const brandNameNorm = normalize(brandName);
        return bNorm === brandNameNorm || 
               bNorm.includes(brandNameNorm) || 
               brandNameNorm.includes(bNorm);
      });
      if (matched) return matched;
    }
  }
  
  // Then try exact brand name matching (highest priority)
  for (const brand of brands) {
    const brandNameNorm = normalize(brand.name);
    
    // Exact match or brand name contained in drink name
    if (drinkNameNorm.includes(brandNameNorm)) {
      // Make sure it's not a false positive (e.g., "Black" matching "Black Forest" when looking for "Black and White")
      // Check if the match is at word boundaries or is the full brand name
      const brandWords = brandNameNorm.split(/\s+/);
      if (brandWords.length === 1) {
        // Single word brand - make sure it's not too short or generic
        if (brandWords[0].length >= 4 && !['black', 'white', 'red', 'blue', 'gold', 'silver'].includes(brandWords[0])) {
          return brand;
        }
      } else {
        // Multi-word brand - require at least 2 words to match
        let matchingWords = 0;
        for (const word of brandWords) {
          if (word.length >= 3 && drinkNameNorm.includes(word)) {
            matchingWords++;
          }
        }
        // Require at least 2 words to match for multi-word brands
        if (matchingWords >= Math.min(2, brandWords.length)) {
          return brand;
        }
      }
    }
  }
  
  // Try matching with significant words only (more lenient)
  for (const brand of brands) {
    const brandNameNorm = normalize(brand.name);
    const brandWords = brandNameNorm.split(/\s+/);
    
    // Skip generic words
    const skipWords = ['gin', 'vodka', 'whisky', 'whiskey', 'rum', 'tequila', 'champagne', 'wine', 'beer', 'cognac', 'brandy', 'label', 'the'];
    
    // Get significant words from brand name
    const significantWords = brandWords.filter(w => w.length >= 4 && !skipWords.includes(w));
    
    if (significantWords.length === 0) continue;
    
    // Check if all significant words appear in drink name
    let allMatch = true;
    for (const word of significantWords) {
      if (!drinkNameNorm.includes(word)) {
        allMatch = false;
        break;
      }
    }
    
    if (allMatch && significantWords.length >= 1) {
      return brand;
    }
  }
  
  return null;
}

async function assignBrandsToDrinks() {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection established');

    // Fetch all drinks and brands
    const drinks = await db.Drink.findAll({
      include: [{
        model: db.Brand,
        as: 'brand'
      }],
      order: [['name', 'ASC']]
    });
    
    const brands = await db.Brand.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    });

    console.log(`\n📊 Found ${drinks.length} drinks and ${brands.length} brands`);

    let assigned = 0;
    let alreadyAssigned = 0;
    let notFound = 0;
    const notFoundDrinks = [];

    for (const drink of drinks) {
      // Skip if already has a brand
      if (drink.brandId) {
        alreadyAssigned++;
        continue;
      }

      const matchedBrand = findMatchingBrand(drink.name, brands);

      if (matchedBrand) {
        await drink.update({ brandId: matchedBrand.id });
        console.log(`✅ Assigned "${drink.name}" → "${matchedBrand.name}"`);
        assigned++;
      } else {
        notFound++;
        notFoundDrinks.push(drink.name);
        // Only log first 50 to avoid spam
        if (notFound <= 50) {
          console.log(`❌ No brand found for: "${drink.name}"`);
        }
      }
    }

    console.log('\n📊 Assignment Summary:');
    console.log(`✅ Newly assigned: ${assigned} drinks`);
    console.log(`⏭️  Already assigned: ${alreadyAssigned} drinks`);
    console.log(`❌ Not found: ${notFound} drinks`);
    
    if (notFoundDrinks.length > 0) {
      console.log('\n❌ Sample drinks without brands (showing first 30):');
      notFoundDrinks.slice(0, 30).forEach(name => console.log(`  - ${name}`));
      if (notFoundDrinks.length > 30) {
        console.log(`  ... and ${notFoundDrinks.length - 30} more`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error assigning brands:', error);
    process.exit(1);
  } finally {
    await db.sequelize.close();
  }
}

// Run assignment
assignBrandsToDrinks();
