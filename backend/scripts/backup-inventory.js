/**
 * Backup Current Inventory
 * Exports all drinks inventory data to a JSON file
 * This creates a complete backup before replacing inventory
 */

const fs = require('fs');
const path = require('path');
const db = require('../models');

async function backupInventory() {
  try {
    console.log('🔌 Connecting to database...');
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful\n');
    
    // Get all drinks with complete data including related entities
    console.log('📦 Fetching all inventory data...');
    const drinks = await db.Drink.findAll({
      include: [
        {
          model: db.Category,
          as: 'category',
          required: false,
          attributes: ['id', 'name']
        },
        {
          model: db.SubCategory,
          as: 'subCategory',
          required: false,
          attributes: ['id', 'name']
        },
        {
          model: db.Brand,
          as: 'brand',
          required: false,
          attributes: ['id', 'name']
        }
      ],
      order: [['id', 'ASC']],
      attributes: [
        'id', 'name', 'description', 'price', 'image', 
        'categoryId', 'subCategoryId', 'brandId',
        'isAvailable', 'isPopular', 'isBrandFocus', 
        'isOnOffer', 'limitedTimeOffer', 'originalPrice',
        'capacity', 'capacityPricing', 'abv', 
        'barcode', 'stock', 'purchasePrice',
        'createdAt', 'updatedAt'
      ]
    });
    
    console.log(`✅ Found ${drinks.length} drinks\n`);
    
    if (drinks.length === 0) {
      console.log('⚠️  No drinks found in database. Nothing to backup.');
      process.exit(0);
    }
    
    // Transform to JSON format
    const inventoryData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalItems: drinks.length,
        version: '1.0'
      },
      drinks: drinks.map(drink => {
        const drinkData = drink.toJSON();
        // Ensure JSON fields are properly formatted
        if (drinkData.capacity && typeof drinkData.capacity === 'string') {
          try {
            drinkData.capacity = JSON.parse(drinkData.capacity);
          } catch (e) {
            drinkData.capacity = [];
          }
        }
        if (drinkData.capacityPricing && typeof drinkData.capacityPricing === 'string') {
          try {
            drinkData.capacityPricing = JSON.parse(drinkData.capacityPricing);
          } catch (e) {
            drinkData.capacityPricing = [];
          }
        }
        return drinkData;
      })
    };
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fileName = `inventory-backup-${timestamp}.json`;
    const filePath = path.join(__dirname, '..', '..', fileName);
    
    // Write to file
    fs.writeFileSync(filePath, JSON.stringify(inventoryData, null, 2), 'utf8');
    
    console.log('✅ Inventory backup created successfully!\n');
    console.log(`📄 Backup file: ${fileName}`);
    console.log(`📁 Location: ${filePath}\n`);
    
    // Display summary
    const totalStock = drinks.reduce((sum, d) => sum + (parseInt(d.stock) || 0), 0);
    const availableCount = drinks.filter(d => d.isAvailable).length;
    const outOfStockCount = drinks.filter(d => !d.isAvailable || (parseInt(d.stock) || 0) === 0).length;
    
    console.log('📊 Inventory Summary:');
    console.log(`   Total Products: ${drinks.length}`);
    console.log(`   Total Stock Units: ${totalStock}`);
    console.log(`   Available Items: ${availableCount}`);
    console.log(`   Out of Stock Items: ${outOfStockCount}`);
    console.log(`   Items with Barcodes: ${drinks.filter(d => d.barcode).length}`);
    console.log(`   Items with Purchase Prices: ${drinks.filter(d => d.purchasePrice).length}\n`);
    
    console.log('✅ Backup complete! You can now safely replace inventory.\n');
    
  } catch (error) {
    console.error('❌ Error backing up inventory:', error);
    process.exit(1);
  } finally {
    await db.sequelize.close();
  }
}

// Run the script
backupInventory();
