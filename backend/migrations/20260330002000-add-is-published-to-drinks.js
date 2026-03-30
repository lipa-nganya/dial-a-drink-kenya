'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('drinks', 'isPublished', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });

    await queryInterface.addIndex('drinks', ['isPublished']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('drinks', ['isPublished']).catch(() => null);
    await queryInterface.removeColumn('drinks', 'isPublished');
  }
};

