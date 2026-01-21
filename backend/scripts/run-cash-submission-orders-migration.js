require('dotenv').config();
const db = require('../models');

async function runMigration() {
  try {
    console.log('🔌 Connecting to database...');
    await db.sequelize.authenticate();
    console.log('✅ Database connection established\n');

    console.log('📝 Running cash submission orders migration...');
    const migration = require('../migrations/add-cash-submission-orders');
    await migration.up(db.sequelize.getQueryInterface(), db.Sequelize);
    console.log('✅ Cash submission orders table created\n');

    // Verify table exists
    const [results] = await db.sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'cash_submission_orders'
      ) as table_exists;
    `);

    if (results[0]?.table_exists) {
      console.log('✅ Migration completed successfully!');
      console.log('   Table: cash_submission_orders');
    } else {
      console.log('⚠️  Warning: Table may not have been created');
    }

    await db.sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('   Error details:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
    await db.sequelize.close();
    process.exit(1);
  }
}

runMigration();
