/**
 * Import/Replace Inventory from JSON
 * Replaces all inventory data with data from a JSON file
 * 
 * Usage: node backend/scripts/import-inventory-from-json.js <path-to-json-file>
 * 
 * JSON Format Expected:
 * {
 *   "drinks": [
 *     {
 *       "id": 1,
 *       "name": "Product Name",
 *       "stock": 10,
 *       "price": 100.00,
 *       ... (other drink fields)
 *     }
 *   ]
 * }
 * 
 * OR simple array format:
 * [
 *   {
 *     "id": 1,
 *     "name": "Product Name",
 *     "stock": 10,
 *     ...
 *   }
 * ]
 */

const fs = require('fs');
const path = require('path');
const db = require('../models');

async function importInventory(jsonFilePath) {
  try {
    // Validate file path
    if (!jsonFilePath) {
      console.error('❌ Error: Please provide the path to the JSON file');
      console.log('\nUsage: node backend/scripts/import-inventory-from-json.js <path-to-json-file>');
      console.log('Example: node backend/scripts/import-inventory-from-json.js inventory-data.json');
      process.exit(1);
    }
    
    const fullPath = path.isAbsolute(jsonFilePath) 
      ? jsonFilePath 
      : path.join(__dirname, '..', '..', jsonFilePath);
    
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ Error: File not found: ${fullPath}`);
      process.exit(1);
    }
    
    console.log('🔌 Connecting to database...');
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful\n');
    
    // Read and parse JSON file
    console.log(`📖 Reading JSON file: ${fullPath}`);
    const fileContent = fs.readFileSync(fullPath, 'utf8');
    let jsonData;
    
    try {
      jsonData = JSON.parse(fileContent);
    } catch (parseError) {
      console.error('❌ Error: Invalid JSON file');
      console.error(`   ${parseError.message}`);
      process.exit(1);
    }
    
    // Extract drinks array (handle both formats)
    let drinks = [];
    if (Array.isArray(jsonData)) {
      drinks = jsonData;
    } else if (jsonData.drinks && Array.isArray(jsonData.drinks)) {
      drinks = jsonData.drinks;
    } else {
      console.error('❌ Error: JSON file must contain a "drinks" array or be an array of drinks');
      process.exit(1);
    }
    
    console.log(`✅ Found ${drinks.length} drinks in JSON file\n`);
    
    if (drinks.length === 0) {
      console.log('⚠️  No drinks found in JSON file. Nothing to import.');
      process.exit(0);
    }
    
    // Get existing drinks to track what will be updated vs created
    const existingDrinks = await db.Drink.findAll({
      attributes: ['id']
    });
    const existingIds = new Set(existingDrinks.map(d => d.id));
    
    console.log(`📊 Current database has ${existingDrinks.length} drinks\n`);
    console.log('🔄 Starting inventory import...\n');
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];
    
    // Process each drink
    for (let i = 0; i < drinks.length; i++) {
      const drinkData = drinks[i];
      
      try {
        // Validate required fields
        if (!drinkData.name) {
          console.warn(`⚠️  Skipping item ${i + 1}: Missing name field`);
          skipped++;
          continue;
        }
        
        // Prepare data for database
        const drinkUpdate = {
          name: drinkData.name,
          description: drinkData.description || null,
          price: drinkData.price || 0,
          image: drinkData.image || null,
          categoryId: drinkData.categoryId || null,
          subCategoryId: drinkData.subCategoryId || null,
          brandId: drinkData.brandId || null,
          isAvailable: drinkData.isAvailable !== undefined ? drinkData.isAvailable : (drinkData.stock > 0),
          isPopular: drinkData.isPopular || false,
          isBrandFocus: drinkData.isBrandFocus || false,
          isOnOffer: drinkData.isOnOffer || false,
          limitedTimeOffer: drinkData.limitedTimeOffer || false,
          originalPrice: drinkData.originalPrice || null,
          capacity: drinkData.capacity || [],
          capacityPricing: drinkData.capacityPricing || [],
          abv: drinkData.abv || null,
          barcode: drinkData.barcode ? String(drinkData.barcode) : null, // Store as string, no truncation
          stock: drinkData.stock !== undefined ? parseInt(drinkData.stock) || 0 : 0,
          purchasePrice: drinkData.purchasePrice || null
        };
        
        // Handle JSON fields
        if (typeof drinkUpdate.capacity === 'string') {
          try {
            drinkUpdate.capacity = JSON.parse(drinkUpdate.capacity);
          } catch (e) {
            drinkUpdate.capacity = [];
          }
        }
        if (typeof drinkUpdate.capacityPricing === 'string') {
          try {
            drinkUpdate.capacityPricing = JSON.parse(drinkUpdate.capacityPricing);
          } catch (e) {
            drinkUpdate.capacityPricing = [];
          }
        }
        
        // Update isAvailable based on stock if not explicitly set
        if (drinkData.isAvailable === undefined) {
          drinkUpdate.isAvailable = (drinkUpdate.stock > 0);
        }
        
        // Always create new drinks (don't use old IDs from export)
        // Let the database auto-generate new IDs
        delete drinkUpdate.id; // Remove any ID to let DB auto-generate
        await db.Drink.create(drinkUpdate);
        created++;
        if ((i + 1) % 50 === 0) {
          console.log(`   Processed ${i + 1}/${drinks.length} drinks...`);
        }
      } catch (error) {
        const errorMsg = `Error processing drink "${drinkData.name || 'Unknown'}" (index ${i + 1}): ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
        skipped++;
      }
    }
    
    console.log('\n✅ Inventory import complete!\n');
    console.log('📊 Summary:');
    console.log(`   ✅ Created: ${created} drinks`);
    console.log(`   🔄 Updated: ${updated} drinks`);
    console.log(`   ⚠️  Skipped: ${skipped} drinks`);
    console.log(`   ❌ Errors: ${errors.length}\n`);
    
    if (errors.length > 0) {
      console.log('❌ Errors encountered:');
      errors.forEach((error, idx) => {
        console.log(`   ${idx + 1}. ${error}`);
      });
      console.log('');
    }
    
    // Verify final count
    const finalCount = await db.Drink.count();
    console.log(`📊 Final drink count in database: ${finalCount}\n`);
    
    console.log('✅ Done!');
    
  } catch (error) {
    console.error('❌ Error importing inventory:', error);
    process.exit(1);
  } finally {
    await db.sequelize.close();
  }
}

// Get JSON file path from command line arguments
const jsonFilePath = process.argv[2];

// Run the script
importInventory(jsonFilePath);
