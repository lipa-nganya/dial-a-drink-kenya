/**
 * Import Local Inventory Export to Development Database
 * 
 * This script imports the exported local inventory data into the development database.
 * It uses the most recent export file.
 * 
 * Usage: NODE_ENV=development node backend/scripts/import-local-inventory-to-dev.js
 */

const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');

// Development database connection
const DEV_DATABASE_URL = 'postgresql://dialadrink_app:o61yqm5fLiTwWnk5@34.41.187.250:5432/dialadrink_dev';

const devSequelize = new Sequelize(DEV_DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: false
});

async function importInventory() {
  try {
    console.log('📥 Importing Local Inventory to Development Database');
    console.log('====================================================\n');
    
    // Find the most recent export file
    const exportFiles = fs.readdirSync(process.cwd())
      .filter(f => f.startsWith('local-inventory-export-') && f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(process.cwd(), f),
        time: fs.statSync(path.join(process.cwd(), f)).mtime
      }))
      .sort((a, b) => b.time - a.time);
    
    if (exportFiles.length === 0) {
      console.error('❌ No export files found. Please run sync-local-to-dev-inventory.js first.');
      process.exit(1);
    }
    
    const exportFile = exportFiles[0];
    console.log(`📄 Using export file: ${exportFile.name}\n`);
    
    // Load export data
    const exportData = JSON.parse(fs.readFileSync(exportFile.path, 'utf8'));
    
    console.log(`📊 Export contains:`);
    console.log(`   Categories: ${exportData.categories.length}`);
    console.log(`   Subcategories: ${exportData.subcategories.length}`);
    console.log(`   Brands: ${exportData.brands.length}`);
    console.log(`   Drinks: ${exportData.drinks.length}\n`);
    
    // Connect to development database
    await devSequelize.authenticate();
    console.log('✅ Connected to development database\n');
    
    // Load models
    const db = require('../models');
    // Override sequelize to use dev connection
    const originalSequelize = db.sequelize;
    db.sequelize = devSequelize;
    
    // Import in order: Categories -> Brands -> SubCategories -> Drinks
    console.log('📋 Step 1: Importing Categories...');
    let categoriesCreated = 0;
    for (const cat of exportData.categories) {
      try {
        await devSequelize.query(`
          INSERT INTO categories (id, name, description, image, "isActive", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            image = EXCLUDED.image,
            "isActive" = EXCLUDED."isActive",
            "updatedAt" = EXCLUDED."updatedAt"
        `, {
          bind: [
            cat.id,
            cat.name,
            cat.description || null,
            cat.image || null,
            cat.isActive !== undefined ? cat.isActive : true,
            cat.createdAt || new Date(),
            cat.updatedAt || new Date()
          ]
        });
        categoriesCreated++;
      } catch (error) {
        console.error(`   ❌ Error with category ${cat.id} (${cat.name}):`, error.message);
      }
    }
    console.log(`   ✅ Imported ${categoriesCreated} categories\n`);
    
    console.log('📋 Step 2: Importing Brands...');
    let brandsCreated = 0;
    for (const brand of exportData.brands) {
      try {
        await devSequelize.query(`
          INSERT INTO brands (id, name, description, image, country, "isActive", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            image = EXCLUDED.image,
            country = EXCLUDED.country,
            "isActive" = EXCLUDED."isActive",
            "updatedAt" = EXCLUDED."updatedAt"
        `, {
          bind: [
            brand.id,
            brand.name,
            brand.description || null,
            brand.image || null,
            brand.country || null,
            brand.isActive !== undefined ? brand.isActive : true,
            brand.createdAt || new Date(),
            brand.updatedAt || new Date()
          ]
        });
        brandsCreated++;
      } catch (error) {
        console.error(`   ❌ Error with brand ${brand.id} (${brand.name}):`, error.message);
      }
    }
    console.log(`   ✅ Imported ${brandsCreated} brands\n`);
    
    console.log('📋 Step 3: Importing Subcategories...');
    let subcategoriesCreated = 0;
    for (const subcat of exportData.subcategories) {
      try {
        await devSequelize.query(`
          INSERT INTO subcategories (id, name, "categoryId", "isActive", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            "categoryId" = EXCLUDED."categoryId",
            "isActive" = EXCLUDED."isActive",
            "updatedAt" = EXCLUDED."updatedAt"
        `, {
          bind: [
            subcat.id,
            subcat.name,
            subcat.categoryId,
            subcat.isActive !== undefined ? subcat.isActive : true,
            subcat.createdAt || new Date(),
            subcat.updatedAt || new Date()
          ]
        });
        subcategoriesCreated++;
      } catch (error) {
        console.error(`   ❌ Error with subcategory ${subcat.id} (${subcat.name}):`, error.message);
      }
    }
    console.log(`   ✅ Imported ${subcategoriesCreated} subcategories\n`);
    
    console.log('📋 Step 4: Importing Drinks...');
    let drinksCreated = 0;
    let drinksUpdated = 0;
    
    for (let i = 0; i < exportData.drinks.length; i++) {
      const drink = exportData.drinks[i];
      
      try {
        const capacity = drink.capacity ? JSON.stringify(drink.capacity) : null;
        const capacityPricing = drink.capacityPricing ? JSON.stringify(drink.capacityPricing) : null;
        const barcode = drink.barcode ? String(drink.barcode).substring(0, 255) : null;
        
        await devSequelize.query(`
          INSERT INTO drinks (
            id, name, description, price, image, "categoryId", "subCategoryId", "brandId",
            "isAvailable", "isPopular", "isBrandFocus", "isOnOffer", "limitedTimeOffer",
            "originalPrice", capacity, "capacityPricing", abv, barcode, stock, "purchasePrice",
            "createdAt", "updatedAt"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            price = EXCLUDED.price,
            image = EXCLUDED.image,
            "categoryId" = EXCLUDED."categoryId",
            "subCategoryId" = EXCLUDED."subCategoryId",
            "brandId" = EXCLUDED."brandId",
            "isAvailable" = EXCLUDED."isAvailable",
            "isPopular" = EXCLUDED."isPopular",
            "isBrandFocus" = EXCLUDED."isBrandFocus",
            "isOnOffer" = EXCLUDED."isOnOffer",
            "limitedTimeOffer" = EXCLUDED."limitedTimeOffer",
            "originalPrice" = EXCLUDED."originalPrice",
            capacity = EXCLUDED.capacity,
            "capacityPricing" = EXCLUDED."capacityPricing",
            abv = EXCLUDED.abv,
            barcode = EXCLUDED.barcode,
            stock = EXCLUDED.stock,
            "purchasePrice" = EXCLUDED."purchasePrice",
            "updatedAt" = EXCLUDED."updatedAt"
        `, {
          bind: [
            drink.id,
            drink.name,
            drink.description || null,
            drink.price || null,
            drink.image || null,
            drink.categoryId || null,
            drink.subCategoryId || null,
            drink.brandId || null,
            drink.isAvailable !== undefined ? drink.isAvailable : true,
            drink.isPopular || false,
            drink.isBrandFocus || false,
            drink.isOnOffer || false,
            drink.limitedTimeOffer || false,
            drink.originalPrice || null,
            capacity,
            capacityPricing,
            drink.abv || null,
            barcode,
            drink.stock !== undefined ? parseInt(drink.stock) || 0 : 0,
            drink.purchasePrice || null,
            drink.createdAt || new Date(),
            drink.updatedAt || new Date()
          ]
        });
        
        if (i < exportData.drinks.length) {
          drinksCreated++;
        } else {
          drinksUpdated++;
        }
        
        if ((i + 1) % 100 === 0) {
          console.log(`   Processed ${i + 1}/${exportData.drinks.length} drinks...`);
        }
      } catch (error) {
        console.error(`   ❌ Error importing drink ${drink.id} (${drink.name}):`, error.message);
      }
    }
    
    console.log(`   ✅ Imported ${drinksCreated} drinks, updated ${drinksUpdated} drinks\n`);
    
    // Verify counts
    const [drinksCount] = await devSequelize.query('SELECT COUNT(*) as count FROM drinks');
    const [categoriesCount] = await devSequelize.query('SELECT COUNT(*) as count FROM categories');
    const [brandsCount] = await devSequelize.query('SELECT COUNT(*) as count FROM brands');
    const [subcategoriesCount] = await devSequelize.query('SELECT COUNT(*) as count FROM subcategories');
    
    console.log('📊 Final counts in development database:');
    console.log(`   Drinks: ${drinksCount[0].count}`);
    console.log(`   Categories: ${categoriesCount[0].count}`);
    console.log(`   Subcategories: ${subcategoriesCount[0].count}`);
    console.log(`   Brands: ${brandsCount[0].count}\n`);
    
    console.log('✅ Import complete!\n');
    
    await devSequelize.close();
    
  } catch (error) {
    console.error('❌ Error importing inventory:', error);
    await devSequelize.close();
    process.exit(1);
  }
}

if (require.main === module) {
  importInventory();
}

module.exports = { importInventory };
