const db = require('../models');
const fs = require('fs');
const path = require('path');

/**
 * Sync tags from JSON into local admin (drinks table).
 *
 * Use after scraping: run scrape-tags-from-dialadrinkkenya.js first; it writes
 * backend/scripts/production-tags.json. Then run this script to import those
 * tags into local drinks (matched by id, slug, or name).
 *
 * This script also accepts a JSON file exported from the browser:
 *
 * Steps (browser export):
 * 1. Log in to https://www.dialadrinkkenya.com/admin/products
 * 2. Open browser console (F12)
 * 3. Run this code to export drinks with tags:
 * 
 *    fetch('/api/admin/drinks', {
 *      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') }
 *    })
 *    .then(r => r.json())
 *    .then(drinks => {
 *      const drinksWithTags = drinks.filter(d => d.tags && Array.isArray(d.tags) && d.tags.length > 0);
 *      const exportData = drinksWithTags.map(d => ({
 *        id: d.id,
 *        name: d.name,
 *        slug: d.slug,
 *        tags: d.tags
 *      }));
 *      console.log(JSON.stringify(exportData, null, 2));
 *      // Copy the output and save to a file
 *    });
 * 
 * 4. Save the output to a file (e.g., production-tags.json)
 * 5. Run this script: node scripts/sync-tags-via-browser-export.js production-tags.json
 */

/**
 * Load tags from JSON file
 */
function loadTagsFromFile(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    
    if (Array.isArray(data)) {
      return data;
    } else if (data.drinks && Array.isArray(data.drinks)) {
      return data.drinks;
    } else {
      throw new Error('Invalid JSON format. Expected an array or object with drinks array.');
    }
  } catch (error) {
    console.error(`❌ Error reading file ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Match production drink to local drink
 */
function findLocalDrink(productionDrink, localDrinks) {
  // Strategy 1: Match by ID
  let localDrink = localDrinks.find(d => d.id === productionDrink.id);
  if (localDrink) {
    return { localDrink, matchType: 'id' };
  }

  // Strategy 2: Match by slug
  if (productionDrink.slug) {
    localDrink = localDrinks.find(d => d.slug === productionDrink.slug);
    if (localDrink) {
      return { localDrink, matchType: 'slug' };
    }
  }

  // Strategy 3: Match by name (case-insensitive, trimmed)
  const productionName = (productionDrink.name || '').trim().toLowerCase();
  localDrink = localDrinks.find(d => 
    (d.name || '').trim().toLowerCase() === productionName
  );
  if (localDrink) {
    return { localDrink, matchType: 'name' };
  }

  return { localDrink: null, matchType: null };
}

/**
 * Update local drink with tags from production
 */
async function updateLocalDrinkTags(localDrink, productionTags) {
  try {
    // Normalize tags - ensure array of strings (scraper/API may send strings or objects)
    let raw = Array.isArray(productionTags) ? productionTags : (productionTags ? [productionTags] : []);
    const tags = raw
      .map(tag => typeof tag === 'string' ? tag.trim() : (tag && (tag.name ?? tag.label ?? tag.value) != null ? String(tag.name ?? tag.label ?? tag.value).trim() : null))
      .filter(Boolean);

    await localDrink.update({ tags });

    return { success: true, tagsCount: tags.length };
  } catch (error) {
    console.error(`❌ Error updating drink ${localDrink.id}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main sync function
 */
async function syncTags() {
  try {
    // Default to scraped file from scrape-tags-from-dialadrinkkenya.js (same directory)
    const defaultPath = path.join(__dirname, 'production-tags.json');
    const jsonFilePath = process.argv[2] || defaultPath;

    if (!fs.existsSync(jsonFilePath)) {
      console.log('📋 Usage: node scripts/sync-tags-via-browser-export.js [json-file-path]');
      console.log(`\n   Default path: ${defaultPath}`);
      console.log('\n   If you just ran the scraper, use: node scripts/sync-tags-via-browser-export.js');
      console.log('   Or pass the path: node scripts/sync-tags-via-browser-export.js path/to/production-tags.json');
      process.exit(1);
    }

    console.log('🚀 Starting tag sync from JSON export...\n');

    // Step 1: Load tags from JSON file
    console.log(`📥 Loading tags from ${jsonFilePath}...`);
    const productionDrinks = loadTagsFromFile(jsonFilePath);
    if (!productionDrinks) {
      console.error('❌ Could not read or parse JSON file. Exiting.');
      process.exit(1);
    }
    if (productionDrinks.length === 0) {
      console.log('✅ Loaded 0 drinks from JSON (empty or no data). Nothing to import.');
      console.log('   Run the scraper first: npm run scrape-tags');
      process.exit(0);
    }
    console.log(`✅ Loaded ${productionDrinks.length} drinks from JSON\n`);

    // Step 2: Fetch local drinks
    console.log('📥 Fetching local drinks...');
    const localDrinks = await db.Drink.findAll({
      attributes: ['id', 'name', 'slug', 'tags']
    });
    console.log(`✅ Found ${localDrinks.length} local drinks\n`);

    // Step 3: Match and update
    console.log('🔄 Matching and updating tags...\n');
    
    let stats = {
      total: productionDrinks.length,
      matched: 0,
      updated: 0,
      skipped: 0,
      notFound: 0,
      errors: 0,
      matchTypes: {
        id: 0,
        slug: 0,
        name: 0
      }
    };

    for (const prodDrink of productionDrinks) {
      const { localDrink, matchType } = findLocalDrink(prodDrink, localDrinks);
      
      if (!localDrink) {
        console.log(`⚠️  Not found: ${prodDrink.name} (ID: ${prodDrink.id})`);
        stats.notFound++;
        continue;
      }

      stats.matched++;
      if (matchType) {
        stats.matchTypes[matchType] = (stats.matchTypes[matchType] || 0) + 1;
      }

      // Check if tags exist
      const prodTags = prodDrink.tags || [];
      const hasTags = Array.isArray(prodTags) && prodTags.length > 0;

      if (!hasTags) {
        console.log(`⏭️  Skipped: ${localDrink.name} (no tags in export)`);
        stats.skipped++;
        continue;
      }

      // Check if tags are already the same
      const localTags = Array.isArray(localDrink.tags) ? localDrink.tags : [];
      const tagsEqual = JSON.stringify(localTags.sort()) === JSON.stringify(prodTags.sort());
      
      if (tagsEqual) {
        console.log(`✓ Already synced: ${localDrink.name} (${prodTags.length} tags)`);
        stats.skipped++;
        continue;
      }

      // Update tags
      const result = await updateLocalDrinkTags(localDrink, prodTags);
      
      if (result.success) {
        console.log(`✅ Updated: ${localDrink.name} (${result.tagsCount} tags) - Matched by ${matchType}`);
        stats.updated++;
      } else {
        console.log(`❌ Error: ${localDrink.name} - ${result.error}`);
        stats.errors++;
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SYNC SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total production drinks with tags: ${stats.total}`);
    console.log(`Matched locally: ${stats.matched}`);
    console.log(`  - By ID: ${stats.matchTypes.id}`);
    console.log(`  - By Slug: ${stats.matchTypes.slug}`);
    console.log(`  - By Name: ${stats.matchTypes.name}`);
    console.log(`Updated with tags: ${stats.updated}`);
    console.log(`Skipped (no tags or already synced): ${stats.skipped}`);
    console.log(`Not found locally: ${stats.notFound}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('='.repeat(60));

    console.log('\n✅ Tag sync completed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error during sync:', error);
    process.exit(1);
  }
}

// Run the sync
syncTags();
