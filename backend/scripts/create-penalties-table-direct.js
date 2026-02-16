// Direct script to create penalties table
// Run with: node scripts/create-penalties-table-direct.js
require('dotenv').config();
const db = require('../models');

async function createPenaltiesTable() {
  try {
    console.log('🔌 Connecting to database...');
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful');

    // Check if table exists
    const [tableCheck] = await db.sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'penalties'
      ) as table_exists;
    `);

    const tableExists = tableCheck[0]?.table_exists;

    if (tableExists) {
      console.log('✅ Penalties table already exists');
      
      // Show table structure
      const [columns] = await db.sequelize.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'penalties' 
        ORDER BY ordinal_position;
      `);
      
      console.log('\n📋 Penalties table structure:');
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    } else {
      console.log('📝 Creating penalties table...');
      
      await db.sequelize.query(`
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
      await db.sequelize.query(`
        CREATE INDEX idx_penalties_driver_id ON penalties("driverId");
        CREATE INDEX idx_penalties_created_at ON penalties("createdAt");
      `);

      console.log('✅ Penalties table created successfully');
    }

    // Also check loans table
    const [loansCheck] = await db.sequelize.query(`
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
      console.log('📝 Creating loans table...');
      
      await db.sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE loan_status_enum AS ENUM ('active', 'paid_off', 'cancelled');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      
      await db.sequelize.query(`
        CREATE TABLE loans (
          id SERIAL PRIMARY KEY,
          "driverId" INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
          amount DECIMAL(10, 2) NOT NULL,
          balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
          reason TEXT NOT NULL,
          "nextDeductionDate" TIMESTAMP WITH TIME ZONE,
          status loan_status_enum NOT NULL DEFAULT 'active',
          "createdBy" INTEGER REFERENCES admins(id),
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await db.sequelize.query(`
        CREATE INDEX idx_loans_driver_id ON loans("driverId");
        CREATE INDEX idx_loans_status ON loans(status);
        CREATE INDEX idx_loans_created_at ON loans("createdAt");
      `);

      console.log('✅ Loans table created successfully');
    }

    await db.sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    await db.sequelize.close();
    process.exit(1);
  }
}

createPenaltiesTable();
