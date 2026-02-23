/**
 * Script to add pushToken column to admins table
 * Uses the same database connection as the server
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const db = require('../models');

async function addPushTokenColumn() {
  try {
    console.log('🔄 Checking for pushToken column in admins table...');
    
    // Test database connection
    await db.sequelize.authenticate();
    console.log('✅ Database connection established');
    
    // Check if column already exists
    const [results] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'admins' 
      AND column_name = 'pushToken'
    `);
    
    if (results.length > 0) {
      console.log('✅ pushToken column already exists in admins table');
      await db.sequelize.close();
      return;
    }
    
    // Add the column
    console.log('📝 Adding pushToken column to admins table...');
    await db.sequelize.query(`
      ALTER TABLE "admins" 
      ADD COLUMN "pushToken" VARCHAR(255) NULL
    `);
    
    console.log('✅ Successfully added pushToken column to admins table');
    
    // Verify it was added
    const [verifyResults] = await db.sequelize.query(`
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
    
    await db.sequelize.close();
    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding pushToken column:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    if (db.sequelize) {
      await db.sequelize.close();
    }
    process.exit(1);
  }
}

// Run the migration
addPushTokenColumn();
