'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('driver_savings_log_overrides', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      driverId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'drivers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      entryKey: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      debitAmount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true
      },
      creditAmount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true
      },
      balanceAfter: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true
      },
      updatedByAdminId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'admins', key: 'id' },
        onUpdate: 'SET NULL',
        onDelete: 'SET NULL'
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

    await queryInterface.addIndex('driver_savings_log_overrides', ['driverId', 'entryKey'], {
      unique: true,
      name: 'driver_savings_log_overrides_driver_entry_key'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('driver_savings_log_overrides');
  }
};

