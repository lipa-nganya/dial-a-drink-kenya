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

async function restoreTable(tableName, orderBy = 'id') {
  try {
    // Get all columns from remote table
    const columnsResult = await remoteClient.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    
    if (columnsResult.rows.length === 0) {
      console.log(`   ⚠️  Table ${tableName} not found in remote database`);
      return { inserted: 0, updated: 0, skipped: 0 };
    }
    
    const columns = columnsResult.rows.map(row => row.column_name);
    const colNames = columns.map(col => `"${col}"`).join(', ');
    
    // Get data from remote
    const result = await remoteClient.query(`SELECT * FROM ${tableName} ORDER BY ${orderBy}`);
    const rows = result.rows;
    
    if (rows.length === 0) {
      console.log(`   ⚠️  No data found in ${tableName}`);
      return { inserted: 0, updated: 0, skipped: 0 };
    }
    
    console.log(`   Found ${rows.length} records`);
    
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const row of rows) {
      try {
        // Build values array, handling nulls and JSON
        const values = columns.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return null;
          if (val && typeof val === 'object' && !(val instanceof Date)) {
            return JSON.stringify(val);
          }
          return val;
        });
        
        const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
        
        // Check if record exists (using id or first column as key)
        const keyCol = columns[0]; // Usually 'id'
        const [existing] = await localDb.query(`SELECT ${keyCol} FROM ${tableName} WHERE ${keyCol} = $1`, {
          bind: [row[keyCol]]
        });
        
        if (existing.length > 0) {
          // Update existing - exclude id and createdAt from update
          const updateCols = columns
            .filter(col => col !== keyCol && col !== 'createdAt')
            .map((col, idx) => {
              const colIdx = columns.indexOf(col);
              return `"${col}" = $${colIdx + 1}`;
            })
            .join(', ');
          
          await localDb.query(`
            UPDATE ${tableName} 
            SET ${updateCols}
            WHERE ${keyCol} = $1
          `, {
            bind: [row[keyCol], ...values.slice(1).filter((_, idx) => columns[idx + 1] !== 'createdAt')]
          });
          updated++;
        } else {
          // Insert new
          await localDb.query(`
            INSERT INTO ${tableName} (${colNames})
            VALUES (${placeholders})
          `, {
            bind: values
          });
          inserted++;
        }
      } catch (error) {
        if (error.message.includes('foreign key constraint')) {
          skipped++;
        } else {
          console.error(`   ❌ Error with ${tableName} ${columns[0]} ${row[columns[0]]}: ${error.message.substring(0, 100)}`);
          skipped++;
        }
      }
    }
    
    return { inserted, updated, skipped };
  } catch (error) {
    console.error(`   ❌ Error restoring ${tableName}: ${error.message}`);
    return { inserted: 0, updated: 0, skipped: 0 };
  }
}

async function restoreAllData() {
  try {
    console.log('🔌 Connecting to databases...');
    
    await localDb.authenticate();
    console.log('✅ Local database connected');
    
    await remoteClient.connect();
    console.log('✅ Remote database connected\n');
    
    const results = {};
    
    // Restore in dependency order
    console.log('📦 Restoring all data...\n');
    
    const tables = [
      'categories',
      'subcategories', 
      'brands',
      'admins',
      'customers',
      'drivers',
      'admin_wallets',
      'driver_wallets',
      'branches',
      'suppliers',
      'settings',
      'cash_submissions',
      'orders',
      'order_items',
      'transactions',
      'notifications',
      'saved_addresses'
    ];
    
    for (const table of tables) {
      console.log(`   ${table}...`);
      results[table] = await restoreTable(table);
      const total = results[table].inserted + results[table].updated;
      console.log(`   ✅ ${table}: ${results[table].inserted} inserted, ${results[table].updated} updated, ${results[table].skipped} skipped\n`);
    }
    
    // Special handling for drinks (with JSON columns)
    console.log('   drinks (with inventory)...');
    const drinksResult = await remoteClient.query(`
      SELECT * FROM drinks ORDER BY id
    `);
    const drinks = drinksResult.rows;
    console.log(`   Found ${drinks.length} drinks`);
    
    let drinksInserted = 0;
    let drinksUpdated = 0;
    let drinksSkipped = 0;
    
    for (const drink of drinks) {
      try {
        const [existing] = await localDb.query('SELECT id FROM drinks WHERE id = $1', {
          bind: [drink.id]
        });
        
        if (existing.length > 0) {
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
          drinksUpdated++;
        } else {
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
          drinksInserted++;
        }
      } catch (error) {
        drinksSkipped++;
      }
    }
    results.drinks = { inserted: drinksInserted, updated: drinksUpdated, skipped: drinksSkipped };
    console.log(`   ✅ drinks: ${drinksInserted} inserted, ${drinksUpdated} updated, ${drinksSkipped} skipped\n`);
    
    // Summary
    console.log('\n✅ Complete data restoration finished!\n');
    console.log('📊 Summary:');
    for (const [table, result] of Object.entries(results)) {
      const total = result.inserted + result.updated;
      if (total > 0) {
        console.log(`   ${table}: ${total} records (${result.inserted} new, ${result.updated} updated)`);
      }
    }
    console.log('');
    
    // Final counts
    const [finalCounts] = await localDb.query(`
      SELECT 
        (SELECT COUNT(*) FROM categories) as categories,
        (SELECT COUNT(*) FROM subcategories) as subcategories,
        (SELECT COUNT(*) FROM brands) as brands,
        (SELECT COUNT(*) FROM drinks) as drinks,
        (SELECT COUNT(*) FROM customers) as customers,
        (SELECT COUNT(*) FROM drivers) as drivers,
        (SELECT COUNT(*) FROM orders) as orders,
        (SELECT COUNT(*) FROM transactions) as transactions,
        (SELECT COUNT(*) FROM cash_submissions) as cash_submissions,
        (SELECT SUM(stock) FROM drinks) as total_stock
    `);
    
    console.log('📊 Final Database Counts:');
    console.log(`   Categories: ${finalCounts[0].categories}`);
    console.log(`   Subcategories: ${finalCounts[0].subcategories}`);
    console.log(`   Brands: ${finalCounts[0].brands}`);
    console.log(`   Drinks: ${finalCounts[0].drinks}`);
    console.log(`   Customers: ${finalCounts[0].customers}`);
    console.log(`   Drivers: ${finalCounts[0].drivers}`);
    console.log(`   Orders: ${finalCounts[0].orders}`);
    console.log(`   Transactions: ${finalCounts[0].transactions}`);
    console.log(`   Cash Submissions: ${finalCounts[0].cash_submissions}`);
    console.log(`   Total Stock: ${finalCounts[0].total_stock || 0} units\n`);
    
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
