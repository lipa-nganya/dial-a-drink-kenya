'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add adminId field to orders table
    await queryInterface.addColumn('orders', 'adminId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'admins',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Admin who serviced/created the POS order'
    });

    // Add index for faster lookups
    await queryInterface.addIndex('orders', ['adminId'], {
      name: 'idx_orders_admin_id'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove index first
    await queryInterface.removeIndex('orders', 'idx_orders_admin_id');
    
    // Remove column
    await queryInterface.removeColumn('orders', 'adminId');
  }
};
