'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add cancellation request fields to orders table
    await queryInterface.addColumn('orders', 'cancellationRequested', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether driver has requested cancellation of this order'
    });
    
    await queryInterface.addColumn('orders', 'cancellationReason', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Reason provided by driver for cancellation request'
    });
    
    await queryInterface.addColumn('orders', 'cancellationRequestedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp when cancellation was requested'
    });
    
    await queryInterface.addColumn('orders', 'cancellationApproved', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: null,
      comment: 'Whether admin approved the cancellation (null = pending, true = approved, false = rejected)'
    });
    
    await queryInterface.addColumn('orders', 'cancellationApprovedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp when cancellation was approved/rejected by admin'
    });
    
    await queryInterface.addColumn('orders', 'cancellationApprovedBy', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'admins',
        key: 'id'
      },
      comment: 'Admin who approved/rejected the cancellation'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('orders', 'cancellationRequested');
    await queryInterface.removeColumn('orders', 'cancellationReason');
    await queryInterface.removeColumn('orders', 'cancellationRequestedAt');
    await queryInterface.removeColumn('orders', 'cancellationApproved');
    await queryInterface.removeColumn('orders', 'cancellationApprovedAt');
    await queryInterface.removeColumn('orders', 'cancellationApprovedBy');
  }
};
