const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add new columns to drinks table
    await queryInterface.addColumn('drinks', 'isOnOffer', {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });

    await queryInterface.addColumn('drinks', 'originalPrice', {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    });

    // Set originalPrice for existing drinks (copy current price)
    await queryInterface.sequelize.query(`
      UPDATE drinks 
      SET "originalPrice" = price 
      WHERE "originalPrice" IS NULL
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('drinks', 'isOnOffer');
    await queryInterface.removeColumn('drinks', 'originalPrice');
  }
};
