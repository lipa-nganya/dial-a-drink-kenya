// Fix Customer ID sequence
// Run this script to sync the auto-increment sequence with the actual max ID in the table

const db = require('../models');

async function fixCustomerSequence() {
  try {
    console.log('🔧 Fixing Customer ID sequence...\n');

    // Check current sequence value
    const [currentSeq] = await db.sequelize.query(
      "SELECT currval(pg_get_serial_sequence('customers', 'id')) AS current_sequence",
      { type: db.sequelize.QueryTypes.SELECT }
    );
    console.log('Current sequence value:', currentSeq.current_sequence);

    // Check max ID in table
    const [maxId] = await db.sequelize.query(
      "SELECT MAX(id) AS max_id FROM customers",
      { type: db.sequelize.QueryTypes.SELECT }
    );
    console.log('Max ID in customers table:', maxId.max_id);

    // Calculate the difference
    const difference = parseInt(maxId.max_id) - parseInt(currentSeq.current_sequence);
    console.log('Difference:', difference);

    if (difference <= 0) {
      console.log('\n✅ Sequence is already correct or ahead. No fix needed.');
      process.exit(0);
    }

    console.log('\n⚠️  Sequence is behind the max ID. Fixing...');

    // Reset sequence to max ID + 1
    await db.sequelize.query(
      "SELECT setval(pg_get_serial_sequence('customers', 'id'), COALESCE((SELECT MAX(id) FROM customers), 1), true)"
    );

    // Verify the fix
    const [newSeq] = await db.sequelize.query(
      "SELECT currval(pg_get_serial_sequence('customers', 'id')) AS new_sequence",
      { type: db.sequelize.QueryTypes.SELECT }
    );
    console.log('\n✅ Sequence fixed!');
    console.log('New sequence value:', newSeq.new_sequence);
    console.log('Next customer ID will be:', parseInt(newSeq.new_sequence) + 1);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing sequence:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

fixCustomerSequence();
