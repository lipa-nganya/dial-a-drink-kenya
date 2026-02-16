/**
 * Copy Inventory from Local to Production Database (Node.js)
 * Handles invalid prices and other data issues
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { Sequelize } = require('sequelize');

// Local database
const localConfig = require('../config').development;
const localSequelize = new Sequelize(
  localConfig.database,
  localConfig.username,
  localConfig.password,
  {
    host: localConfig.host,
    port: localConfig.port,
    dialect: 'postgres',
    logging: false
  }
);

// Production database
const PROD_DB_URL = 'postgresql://dialadrink_app:E7A3IIa60hFD3bkGH1XAiryvB@35.223.10.1:5432/dialadrink_prod';
const prodSequelize = new Sequelize(PROD_DB_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: false
});

async function copyInventory() {
  try {
    console.log('🚀 Copying Inventory from Local to Production');
    console.log('==============================================\n');
    
    // Connect to databases
    await localSequelize.authenticate();
    console.log('✅ Connected to local database');
    
    await prodSequelize.authenticate();
    console.log('✅ Connected to production database\n');
    
    // Step 1: Clear production
    console.log('🗑️  Clearing production database...');
    await prodSequelize.query('DELETE FROM inventory_checks');
    await prodSequelize.query('DELETE FROM order_items');
    await prodSequelize.query('DELETE FROM drinks');
    await prodSequelize.query('DELETE FROM subcategories');
    await prodSequelize.query('DELETE FROM categories');
    await prodSequelize.query('DELETE FROM brands');
    await prodSequelize.query('ALTER SEQUENCE IF EXISTS drinks_id_seq RESTART WITH 1');
    await prodSequelize.query('ALTER SEQUENCE IF EXISTS categories_id_seq RESTART WITH 1');
    await prodSequelize.query('ALTER SEQUENCE IF EXISTS subcategories_id_seq RESTART WITH 1');
    await prodSequelize.query('ALTER SEQUENCE IF EXISTS brands_id_seq RESTART WITH 1');
    console.log('   ✅ Production cleared\n');
    
    // Step 2: Export from local
    console.log('📦 Exporting from local database...');
    const categories = await localSequelize.query('SELECT * FROM categories ORDER BY id', {
      type: localSequelize.QueryTypes.SELECT
    });
    const subcategories = await localSequelize.query('SELECT * FROM subcategories ORDER BY id', {
      type: localSequelize.QueryTypes.SELECT
    });
    const brands = await localSequelize.query('SELECT * FROM brands ORDER BY id', {
      type: localSequelize.QueryTypes.SELECT
    });
    const drinks = await localSequelize.query('SELECT * FROM drinks ORDER BY id', {
      type: localSequelize.QueryTypes.SELECT
    });
    
    console.log(`   Found: ${categories.length} categories, ${subcategories.length} subcategories, ${brands.length} brands, ${drinks.length} drinks\n`);
    
    // Step 3: Import to production
    console.log('📥 Importing to production database...');
    
    // Import categories
    console.log('   Importing categories...');
    for (const cat of categories) {
      await prodSequelize.query(`
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
    }
    console.log(`   ✅ Imported ${categories.length} categories`);
    
    // Import brands
    console.log('   Importing brands...');
    for (const brand of brands) {
      await prodSequelize.query(`
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
    }
    console.log(`   ✅ Imported ${brands.length} brands`);
    
    // Import subcategories
    console.log('   Importing subcategories...');
    for (const subcat of subcategories) {
      await prodSequelize.query(`
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
    }
    console.log(`   ✅ Imported ${subcategories.length} subcategories`);
    
    // Import drinks (with price validation)
    console.log('   Importing drinks...');
    let drinksImported = 0;
    let drinksSkipped = 0;
    
    for (let i = 0; i < drinks.length; i++) {
      const drink = drinks[i];
      
      try {
        // Validate and fix price
        let price = drink.price;
        if (price && (parseFloat(price) > 99999999.99 || parseFloat(price) < -99999999.99)) {
          console.log(`   ⚠️  Skipping drink ${drink.id} (${drink.name}): Invalid price ${price}`);
          drinksSkipped++;
          continue;
        }
        
        // Validate capacity and capacityPricing JSON
        let capacity = drink.capacity;
        let capacityPricing = drink.capacityPricing;
        
        if (typeof capacity === 'string') {
          try {
            capacity = JSON.parse(capacity);
          } catch (e) {
            capacity = null;
          }
        }
        
        if (typeof capacityPricing === 'string') {
          try {
            capacityPricing = JSON.parse(capacityPricing);
          } catch (e) {
            capacityPricing = null;
          }
        }
        
        await prodSequelize.query(`
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
            price || null,
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
            capacity ? JSON.stringify(capacity) : null,
            capacityPricing ? JSON.stringify(capacityPricing) : null,
            drink.abv || null,
            drink.barcode ? String(drink.barcode).substring(0, 255) : null,
            drink.stock !== undefined ? parseInt(drink.stock) || 0 : 0,
            drink.purchasePrice || null,
            drink.createdAt || new Date(),
            drink.updatedAt || new Date()
          ]
        });
        
        drinksImported++;
        
        if ((i + 1) % 100 === 0) {
          console.log(`      Processed ${i + 1}/${drinks.length} drinks...`);
        }
      } catch (error) {
        console.error(`   ❌ Error importing drink ${drink.id} (${drink.name}):`, error.message);
        drinksSkipped++;
      }
    }
    
    console.log(`   ✅ Imported ${drinksImported} drinks, skipped ${drinksSkipped} drinks\n`);
    
    // Verify counts
    const [drinksCount] = await prodSequelize.query('SELECT COUNT(*) as count FROM drinks');
    const [categoriesCount] = await prodSequelize.query('SELECT COUNT(*) as count FROM categories');
    const [brandsCount] = await prodSequelize.query('SELECT COUNT(*) as count FROM brands');
    const [subcategoriesCount] = await prodSequelize.query('SELECT COUNT(*) as count FROM subcategories');
    
    console.log('📊 Final counts in production database:');
    console.log(`   Drinks: ${drinksCount[0].count}`);
    console.log(`   Categories: ${categoriesCount[0].count}`);
    console.log(`   Subcategories: ${subcategoriesCount[0].count}`);
    console.log(`   Brands: ${brandsCount[0].count}\n`);
    
    console.log('✅ Inventory copy complete!\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await localSequelize.close();
    await prodSequelize.close();
  }
}

if (require.main === module) {
  copyInventory()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Copy failed:', error);
      process.exit(1);
    });
}

module.exports = { copyInventory };
