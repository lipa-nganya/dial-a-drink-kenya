'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('branches', 'latitude', {
      type: Sequelize.DECIMAL(10, 8),
      allowNull: true,
      comment: 'Latitude coordinate from Google Maps API'
    });
    
    await queryInterface.addColumn('branches', 'longitude', {
      type: Sequelize.DECIMAL(11, 8),
      allowNull: true,
      comment: 'Longitude coordinate from Google Maps API'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('branches', 'latitude');
    await queryInterface.removeColumn('branches', 'longitude');
  }
};
