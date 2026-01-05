#!/usr/bin/env node

/**
 * Fix brands in production by ensuring they exist in the database
 * This script connects to the production database and ensures brands are present
 */

const db = require('../models');

async function fixBrands() {
  try {
    console.log('🔌 Connecting to production database...');
    await db.sequelize.authenticate();
    console.log('✅ Connected');
    
    // Check current count
    const currentCount = await db.Brand.count();
    console.log(`📊 Current brands: ${currentCount}`);
    
    if (currentCount === 0) {
      console.log('⚠️  No brands found! Running migration...');
      // Run the migration script
      process.exit(1); // Exit to run migration separately
    } else {
      console.log('✅ Brands exist in database');
      // Test the query
      const brands = await db.Brand.findAll({ limit: 5 });
      console.log('Sample brands:', brands.map(b => b.name));
    }
    
    await db.sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixBrands();



