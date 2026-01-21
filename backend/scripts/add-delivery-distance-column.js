#!/usr/bin/env node

/**
 * Add deliveryDistance column to orders table
 * This migration adds a column to store the road distance in kilometers
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { Sequelize } = require('sequelize');

async function addDeliveryDistanceColumn() {
  try {
    console.log('🚀 Adding deliveryDistance column to orders table...\n');
    
    const databaseUrl = process.env.CLOUD_DATABASE_URL || process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error('❌ DATABASE_URL or CLOUD_DATABASE_URL not set');
      process.exit(1);
    }

    // Create Sequelize instance directly from database URL
    const sequelize = new Sequelize(databaseUrl, {
      dialect: 'postgres',
      dialectOptions: {
        ssl: databaseUrl.includes('localhost') || databaseUrl.includes('/cloudsql/') ? false : {
          require: true,
          rejectUnauthorized: false
        }
      },
      logging: false
    });

    // Initialize Sequelize
    await sequelize.authenticate();
    console.log('✅ Connected to database\n');

    const queryInterface = sequelize.getQueryInterface();

    // Check if column already exists
    const tableDescription = await queryInterface.describeTable('orders');
    
    if (tableDescription.deliveryDistance) {
      console.log('⏭️  deliveryDistance column already exists. Skipping migration.\n');
      process.exit(0);
    }

    // Add deliveryDistance column
    await queryInterface.addColumn('orders', 'deliveryDistance', {
      type: Sequelize.DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Road distance in kilometers from origin to delivery address'
    });

    console.log('✅ deliveryDistance column added successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding deliveryDistance column:', error);
    process.exit(1);
  } finally {
    if (sequelize) {
      await sequelize.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

addDeliveryDistanceColumn();
