const db = require('../models');
const axios = require('axios');

/**
 * Script to fetch tags from production and sync them to local database
 * 
 * Usage:
 *   node scripts/sync-tags-from-production.js
 */

const PRODUCTION_API_URL = 'https://deliveryos-production-backend-805803410802.us-central1.run.app/api';
const PRODUCTION_LOGIN_URL = `${PRODUCTION_API_URL}/admin/auth/login`;

// Production credentials
// Try different username formats if login fails
const PRODUCTION_CREDENTIALS_OPTIONS = [
  { username: 'simonkimari@gmail.com', password: 'admin12345' },
  { username: 'simonkimari', password: 'admin12345' },
  { username: 'simon', password: 'admin12345' }
];

let authToken = null;

/**
 * Login to production API
 */
async function loginToProduction() {
  // Try each credential option
  for (let i = 0; i < PRODUCTION_CREDENTIALS_OPTIONS.length; i++) {
    const credentials = PRODUCTION_CREDENTIALS_OPTIONS[i];
    try {
      console.log(`🔐 Attempting login with username: ${credentials.username}...`);
      const response = await axios.post(PRODUCTION_LOGIN_URL, credentials);
      
      // Handle different response formats
      let token = null;
      if (response.data && response.data.token) {
        token = response.data.token;
      } else if (response.data && response.data.data && response.data.data.token) {
        token = response.data.data.token;
      }
      
      if (token) {
        authToken = token;
        console.log('✅ Successfully logged in to production');
        return true;
      } else {
        console.warn(`⚠️  Login attempt ${i + 1} failed: No token received`);
        if (i < PRODUCTION_CREDENTIALS_OPTIONS.length - 1) {
          console.log('   Trying next credential option...');
        }
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message;
      console.warn(`⚠️  Login attempt ${i + 1} failed: ${errorMsg}`);
      if (i < PRODUCTION_CREDENTIALS_OPTIONS.length - 1) {
        console.log('   Trying next credential option...');
      } else {
        console.error('\n❌ All login attempts failed.');
        console.error('\n💡 Alternative options:');
        console.error('   1. Verify credentials are correct');
        console.error('   2. Get token manually from browser:');
        console.error('      - Log in to https://www.dialadrinkkenya.com/admin/login');
        console.error('      - Open browser console (F12)');
        console.error('      - Run: localStorage.getItem("adminToken")');
        console.error('      - Use that token with: ADMIN_TOKEN="your-token" node scripts/sync-tags-from-production.js');
        console.error('   3. Or use database sync script if you have Cloud SQL access');
      }
    }
  }
  
  return false;
}

/**
 * Fetch all drinks from production API
 */
async function fetchProductionDrinks() {
  try {
    if (!authToken) {
      console.error('❌ Not authenticated. Please login first.');
      return null;
    }

    console.log('📥 Fetching drinks from production...');
    const response = await axios.get(`${PRODUCTION_API_URL}/admin/drinks`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.data && Array.isArray(response.data)) {
      console.log(`✅ Fetched ${response.data.length} drinks from production`);
      return response.data;
    } else {
      console.error('❌ Invalid response format from production API');
      return null;
    }
  } catch (error) {
    console.error('❌ Error fetching production drinks:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Match production drink to local drink
 * Tries multiple matching strategies:
 * 1. Exact ID match
 * 2. Slug match
 * 3. Name match (case-insensitive)
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
    console.log('🚀 Starting tag sync from production to local...\n');

    // Check if token is provided via environment variable
    if (process.env.ADMIN_TOKEN) {
      authToken = process.env.ADMIN_TOKEN;
      console.log('✅ Using token from ADMIN_TOKEN environment variable');
    } else {
      // Step 1: Login to production
      const loginSuccess = await loginToProduction();
      if (!loginSuccess) {
        console.error('❌ Failed to login. Exiting.');
        process.exit(1);
      }
    }

    // Step 2: Fetch production drinks
    const productionDrinks = await fetchProductionDrinks();
    if (!productionDrinks || productionDrinks.length === 0) {
      console.error('❌ No drinks fetched from production. Exiting.');
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

      // Check if tags exist in production
      const prodTags = prodDrink.tags || [];
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
    console.log(`Total production drinks: ${stats.total}`);
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
