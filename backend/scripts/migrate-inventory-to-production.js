require('dotenv').config();
const { Client } = require('pg');
const { Sequelize } = require('sequelize');

/**
 * Migration Script: Migrate Inventory and Images from Old Cloud SQL to New Cloud SQL
 * 
 * Source: drink-suite-db (drink-suite project, lipanganya@gmail.com)
 * Target: dialadrink-db-prod (dialadrink-production project, dialadrinkkenya254@gmail.com)
 * 
 * Usage:
 *   SOURCE_DATABASE_URL="postgresql://user:pass@host/db" \
 *   TARGET_DATABASE_URL="postgresql://user:pass@host/db" \
 *   node backend/scripts/migrate-inventory-to-production.js
 */

// Get database URLs from environment
const sourceDatabaseUrl = process.env.SOURCE_DATABASE_URL;
const targetDatabaseUrl = process.env.TARGET_DATABASE_URL;

if (!sourceDatabaseUrl || !targetDatabaseUrl) {
  console.error('❌ Error: Both SOURCE_DATABASE_URL and TARGET_DATABASE_URL must be set');
  console.error('');
  console.error('Usage:');
  console.error('  SOURCE_DATABASE_URL="postgresql://user:pass@host/db" \\');
  console.error('  TARGET_DATABASE_URL="postgresql://user:pass@host/db" \\');
  console.error('  node backend/scripts/migrate-inventory-to-production.js');
  console.error('');
  console.error('Example:');
  console.error('  SOURCE_DATABASE_URL="postgresql://dialadrink_app:pass@136.111.27.173:5432/dialadrink?sslmode=require" \\');
  console.error('  TARGET_DATABASE_URL="postgresql://dialadrink_app:pass@35.223.10.1:5432/dialadrink_prod?sslmode=require" \\');
  console.error('  node backend/scripts/migrate-inventory-to-production.js');
  process.exit(1);
}

