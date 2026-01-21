const db = require('../models');
const migration = require('../migrations/add-stop-fields-to-orders');

async function runMigration() {
  try {
    console.log('🔄 Running migration: add-stop-fields-to-orders');
    await migration.up(db.sequelize.getQueryInterface(), db.Sequelize);
    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
}

runMigration();
