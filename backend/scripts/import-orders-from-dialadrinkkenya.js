require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const axios = require('axios');
const { Sequelize } = require('sequelize');
const db = require('../models');

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

// Try both old and new site URLs
const SOURCE_API_OLD = 'https://www.dialadrinkkenya.com/api';
const SOURCE_API_NEW = 'https://deliveryos-production-backend-805803410802.us-central1.run.app/api';
const LOGIN_EMAIL = 'simonkimari@gmail.com';
const LOGIN_PASSWORD = 'admin12345';

// Use the old site by default
let SOURCE_API = SOURCE_API_OLD;
let authToken = null;

async function login() {
  console.log('🔐 Logging in to source API...');
  console.log(`   Trying: ${SOURCE_API}/admin/auth/login`);
  
  // Try multiple variations
  const loginAttempts = [
    { username: LOGIN_EMAIL, password: LOGIN_PASSWORD },
    { email: LOGIN_EMAIL, password: LOGIN_PASSWORD },
    { username: 'simonkimari', password: LOGIN_PASSWORD }
  ];

  for (const attempt of loginAttempts) {
    try {
      console.log(`   Attempting login with: ${Object.keys(attempt)[0]}=${attempt[Object.keys(attempt)[0]]}`);
      const response = await axios.post(`${SOURCE_API}/admin/auth/login`, attempt, {
        headers: { 'Content-Type': 'application/json' },
        validateStatus: () => true,
        timeout: 10000
      });

      if (response.data && response.data.token) {
        authToken = response.data.token;
        console.log('✅ Login successful');
        return true;
      } else if (response.data && response.data.success && response.data.token) {
        authToken = response.data.token;
        console.log('✅ Login successful');
        return true;
      } else if (response.status === 200 && response.data) {
        console.log('   Response:', JSON.stringify(response.data).substring(0, 200));
      }
    } catch (error) {
      console.error(`   ❌ Login attempt failed:`, error.message);
      if (error.response) {
        console.error(`      Status: ${error.response.status}`);
        console.error(`      Response:`, error.response.data);
      }
    }
  }

  // If old site fails, try new site
  if (SOURCE_API === SOURCE_API_OLD) {
    console.log('\n⚠️  Old site login failed, trying new site...');
    SOURCE_API = SOURCE_API_NEW;
    return await login();
  }

  console.error('❌ All login attempts failed');
  return false;
}

async function fetchAllOrders() {
  console.log('📥 Fetching all orders from source API...');
  const allOrders = [];
  
  try {
    // Fetch all orders at once (the endpoint returns all orders)
    const response = await axios.get(`${SOURCE_API}/admin/orders`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      validateStatus: () => true,
      timeout: 300000 // 5 minute timeout for large datasets
    });

    if (response.status === 401) {
      console.log('⚠️  Token expired, re-authenticating...');
      const loggedIn = await login();
      if (!loggedIn) {
        throw new Error('Failed to re-authenticate');
      }
      // Retry the request
      return await fetchAllOrders();
    }

    if (!response.data || !Array.isArray(response.data)) {
      console.error('❌ Unexpected response format:', typeof response.data);
      if (response.data && response.data.error) {
        console.error('   Error:', response.data.error);
      }
      return [];
    }

    const orders = response.data;
    allOrders.push(...orders);
    console.log(`✅ Fetched ${allOrders.length} orders total`);
    
    return allOrders;
  } catch (error) {
    console.error(`❌ Error fetching orders:`, error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Response:', error.response.data);
    }
    if (error.code === 'ECONNABORTED') {
      console.error('   Request timed out. The dataset may be too large.');
    }
    return [];
  }
}

async function importOrdersToProduction(orders) {
  console.log('📥 Importing orders to production database...');
  
  const prodSequelize = new Sequelize(PROD_DB_CONFIG);
  const prodModels = require('../models');
  prodModels.sequelize = prodSequelize;

  try {
    await prodSequelize.authenticate();
    console.log('✅ Connected to production database');

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    // Process in batches
    const batchSize = 50;
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
              createdAt: orderData.createdAt || new Date(),
              updatedAt: orderData.updatedAt || new Date()
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
                  createdAt: itemData.createdAt || new Date(),
                  updatedAt: itemData.updatedAt || new Date()
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
        console.log(`   Processed batch ${Math.floor(i / batchSize) + 1} (${imported} imported, ${errors} errors)`);
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

  } catch (error) {
    console.error('❌ Import error:', error);
    throw error;
  } finally {
    await prodSequelize.close();
  }
}

async function main() {
  console.log('🚀 Importing Orders from dialadrinkkenya.com to Production');
  console.log('================================================================\n');

  // Step 1: Login
  const loggedIn = await login();
  if (!loggedIn) {
    console.error('❌ Failed to login. Exiting.');
    process.exit(1);
  }

  // Step 2: Fetch all orders
  const orders = await fetchAllOrders();
  if (orders.length === 0) {
    console.error('❌ No orders fetched. Exiting.');
    process.exit(1);
  }

  console.log(`\n📊 Found ${orders.length} orders to import\n`);

  // Step 3: Import to production
  await importOrdersToProduction(orders);

  console.log('\n✅ All done!');
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}
