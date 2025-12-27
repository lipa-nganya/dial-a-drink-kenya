const { DataTypes } = require('sequelize');

/**
 * Migration: Add Valkyrie tables and fields
 * Run this migration to set up Valkyrie Partner API infrastructure
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add valkyrie_eligible field to drivers table
    await queryInterface.addColumn('drivers', 'valkyrieEligible', {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });

    // Create valkyrie_partners table
    await queryInterface.createTable('valkyrie_partners', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM('active', 'suspended'),
        defaultValue: 'active',
        allowNull: false
      },
      allowedCities: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        defaultValue: []
      },
      allowedVehicleTypes: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        defaultValue: []
      },
      billingPlan: {
        type: DataTypes.STRING,
        allowNull: true
      },
      apiKey: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
      },
      apiSecret: {
        type: DataTypes.STRING,
        allowNull: true
      },
      webhookUrl: {
        type: DataTypes.STRING,
        allowNull: true
      },
      webhookSecret: {
        type: DataTypes.STRING,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create valkyrie_partner_users table
    await queryInterface.createTable('valkyrie_partner_users', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      partnerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'valkyrie_partners',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      password: {
        type: DataTypes.STRING,
        allowNull: true
      },
      role: {
        type: DataTypes.ENUM('admin', 'ops', 'finance', 'readonly'),
        defaultValue: 'readonly',
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active',
        allowNull: false
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create valkyrie_partner_drivers table
    await queryInterface.createTable('valkyrie_partner_drivers', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      partnerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'valkyrie_partners',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      driverId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'drivers',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      ownershipType: {
        type: DataTypes.ENUM('partner_owned', 'deliveryos_owned'),
        defaultValue: 'partner_owned',
        allowNull: false
      },
      active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create unique index on partnerId + driverId
    await queryInterface.addIndex('valkyrie_partner_drivers', {
      fields: ['partnerId', 'driverId'],
      unique: true,
      name: 'valkyrie_partner_drivers_partner_driver_unique'
    });

    // Create valkyrie_partner_orders table
    await queryInterface.createTable('valkyrie_partner_orders', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      partnerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'valkyrie_partners',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      orderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'orders',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      assignedDriverId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'drivers',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      fulfillmentType: {
        type: DataTypes.ENUM('partner_driver', 'deliveryos_driver'),
        allowNull: true
      },
      externalOrderId: {
        type: DataTypes.STRING,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create unique index on partnerId + orderId
    await queryInterface.addIndex('valkyrie_partner_orders', {
      fields: ['partnerId', 'orderId'],
      unique: true,
      name: 'valkyrie_partner_orders_partner_order_unique'
    });

    // Create index on externalOrderId
    await queryInterface.addIndex('valkyrie_partner_orders', {
      fields: ['externalOrderId'],
      name: 'valkyrie_partner_orders_external_order_id_idx'
    });

    console.log('✅ Valkyrie tables created successfully');
  },

  down: async (queryInterface, Sequelize) => {
    // Drop tables in reverse order (respecting foreign keys)
    await queryInterface.dropTable('valkyrie_partner_orders');
    await queryInterface.dropTable('valkyrie_partner_drivers');
    await queryInterface.dropTable('valkyrie_partner_users');
    await queryInterface.dropTable('valkyrie_partners');

    // Remove valkyrie_eligible column from drivers
    await queryInterface.removeColumn('drivers', 'valkyrieEligible');

    console.log('✅ Valkyrie tables dropped successfully');
  }
};







