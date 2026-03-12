/**
 * Migration: Add stockByCapacity to drinks, capacity to inventory_checks
 * - drinks.stockByCapacity: JSON object e.g. {"250ml": 10, "500ml": 5} for per-capacity stock
 * - inventory_checks.capacity: which capacity was checked (nullable)
 * Run with: node backend/migrations/add-stock-by-capacity-and-inventory-check-capacity.js
 */

const db = require('../models');

async function up() {
  const queryInterface = db.sequelize.getQueryInterface();

  // Add stockByCapacity to drinks if not present
  const drinkTable = await queryInterface.describeTable('drinks');
  if (!drinkTable.stockByCapacity) {
    await queryInterface.addColumn('drinks', 'stockByCapacity', {
      type: db.Sequelize.JSON,
      allowNull: true,
      defaultValue: null
    });
    console.log('✅ Added stockByCapacity to drinks');
  } else {
    console.log('⏭️ drinks.stockByCapacity already exists');
  }

  // Add capacity to inventory_checks if not present
  const checkTable = await queryInterface.describeTable('inventory_checks');
  if (!checkTable.capacity) {
    await queryInterface.addColumn('inventory_checks', 'capacity', {
      type: db.Sequelize.STRING(100),
      allowNull: true
    });
    console.log('✅ Added capacity to inventory_checks');
  } else {
    console.log('⏭️ inventory_checks.capacity already exists');
  }
}

async function run() {
  try {
    await up();
    console.log('✅ Migration completed');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { up, run };