// Source database connection (old Cloud SQL)
const sourceClient = new Client({
  connectionString: sourceDatabaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

// Target database connection (new Cloud SQL)
const targetSequelize = new Sequelize(targetDatabaseUrl, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: false
});

const targetClient = new Client({
  connectionString: targetDatabaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrateInventory() {
  try {
    console.log('🚀 Starting Inventory Migration');
    console.log('================================\n');
    
    // Connect to databases
    console.log('🔌 Connecting to databases...');
    await sourceClient.connect();
    console.log('✅ Source database connected');
    
    await targetSequelize.authenticate();
    console.log('✅ Target database connected (Sequelize)');
    
    await targetClient.connect();
    console.log('✅ Target database connected (pg Client)\n');
    
    // Step 1: Migrate Categories
    console.log('📦 Step 1: Migrating categories...');
    const categoriesResult = await sourceClient.query('SELECT * FROM categories ORDER BY id');
    const categories = categoriesResult.rows;
    console.log(`   Found ${categories.length} categories`);
    
    let categoriesInserted = 0;
    let categoriesUpdated = 0;
    
    for (const cat of categories) {
      try {
        const result = await targetClient.query(`
          INSERT INTO categories (id, name, description, image, "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            image = EXCLUDED.image,
            "updatedAt" = EXCLUDED."updatedAt"
        `, [cat.id, cat.name, cat.description || null, cat.image || null, cat.createdAt, cat.updatedAt]);
        
        if (result.rowCount === 1) {
          categoriesInserted++;
        } else {
          categoriesUpdated++;
        }
      } catch (error) {
        console.error(`   ❌ Error with category ${cat.id} (${cat.name}): ${error.message}`);
      }
    }
    console.log(`   ✅ Categories: ${categoriesInserted} inserted, ${categoriesUpdated} updated\n`);
    
    // Step 2: Migrate Subcategories
    console.log('📦 Step 2: Migrating subcategories...');
    const subcatsResult = await sourceClient.query('SELECT * FROM subcategories ORDER BY id');
    const subcats = subcatsResult.rows;
    console.log(`   Found ${subcats.length} subcategories`);
    
    let subcatsInserted = 0;
    let subcatsUpdated = 0;
    
    for (const subcat of subcats) {
      try {
        const result = await targetClient.query(`
          INSERT INTO subcategories (id, name, description, "categoryId", "isActive", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            "categoryId" = EXCLUDED."categoryId",
            "isActive" = EXCLUDED."isActive",
            "updatedAt" = EXCLUDED."updatedAt"
        `, [
          subcat.id, 
          subcat.name, 
          subcat.description || null, 
          subcat.categoryId,
          subcat.isActive !== undefined ? subcat.isActive : true,
          subcat.createdAt, 
          subcat.updatedAt
        ]);
        
        if (result.rowCount === 1) {
          subcatsInserted++;
        } else {
          subcatsUpdated++;
        }
      } catch (error) {
        console.error(`   ❌ Error with subcategory ${subcat.id} (${subcat.name}): ${error.message}`);
      }
    }
    console.log(`   ✅ Subcategories: ${subcatsInserted} inserted, ${subcatsUpdated} updated\n`);
    
    // Step 3: Migrate Brands
    console.log('📦 Step 3: Migrating brands...');
    const brandsResult = await sourceClient.query('SELECT * FROM brands ORDER BY id');
    const brands = brandsResult.rows;
    console.log(`   Found ${brands.length} brands`);
    
    let brandsInserted = 0;
    let brandsUpdated = 0;
    
    for (const brand of brands) {
      try {
        const result = await targetClient.query(`
          INSERT INTO brands (id, name, description, image, "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            image = EXCLUDED.image,
            "updatedAt" = EXCLUDED."updatedAt"
        `, [brand.id, brand.name, brand.description || null, brand.image || null, brand.createdAt, brand.updatedAt]);
        
        if (result.rowCount === 1) {
          brandsInserted++;
        } else {
          brandsUpdated++;
        }
      } catch (error) {
        console.error(`   ❌ Error with brand ${brand.id} (${brand.name}): ${error.message}`);
      }
    }
    console.log(`   ✅ Brands: ${brandsInserted} inserted, ${brandsUpdated} updated\n`);
    
    // Step 4: Migrate Drinks (Inventory)
    console.log('📦 Step 4: Migrating drinks (inventory)...');
    const drinksResult = await sourceClient.query(`
      SELECT id, name, description, price, image, stock, "isAvailable", 
             "categoryId", "subCategoryId", "brandId", "isPopular", 
             "isBrandFocus", "isOnOffer", "limitedTimeOffer", "originalPrice",
             capacity, "capacityPricing", abv, barcode, "purchasePrice",
             "createdAt", "updatedAt"
      FROM drinks
      ORDER BY id
    `);
    const drinks = drinksResult.rows;
    console.log(`   Found ${drinks.length} drinks`);
    
    let drinksInserted = 0;
    let drinksUpdated = 0;
    let drinksSkipped = 0;
    
    for (const drink of drinks) {
      try {
        const result = await targetClient.query(`
          INSERT INTO drinks (
            id, name, description, price, image, stock, "isAvailable", 
            "categoryId", "subCategoryId", "brandId", "isPopular", 
            "isBrandFocus", "isOnOffer", "limitedTimeOffer", "originalPrice",
            capacity, "capacityPricing", abv, barcode, "purchasePrice",
            "createdAt", "updatedAt"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            price = EXCLUDED.price,
            image = EXCLUDED.image,
            stock = EXCLUDED.stock,
            "isAvailable" = EXCLUDED."isAvailable",
            "categoryId" = EXCLUDED."categoryId",
            "subCategoryId" = EXCLUDED."subCategoryId",
            "brandId" = EXCLUDED."brandId",
            "isPopular" = EXCLUDED."isPopular",
            "isBrandFocus" = EXCLUDED."isBrandFocus",
            "isOnOffer" = EXCLUDED."isOnOffer",
            "limitedTimeOffer" = EXCLUDED."limitedTimeOffer",
            "originalPrice" = EXCLUDED."originalPrice",
            capacity = EXCLUDED.capacity,
            "capacityPricing" = EXCLUDED."capacityPricing",
            abv = EXCLUDED.abv,
            barcode = EXCLUDED.barcode,
            "purchasePrice" = EXCLUDED."purchasePrice",
            "updatedAt" = EXCLUDED."updatedAt"
        `, [
          drink.id, drink.name, drink.description || null, drink.price, drink.image || null,
          drink.stock || 0, drink.isAvailable !== undefined ? drink.isAvailable : true,
          drink.categoryId, drink.subCategoryId || null, drink.brandId || null,
          drink.isPopular || false, drink.isBrandFocus || false,
          drink.isOnOffer || false, drink.limitedTimeOffer || false,
          drink.originalPrice || null,
          JSON.stringify(drink.capacity || []),
          JSON.stringify(drink.capacityPricing || []),
          drink.abv || null, drink.barcode || null, drink.purchasePrice || null,
          drink.createdAt, drink.updatedAt
        ]);
        
        if (result.rowCount === 1) {
          drinksInserted++;
        } else {
          drinksUpdated++;
        }
      } catch (error) {
        console.error(`   ❌ Error with drink ${drink.id} (${drink.name}): ${error.message}`);
        drinksSkipped++;
      }
    }
    console.log(`   ✅ Drinks: ${drinksInserted} inserted, ${drinksUpdated} updated, ${drinksSkipped} skipped\n`);
    
    // Step 5: Summary
    console.log('📊 Migration Summary');
    console.log('===================');
    console.log(`Categories:   ${categoriesInserted} inserted, ${categoriesUpdated} updated`);
    console.log(`Subcategories: ${subcatsInserted} inserted, ${subcatsUpdated} updated`);
    console.log(`Brands:      ${brandsInserted} inserted, ${brandsUpdated} updated`);
    console.log(`Drinks:      ${drinksInserted} inserted, ${drinksUpdated} updated, ${drinksSkipped} skipped`);
    console.log('');
    
    // Verify counts
    const [targetCategories] = await targetClient.query('SELECT COUNT(*) as count FROM categories');
    const [targetSubcats] = await targetClient.query('SELECT COUNT(*) as count FROM subcategories');
    const [targetBrands] = await targetClient.query('SELECT COUNT(*) as count FROM brands');
    const [targetDrinks] = await targetClient.query('SELECT COUNT(*) as count FROM drinks');
    
    console.log('📊 Target Database Counts:');
    console.log(`   Categories: ${targetCategories.rows[0].count}`);
    console.log(`   Subcategories: ${targetSubcats.rows[0].count}`);
    console.log(`   Brands: ${targetBrands.rows[0].count}`);
    console.log(`   Drinks: ${targetDrinks.rows[0].count}`);
    console.log('');
    
    console.log('✅ Inventory migration complete!');
    console.log('');
    console.log('📝 Note: Image URLs are preserved in the database.');
    console.log('   If images are stored in Cloud Storage, you may need to:');
    console.log('   1. Copy images from source bucket to target bucket');
    console.log('   2. Update image URLs if bucket names changed');
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    await sourceClient.end();
    await targetClient.end();
    await targetSequelize.close();
  }
}

// Run migration
migrateInventory()
  .then(() => {
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
