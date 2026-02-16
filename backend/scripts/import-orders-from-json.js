require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');

// Production DB config
const PROD_DB_CONFIG = {
  username: 'dialadrink_app',
  password: 'E7A3IIa60hFD3bkGH1XAiryvB',
  database: 'dialadrink_prod',
  host: '35.223.10.1',
  port: 5432,
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: false
};

async function importOrdersFromJson(jsonFilePath) {
  console.log('🚀 Importing Orders from JSON to Production Database');
  console.log('====================================================\n');

  // Read JSON file
  console.log(`📖 Reading orders from: ${jsonFilePath}`);
  let orders;
  try {
    const jsonData = fs.readFileSync(jsonFilePath, 'utf8');
    orders = JSON.parse(jsonData);
    if (!Array.isArray(orders)) {
      throw new Error('JSON file must contain an array of orders');
    }
    console.log(`✅ Loaded ${orders.length} orders from JSON file\n`);
  } catch (error) {
    console.error('❌ Error reading JSON file:', error.message);
    process.exit(1);
  }

  // Connect to production database
  const prodSequelize = new Sequelize(PROD_DB_CONFIG);
  const prodModels = require('../models');
  prodModels.sequelize = prodSequelize;

  try {
    await prodSequelize.authenticate();
    console.log('✅ Connected to production database\n');

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    // Process in batches
    const batchSize = 50;
    console.log(`📥 Importing orders in batches of ${batchSize}...\n`);

    for (let i = 0; i < orders.length; i += batchSize) {
      const batch = orders.slice(i, i + batchSize);
      const transaction = await prodSequelize.transaction();

      try {
        for (const orderData of batch) {
          try {
            // Map order data to production schema
            const orderRecord = {
              id: orderData.id,
              customerName: orderData.customerName || '',
              customerPhone: orderData.customerPhone || '',
              customerEmail: orderData.customerEmail || null,
              deliveryAddress: orderData.deliveryAddress || '',
              totalAmount: parseFloat(orderData.totalAmount) || 0,
              tipAmount: parseFloat(orderData.tipAmount) || 0,
              status: orderData.status || 'pending',
              paymentStatus: orderData.paymentStatus || 'pending',
              paymentType: orderData.paymentType || 'pay_on_delivery',
              paymentMethod: orderData.paymentMethod || null,
              driverId: orderData.driverId || null,
              driverAccepted: orderData.driverAccepted || null,
              driverPayCredited: orderData.driverPayCredited || false,
              driverPayCreditedAt: orderData.driverPayCreditedAt || null,
              driverPayAmount: parseFloat(orderData.driverPayAmount) || 0,
              branchId: orderData.branchId || null,
              adminOrder: orderData.adminOrder || false,
              adminId: orderData.adminId || null,
              territoryId: orderData.territoryId || null,
              deliverySequence: orderData.deliverySequence || null,
              cancellationRequested: orderData.cancellationRequested || false,
              cancellationReason: orderData.cancellationReason || null,
              cancellationRequestedAt: orderData.cancellationRequestedAt || null,
              cancellationApproved: orderData.cancellationApproved || null,
              cancellationApprovedAt: orderData.cancellationApprovedAt || null,
              cancellationApprovedBy: orderData.cancellationApprovedBy || null,
              isStop: orderData.isStop || false,
              stopDeductionAmount: parseFloat(orderData.stopDeductionAmount) || null,
              trackingToken: orderData.trackingToken || null,
              deliveryDistance: parseFloat(orderData.deliveryDistance) || null,
              notes: orderData.notes || null,
              createdAt: orderData.createdAt ? new Date(orderData.createdAt) : new Date(),
              updatedAt: orderData.updatedAt ? new Date(orderData.updatedAt) : new Date()
            };

            // Create or update order
            const [order, created] = await prodModels.Order.upsert(orderRecord, {
              transaction,
              conflictFields: ['id']
            });

            // Import order items
            if (orderData.items && Array.isArray(orderData.items)) {
              for (const itemData of orderData.items) {
                const orderItem = {
                  id: itemData.id,
                  orderId: order.id,
                  drinkId: itemData.drinkId || itemData.drink?.id,
                  quantity: parseInt(itemData.quantity) || 1,
                  price: parseFloat(itemData.price) || 0,
                  createdAt: itemData.createdAt ? new Date(itemData.createdAt) : new Date(),
                  updatedAt: itemData.updatedAt ? new Date(itemData.updatedAt) : new Date()
                };

                if (orderItem.drinkId) {
                  await prodModels.OrderItem.upsert(orderItem, {
                    transaction,
                    conflictFields: ['id']
                  });
                }
              }
            }

            imported++;
          } catch (itemError) {
            console.error(`   ⚠️  Error importing order ${orderData.id}:`, itemError.message);
            errors++;
          }
        }

        await transaction.commit();
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(orders.length / batchSize);
        console.log(`   ✅ Batch ${batchNum}/${totalBatches}: ${imported} imported, ${errors} errors`);
      } catch (batchError) {
        await transaction.rollback();
        console.error(`   ❌ Error in batch ${Math.floor(i / batchSize) + 1}:`, batchError.message);
        skipped += batch.length;
      }
    }

    console.log(`\n✅ Import complete!`);
    console.log(`   Imported: ${imported}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Total: ${orders.length}`);

  } catch (error) {
    console.error('❌ Import error:', error);
    throw error;
  } finally {
    await prodSequelize.close();
  }
}

// Main execution
if (require.main === module) {
  const jsonFilePath = process.argv[2];
  
  if (!jsonFilePath) {
    console.error('❌ Usage: node import-orders-from-json.js <path-to-orders.json>');
    console.error('   Example: node import-orders-from-json.js ./orders-export.json');
    process.exit(1);
  }

  const fullPath = path.resolve(jsonFilePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ File not found: ${fullPath}`);
    process.exit(1);
  }

  importOrdersFromJson(fullPath).catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { importOrdersFromJson };
