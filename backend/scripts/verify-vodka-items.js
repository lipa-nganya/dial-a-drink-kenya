const db = require('../models');

// List of vodka items that ARE on the website (from the search results)
const validVodkaItems = [
  'Tito\'s Handmade Vodka',
  'Smirnoff Vodka',
  'Absolut Vodka',
  'Haku Vodka',
  'Russian Standard Gold Vodka',
  'Belvedere Lake Bartezek',
  'Grey Goose Vx',
  'Bufalov French Wheat Sugar Free Vodka',
  'Belvedere Pink Grapefruit',
  'Belvedere Heritage 176',
  'Danzka Vodka',
  'Belvedere Smogory Forest',
  'Magic Moments Raspberry',
  'Magic Moments Lemon',
  'Magic Moments Lemon & ginger',
  'Flirt Vodka Green Apple',
  'Magic Moments Green Apple',
  'Everclear 190 Proof',
  'Sadko Vodka',
  'Magic Moments Original',
  'Kenya Cane Smooth',
  'Smirnoff Blue Label',
  'Caribia Cane',
  'Spirytus Vodka',
  'Flirt Vodka Unflavoured',
  'Flirt Vodka Strawberry',
  'Hlibny Dar Vodka',
  'Absolute Oak',
  'Beluga Transatlantic Racing',
  'Absolut Elyx',
  'Crystal Head Vodka Year Of The dragon',
  'Ciroc Pineapple',
  'Billionaire Vodka',
  'Absolute Pepper',
  'Sobieski Vodka',
  'Belvedere Vodka',
  'Absolut Raspberri',
  'Grey Goose',
  'Elite Vodka',
  'Ciroc Coconut',
  'Celsius Vodka',
  'Smirnoff Green Apple',
  'Magic Moments Orange',
  'Red Army Vodka',
  'KGB vodka',
  'Absolut Vanilla',
  'Smirnoff Orange',
  'Ketel One',
  'Absolute Unique',
  'Rada Premium Vodka',
  'Absolut Kurant',
  'Ciroc Red Berry',
  'Absolute mango',
  'Beluga Noble Vodka',
  'Skyy Vodka',
  'Crystal Head Aurora Vodka',
  'Jinro Soju Strawberry Vodka',
  'Belvedere Bloody Mary 70cl',
  'Smirnoff Gold',
  'Danzka Citrus Vodka',
  'Beluga Gold',
  'Ciroc Vodka',
  'Crystal Head Onyx Vodka',
  'Absolut Citron',
  'Crystal Head Pride Vodka',
  'Smirnoff Raspberry',
  'Beluga Noble Silver',
  'Crystal Head Vodka Jeroboam',
  'Ciroc Vodka Summer Watermelon',
  'Beluga Celebration',
  'Absolute Pears',
  'Leleshwa Vodka',
  'Skyy 90',
  'Absolut Mandrin',
  'Ketel One Citroen',
  'Golden Grain 190',
  'Balkan 176 Vodka',
  'Crystal Head Bone Edition',
  'Smirnoff Vodka Red',
  'Hapsburg Absinthe Cassis X.C',
  'Luksusowa Vodka',
  'Crystal Head Alexander Series',
  'Crystal Head Pride Edition',
  'Ciroc Vodka 1.75Litres',
  'Amsterdam Vodka',
  'Absolut Watkins',
  'Belvedere Citron',
  'Smirnoff Espresso',
  'Magic Moments Chocolate',
  'Hapsburg Absinthe Vodka'
];

// Function to normalize drink names for comparison
function normalizeName(name) {
  return name.toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/&/g, 'and')
    .replace(/[.,]/g, '');
}

// Mapping of database names to website names (for variations)
const nameMappings = {
  'flirt vodka apple': 'Flirt Vodka Green Apple',
  'grey goose vodka': 'Grey Goose',
  'ketel one vodka': 'Ketel One',
  'russian standard gold': 'Russian Standard Gold Vodka',
  'smirnoff vodka red': 'Smirnoff Vodka Red',
  'absolute oak': 'Absolute Oak',
  'absolute pepper': 'Absolute Pepper',
  'absolute unique': 'Absolute Unique',
  'absolute pears': 'Absolute Pears',
  'absolute mango': 'Absolute mango',
  'absolut raspberri': 'Absolut Raspberri',
  'absolut watkins': 'Absolut Watkins',
  'absolut mandrin': 'Absolut Mandrin',
  'absolut elyx': 'Absolut Elyx',
  'crystal head vodka': 'Crystal Head Vodka Year Of The dragon' // default to most common variant
};

