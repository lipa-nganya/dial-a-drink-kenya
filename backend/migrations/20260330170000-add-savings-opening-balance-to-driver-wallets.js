'use strict';

/** Optional opening balance for savings statement (anchor before oldest transaction). */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('driver_wallets', 'savingsOpeningBalance', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: null
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('driver_wallets', 'savingsOpeningBalance');
  }
};

