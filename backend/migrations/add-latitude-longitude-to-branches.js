#!/usr/bin/env node

/**
 * Migration: Add latitude and longitude columns to branches table
 * Date: 2026-01-08
 * Description: Adds location coordinates to branches table for navigation
 */

const db = require('../models');
require('dotenv').config();

async function addLatitudeLongitudeToBranches() {
  try {
    console.log('🚀 Starting branches latitude/longitude migration...\n');
    
    // Test connection
    await db.sequelize.authenticate();
    console.log('✅ Database connection established\n');
    
    const queryInterface = db.sequelize.getQueryInterface();
    
    // Check if latitude column exists
    const [latitudeResults] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'branches' AND column_name = 'latitude'
    `);
    
    if (latitudeResults.length === 0) {
      console.log('📝 Adding latitude column to branches table...');
      await queryInterface.addColumn('branches', 'latitude', {
        type: db.Sequelize.DECIMAL(10, 8),
        allowNull: true,
        comment: 'Latitude coordinate from Google Maps API'
      });
      console.log('✅ latitude column added to branches table');
    } else {
      console.log('⏭️  latitude column already exists');
    }
    
    // Check if longitude column exists
    const [longitudeResults] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'branches' AND column_name = 'longitude'
    `);
    
    if (longitudeResults.length === 0) {
      console.log('📝 Adding longitude column to branches table...');
      await queryInterface.addColumn('branches', 'longitude', {
        type: db.Sequelize.DECIMAL(11, 8),
        allowNull: true,
        comment: 'Longitude coordinate from Google Maps API'
      });
      console.log('✅ longitude column added to branches table');
    } else {
      console.log('⏭️  longitude column already exists');
    }
    
    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await db.sequelize.close();
  }
}

// Run migration
addLatitudeLongitudeToBranches();