// Helper to check if item matches a valid item from website
function matchesValidItem(drinkName) {
  const normalized = normalizeName(drinkName);
  
  // Check exact matches
  for (const validItem of validVodkaItems) {
    if (normalizeName(validItem) === normalized) {
      return true;
    }
  }
  
  // Check name mappings (e.g., "Flirt Vodka Apple" -> "Flirt Vodka Green Apple")
  if (nameMappings[normalized]) {
    return true;
  }
  
  // Only allow these specific known variations
  const allowedVariations = {
    'grey goose vodka': 'Grey Goose',
    'ketel one vodka': 'Ketel One',
    'russian standard gold': 'Russian Standard Gold Vodka',
    'flirt vodka apple': 'Flirt Vodka Green Apple',
    'titos handmade vodka': 'Tito\'s Handmade Vodka',
    'tito handmade vodka': 'Tito\'s Handmade Vodka',
    'smirnoff red': 'Smirnoff Vodka Red', // Close match
    'absolut raspberri': 'Absolut Raspberri',
    'absolut mandrin': 'Absolut Mandrin'
  };
  
  if (allowedVariations[normalized]) {
    // Verify the target exists in valid items
    const target = allowedVariations[normalized];
    if (validVodkaItems.some(item => normalizeName(item) === normalizeName(target))) {
      return true;
    }
  }
  
  // Very strict: only check if the name appears as-is or is a close variant in valid items
  // First check for exact normalized match (this should catch "Jumping Goat Vodka Liqueur" etc.)
  for (const validItem of validVodkaItems) {
    const validNormalized = normalizeName(validItem);
    if (validNormalized === normalized) {
      return true;
    }
  }
  
  // Remove "Vodka" suffix and check if base brand matches
  const baseName = normalized.replace(/\s+vodka\s*$/i, '').trim();
  for (const validItem of validVodkaItems) {
    const validNormalized = normalizeName(validItem);
    const validBaseName = validNormalized.replace(/\s+vodka\s*$/i, '').trim();
    
    // If base names match exactly (e.g., "Grey Goose" matches "Grey Goose Vodka")
    if (baseName === validBaseName && baseName.length > 3) {
      return true;
    }
    
    // Check if one is a substring of the other and very close (for variants like "Ciroc" vs "Ciroc Vodka")
    if ((validNormalized.includes(baseName) || baseName.includes(validBaseName)) && 
        Math.min(baseName.length, validBaseName.length) / Math.max(baseName.length, validBaseName.length) > 0.9) {
      return true;
    }
  }
  
  return false;
}

async function verifyAndCleanVodkaItems() {
  try {
    console.log('🔍 Verifying vodka items against dialadrinkkenya.com...\n');
    await db.sequelize.authenticate();
    console.log('Database connected\n');

    const vodkaCategory = await db.Category.findOne({ where: { name: 'Vodka' } });
    if (!vodkaCategory) {
      console.error('Vodka category not found!');
      return;
    }

    const allVodkas = await db.Drink.findAll({
      where: { categoryId: vodkaCategory.id },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']]
    });

    console.log(`Found ${allVodkas.length} vodka items in database\n`);
    console.log('Checking each item against valid website items...\n');

    const itemsToRemove = [];
    const itemsToKeep = [];

    for (let i = 0; i < allVodkas.length; i++) {
      const vodka = allVodkas[i];
      process.stdout.write(`[${i + 1}/${allVodkas.length}] Checking: ${vodka.name}... `);
      
      const matches = matchesValidItem(vodka.name);
      
      if (matches) {
        console.log('✅ Found on website');
        itemsToKeep.push(vodka);
      } else {
        console.log('❌ Not found on website');
        itemsToRemove.push(vodka);
      }
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`- Items to keep: ${itemsToKeep.length}`);
    console.log(`- Items to remove: ${itemsToRemove.length}`);

    if (itemsToRemove.length > 0) {
      console.log(`\n🗑️  Removing ${itemsToRemove.length} items not found on website:\n`);
      for (const item of itemsToRemove) {
        await item.destroy();
        console.log(`   ✅ Removed: ${item.name} (ID: ${item.id})`);
      }
    }

    console.log(`\n✅ Verification complete!`);
    console.log(`- Kept: ${itemsToKeep.length} items`);
    console.log(`- Removed: ${itemsToRemove.length} items`);

  } catch (error) {
    console.error('Error verifying vodka items:', error);
  } finally {
    await db.sequelize.close();
  }
}

verifyAndCleanVodkaItems()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

