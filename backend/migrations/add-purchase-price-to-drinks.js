'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add purchasePrice column to drinks table
    await queryInterface.addColumn('drinks', 'purchasePrice', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Purchase/cost price of the inventory item'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('drinks', 'purchasePrice');
  }
};
