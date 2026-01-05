#!/usr/bin/env node

/**
 * Migration: Add locationLatitude and locationLongitude columns to drivers table
 * Date: 2026-01-05
 * Description: Adds location tracking columns to drivers table for route optimization
 */

const db = require('../models');

async function addDriverLocationColumns() {
  try {
    console.log('🚀 Starting driver location columns migration...\n');
    
    // Test connection
    await db.sequelize.authenticate();
    console.log('✅ Database connection established\n');
    
    // Check if locationLatitude column exists
    const [locationLatitudeResults] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'drivers' AND column_name = 'locationLatitude'
    `);
    
    if (locationLatitudeResults.length === 0) {
      console.log('📝 Adding locationLatitude column to drivers table...');
      await db.sequelize.query(`
        ALTER TABLE drivers 
        ADD COLUMN "locationLatitude" DECIMAL(10, 8)
      `);
      console.log('✅ locationLatitude column added to drivers table');
    } else {
      console.log('⏭️  locationLatitude column already exists');
    }
    
    // Check if locationLongitude column exists
    const [locationLongitudeResults] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'drivers' AND column_name = 'locationLongitude'
    `);
    
    if (locationLongitudeResults.length === 0) {
      console.log('📝 Adding locationLongitude column to drivers table...');
      await db.sequelize.query(`
        ALTER TABLE drivers 
        ADD COLUMN "locationLongitude" DECIMAL(11, 8)
      `);
      console.log('✅ locationLongitude column added to drivers table');
    } else {
      console.log('⏭️  locationLongitude column already exists');
    }
    
    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('   Error details:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    // Close database connection
    try {
      await db.sequelize.close();
      console.log('\n✅ Database connection closed');
    } catch (closeError) {
      console.warn('⚠️  Error closing database connection:', closeError.message);
    }
  }
}

// Run migration
addDriverLocationColumns();

