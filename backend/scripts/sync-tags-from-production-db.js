const db = require('../models');
const { Sequelize } = require('sequelize');

/**
 * Script to fetch tags from production database and sync them to local database
 * 
 * This script connects directly to the production database to fetch tags,
 * then matches and updates local drinks.
 * 
 * Usage:
 *   DATABASE_URL="postgresql://user:pass@host/db" node scripts/sync-tags-from-production-db.js
 */

// Production database connection (from deploy-to-production.sh)
const PROD_DB_USER = 'dialadrink_app';
const PROD_DB_PASSWORD = 'E7A3IIa60hFD3bkGH1XAiryvB';
const PROD_DB_NAME = 'dialadrink_prod';
const PROD_CONNECTION = 'dialadrink-production:us-central1:dialadrink-db-prod';
const PROD_DATABASE_URL = `postgresql://${PROD_DB_USER}:${PROD_DB_PASSWORD}@/${PROD_DB_NAME}?host=/cloudsql/${PROD_CONNECTION}`;

// For local execution, we'll need to use a different connection method
// Since we can't use Cloud SQL proxy locally easily, let's try using the public IP or
// create a script that can be run on Cloud Run or a machine with Cloud SQL access

let productionDb = null;

/**
 * Connect to production database
 */
async function connectToProductionDb() {
  try {
    console.log('🔌 Connecting to production database...');
    
    // Try to use DATABASE_URL if provided, otherwise use the production URL
    const dbUrl = process.env.PRODUCTION_DATABASE_URL || PROD_DATABASE_URL;
    
    // For local execution, we might need to use a different approach
    // Cloud SQL requires either:
    // 1. Cloud SQL Proxy
    // 2. Authorized network
    // 3. Private IP access from GCP
    
    // Let's try a simpler approach: use the API but with better error handling
    // Or we can create a Cloud Run Job to do this
    
    console.log('⚠️  Direct database connection requires Cloud SQL Proxy or GCP environment.');
    console.log('💡 Alternative: Use the API-based sync script with correct credentials.');
    console.log('💡 Or run this script on Cloud Run with Cloud SQL access.');
    
    return null;
  } catch (error) {
    console.error('❌ Error connecting to production database:', error.message);
    return null;
  }
}

/**
 * Fetch all drinks from production database
 */
async function fetchProductionDrinks() {
  try {
    if (!productionDb) {
      console.error('❌ Production database not connected');
      return null;
    }

    console.log('📥 Fetching drinks from production database...');
    const [results] = await productionDb.query(
      `SELECT id, name, slug, tags, "pageTitle", keywords, "youtubeUrl" 
       FROM drinks 
       WHERE tags IS NOT NULL AND tags != '[]'::jsonb
       ORDER BY id`
    );

    console.log(`✅ Fetched ${results.length} drinks with tags from production`);
    return results;
  } catch (error) {
    console.error('❌ Error fetching production drinks:', error.message);
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
    // Normalize tags - ensure it's an array
    const tags = Array.isArray(productionTags) 
      ? productionTags.filter(tag => tag && typeof tag === 'string' && tag.trim())
      : (productionTags ? [productionTags] : []);

    // Update the drink
    await localDrink.update({
      tags: tags
    });

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
    console.log('🚀 Starting tag sync from production database to local...\n');

    // Step 1: Connect to production database
    productionDb = await connectToProductionDb();
    if (!productionDb) {
      console.error('❌ Could not connect to production database.');
      console.log('\n💡 To use this script:');
      console.log('   1. Run it on Cloud Run with Cloud SQL access, OR');
      console.log('   2. Use Cloud SQL Proxy locally, OR');
      console.log('   3. Use the API-based sync script (sync-tags-from-production.js)');
      process.exit(1);
    }

    // Step 2: Fetch production drinks
    const productionDrinks = await fetchProductionDrinks();
    if (!productionDrinks || productionDrinks.length === 0) {
      console.error('❌ No drinks with tags found in production. Exiting.');
      process.exit(1);
    }

    // Step 3: Fetch local drinks
    console.log('📥 Fetching local drinks...');
    const localDrinks = await db.Drink.findAll({
      attributes: ['id', 'name', 'slug', 'tags']
    });
    console.log(`✅ Found ${localDrinks.length} local drinks\n`);

    // Step 4: Match and update
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

      // Parse tags from JSONB
      let prodTags = [];
      if (prodDrink.tags) {
        if (typeof prodDrink.tags === 'string') {
          try {
            prodTags = JSON.parse(prodDrink.tags);
          } catch (e) {
            console.warn(`⚠️  Could not parse tags for ${prodDrink.name}: ${e.message}`);
            prodTags = [];
          }
        } else if (Array.isArray(prodDrink.tags)) {
          prodTags = prodDrink.tags;
        }
      }

      const hasTags = Array.isArray(prodTags) && prodTags.length > 0;

      if (!hasTags) {
        console.log(`⏭️  Skipped: ${localDrink.name} (no tags in production)`);
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
    
    // Close production connection
    if (productionDb) {
      await productionDb.close();
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error during sync:', error);
    if (productionDb) {
      await productionDb.close();
    }
    process.exit(1);
  }
}

// Run the sync
syncTags();
