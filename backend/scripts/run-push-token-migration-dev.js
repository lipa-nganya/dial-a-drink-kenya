/**
 * Run pushToken migration on development Cloud SQL database
 * This script connects to the development database and adds the pushToken column
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../../.env.local') });

const { Sequelize } = require('sequelize');

// Development database configuration
const DB_NAME = process.env.DB_NAME || 'dialadrink_dev';
const DB_USER = process.env.DB_USER || 'dialadrink_app';
const DB_PASSWORD = process.env.DB_PASSWORD || 'o61yqm5fLiTwWnk5';
const DB_HOST = process.env.DB_HOST || '/cloudsql/dialadrink-production:us-central1:dialadrink-db-dev';
const DB_PORT = process.env.DB_PORT || 5432;

// For Cloud SQL, we need to use the Unix socket path
// If running locally, you might need cloud-sql-proxy
const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'postgres',
  dialectOptions: DB_HOST.includes('/cloudsql/') ? {
    // Cloud SQL Unix socket connection
  } : {
    // Regular TCP connection
  },
  logging: console.log,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

async function addPushTokenColumn() {
  try {
    console.log('🔄 Connecting to development database...');
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    console.log('🔄 Checking for pushToken column in admins table...');
    
    // Check if column already exists
    const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'admins' 
      AND column_name = 'pushToken'
    `);
    
    if (results.length > 0) {
      console.log('✅ pushToken column already exists in admins table');
      await sequelize.close();
      return;
    }
    
    // Add the column
    console.log('📝 Adding pushToken column to admins table...');
    await sequelize.query(`
      ALTER TABLE "admins" 
      ADD COLUMN "pushToken" VARCHAR(255) NULL
    `);
    
    console.log('✅ Successfully added pushToken column to admins table');
    
    // Verify it was added
    const [verifyResults] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'admins' 
      AND column_name = 'pushToken'
    `);
    
    if (verifyResults.length > 0) {
      console.log('✅ Verification: pushToken column exists');
      console.log(`   - Data type: ${verifyResults[0].data_type}`);
      console.log(`   - Nullable: ${verifyResults[0].is_nullable}`);
    }
    
    await sequelize.close();
    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding pushToken column:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    if (sequelize) {
      await sequelize.close();
    }
    process.exit(1);
  }
}

// Run the migration
addPushTokenColumn();
