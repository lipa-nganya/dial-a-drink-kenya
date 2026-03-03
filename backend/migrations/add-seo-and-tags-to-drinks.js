'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('drinks');
    if (!table.pageTitle) {
      await queryInterface.addColumn('drinks', 'pageTitle', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }
    if (!table.keywords) {
      await queryInterface.addColumn('drinks', 'keywords', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }
    if (!table.youtubeUrl) {
      await queryInterface.addColumn('drinks', 'youtubeUrl', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }
    if (!table.tags) {
      await queryInterface.addColumn('drinks', 'tags', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: []
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('drinks');
    if (table.pageTitle) await queryInterface.removeColumn('drinks', 'pageTitle');
    if (table.keywords) await queryInterface.removeColumn('drinks', 'keywords');
    if (table.youtubeUrl) await queryInterface.removeColumn('drinks', 'youtubeUrl');
    if (table.tags) await queryInterface.removeColumn('drinks', 'tags');
  }
};
