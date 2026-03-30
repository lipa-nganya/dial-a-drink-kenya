'use strict';

/** Optional opening balance for cash-at-hand statement (anchor before oldest transaction). */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('drivers', 'cashAtHandOpeningBalance', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: null
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('drivers', 'cashAtHandOpeningBalance');
  }
};
