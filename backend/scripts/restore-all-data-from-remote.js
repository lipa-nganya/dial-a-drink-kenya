require('dotenv').config();
const { Client } = require('pg');
const { Sequelize } = require('sequelize');

// Get remote database URL from commented line in .env
const fs = require('fs');
const envContent = fs.readFileSync('.env', 'utf8');
const remoteDbMatch = envContent.match(/#DATABASE_URL=(.+)/);
const remoteDatabaseUrl = remoteDbMatch ? remoteDbMatch[1].trim() : null;

if (!remoteDatabaseUrl) {
  console.error('❌ Could not find remote DATABASE_URL in .env');
  process.exit(1);
}

// Local database connection
const localDb = new Sequelize(process.env.DB_NAME || 'dialadrink', process.env.DB_USER || 'maria', process.env.DB_PASSWORD || '', {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  dialect: 'postgres',
  logging: false
});

// Remote database connection
const remoteClient = new Client({
  connectionString: remoteDatabaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function restoreAllData() {
  try {
    console.log('🔌 Connecting to databases...');
    
    await localDb.authenticate();
    console.log('✅ Local database connected');
    
    await remoteClient.connect();
    console.log('✅ Remote database connected\n');
    
    // Step 1: Restore Categories
    console.log('📦 Step 1: Restoring categories...');
    const categoriesResult = await remoteClient.query('SELECT * FROM categories ORDER BY id');
    const categories = categoriesResult.rows;
    console.log(`   Found ${categories.length} categories`);
    
    for (const cat of categories) {
      try {
        await localDb.query(`
          INSERT INTO categories (id, name, description, image, "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            image = EXCLUDED.image,
            "updatedAt" = EXCLUDED."updatedAt"
        `, {
          bind: [cat.id, cat.name, cat.description, cat.image, cat.createdAt, cat.updatedAt]
        });
      } catch (error) {
        console.error(`   ❌ Error with category ${cat.id}: ${error.message}`);
      }
    }
    console.log(`   ✅ Categories restored\n`);
    
    // Step 2: Restore Subcategories
    console.log('📦 Step 2: Restoring subcategories...');
    const subcatsResult = await remoteClient.query('SELECT * FROM subcategories ORDER BY id');
    const subcats = subcatsResult.rows;
    console.log(`   Found ${subcats.length} subcategories`);
    
    for (const subcat of subcats) {
      try {
        await localDb.query(`
          INSERT INTO subcategories (id, name, description, "categoryId", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            "categoryId" = EXCLUDED."categoryId",
            "updatedAt" = EXCLUDED."updatedAt"
        `, {
          bind: [subcat.id, subcat.name, subcat.description || null, subcat.categoryId, subcat.createdAt, subcat.updatedAt]
        });
      } catch (error) {
        console.error(`   ❌ Error with subcategory ${subcat.id}: ${error.message}`);
      }
    }
    console.log(`   ✅ Subcategories restored\n`);
    
    // Step 3: Restore Brands
    console.log('📦 Step 3: Restoring brands...');
    const brandsResult = await remoteClient.query('SELECT * FROM brands ORDER BY id');
    const brands = brandsResult.rows;
    console.log(`   Found ${brands.length} brands`);
    
    for (const brand of brands) {
      try {
        await localDb.query(`
          INSERT INTO brands (id, name, description, image, country, "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            image = EXCLUDED.image,
            country = EXCLUDED.country,
            "updatedAt" = EXCLUDED."updatedAt"
        `, {
          bind: [brand.id, brand.name, brand.description, brand.image, brand.country, brand.createdAt, brand.updatedAt]
        });
      } catch (error) {
        console.error(`   ❌ Error with brand ${brand.id}: ${error.message}`);
      }
    }
    console.log(`   ✅ Brands restored\n`);
    
    // Step 4: Restore Drinks (with stock/inventory)
    console.log('📦 Step 4: Restoring drinks with inventory...');
    const drinksResult = await remoteClient.query(`
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
    
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const drink of drinks) {
      try {
        const [existing] = await localDb.query('SELECT id FROM drinks WHERE id = $1', {
          bind: [drink.id]
        });
        
        if (existing.length > 0) {
          // Update existing
          await localDb.query(`
            UPDATE drinks 
            SET name = $1, description = $2, price = $3, image = $4, stock = $5,
                "isAvailable" = $6, "categoryId" = $7, "subCategoryId" = $8,
                "brandId" = $9, "isPopular" = $10, "isBrandFocus" = $11,
                "isOnOffer" = $12, "limitedTimeOffer" = $13, "originalPrice" = $14,
                capacity = $15, "capacityPricing" = $16, abv = $17, barcode = $18,
                "purchasePrice" = $19, "updatedAt" = $20
            WHERE id = $21
          `, {
            bind: [
              drink.name, drink.description, drink.price, drink.image, drink.stock,
              drink.isAvailable, drink.categoryId, drink.subCategoryId,
              drink.brandId, drink.isPopular, drink.isBrandFocus,
              drink.isOnOffer, drink.limitedTimeOffer, drink.originalPrice,
              JSON.stringify(drink.capacity || []), JSON.stringify(drink.capacityPricing || []),
              drink.abv, drink.barcode, drink.purchasePrice, drink.updatedAt, drink.id
            ]
          });
          updated++;
        } else {
          // Insert new
          await localDb.query(`
            INSERT INTO drinks (id, name, description, price, image, stock, 
                              "isAvailable", "categoryId", "subCategoryId", "brandId",
                              "isPopular", "isBrandFocus", "isOnOffer", "limitedTimeOffer",
                              "originalPrice", capacity, "capacityPricing", abv, barcode,
                              "purchasePrice", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
          `, {
            bind: [
              drink.id, drink.name, drink.description, drink.price, drink.image, drink.stock,
              drink.isAvailable, drink.categoryId, drink.subCategoryId, drink.brandId,
              drink.isPopular, drink.isBrandFocus, drink.isOnOffer, drink.limitedTimeOffer,
              drink.originalPrice, JSON.stringify(drink.capacity || []), JSON.stringify(drink.capacityPricing || []),
              drink.abv, drink.barcode, drink.purchasePrice, drink.createdAt, drink.updatedAt
            ]
          });
          inserted++;
        }
      } catch (error) {
        if (error.message.includes('foreign key constraint')) {
          skipped++;
        } else {
          console.error(`   ❌ Error processing drink ${drink.id} (${drink.name}): ${error.message}`);
          skipped++;
        }
      }
    }
    
    console.log(`   ✅ Drinks restored: ${inserted} inserted, ${updated} updated, ${skipped} skipped\n`);
    
    // Summary
    const [finalCounts] = await localDb.query(`
      SELECT 
        (SELECT COUNT(*) FROM categories) as categories,
        (SELECT COUNT(*) FROM subcategories) as subcategories,
        (SELECT COUNT(*) FROM brands) as brands,
        (SELECT COUNT(*) FROM drinks) as drinks,
        (SELECT SUM(stock) FROM drinks) as total_stock
    `);
    
    console.log('✅ Data restoration complete!');
    console.log(`   - Categories: ${finalCounts[0].categories}`);
    console.log(`   - Subcategories: ${finalCounts[0].subcategories}`);
    console.log(`   - Brands: ${finalCounts[0].brands}`);
    console.log(`   - Drinks: ${finalCounts[0].drinks}`);
    console.log(`   - Total stock: ${finalCounts[0].total_stock || 0} units\n`);
    
  } catch (error) {
    console.error('❌ Error restoring data:', error);
    throw error;
  } finally {
    await localDb.close();
    await remoteClient.end();
  }
}

restoreAllData()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
