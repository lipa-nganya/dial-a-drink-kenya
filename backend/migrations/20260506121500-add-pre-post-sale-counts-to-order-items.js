'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('order_items');

    if (!table.preSaleCount) {
      await queryInterface.addColumn('order_items', 'preSaleCount', {
        type: Sequelize.INTEGER,
        allowNull: true
      });
    }

    if (!table.postSaleCount) {
      await queryInterface.addColumn('order_items', 'postSaleCount', {
        type: Sequelize.INTEGER,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('order_items', 'preSaleCount').catch(() => {});
    await queryInterface.removeColumn('order_items', 'postSaleCount').catch(() => {});
  }
};

