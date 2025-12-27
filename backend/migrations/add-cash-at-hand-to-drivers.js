'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add cashAtHand field
    await queryInterface.addColumn('drivers', 'cashAtHand', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('drivers', 'cashAtHand');
  }
};

