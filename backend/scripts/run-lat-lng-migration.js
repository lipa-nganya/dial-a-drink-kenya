#!/usr/bin/env node

/**
 * Run migration to add latitude and longitude columns to saved_addresses table
 */

const db = require('../models');

async function addLatLngColumns() {
  try {
    console.log('🚀 Starting latitude/longitude migration...\n');
    
    // Test connection
    await db.sequelize.authenticate();
    console.log('✅ Database connection established\n');

    const queryInterface = db.sequelize.getQueryInterface();
    
    // Check if latitude column exists
    const tableDescription = await queryInterface.describeTable('saved_addresses');
    
    if (!tableDescription.latitude) {
      await queryInterface.addColumn('saved_addresses', 'latitude', {
        type: db.Sequelize.DECIMAL(10, 8),
        allowNull: true
      });
      console.log('✅ latitude column added to saved_addresses table');
    } else {
      console.log('⏭️  latitude column already exists');
    }
    
    if (!tableDescription.longitude) {
      await queryInterface.addColumn('saved_addresses', 'longitude', {
        type: db.Sequelize.DECIMAL(11, 8),
        allowNull: true
      });
      console.log('✅ longitude column added to saved_addresses table');
    } else {
      console.log('⏭️  longitude column already exists');
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
    try {
      await db.sequelize.close();
      console.log('\n🔌 Database connection closed');
    } catch (closeError) {
      console.warn('⚠️  Error closing database connection:', closeError.message);
    }
  }
}

// Run migration
addLatLngColumns();





