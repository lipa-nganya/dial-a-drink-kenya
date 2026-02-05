require('dotenv').config();
const { Sequelize } = require('sequelize');
const { Client } = require('pg');

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

// Remote database connection using pg Client directly for better SSL control
const remoteClient = new Client({
  connectionString: remoteDatabaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function restoreInventory() {
  try {
    console.log('🔌 Connecting to databases...');
    
    await localDb.authenticate();
    console.log('✅ Local database connected');
    
    await remoteClient.connect();
    console.log('✅ Remote database connected\n');
    
    // Get all drinks from remote - only select columns that exist
    console.log('📦 Fetching drinks from remote database...');
    const remoteResult = await remoteClient.query(`
      SELECT id, name, description, price, image, stock, "isAvailable", 
             "categoryId", "subCategoryId", "brandId", "isPopular", 
             "isBrandFocus", "isOnOffer", "limitedTimeOffer", "originalPrice",
             capacity, "capacityPricing", abv, barcode, "purchasePrice",
             "createdAt", "updatedAt"
      FROM drinks
      ORDER BY id
    `);
    const remoteDrinks = remoteResult.rows;
    
    console.log(`✅ Found ${remoteDrinks.length} drinks in remote database\n`);
    
    if (remoteDrinks.length === 0) {
      console.log('⚠️  No drinks found in remote database');
      return;
    }
    
    // Get existing drinks from local
    const [localDrinks] = await localDb.query('SELECT id FROM drinks');
    const localDrinkIds = new Set(localDrinks.map(d => d.id));
    
    console.log(`📝 Local database has ${localDrinks.length} drinks\n`);
    
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const drink of remoteDrinks) {
      try {
        if (localDrinkIds.has(drink.id)) {
          // Update existing drink
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
          // Insert new drink
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
        console.error(`❌ Error processing drink ${drink.id} (${drink.name}):`, error.message);
        skipped++;
      }
    }
    
    console.log('\n✅ Inventory restoration complete!');
    console.log(`   - Inserted: ${inserted} drinks`);
    console.log(`   - Updated: ${updated} drinks`);
    console.log(`   - Skipped: ${skipped} drinks`);
    console.log(`   - Total: ${remoteDrinks.length} drinks\n`);
    
    // Verify
    const [finalCount] = await localDb.query('SELECT COUNT(*) as count FROM drinks');
    console.log(`📊 Final drink count in local database: ${finalCount[0].count}`);
    
  } catch (error) {
    console.error('❌ Error restoring inventory:', error);
    throw error;
  } finally {
    await localDb.close();
    await remoteClient.end();
  }
}

restoreInventory()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
