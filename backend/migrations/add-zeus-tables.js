const { DataTypes } = require('sequelize');

/**
 * Migration: Add Zeus tables and extend ValkyriePartner
 * Run this migration to set up Zeus Super Admin Control Plane
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Extend valkyrie_partners table with Zeus fields
    await queryInterface.addColumn('valkyrie_partners', 'apiRateLimit', {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1000,
      comment: 'API calls per hour'
    });

    await queryInterface.addColumn('valkyrie_partners', 'zeusManaged', {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });

    // Update status enum to include 'restricted'
    await queryInterface.sequelize.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'restricted' 
          AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'enum_valkyrie_partners_status'
          )
        ) THEN
          ALTER TYPE enum_valkyrie_partners_status ADD VALUE 'restricted';
        END IF;
      END $$;
    `);

    // Create zeus_admins table
    await queryInterface.createTable('zeus_admins', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
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
        type: DataTypes.ENUM('super_admin', 'ops', 'finance'),
        defaultValue: 'ops',
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

    // Create partner_geofences table
    await queryInterface.createTable('partner_geofences', {
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
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      geometry: {
        type: DataTypes.JSONB,
        allowNull: false
      },
      source: {
        type: DataTypes.ENUM('zeus', 'partner'),
        defaultValue: 'partner',
        allowNull: false
      },
      active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'zeus_admins',
          key: 'id'
        },
        onDelete: 'SET NULL'
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

    await queryInterface.addIndex('partner_geofences', {
      fields: ['partnerId'],
      name: 'partner_geofences_partner_id_idx'
    });

    await queryInterface.addIndex('partner_geofences', {
      fields: ['active'],
      name: 'partner_geofences_active_idx'
    });

    // Create partner_usage table
    await queryInterface.createTable('partner_usage', {
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
      metric: {
        type: DataTypes.ENUM('orders', 'api_calls', 'km', 'drivers'),
        allowNull: false
      },
      value: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      period: {
        type: DataTypes.ENUM('daily', 'monthly'),
        allowNull: false
      },
      periodDate: {
        type: DataTypes.DATE,
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

    await queryInterface.addIndex('partner_usage', {
      fields: ['partnerId', 'metric', 'period', 'periodDate'],
      unique: true,
      name: 'partner_usage_unique_idx'
    });

    await queryInterface.addIndex('partner_usage', {
      fields: ['partnerId', 'periodDate'],
      name: 'partner_usage_partner_period_idx'
    });

    // Create partner_invoices table
    await queryInterface.createTable('partner_invoices', {
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
      invoiceNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      period: {
        type: DataTypes.STRING,
        allowNull: false
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      status: {
        type: DataTypes.ENUM('draft', 'issued', 'paid'),
        defaultValue: 'draft',
        allowNull: false
      },
      dueDate: {
        type: DataTypes.DATE,
        allowNull: true
      },
      paidDate: {
        type: DataTypes.DATE,
        allowNull: true
      },
      notes: {
        type: DataTypes.TEXT,
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

    await queryInterface.addIndex('partner_invoices', {
      fields: ['partnerId', 'period'],
      name: 'partner_invoices_partner_period_idx'
    });

    await queryInterface.addIndex('partner_invoices', {
      fields: ['status'],
      name: 'partner_invoices_status_idx'
    });

    console.log('✅ Zeus tables created successfully');
  },

  down: async (queryInterface, Sequelize) => {
    // Drop tables in reverse order
    await queryInterface.dropTable('partner_invoices');
    await queryInterface.dropTable('partner_usage');
    await queryInterface.dropTable('partner_geofences');
    await queryInterface.dropTable('zeus_admins');

    // Remove columns from valkyrie_partners
    await queryInterface.removeColumn('valkyrie_partners', 'apiRateLimit');
    await queryInterface.removeColumn('valkyrie_partners', 'zeusManaged');

    // Note: We don't remove the 'restricted' enum value as it may break existing data
    // If needed, manually remove it: ALTER TYPE enum_valkyrie_partners_status DROP VALUE 'restricted';

    console.log('✅ Zeus tables dropped successfully');
  }
};










