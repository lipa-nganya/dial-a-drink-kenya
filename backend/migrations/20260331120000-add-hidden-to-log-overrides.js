'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Cash at hand overrides
    await queryInterface.addColumn('cash_at_hand_log_overrides', 'hidden', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // Savings overrides
    await queryInterface.addColumn('driver_savings_log_overrides', 'hidden', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('cash_at_hand_log_overrides', 'hidden');
    await queryInterface.removeColumn('driver_savings_log_overrides', 'hidden');
  }
};

