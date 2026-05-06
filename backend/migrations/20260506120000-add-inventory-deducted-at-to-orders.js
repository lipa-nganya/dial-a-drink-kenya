/**
 * orders.inventoryDeductedAt — set when stock was decreased for this order (idempotency + cancel restore).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [rows] = await queryInterface.sequelize.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'inventoryDeductedAt'
    `);
    if (rows.length > 0) return;
    await queryInterface.addColumn('orders', 'inventoryDeductedAt', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When per-line inventory was committed for this order (stock/stockByCapacity decreased)'
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('orders', 'inventoryDeductedAt').catch(() => {});
  }
};
