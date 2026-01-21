'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add cashAtHand column to admin_wallets table
    await queryInterface.addColumn('admin_wallets', 'cashAtHand', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'Cash at hand amount for admin (calculated from cash orders - settlements - submissions)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove cashAtHand column from admin_wallets table
    await queryInterface.removeColumn('admin_wallets', 'cashAtHand');
  }
};
