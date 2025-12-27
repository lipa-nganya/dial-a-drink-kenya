// Direct migration script - run with: DATABASE_URL="your-prod-url" node run-migration-direct.js
const { Sequelize } = require('sequelize');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('Set DATABASE_URL environment variable');
  process.exit(1);
}

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: databaseUrl.includes('/cloudsql/') ? false : { require: true, rejectUnauthorized: false }
  },
  logging: false
});

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected');
    
    console.log('Adding cashAtHand...');
    await sequelize.query('ALTER TABLE drivers ADD COLUMN IF NOT EXISTS "cashAtHand" DECIMAL(10, 2) DEFAULT 0');
    
    console.log('Adding adminOrder...');
    await sequelize.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS "adminOrder" BOOLEAN NOT NULL DEFAULT false');
    
    console.log('Adding territoryId...');
    await sequelize.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS "territoryId" INTEGER');
    
    console.log('Creating supplier_transactions...');
    await sequelize.query(`DO $$ BEGIN CREATE TYPE supplier_transaction_type_enum AS ENUM ('credit', 'debit'); EXCEPTION WHEN duplicate_object THEN null; END $$;`);
    await sequelize.query(`CREATE TABLE IF NOT EXISTS supplier_transactions (id SERIAL PRIMARY KEY, "supplierId" INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE, "transactionType" supplier_transaction_type_enum NOT NULL, amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0), reason TEXT, reference VARCHAR(255), "createdBy" INTEGER REFERENCES admins(id), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_supplier_transactions_supplier_id ON supplier_transactions("supplierId");`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_supplier_transactions_created_at ON supplier_transactions("createdAt");`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_supplier_transactions_type ON supplier_transactions("transactionType");`);
    
    console.log('✅ Migration complete!');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();
