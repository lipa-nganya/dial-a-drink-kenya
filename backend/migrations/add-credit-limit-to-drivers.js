'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add creditLimit field to drivers table
    await queryInterface.addColumn('drivers', 'creditLimit', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'Maximum amount driver can owe the company. If balance exceeds this, driver cannot accept new deliveries.'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('drivers', 'creditLimit');
  }
};




