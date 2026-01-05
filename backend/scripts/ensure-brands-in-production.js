#!/usr/bin/env node

/**
 * Ensure brands table exists and has data in production database
 * This script can be run to verify/fix brands in the production backend's database
 */

const db = require('../models');

async function ensureBrands() {
  try {
    console.log('🔌 Connecting to production database...');
    await db.sequelize.authenticate();
    console.log('✅ Connected to database');
    
    // Ensure brands table exists
    console.log('📦 Ensuring brands table exists...');
    await db.Brand.sync({ alter: false });
    console.log('✅ Brands table verified');
    
    // Check current brand count
    const currentCount = await db.Brand.count();
    console.log(`📊 Current brands in database: ${currentCount}`);
    
    if (currentCount === 0) {
      console.log('⚠️  No brands found! Running migration...');
      // Import the migration script
      const migrateScript = require('./migrate-brands-to-cloud-sql.js');
      // The script will run automatically when required
    } else {
      console.log('✅ Brands already exist in database');
      // Show sample brands
      const sampleBrands = await db.Brand.findAll({ limit: 5 });
      console.log('Sample brands:', sampleBrands.map(b => b.name).join(', '));
    }
    
    await db.sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

ensureBrands();



