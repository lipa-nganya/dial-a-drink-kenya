'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn('territories', 'deliveryFromRuaka');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('territories', 'deliveryFromRuaka', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Delivery cost from Ruaka location (restored; use deliveryFromCBD only going forward)'
    });
  }
};
