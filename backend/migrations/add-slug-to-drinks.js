'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add slug column to drinks table
    await queryInterface.addColumn('drinks', 'slug', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true
    });

    // Add index on slug for performance
    await queryInterface.addIndex('drinks', ['slug'], {
      name: 'drinks_slug_idx',
      unique: true
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove index first
    await queryInterface.removeIndex('drinks', 'drinks_slug_idx');
    
    // Remove slug column
    await queryInterface.removeColumn('drinks', 'slug');
  }
};
