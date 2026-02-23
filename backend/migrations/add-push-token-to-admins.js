/**
 * Migration: Add pushToken column to admins table
 * 
 * This migration adds a pushToken column to the admins table
 * to store FCM push tokens for shop agents.
 * 
 * Run with: node migrations/add-push-token-to-admins.js
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'dial_a_drink',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false
  }
);

async function addPushTokenColumn() {
  try {
    console.log('🔄 Adding pushToken column to admins table...');
    
    // Check if column already exists
    const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'admins' 
      AND column_name = 'pushToken'
    `);
    
    if (results.length > 0) {
      console.log('✅ pushToken column already exists in admins table');
      return;
    }
    
    // Add the column
    await sequelize.query(`
      ALTER TABLE "admins" 
      ADD COLUMN "pushToken" VARCHAR(255) NULL
    `);
    
    console.log('✅ Successfully added pushToken column to admins table');
  } catch (error) {
    console.error('❌ Error adding pushToken column:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run migration
addPushTokenColumn()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
