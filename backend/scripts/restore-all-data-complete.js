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

async function restoreTable(tableName, columns, orderBy = 'id', skipForeignKeys = false) {
  try {
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
        // Build column list and values
        const colNames = columns.map((col, idx) => `"${col}"`).join(', ');
        const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
        const values = columns.map(col => {
          const val = row[col];
          // Handle JSON columns
          if (val && typeof val === 'object' && !(val instanceof Date)) {
            return JSON.stringify(val);
          }
          return val;
        });
        
        // Check if record exists
        const [existing] = await localDb.query(`SELECT id FROM ${tableName} WHERE id = $1`, {
          bind: [row.id]
        });
        
        if (existing.length > 0) {
          // Update existing
          const updateCols = columns.filter(col => col !== 'id' && col !== 'createdAt').map((col, idx) => `"${col}" = $${idx + 2}`).join(', ');
          await localDb.query(`
            UPDATE ${tableName} 
            SET ${updateCols}
            WHERE id = $1
          `, {
            bind: [row.id, ...values.slice(1)]
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
        if (error.message.includes('foreign key constraint') && !skipForeignKeys) {
          skipped++;
        } else {
          console.error(`   ❌ Error with ${tableName} id ${row.id}: ${error.message}`);
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
    
    // 1. Basic reference data
    console.log('📦 Restoring basic reference data...\n');
    
    console.log('   Categories...');
    results.categories = await restoreTable('categories', ['id', 'name', 'description', 'image', 'createdAt', 'updatedAt']);
    console.log(`   ✅ Categories: ${results.categories.inserted} inserted, ${results.categories.updated} updated\n`);
    
    console.log('   Subcategories...');
    results.subcategories = await restoreTable('subcategories', ['id', 'name', 'description', 'categoryId', 'createdAt', 'updatedAt']);
    console.log(`   ✅ Subcategories: ${results.subcategories.inserted} inserted, ${results.subcategories.updated} updated\n`);
    
    console.log('   Brands...');
    results.brands = await restoreTable('brands', ['id', 'name', 'description', 'image', 'country', 'createdAt', 'updatedAt']);
    console.log(`   ✅ Brands: ${results.brands.inserted} inserted, ${results.brands.updated} updated\n`);
    
    // 2. Users and accounts
    console.log('📦 Restoring users and accounts...\n');
    
    console.log('   Admins...');
    results.admins = await restoreTable('admins', ['id', 'username', 'email', 'password', 'role', 'pinHash', 'hasSetPin', 'createdAt', 'updatedAt'], 'id', true);
    console.log(`   ✅ Admins: ${results.admins.inserted} inserted, ${results.admins.updated} updated\n`);
    
    console.log('   Customers...');
    results.customers = await restoreTable('customers', ['id', 'username', 'email', 'phone', 'password', 'hasSetPassword', 'customerName', 'createdAt', 'updatedAt'], 'id', true);
    console.log(`   ✅ Customers: ${results.customers.inserted} inserted, ${results.customers.updated} updated\n`);
    
    console.log('   Drivers...');
    results.drivers = await restoreTable('drivers', ['id', 'name', 'phoneNumber', 'status', 'pinHash', 'pushToken', 'lastActivity', 'valkyrieEligible', 'cashAtHand', 'creditLimit', 'locationLatitude', 'locationLongitude', 'createdAt', 'updatedAt'], 'id', true);
    console.log(`   ✅ Drivers: ${results.drivers.inserted} inserted, ${results.drivers.updated} updated\n`);
    
    // 3. Wallets
    console.log('📦 Restoring wallets...\n');
    
    console.log('   Admin Wallets...');
    results.adminWallets = await restoreTable('admin_wallets', ['id', 'balance', 'totalRevenue', 'totalOrders', 'cashAtHand', 'createdAt', 'updatedAt'], 'id', true);
    console.log(`   ✅ Admin Wallets: ${results.adminWallets.inserted} inserted, ${results.adminWallets.updated} updated\n`);
    
    console.log('   Driver Wallets...');
    results.driverWallets = await restoreTable('driver_wallets', ['id', 'driverId', 'balance', 'totalTipsReceived', 'totalTipsCount', 'totalDeliveryPay', 'totalDeliveryPayCount', 'savings', 'createdAt', 'updatedAt'], 'id', true);
    console.log(`   ✅ Driver Wallets: ${results.driverWallets.inserted} inserted, ${results.driverWallets.updated} updated\n`);
    
    // 4. Products
    console.log('📦 Restoring products...\n');
    
    console.log('   Drinks (with inventory)...');
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
    console.log(`   ✅ Drinks: ${drinksInserted} inserted, ${drinksUpdated} updated, ${drinksSkipped} skipped\n`);
    
    // 5. Orders and transactions
    console.log('📦 Restoring orders and transactions...\n');
    
    console.log('   Orders...');
    results.orders = await restoreTable('orders', [
      'id', 'customerName', 'customerPhone', 'customerEmail', 'deliveryAddress',
      'status', 'paymentStatus', 'paymentType', 'paymentMethod', 'totalAmount',
      'tipAmount', 'driverId', 'driverAccepted', 'transactionCode', 'transactionDate',
      'branchId', 'cancellationRequested', 'cancellationReason', 'cancellationApproved',
      'trackingToken', 'createdAt', 'updatedAt'
    ], 'id', true);
    console.log(`   ✅ Orders: ${results.orders.inserted} inserted, ${results.orders.updated} updated\n`);
    
    console.log('   Order Items...');
    results.orderItems = await restoreTable('order_items', [
      'id', 'orderId', 'drinkId', 'quantity', 'price', 'createdAt', 'updatedAt'
    ], 'id', true);
    console.log(`   ✅ Order Items: ${results.orderItems.inserted} inserted, ${results.orderItems.updated} updated\n`);
    
    console.log('   Transactions...');
    results.transactions = await restoreTable('transactions', [
      'id', 'orderId', 'driverId', 'driverWalletId', 'transactionType',
      'paymentMethod', 'paymentProvider', 'amount', 'status', 'paymentStatus',
      'receiptNumber', 'checkoutRequestID', 'merchantRequestID', 'phoneNumber',
      'transactionDate', 'notes', 'createdAt', 'updatedAt'
    ], 'id', true);
    console.log(`   ✅ Transactions: ${results.transactions.inserted} inserted, ${results.transactions.updated} updated\n`);
    
    // 6. Cash submissions
    console.log('📦 Restoring cash submissions...\n');
    
    console.log('   Cash Submissions...');
    results.cashSubmissions = await restoreTable('cash_submissions', [
      'id', 'driverId', 'amount', 'submissionType', 'status', 'details',
      'approvedBy', 'approvedAt', 'rejectedBy', 'rejectedAt', 'rejectionReason',
      'createdAt', 'updatedAt'
    ], 'id', true);
    console.log(`   ✅ Cash Submissions: ${results.cashSubmissions.inserted} inserted, ${results.cashSubmissions.updated} updated\n`);
    
    console.log('   Cash Submission Orders...');
    results.cashSubmissionOrders = await restoreTable('cash_submission_orders', [
      'id', 'submissionId', 'orderId', 'createdAt', 'updatedAt'
    ], 'id', true);
    console.log(`   ✅ Cash Submission Orders: ${results.cashSubmissionOrders.inserted} inserted, ${results.cashSubmissionOrders.updated} updated\n`);
    
    // 7. Other data
    console.log('📦 Restoring other data...\n');
    
    console.log('   Branches...');
    results.branches = await restoreTable('branches', ['id', 'name', 'address', 'phone', 'createdAt', 'updatedAt'], 'id', true);
    console.log(`   ✅ Branches: ${results.branches.inserted} inserted, ${results.branches.updated} updated\n`);
    
    console.log('   Suppliers...');
    results.suppliers = await restoreTable('suppliers', ['id', 'name', 'contact', 'phone', 'email', 'createdAt', 'updatedAt'], 'id', true);
    console.log(`   ✅ Suppliers: ${results.suppliers.inserted} inserted, ${results.suppliers.updated} updated\n`);
    
    console.log('   Supplier Transactions...');
    results.supplierTransactions = await restoreTable('supplier_transactions', [
      'id', 'supplierId', 'amount', 'transactionType', 'description', 'createdAt', 'updatedAt'
    ], 'id', true);
    console.log(`   ✅ Supplier Transactions: ${results.supplierTransactions.inserted} inserted, ${results.supplierTransactions.updated} updated\n`);
    
    console.log('   Settings...');
    results.settings = await restoreTable('settings', ['id', 'key', 'value', 'createdAt', 'updatedAt'], 'id', true);
    console.log(`   ✅ Settings: ${results.settings.inserted} inserted, ${results.settings.updated} updated\n`);
    
    // Summary
    console.log('\n✅ Complete data restoration finished!\n');
    console.log('📊 Summary:');
    console.log(`   Categories: ${results.categories.inserted + results.categories.updated}`);
    console.log(`   Subcategories: ${results.subcategories.inserted + results.subcategories.updated}`);
    console.log(`   Brands: ${results.brands.inserted + results.brands.updated}`);
    console.log(`   Drinks: ${results.drinks.inserted + results.drinks.updated}`);
    console.log(`   Admins: ${results.admins.inserted + results.admins.updated}`);
    console.log(`   Customers: ${results.customers.inserted + results.customers.updated}`);
    console.log(`   Drivers: ${results.drivers.inserted + results.drivers.updated}`);
    console.log(`   Orders: ${results.orders.inserted + results.orders.updated}`);
    console.log(`   Order Items: ${results.orderItems.inserted + results.orderItems.updated}`);
    console.log(`   Transactions: ${results.transactions.inserted + results.transactions.updated}`);
    console.log(`   Cash Submissions: ${results.cashSubmissions.inserted + results.cashSubmissions.updated}`);
    console.log(`   Wallets: ${(results.adminWallets.inserted + results.adminWallets.updated) + (results.driverWallets.inserted + results.driverWallets.updated)}\n`);
    
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
