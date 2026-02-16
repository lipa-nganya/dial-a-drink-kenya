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
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
};

// Import customers from JSON file
async function importCustomersFromJson(jsonFilePath) {
  console.log('📥 Importing customers from JSON to production database...\n');

  // Read JSON file
  console.log(`📖 Reading customers from: ${jsonFilePath}`);
  let customers;
  try {
    const jsonData = fs.readFileSync(jsonFilePath, 'utf8');
    customers = JSON.parse(jsonData);
    if (!Array.isArray(customers)) {
      throw new Error('JSON file must contain an array of customers');
    }
    console.log(`✅ Loaded ${customers.length} customers from JSON file\n`);
  } catch (error) {
    console.error('❌ Error reading JSON file:', error.message);
    process.exit(1);
  }

  // Connect to production database
  const prodSequelize = new Sequelize(PROD_DB_CONFIG);
  const prodModels = require('../models');
  prodModels.sequelize = prodSequelize;

  // Retry connection
  let connected = false;
  let retries = 5;
  while (!connected && retries > 0) {
    try {
      await prodSequelize.authenticate();
      console.log('✅ Connected to production database\n');
      connected = true;
    } catch (connError) {
      retries--;
      if (retries > 0) {
        console.log(`⚠️  Connection failed, retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        throw connError;
      }
    }
  }

  try {
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    // Process in batches
    const batchSize = 100;
    console.log(`   Processing in batches of ${batchSize}...\n`);

    for (let i = 0; i < customers.length; i += batchSize) {
      const batch = customers.slice(i, i + batchSize);
      const transaction = await prodSequelize.transaction();

      try {
        for (const customerData of batch) {
          try {
            // Use upsert to handle conflicts
            const [customer, created] = await prodModels.Customer.upsert(customerData, {
              transaction,
              conflictFields: ['username'], // Conflict on username
              returning: true
            });

            if (created) {
              imported++;
            } else {
              skipped++;
            }
          } catch (itemError) {
            // Try to handle unique constraint on phone/email
            if (itemError.name === 'SequelizeUniqueConstraintError') {
              skipped++;
            } else {
              console.error(`   ⚠️  Error importing customer ${customerData.username}:`, itemError.message);
              errors++;
            }
          }
        }

        await transaction.commit();
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(customers.length / batchSize);
        console.log(`   ✅ Batch ${batchNum}/${totalBatches}: ${imported} imported, ${skipped} skipped, ${errors} errors`);
      } catch (batchError) {
        await transaction.rollback();
        console.error(`   ❌ Error in batch ${Math.floor(i / batchSize) + 1}:`, batchError.message);
        skipped += batch.length;
      }
    }

    console.log(`\n✅ Import complete!`);
    console.log(`   Imported: ${imported}`);
    console.log(`   Skipped (duplicates): ${skipped}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Total processed: ${customers.length}`);

  } catch (error) {
    console.error('❌ Import error:', error);
    throw error;
  } finally {
    await prodSequelize.close();
  }
}

// Main execution
if (require.main === module) {
  const jsonFilePath = process.argv[2] || path.join(__dirname, 'customers-extracted.json');
  
  if (!fs.existsSync(jsonFilePath)) {
    console.error(`❌ File not found: ${jsonFilePath}`);
    console.error('   Usage: node import-customers-from-json.js [path-to-customers.json]');
    process.exit(1);
  }

  importCustomersFromJson(jsonFilePath).catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { importCustomersFromJson };
