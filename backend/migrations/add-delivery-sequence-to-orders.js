'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if deliverySequence column already exists
    const [results] = await queryInterface.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'deliverySequence'
    `);
    
    if (results.length === 0) {
      // Add deliverySequence field to orders table
      await queryInterface.addColumn('orders', 'deliverySequence', {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Order sequence for delivery route (lower number = earlier in route)'
      });
      console.log('✅ Added deliverySequence column to orders table');
    } else {
      console.log('✅ deliverySequence column already exists in orders table');
    }
  },

  async down(queryInterface, Sequelize) {
    // Check if deliverySequence column exists before removing
    const [results] = await queryInterface.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'deliverySequence'
    `);
    
    if (results.length > 0) {
      await queryInterface.removeColumn('orders', 'deliverySequence');
      console.log('✅ Removed deliverySequence column from orders table');
    }
  }
};



