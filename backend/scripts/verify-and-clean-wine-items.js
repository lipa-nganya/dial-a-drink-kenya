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

async function getWebsiteWineNames() {
  try {
    console.log('🔍 Fetching wine items from website...\n');
    
    const url = 'https://www.dialadrinkkenya.com/search?query=wine';
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
    
    // Also extract from h3.modal-title
    $('h3.modal-title').each((i, el) => {
      const name = $(el).text().trim();
      if (name && name.length > 3 && name.length < 100) {
        const normalized = normalizeName(name);
        websiteNames.add(normalized);
      }
    });
    
    console.log(`Found ${websiteNames.size} unique wine items on website\n`);
    
    return websiteNames;
    
  } catch (error) {
    console.error('Error fetching website:', error.message);
    return new Set();
  }
}

async function verifyAndCleanWineItems() {
  try {
    console.log('🔍 Verifying wine items against dialadrinkkenya.com...\n');
    await db.sequelize.authenticate();
    console.log('Database connected\n');

    const wineCategory = await db.Category.findOne({ where: { name: 'Wine' } });
    if (!wineCategory) {
      console.error('Wine category not found!');
      return;
    }

    // Get all wine items from database
    const allWines = await db.Drink.findAll({
      where: { categoryId: wineCategory.id },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']]
    });

    console.log(`Found ${allWines.length} wine items in database\n`);

    // Get website items
    const websiteNames = await getWebsiteWineNames();
    
    if (websiteNames.size === 0) {
      console.log('⚠️  Could not fetch website items. Cannot verify.');
      return;
    }

    const itemsToKeep = [];
    const itemsToRemove = [];

    console.log('Checking each item...\n');

    for (let i = 0; i < allWines.length; i++) {
      const wine = allWines[i];
      const normalized = normalizeName(wine.name);
      
      // Check exact match
      if (websiteNames.has(normalized)) {
        itemsToKeep.push(wine);
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
        itemsToKeep.push(wine);
      } else {
        itemsToRemove.push(wine);
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

    const finalCount = await db.Drink.count({ where: { categoryId: wineCategory.id } });

    console.log(`\n✅ Verification complete!`);
    console.log(`- Kept: ${itemsToKeep.length} items`);
    console.log(`- Removed: ${itemsToRemove.length} items`);
    console.log(`- Final database count: ${finalCount}`);
    console.log(`- Website items: ${websiteNames.size}`);

  } catch (error) {
    console.error('Error verifying wine items:', error);
  } finally {
    await db.sequelize.close();
  }
}

verifyAndCleanWineItems()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

