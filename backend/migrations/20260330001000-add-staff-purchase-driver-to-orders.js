'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'staffPurchaseDriverId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'drivers',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addIndex('orders', ['staffPurchaseDriverId']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('orders', ['staffPurchaseDriverId']).catch(() => null);
    await queryInterface.removeColumn('orders', 'staffPurchaseDriverId');
  }
};

