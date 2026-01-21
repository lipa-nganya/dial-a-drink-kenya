'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add trackingToken field
    await queryInterface.addColumn('orders', 'trackingToken', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
      comment: 'Secure token for order tracking via SMS link'
    });

    // Create index on trackingToken for faster lookups
    await queryInterface.addIndex('orders', ['trackingToken'], {
      name: 'orders_trackingToken_idx',
      unique: true
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove index first
    await queryInterface.removeIndex('orders', 'orders_trackingToken_idx');
    
    // Remove column
    await queryInterface.removeColumn('orders', 'trackingToken');
  }
};
