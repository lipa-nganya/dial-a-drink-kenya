// Script to check if penalties table exists and create it if needed
const { Sequelize } = require('sequelize');
const config = require('../config');
const { getDatabaseConfigName } = require('../utils/envDetection');

const env = getDatabaseConfigName();
const dbConfig = config[env];

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
  host: dbConfig.host,
  port: dbConfig.port,
  dialect: 'postgres',
  logging: false
});

async function checkAndCreatePenaltiesTable() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // Check if penalties table exists
    const [results] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'penalties'
      ) as table_exists;
    `);

    if (results[0]?.table_exists) {
      console.log('✅ Penalties table exists');
      
      // Check table structure
      const [columns] = await sequelize.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'penalties' 
        ORDER BY ordinal_position;
      `);
      
      console.log('\n📋 Penalties table structure:');
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    } else {
      console.log('❌ Penalties table does NOT exist');
      console.log('\n📝 Creating penalties table...');
      
      await sequelize.query(`
        CREATE TABLE penalties (
          id SERIAL PRIMARY KEY,
          "driverId" INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
          amount DECIMAL(10, 2) NOT NULL,
          balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
          reason TEXT NOT NULL,
          "createdBy" INTEGER REFERENCES admins(id),
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // Create indexes
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_penalties_driver_id ON penalties("driverId");
        CREATE INDEX IF NOT EXISTS idx_penalties_created_at ON penalties("createdAt");
      `);
      
      console.log('✅ Penalties table created successfully');
    }

    // Also check loans table
    const [loansCheck] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'loans'
      ) as table_exists;
    `);

    if (loansCheck[0]?.table_exists) {
      console.log('\n✅ Loans table exists');
    } else {
      console.log('\n❌ Loans table does NOT exist');
    }

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    await sequelize.close();
    process.exit(1);
  }
}

checkAndCreatePenaltiesTable();
