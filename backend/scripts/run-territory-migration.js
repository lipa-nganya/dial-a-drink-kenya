require('dotenv').config();
const db = require('../models');

async function runMigration() {
  try {
    console.log('🔌 Connecting to database...');
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful');

    // Check if table already exists
    const [tableCheck] = await db.sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'territories'
      ) as table_exists;
    `);

    const tableExists = tableCheck[0]?.table_exists || tableCheck[0]?.[0]?.table_exists;

    if (tableExists) {
      console.log('✅ Territories table already exists');
      await db.sequelize.query(
        'ALTER TABLE territories DROP COLUMN IF EXISTS "deliveryFromRuaka";'
      );
      console.log('✅ Single delivery fee: removed deliveryFromRuaka if present');
    } else {
      console.log('📝 Creating territories table...');
      
      await db.sequelize.query(`
        CREATE TABLE IF NOT EXISTS territories (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          "deliveryFromCBD" DECIMAL(10, 2) NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create index on name
      await db.sequelize.query(`
        CREATE INDEX IF NOT EXISTS territories_name_idx ON territories(name);
      `);

      console.log('✅ Territories table created successfully');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error running migration:', error);
    process.exit(1);
  }
}

runMigration();

