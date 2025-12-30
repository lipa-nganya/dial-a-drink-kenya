const db = require('../models');

/**
 * Migration: Add brands table and brandId to drinks table
 * Run this with: node backend/migrations/add-brands-table.js
 */

async function addBrandsTable() {
  try {
    // Test connection
    await db.sequelize.authenticate();
    console.log('✅ Database connection established');

    // Sync Brand model (creates table if it doesn't exist)
    await db.Brand.sync({ alter: false });
    console.log('✅ Brands table created/verified');

    // Add brandId column to drinks table if it doesn't exist
    const queryInterface = db.sequelize.getQueryInterface();
    
    // Check if brandId column exists
    const tableDescription = await queryInterface.describeTable('drinks');
    
    if (!tableDescription.brandId) {
      await queryInterface.addColumn('drinks', 'brandId', {
        type: db.Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'brands',
          key: 'id'
        },
        onDelete: 'SET NULL'
      });
      
      // Add index for better query performance
      await queryInterface.addIndex('drinks', ['brandId'], {
        name: 'drinks_brandId_idx'
      });
      
      console.log('✅ brandId column added to drinks table');
    } else {
      console.log('⏭️  brandId column already exists in drinks table');
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
addBrandsTable();
