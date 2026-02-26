'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add slug column to categories table
    await queryInterface.addColumn('categories', 'slug', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true
    });

    // Add index on slug for performance
    await queryInterface.addIndex('categories', ['slug'], {
      name: 'categories_slug_idx',
      unique: true
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove index first
    await queryInterface.removeIndex('categories', 'categories_slug_idx');
    
    // Remove slug column
    await queryInterface.removeColumn('categories', 'slug');
  }
};
