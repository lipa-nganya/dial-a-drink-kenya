'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add savings column to driver_wallets table
    await queryInterface.addColumn('driver_wallets', 'savings', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Driver-owned savings (withheld delivery fees). This is leverage, not revenue.'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('driver_wallets', 'savings');
  }
};
