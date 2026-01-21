'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add image field
    await queryInterface.addColumn('brands', 'image', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // Add country field
    await queryInterface.addColumn('brands', 'country', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('brands', 'country');
    await queryInterface.removeColumn('brands', 'image');
  }
};
