/**
 * Import territories into local, development, and production databases
 * 
 * Usage:
 *   NODE_ENV=development node backend/scripts/import-territories-to-all-envs.js
 *   NODE_ENV=cloud-dev node backend/scripts/import-territories-to-all-envs.js
 *   NODE_ENV=production node backend/scripts/import-territories-to-all-envs.js
 * 
 * Or run all three:
 *   node backend/scripts/import-territories-to-all-envs.js --all
 */

const fs = require('fs');
const path = require('path');
const { importTerritories } = require('./import-territories-from-website');

// Load territories data from JSON file
function loadTerritoriesFromFile() {
  const territoriesFile = path.join(__dirname, 'territories-data.json');
  
  if (!fs.existsSync(territoriesFile)) {
    console.error('❌ territories-data.json not found. Please run import-territories-from-website.js first to generate it.');
    process.exit(1);
  }
  
  const data = fs.readFileSync(territoriesFile, 'utf8');
  return JSON.parse(data);
}

// Save territories to JSON file
function saveTerritoriesToFile(territories) {
  const territoriesFile = path.join(__dirname, 'territories-data.json');
  fs.writeFileSync(territoriesFile, JSON.stringify(territories, null, 2));
  console.log(`💾 Saved ${territories.length} territories to ${territoriesFile}`);
}

async function importToEnvironment(envName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 Importing territories to ${envName.toUpperCase()} database`);
  console.log(`${'='.repeat(60)}\n`);
  
  // Store original NODE_ENV
  const originalNodeEnv = process.env.NODE_ENV;
  
  // Set environment for this import
  process.env.NODE_ENV = envName;
  
  // Clear the models cache to force reload with new environment
  delete require.cache[require.resolve('../models')];
  delete require.cache[require.resolve('../models/index')];
  
  // Load database models with the correct environment
  const db = require('../models');
  
  try {
    // Connect to database
    await db.sequelize.authenticate();
    console.log(`✅ Connected to ${envName} database\n`);
    
    // Load territories
    const territories = loadTerritoriesFromFile();
    console.log(`📋 Loaded ${territories.length} territories from file\n`);
    
    // Import territories
    let imported = 0;
    let updated = 0;
    let errors = 0;
    
    for (const territory of territories) {
      try {
        // Check if territory already exists
        const [territoryRecord, created] = await db.Territory.findOrCreate({
          where: { name: territory.name.trim() },
          defaults: {
            name: territory.name.trim(),
            deliveryFromCBD: territory.deliveryFromCBD || 0,
            deliveryFromRuaka: territory.deliveryFromRuaka || 0
          }
        });
        
        if (created) {
          console.log(`✅ Created: ${territory.name} (CBD: ${territory.deliveryFromCBD}, Ruaka: ${territory.deliveryFromRuaka})`);
          imported++;
        } else {
          // Update existing territory
          territoryRecord.deliveryFromCBD = territory.deliveryFromCBD || 0;
          territoryRecord.deliveryFromRuaka = territory.deliveryFromRuaka || 0;
          await territoryRecord.save();
          console.log(`🔄 Updated: ${territory.name} (CBD: ${territory.deliveryFromCBD}, Ruaka: ${territory.deliveryFromRuaka})`);
          updated++;
        }
      } catch (error) {
        console.error(`❌ Error importing ${territory.name}:`, error.message);
        errors++;
      }
    }
    
    console.log(`\n📊 ${envName.toUpperCase()} Import Summary:`);
    console.log(`   ✅ Created: ${imported}`);
    console.log(`   🔄 Updated: ${updated}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📦 Total: ${territories.length}`);
    
    // Close database connection
    await db.sequelize.close();
    
    // Restore original NODE_ENV
    if (originalNodeEnv) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
    
    return { imported, updated, errors, total: territories.length };
    
  } catch (error) {
    console.error(`\n❌ Error importing to ${envName}:`, error);
    try {
      await db.sequelize.close();
    } catch (e) {
      // Ignore close errors
    }
    // Restore original NODE_ENV
    if (originalNodeEnv) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const importAll = args.includes('--all');
  
  try {
    // First, check if territories data file exists, if not, scrape it
    const territoriesFile = path.join(__dirname, 'territories-data.json');
    
    if (!fs.existsSync(territoriesFile)) {
      console.log('📋 Territories data file not found. Scraping from website...\n');
      const { scrapeTerritories } = require('./import-territories-from-website');
      const territories = await scrapeTerritories();
      
      if (territories.length === 0) {
        console.error('❌ No territories found. Please check the scraping script.');
        process.exit(1);
      }
      
      saveTerritoriesToFile(territories);
    }
    
    if (importAll) {
      // Import to all environments
      console.log('🚀 Importing territories to ALL environments...\n');
      
      const results = {
        development: null,
        'cloud-dev': null,
        production: null
      };
      
      // Import to local/development
      try {
        results.development = await importToEnvironment('development');
      } catch (error) {
        console.error('❌ Failed to import to development:', error.message);
      }
      
      // Import to cloud-dev
      try {
        results['cloud-dev'] = await importToEnvironment('cloud-dev');
      } catch (error) {
        console.error('❌ Failed to import to cloud-dev:', error.message);
      }
      
      // Import to production
      try {
        results.production = await importToEnvironment('production');
      } catch (error) {
        console.error('❌ Failed to import to production:', error.message);
      }
      
      // Summary
      console.log(`\n${'='.repeat(60)}`);
      console.log('📊 FINAL SUMMARY');
      console.log(`${'='.repeat(60)}\n`);
      
      for (const [env, result] of Object.entries(results)) {
        if (result) {
          console.log(`${env.toUpperCase()}:`);
          console.log(`   ✅ Created: ${result.imported}`);
          console.log(`   🔄 Updated: ${result.updated}`);
          console.log(`   ❌ Errors: ${result.errors}`);
          console.log(`   📦 Total: ${result.total}\n`);
        } else {
          console.log(`${env.toUpperCase()}: ❌ Failed\n`);
        }
      }
      
    } else {
      // Import to current environment (from NODE_ENV or default to development)
      const env = process.env.NODE_ENV || 'development';
      await importToEnvironment(env);
    }
    
    console.log('\n✅ Import complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { importToEnvironment, loadTerritoriesFromFile, saveTerritoriesToFile };
