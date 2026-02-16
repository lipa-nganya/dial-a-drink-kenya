'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if table already exists
    const [results] = await queryInterface.sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'penalties'
      ) as table_exists;
    `);

    if (results[0]?.table_exists) {
      console.log('⚠️  Penalties table already exists, skipping creation');
      return;
    }

    // Create penalties table
    await queryInterface.createTable('penalties', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      driverId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'drivers',
          key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'Driver who received the penalty'
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Original penalty amount'
      },
      balance: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        comment: 'Remaining penalty balance (reduced by payments)'
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Reason for the penalty'
      },
      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'admins',
          key: 'id'
        },
        comment: 'Admin who created the penalty'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create indexes
    await queryInterface.addIndex('penalties', ['driverId'], {
      name: 'idx_penalties_driver_id'
    });

    await queryInterface.addIndex('penalties', ['createdAt'], {
      name: 'idx_penalties_created_at'
    });

    console.log('✅ Penalties table created successfully');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('penalties');
  }
};
