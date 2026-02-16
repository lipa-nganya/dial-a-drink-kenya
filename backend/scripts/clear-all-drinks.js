/**
 * Clear All Drinks from Database
 * 
 * This script deletes all drinks from the database.
 * Use with caution!
 * 
 * Usage: node backend/scripts/clear-all-drinks.js
 */

const db = require('../models');

async function clearAllDrinks() {
  try {
    console.log('🔌 Connecting to database...');
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful\n');

    // Get current count
    const currentCount = await db.Drink.count();
    console.log(`📊 Current drink count: ${currentCount}\n`);

    if (currentCount === 0) {
      console.log('✅ Database is already empty. Nothing to delete.');
      return;
    }

    // Confirm deletion
    console.log('⚠️  WARNING: This will delete ALL drinks from the database!');
    console.log(`   About to delete ${currentCount} drinks...\n`);

    // Delete all drinks
    // First, we need to handle foreign key constraints from related tables
    console.log('🗑️  Deleting related records first...');
    
    // Delete from all tables that reference drinks
    const relatedTables = [
      'order_items',
      'inventory_checks',
      'cart_items' // if exists
    ];

    for (const table of relatedTables) {
      try {
        const result = await db.sequelize.query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = parseInt(result[0][0].count);
        if (count > 0) {
          console.log(`   Deleting ${count} records from ${table}...`);
          await db.sequelize.query(`DELETE FROM ${table}`);
          console.log(`   ✅ Deleted from ${table}`);
        }
      } catch (error) {
        // Table might not exist, continue
        console.log(`   ⚠️  Table ${table} doesn't exist or couldn't be accessed (this is okay)`);
      }
    }

    console.log('\n🗑️  Deleting all drinks...');
    const deletedCount = await db.Drink.destroy({
      where: {}
    });

    // Reset the sequence manually
    if (deletedCount > 0) {
      try {
        await db.sequelize.query('ALTER SEQUENCE drinks_id_seq RESTART WITH 1');
        console.log('   ✅ Reset auto-increment sequence');
      } catch (seqError) {
        // Sequence reset is optional, continue even if it fails
        console.log('   ⚠️  Could not reset sequence (this is okay)');
      }
    }

    console.log(`✅ Successfully deleted ${deletedCount} drinks\n`);

    // Verify deletion
    const finalCount = await db.Drink.count();
    console.log(`📊 Final drink count: ${finalCount}\n`);

    if (finalCount === 0) {
      console.log('✅ Database cleared successfully!');
      console.log('   You can now import the new inventory.\n');
    } else {
      console.log('⚠️  Warning: Some drinks may still exist in the database.');
    }

  } catch (error) {
    console.error('❌ Error clearing drinks:', error);
    process.exit(1);
  } finally {
    await db.sequelize.close();
  }
}

// Run the script
clearAllDrinks();
