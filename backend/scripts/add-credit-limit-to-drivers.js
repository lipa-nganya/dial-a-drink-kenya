#!/usr/bin/env node

/**
 * Add creditLimit column to drivers table in production
 */

const db = require('../models');

async function addCreditLimitToDrivers() {
  try {
    console.log('🔌 Connecting to database...');
    await db.sequelize.authenticate();
    console.log('✅ Connected to database');
    
    const queryInterface = db.sequelize.getQueryInterface();
    
    // Check if column already exists
    const tableDescription = await queryInterface.describeTable('drivers');
    
    if (tableDescription.creditLimit) {
      console.log('⏭️  creditLimit column already exists in drivers table');
    } else {
      console.log('📦 Adding creditLimit column to drivers table...');
      await queryInterface.addColumn('drivers', 'creditLimit', {
        type: db.Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0
      });
      console.log('✅ creditLimit column added to drivers table');
    }
    
    // Update all existing drivers to have creditLimit = 0 if null
    console.log('🔄 Updating existing drivers...');
    await db.sequelize.query(`
      UPDATE drivers 
      SET "creditLimit" = 0 
      WHERE "creditLimit" IS NULL
    `);
    console.log('✅ Updated existing drivers');
    
    await db.sequelize.close();
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

addCreditLimitToDrivers();



