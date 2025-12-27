require('dotenv').config();
const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Get DATABASE_URL from environment
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Error: DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Create Sequelize instance
const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: databaseUrl.includes('cloudsql') ? false : {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: console.log
});

async function runMigrations() {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    const migrationsDir = path.join(__dirname, '../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js') && file !== 'create-supplier-transactions-table.js')
      .sort();

    console.log(`\n📋 Found ${migrationFiles.length} migration files\n`);

    // Run the new supplier transactions migration
    console.log('📝 Running supplier transactions migration...');
    const supplierTransactionMigration = require(path.join(migrationsDir, 'create-supplier-transactions-table.js'));
    await supplierTransactionMigration.up(sequelize.getQueryInterface(), Sequelize);
    console.log('✅ Supplier transactions table created');

    // Check if table exists
    const [results] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'supplier_transactions'
      ) as table_exists;
    `);

    if (results[0]?.table_exists) {
      console.log('✅ supplier_transactions table exists');
    } else {
      console.log('⚠️  supplier_transactions table does not exist - creating...');
      // Manually create the table if migration didn't work
      await sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE supplier_transaction_type_enum AS ENUM ('credit', 'debit');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS supplier_transactions (
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

      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_supplier_transactions_supplier_id ON supplier_transactions("supplierId");
        CREATE INDEX IF NOT EXISTS idx_supplier_transactions_created_at ON supplier_transactions("createdAt");
        CREATE INDEX IF NOT EXISTS idx_supplier_transactions_type ON supplier_transactions("transactionType");
      `);

      console.log('✅ supplier_transactions table created manually');
    }

    console.log('\n✅ All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error running migrations:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

runMigrations();

