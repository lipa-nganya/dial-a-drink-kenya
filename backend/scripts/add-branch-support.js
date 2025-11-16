const db = require('../models');
require('dotenv').config();

async function addBranchSupport() {
  try {
    console.log('🔌 Connecting to database...');
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful');

    // Check if branches table exists
    const [branchesTableCheck] = await db.sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'branches'
      ) as table_exists;
    `);

    const branchesTableExists = branchesTableCheck[0]?.table_exists || branchesTableCheck[0]?.[0]?.table_exists;

    if (!branchesTableExists) {
      console.log('📝 Creating branches table...');
      
      await db.sequelize.query(`
        CREATE TABLE IF NOT EXISTS branches (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          address TEXT NOT NULL,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
      `);
      console.log('✅ Branches table created');
    } else {
      console.log('✅ Branches table already exists');
    }

    // Check if branchId column exists in orders table
    const [columnCheck] = await db.sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'branchId'
      ) as column_exists;
    `);

    const columnExists = columnCheck[0]?.column_exists || columnCheck[0]?.[0]?.column_exists;

    if (!columnExists) {
      console.log('📝 Adding branchId column to orders table...');
      
      // Add branchId column
      await db.sequelize.query(`
        ALTER TABLE orders 
        ADD COLUMN "branchId" INTEGER;
      `);

      // Add foreign key constraint
      await db.sequelize.query(`
        ALTER TABLE orders 
        ADD CONSTRAINT orders_branchId_fkey 
        FOREIGN KEY ("branchId") 
        REFERENCES branches(id) 
        ON DELETE SET NULL;
      `);

      console.log('✅ branchId column added to orders table');
    } else {
      console.log('✅ branchId column already exists in orders table');
    }

    console.log('✅ Branch support migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding branch support:', error);
    process.exit(1);
  }
}

addBranchSupport();

