const db = require('../models');
require('dotenv').config();

async function createTransactionsTable() {
  try {
    console.log('🔌 Connecting to database...');
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful');

    // Check if table exists
    const [tableCheck] = await db.sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions'
      ) as table_exists;
    `);

    const tableExists = tableCheck[0]?.table_exists || tableCheck[0]?.[0]?.table_exists;

    if (tableExists) {
      console.log('✅ Transactions table already exists');
    } else {
      console.log('📝 Creating transactions table...');
      
      // Create ENUM types first
      await db.sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE transaction_type_enum AS ENUM ('payment', 'refund');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `).catch(() => {});

      await db.sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE transaction_status_enum AS ENUM ('pending', 'completed', 'failed', 'cancelled');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `).catch(() => {});

      await db.sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE transaction_payment_method_enum AS ENUM ('card', 'mobile_money', 'cash');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `).catch(() => {});

      // Create transactions table
      await db.sequelize.query(`
        CREATE TABLE IF NOT EXISTS "transactions" (
          "id" SERIAL PRIMARY KEY,
          "orderId" INTEGER NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
          "transactionType" VARCHAR(255) DEFAULT 'payment',
          "paymentMethod" VARCHAR(255) NOT NULL,
          "paymentProvider" VARCHAR(255),
          "amount" DECIMAL(10, 2) NOT NULL,
          "status" VARCHAR(255) DEFAULT 'pending',
          "receiptNumber" VARCHAR(255),
          "checkoutRequestID" VARCHAR(255),
          "merchantRequestID" VARCHAR(255),
          "phoneNumber" VARCHAR(255),
          "transactionDate" TIMESTAMP WITH TIME ZONE,
          "notes" TEXT,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
        );
      `);

      console.log('✅ Transactions table created successfully');
    }

    // Verify table structure
    const [columns] = await db.sequelize.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'transactions'
      ORDER BY ordinal_position;
    `);

    console.log('\n📊 Table structure:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : '(NULL)'}`);
    });

    console.log('\n✅ Script completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createTransactionsTable();

























