const db = require('../models');

/**
 * Migration: Add isBrandFocus column to drinks table
 * Run this with: node backend/migrations/add-brand-focus.js
 */

async function addBrandFocusColumn() {
  try {
    // Test connection
    await db.sequelize.authenticate();
    console.log('✅ Database connection established');

    // Add isBrandFocus column to drinks table if it doesn't exist
    const queryInterface = db.sequelize.getQueryInterface();
    
    // Check if isBrandFocus column exists
    const tableDescription = await queryInterface.describeTable('drinks');
    
    if (!tableDescription.isBrandFocus) {
      await queryInterface.addColumn('drinks', 'isBrandFocus', {
        type: db.Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
      console.log('✅ isBrandFocus column added to drinks table');
      
      // Add index for better query performance
      try {
        await queryInterface.addIndex('drinks', ['isBrandFocus'], {
          name: 'drinks_isBrandFocus_idx'
        });
        console.log('✅ Index created for isBrandFocus column');
      } catch (indexError) {
        // Index might already exist, that's okay
        console.log('ℹ️  Index may already exist, skipping...');
      }
    } else {
      console.log('ℹ️  isBrandFocus column already exists');
    }

    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await db.sequelize.close();
  }
}

// Run migration
addBrandFocusColumn();

