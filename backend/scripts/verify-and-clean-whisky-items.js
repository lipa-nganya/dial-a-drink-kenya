const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../models');

function normalizeName(name) {
  return name.toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/&/g, 'and')
    .replace(/[.,]/g, '');
}

async function getWebsiteWhiskyNames() {
  try {
    console.log('🔍 Fetching whisky items from website...\n');
    
    const url = 'https://www.dialadrinkkenya.com/category/whisky';
    const response = await axios.get(url, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const websiteNames = new Set();
    
    // Extract from JSON-LD
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const jsonText = $(el).html();
        if (!jsonText || !jsonText.includes('"name"')) return;
        
        const data = JSON.parse(jsonText);
        
        if (data.name && typeof data.name === 'string' && data.name.length > 3) {
          const normalized = normalizeName(data.name);
          websiteNames.add(normalized);
        }
      } catch (error) {
        // Skip invalid JSON
      }
    });
    
    console.log(`Found ${websiteNames.size} unique whisky items on website\n`);
    
    return websiteNames;
    
  } catch (error) {
    console.error('Error fetching website:', error.message);
    return new Set();
  }
}

async function verifyAndCleanWhiskyItems() {
  try {
    console.log('🔍 Verifying whisky items against dialadrinkkenya.com...\n');
    await db.sequelize.authenticate();
    console.log('Database connected\n');

    const whiskyCategory = await db.Category.findOne({ where: { name: 'Whisky' } });
    if (!whiskyCategory) {
      console.error('Whisky category not found!');
      return;
    }

    // Get all whisky items from database
    const allWhiskies = await db.Drink.findAll({
      where: { categoryId: whiskyCategory.id },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']]
    });

    console.log(`Found ${allWhiskies.length} whisky items in database\n`);

    // Get website items
    const websiteNames = await getWebsiteWhiskyNames();
    
    if (websiteNames.size === 0) {
      console.log('⚠️  Could not fetch website items. Cannot verify.');
      return;
    }

    const itemsToKeep = [];
    const itemsToRemove = [];

    console.log('Checking each item...\n');

    for (let i = 0; i < allWhiskies.length; i++) {
      const whisky = allWhiskies[i];
      const normalized = normalizeName(whisky.name);
      
      // Check exact match
      if (websiteNames.has(normalized)) {
        itemsToKeep.push(whisky);
        continue;
      }
      
      // Check for partial matches
      let found = false;
      for (const websiteName of websiteNames) {
        // If one contains the other and they're very similar
        if (normalized.includes(websiteName) || websiteName.includes(normalized)) {
          const longer = normalized.length > websiteName.length ? normalized : websiteName;
          const shorter = normalized.length > websiteName.length ? websiteName : normalized;
          // If 85%+ match, consider it the same
          if (shorter.length / longer.length >= 0.85) {
            found = true;
            break;
          }
        }
      }
      
      if (found) {
        itemsToKeep.push(whisky);
      } else {
        itemsToRemove.push(whisky);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`- Items to keep: ${itemsToKeep.length}`);
    console.log(`- Items to remove (not on website): ${itemsToRemove.length}`);

    if (itemsToRemove.length > 0) {
      console.log(`\n🗑️  Removing ${itemsToRemove.length} items not found on website:\n`);
      for (const item of itemsToRemove) {
        await item.destroy();
        console.log(`   ✅ Removed: ${item.name}`);
      }
    }

    const finalCount = await db.Drink.count({ where: { categoryId: whiskyCategory.id } });

    console.log(`\n✅ Verification complete!`);
    console.log(`- Kept: ${itemsToKeep.length} items`);
    console.log(`- Removed: ${itemsToRemove.length} items`);
    console.log(`- Final database count: ${finalCount}`);
    console.log(`- Website items: ${websiteNames.size}`);

  } catch (error) {
    console.error('Error verifying whisky items:', error);
  } finally {
    await db.sequelize.close();
  }
}

verifyAndCleanWhiskyItems()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

