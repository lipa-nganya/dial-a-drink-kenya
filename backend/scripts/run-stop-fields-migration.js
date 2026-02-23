const db = require('../models');
const migration = require('../migrations/add-stop-fields-to-orders');

async function runMigration() {
  try {
    console.log('🔄 Running migration: add-stop-fields-to-orders');
    
    // Ensure database connection is established
    console.log('🔌 Connecting to database...');
    await db.sequelize.authenticate();
    console.log('✅ Database connection established');
    
    // Check if columns already exist (idempotent migration)
    const [results] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='orders' 
      AND column_name IN ('isStop', 'stopDeductionAmount')
    `);
    
    const existingColumns = results.map(r => r.column_name);
    console.log(`📊 Existing columns: ${existingColumns.join(', ') || 'none'}`);
    
    if (existingColumns.includes('isStop') && existingColumns.includes('stopDeductionAmount')) {
      console.log('✅ Columns already exist, skipping migration');
      await db.sequelize.close();
      process.exit(0);
    }
    
    // Run migration
    await migration.up(db.sequelize.getQueryInterface(), db.Sequelize);
    console.log('✅ Migration completed successfully');
    
    await db.sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Error stack:', error.stack);
    try {
      await db.sequelize.close();
    } catch (e) {
      // Ignore close errors
    }
    process.exit(1);
  }
}

runMigration();
