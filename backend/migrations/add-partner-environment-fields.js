const { DataTypes } = require('sequelize');

/**
 * Migration: Add environment and productionEnabled fields to valkyrie_partners
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if environment column already exists
    const tableDescription = await queryInterface.describeTable('valkyrie_partners');
    
    if (!tableDescription.environment) {
      // Create ENUM type if it doesn't exist
      await queryInterface.sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE "enum_valkyrie_partners_environment" AS ENUM ('sandbox', 'production');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      // Add environment column
      await queryInterface.addColumn('valkyrie_partners', 'environment', {
        type: Sequelize.ENUM('sandbox', 'production'),
        defaultValue: 'sandbox',
        allowNull: false
      });
    }

    if (!tableDescription.productionEnabled) {
      // Add productionEnabled column
      await queryInterface.addColumn('valkyrie_partners', 'productionEnabled', {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
      });
    }

    // Set existing partners to production if they have zeusManaged=true
    await queryInterface.sequelize.query(`
      UPDATE valkyrie_partners 
      SET environment = 'production', "productionEnabled" = true
      WHERE "zeusManaged" = true;
    `);

    console.log('✅ Added environment and productionEnabled fields to valkyrie_partners');
  },

  down: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable('valkyrie_partners');
    
    if (tableDescription.productionEnabled) {
      await queryInterface.removeColumn('valkyrie_partners', 'productionEnabled');
    }
    
    if (tableDescription.environment) {
      await queryInterface.removeColumn('valkyrie_partners', 'environment');
    }
    
    console.log('✅ Removed environment and productionEnabled fields from valkyrie_partners');
  }
};

