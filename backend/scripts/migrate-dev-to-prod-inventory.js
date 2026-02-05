require('dotenv').config();
const { Client } = require('pg');

/**
 * Migrate inventory (categories, subcategories, brands, drinks)
 * from the current dev database to the production database.
 *
 * This script is similar to migrate-inventory-to-production.js but:
 * - Hard-wires SSL to rejectUnauthorized:false to avoid local cert issues
 * - Uses explicit connection params instead of connectionString
 *
 * Usage (from repo root):
 *   node backend/scripts/migrate-dev-to-prod-inventory.js
 */

// Dev (source) DB - dialadrink-db-dev
const DEV_HOST = '34.41.187.250';
const DEV_PORT = 5432;
const DEV_USER = 'dialadrink_app';
const DEV_PASSWORD = 'o61yqm5fLiTwWnk5';
const DEV_DB = 'dialadrink_dev';

// Prod (target) DB - dialadrink-db-prod
const PROD_HOST = '35.223.10.1';
const PROD_PORT = 5432;
const PROD_USER = 'dialadrink_app';
const PROD_PASSWORD = 'E7A3IIa60hFD3bkGH1XAiryvB';
const PROD_DB = 'dialadrink_prod';

const sourceClient = new Client({
  host: DEV_HOST,
  port: DEV_PORT,
  user: DEV_USER,
  password: DEV_PASSWORD,
  database: DEV_DB,
  ssl: { require: true, rejectUnauthorized: false },
});

const targetClient = new Client({
  host: PROD_HOST,
  port: PROD_PORT,
  user: PROD_USER,
  password: PROD_PASSWORD,
  database: PROD_DB,
  ssl: { require: true, rejectUnauthorized: false },
});

async function migrateFromDevToProd() {
  try {
    console.log('🚀 Starting Dev → Prod Inventory Migration');
    console.log('==========================================\n');

    console.log('🔌 Connecting to dev database (source)...');
    await sourceClient.connect();
    console.log('✅ Connected to dev database');

    console.log('🔌 Connecting to prod database (target)...');
    await targetClient.connect();
    console.log('✅ Connected to prod database\n');

    // 1. Categories
    console.log('📦 Step 1: Migrating categories from dev to prod...');
    const categoriesResult = await sourceClient.query('SELECT * FROM categories ORDER BY id');
    const categories = categoriesResult.rows;
    console.log(`   Found ${categories.length} categories in dev`);

    let categoriesInserted = 0;
    let categoriesUpdated = 0;

    for (const cat of categories) {
      try {
        const result = await targetClient.query(
          `
          INSERT INTO categories (id, name, description, image, "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            image = EXCLUDED.image,
            "updatedAt" = EXCLUDED."updatedAt"
        `,
          [cat.id, cat.name, cat.description || null, cat.image || null, cat.createdAt, cat.updatedAt],
        );

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

    // 2. Subcategories
    console.log('📦 Step 2: Migrating subcategories...');
    const subcatsResult = await sourceClient.query('SELECT * FROM subcategories ORDER BY id');
    const subcats = subcatsResult.rows;
    console.log(`   Found ${subcats.length} subcategories in dev`);

    let subcatsInserted = 0;
    let subcatsUpdated = 0;

    for (const subcat of subcats) {
      try {
        const result = await targetClient.query(
          `
          INSERT INTO subcategories (id, name, description, "categoryId", "isActive", "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            "categoryId" = EXCLUDED."categoryId",
            "isActive" = EXCLUDED."isActive",
            "updatedAt" = EXCLUDED."updatedAt"
        `,
          [
            subcat.id,
            subcat.name,
            subcat.description || null,
            subcat.categoryId,
            subcat.isActive !== undefined ? subcat.isActive : true,
            subcat.createdAt,
            subcat.updatedAt,
          ],
        );

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

    // 3. Brands
    console.log('📦 Step 3: Migrating brands...');
    const brandsResult = await sourceClient.query('SELECT * FROM brands ORDER BY id');
    const brands = brandsResult.rows;
    console.log(`   Found ${brands.length} brands in dev`);

    let brandsInserted = 0;
    let brandsUpdated = 0;

    for (const brand of brands) {
      try {
        const result = await targetClient.query(
          `
          INSERT INTO brands (id, name, description, image, "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            image = EXCLUDED.image,
            "updatedAt" = EXCLUDED."updatedAt"
        `,
          [brand.id, brand.name, brand.description || null, brand.image || null, brand.createdAt, brand.updatedAt],
        );

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

    // 4. Drinks
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
    console.log(`   Found ${drinks.length} drinks in dev`);

    let drinksInserted = 0;
    let drinksUpdated = 0;
    let drinksSkipped = 0;

    // Get list of valid subcategory IDs in prod to validate foreign keys
    const validSubcatsResult = await targetClient.query('SELECT id FROM subcategories');
    const validSubcatIds = new Set(validSubcatsResult.rows.map(row => row.id));
    console.log(`   Valid subcategory IDs in prod: ${validSubcatIds.size}`);

    for (const drink of drinks) {
      try {
        // Validate subCategoryId - set to NULL if subcategory doesn't exist in prod
        let subCategoryId = drink.subCategoryId || null;
        if (subCategoryId && !validSubcatIds.has(subCategoryId)) {
          console.log(`   ⚠️  Drink ${drink.id} (${drink.name}) has invalid subCategoryId ${subCategoryId}, setting to NULL`);
          subCategoryId = null;
        }

        const result = await targetClient.query(
          `
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
        `,
          [
            drink.id,
            drink.name,
            drink.description || null,
            drink.price,
            drink.image || null,
            drink.stock || 0,
            drink.isAvailable !== undefined ? drink.isAvailable : true,
            drink.categoryId,
            subCategoryId,
            drink.brandId || null,
            drink.isPopular || false,
            drink.isBrandFocus || false,
            drink.isOnOffer || false,
            drink.limitedTimeOffer || false,
            drink.originalPrice || null,
            JSON.stringify(drink.capacity || []),
            JSON.stringify(drink.capacityPricing || []),
            drink.abv || null,
            drink.barcode || null,
            drink.purchasePrice || null,
            drink.createdAt,
            drink.updatedAt,
          ],
        );

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

    // Summary
    console.log('📊 Dev → Prod Migration Summary');
    console.log('===============================');
    const catCount = await targetClient.query('SELECT COUNT(*) as count FROM categories');
    const subcatCount = await targetClient.query('SELECT COUNT(*) as count FROM subcategories');
    const brandCount = await targetClient.query('SELECT COUNT(*) as count FROM brands');
    const drinkCount = await targetClient.query('SELECT COUNT(*) as count FROM drinks');

    console.log(`   Categories in prod:   ${catCount.rows[0].count}`);
    console.log(`   Subcategories in prod: ${subcatCount.rows[0].count}`);
    console.log(`   Brands in prod:      ${brandCount.rows[0].count}`);
    console.log(`   Drinks in prod:      ${drinkCount.rows[0].count}`);
    console.log('');

    console.log('✅ Dev → Prod inventory migration complete!');
  } catch (error) {
    console.error('❌ Dev → Prod migration failed:', error);
    process.exit(1);
  } finally {
    await sourceClient.end().catch(() => {});
    await targetClient.end().catch(() => {});
  }
}

migrateFromDevToProd();

