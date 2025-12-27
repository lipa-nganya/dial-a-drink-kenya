'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add adminOrder field
    await queryInterface.addColumn('orders', 'adminOrder', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // Add territoryId field
    await queryInterface.addColumn('orders', 'territoryId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'territories',
        key: 'id'
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('orders', 'adminOrder');
    await queryInterface.removeColumn('orders', 'territoryId');
  }
};

