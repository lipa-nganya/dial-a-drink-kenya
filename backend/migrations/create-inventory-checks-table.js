/**
 * Migration: Create inventory_checks table
 * Run this with: node backend/migrations/create-inventory-checks-table.js
 */

const db = require('../models');
const { DataTypes } = require('sequelize');

async function createInventoryChecksTable() {
  try {
    console.log('🔄 Creating inventory_checks table...');

    const queryInterface = db.sequelize.getQueryInterface();

    // Check if table already exists
    const tableExists = await queryInterface.tableExists('inventory_checks');
    if (tableExists) {
      console.log('✅ inventory_checks table already exists');
      return;
    }

    await queryInterface.createTable('inventory_checks', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      shopAgentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'admins',
          key: 'id'
        },
        comment: 'Shop agent who submitted the check'
      },
      drinkId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'drinks',
          key: 'id'
        },
        comment: 'Drink/item being checked'
      },
      agentCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Count reported by shop agent'
      },
      databaseCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Count in database at time of check'
      },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'recount_requested'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Status of the inventory check'
      },
      isFlagged: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'True if agent count does not match database count'
      },
      approvedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'admins',
          key: 'id'
        },
        comment: 'Admin who approved the check'
      },
      approvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When the check was approved'
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Additional notes about the check'
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    // Create indexes
    await queryInterface.addIndex('inventory_checks', ['shopAgentId']);
    await queryInterface.addIndex('inventory_checks', ['drinkId']);
    await queryInterface.addIndex('inventory_checks', ['status']);
    await queryInterface.addIndex('inventory_checks', ['isFlagged']);
    await queryInterface.addIndex('inventory_checks', ['createdAt']);

    console.log('✅ inventory_checks table created successfully');
  } catch (error) {
    console.error('❌ Error creating inventory_checks table:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  createInventoryChecksTable()
    .then(() => {
      console.log('✅ Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = createInventoryChecksTable;
