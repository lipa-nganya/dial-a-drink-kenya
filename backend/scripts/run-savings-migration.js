require('dotenv').config();
const db = require('../models');

async function runMigration() {
  try {
    console.log('🔌 Connecting to database...');
    await db.sequelize.authenticate();
    console.log('✅ Database connection established\n');

    console.log('📝 Running savings migration...');
    const migration = require('../migrations/add-savings-to-driver-wallets');
    
    await migration.up(db.sequelize.getQueryInterface(), db.Sequelize);
    console.log('✅ Savings column added to driver_wallets table\n');

    // Verify the column was added
    const [results] = await db.sequelize.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'driver_wallets' AND column_name = 'savings';
    `);

    if (results.length > 0) {
      console.log('✅ Migration verified:');
      console.log(`   Column: ${results[0].column_name}`);
      console.log(`   Type: ${results[0].data_type}`);
      console.log(`   Default: ${results[0].column_default}`);
      console.log(`   Nullable: ${results[0].is_nullable}`);
    } else {
      console.warn('⚠️  Warning: Column not found after migration');
    }

    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    try {
      await db.sequelize.close();
      console.log('\n🔌 Database connection closed');
    } catch (closeError) {
      console.warn('⚠️  Error closing database connection:', closeError.message);
    }
  }
}

runMigration();
