'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add isStop field
    await queryInterface.addColumn('orders', 'isStop', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether this order is a stop (deducts from driver savings)'
    });

    // Add stopDeductionAmount field
    await queryInterface.addColumn('orders', 'stopDeductionAmount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 100.00,
      comment: 'Amount to deduct from driver savings when order is completed (default 100)'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('orders', 'stopDeductionAmount');
    await queryInterface.removeColumn('orders', 'isStop');
  }
};
