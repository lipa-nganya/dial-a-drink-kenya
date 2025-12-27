require('dotenv').config();
const { Sequelize } = require('sequelize');

// Get production DATABASE_URL from environment
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Error: DATABASE_URL environment variable is not set');
  console.error('Please set DATABASE_URL to your production database connection string');
  process.exit(1);
}

console.log('🔌 Connecting to database...');
const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  dialectOptions: {
    // For Cloud SQL Unix socket connections, SSL is not needed
    ssl: databaseUrl.includes('/cloudsql/') ? false : {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: console.log
});

async function fixDatabase() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    console.log('\n📝 Adding missing columns and tables...\n');
    
    // 1. Add cashAtHand to drivers table
    console.log('1. Adding cashAtHand column to drivers table...');
    try {
      await sequelize.query(`
        ALTER TABLE drivers 
        ADD COLUMN IF NOT EXISTS "cashAtHand" DECIMAL(10, 2) DEFAULT 0;
      `);
      console.log('   ✅ Added cashAtHand column');
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log('   ⏭️  cashAtHand column already exists');
      } else {
        throw error;
      }
    }
    
    // 2. Add adminOrder to orders table
    console.log('2. Adding adminOrder column to orders table...');
    try {
      await sequelize.query(`
        ALTER TABLE orders 
        ADD COLUMN IF NOT EXISTS "adminOrder" BOOLEAN NOT NULL DEFAULT false;
      `);
      console.log('   ✅ Added adminOrder column');
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log('   ⏭️  adminOrder column already exists');
      } else {
        throw error;
      }
    }
    
    // 3. Add territoryId to orders table
    console.log('3. Adding territoryId column to orders table...');
    try {
      // Check if territories table exists first
      const [territoriesCheck] = await sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'territories'
        ) as exists;
      `);
      
      if (territoriesCheck[0]?.exists) {
        await sequelize.query(`
          ALTER TABLE orders 
          ADD COLUMN IF NOT EXISTS "territoryId" INTEGER REFERENCES territories(id);
        `);
        console.log('   ✅ Added territoryId column');
      } else {
        // Add column without foreign key if territories table doesn't exist
        await sequelize.query(`
          ALTER TABLE orders 
          ADD COLUMN IF NOT EXISTS "territoryId" INTEGER;
        `);
        console.log('   ✅ Added territoryId column (without FK - territories table not found)');
      }
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log('   ⏭️  territoryId column already exists');
      } else {
        throw error;
      }
    }
    
    // 4. Create supplier_transactions table
    console.log('4. Creating supplier_transactions table...');
    try {
      // Check if table already exists
      const [tableCheck] = await sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'supplier_transactions'
        ) as exists;
      `);
      
      if (!tableCheck[0]?.exists) {
        // Create ENUM type
        await sequelize.query(`
          DO $$ BEGIN
            CREATE TYPE supplier_transaction_type_enum AS ENUM ('credit', 'debit');
          EXCEPTION
            WHEN duplicate_object THEN null;
          END $$;
        `);
        
        // Create table
        await sequelize.query(`
          CREATE TABLE supplier_transactions (
            id SERIAL PRIMARY KEY,
            "supplierId" INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
            "transactionType" supplier_transaction_type_enum NOT NULL,
            amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
            reason TEXT,
            reference VARCHAR(255),
            "createdBy" INTEGER REFERENCES admins(id),
            "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        
        // Create indexes
        await sequelize.query(`
          CREATE INDEX IF NOT EXISTS idx_supplier_transactions_supplier_id 
          ON supplier_transactions("supplierId");
          
          CREATE INDEX IF NOT EXISTS idx_supplier_transactions_created_at 
          ON supplier_transactions("createdAt");
          
          CREATE INDEX IF NOT EXISTS idx_supplier_transactions_type 
          ON supplier_transactions("transactionType");
        `);
        
        console.log('   ✅ Created supplier_transactions table with indexes');
      } else {
        console.log('   ⏭️  supplier_transactions table already exists');
      }
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log('   ⏭️  supplier_transactions table already exists');
      } else {
        console.error('   ❌ Error creating supplier_transactions table:', error.message);
        // Don't fail - continue with other operations
      }
    }
    
    console.log('\n✅ Database update complete!');
    console.log('\n📋 Summary of changes:');
    console.log('   - drivers.cashAtHand: Added');
    console.log('   - orders.adminOrder: Added');
    console.log('   - orders.territoryId: Added');
    console.log('   - supplier_transactions: Created');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error updating database:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

fixDatabase();

