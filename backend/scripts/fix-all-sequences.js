// Fix ALL table ID sequences
// This script checks and fixes auto-increment sequences for all tables

const db = require('../models');

const tables = [
  'customers',
  'orders',
  'drinks',
  'drivers',
  'admins',
  'transactions',
  'cash_submissions',
  'categories',
  'subcategories',
  'brands',
  'territories',
  'branches',
  'order_items',
  'driver_wallets'
];

async function fixSequence(tableName) {
  try {
    // Check if table has an id column with a sequence
    const [columns] = await db.sequelize.query(
      `SELECT column_name, column_default 
       FROM information_schema.columns 
       WHERE table_name = '${tableName}' 
       AND column_name = 'id' 
       AND column_default LIKE 'nextval%'`,
      { type: db.sequelize.QueryTypes.SELECT }
    );

    if (!columns) {
      console.log(`⏭️  ${tableName}: No auto-increment ID column, skipping`);
      return;
    }

    // Get current sequence value
    let currentSeq;
    try {
      [currentSeq] = await db.sequelize.query(
        `SELECT currval(pg_get_serial_sequence('${tableName}', 'id')) AS current_sequence`,
        { type: db.sequelize.QueryTypes.SELECT }
      );
    } catch (err) {
      // Sequence might not have been used yet
      console.log(`⚠️  ${tableName}: Sequence not initialized yet, initializing...`);
      await db.sequelize.query(
        `SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), COALESCE((SELECT MAX(id) FROM ${tableName}), 1), true)`
      );
      [currentSeq] = await db.sequelize.query(
        `SELECT currval(pg_get_serial_sequence('${tableName}', 'id')) AS current_sequence`,
        { type: db.sequelize.QueryTypes.SELECT }
      );
    }

    // Get max ID in table
    const [maxId] = await db.sequelize.query(
      `SELECT COALESCE(MAX(id), 0) AS max_id FROM ${tableName}`,
      { type: db.sequelize.QueryTypes.SELECT }
    );

    const currentSeqVal = parseInt(currentSeq.current_sequence);
    const maxIdVal = parseInt(maxId.max_id);
    const difference = maxIdVal - currentSeqVal;

    if (difference <= 0) {
      console.log(`✅ ${tableName}: Sequence OK (current: ${currentSeqVal}, max: ${maxIdVal})`);
      return;
    }

    console.log(`⚠️  ${tableName}: Sequence behind (current: ${currentSeqVal}, max: ${maxIdVal}, diff: ${difference})`);
    console.log(`   Fixing...`);

    // Fix the sequence
    await db.sequelize.query(
      `SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), ${maxIdVal}, true)`
    );

    console.log(`✅ ${tableName}: Fixed! Next ID will be ${maxIdVal + 1}`);
  } catch (error) {
    console.error(`❌ ${tableName}: Error - ${error.message}`);
  }
}

async function fixAllSequences() {
  console.log('🔧 Checking and fixing all table sequences...\n');

  for (const table of tables) {
    await fixSequence(table);
  }

  console.log('\n✅ All sequences checked and fixed!');
  process.exit(0);
}

fixAllSequences().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
