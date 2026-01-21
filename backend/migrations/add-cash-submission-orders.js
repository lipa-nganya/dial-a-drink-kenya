'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create join table for cash submissions and orders
    await queryInterface.createTable('cash_submission_orders', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      cashSubmissionId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'cash_submissions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      orderId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'orders',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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

    // Add indexes
    await queryInterface.addIndex('cash_submission_orders', ['cashSubmissionId']);
    await queryInterface.addIndex('cash_submission_orders', ['orderId']);
    
    // Add unique constraint to prevent duplicate associations
    await queryInterface.addIndex('cash_submission_orders', ['cashSubmissionId', 'orderId'], {
      unique: true,
      name: 'cash_submission_orders_unique'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('cash_submission_orders');
  }
};
