require('dotenv').config();

// Set NODE_TLS_REJECT_UNAUTHORIZED to allow self-signed certificates
// This is needed for Cloud SQL connections with SSL
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const db = require('../models');

// Use the existing database connection from models
const sequelize = db.sequelize;

async function addCashAtHandColumn() {
  try {
    console.log('🔌 Testing database connection...');
    console.log(`📊 Using database config from models/index.js`);
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Check if column already exists
    console.log('🔍 Checking if cashAtHand column exists...');
    const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'admin_wallets' 
      AND column_name = 'cashAtHand';
    `);

    if (results.length > 0) {
      console.log('✅ Column cashAtHand already exists in admin_wallets table');
      
      // Verify column properties
      const [columnInfo] = await sequelize.query(`
        SELECT 
          column_name, 
          data_type, 
          column_default,
          is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_wallets' 
        AND column_name = 'cashAtHand';
      `);
      
      console.log('\n📊 Column details:');
      console.log(JSON.stringify(columnInfo[0], null, 2));
    } else {
      console.log('📝 Column does not exist. Adding cashAtHand column...');
      
      // Add the column
      await sequelize.query(`
        ALTER TABLE admin_wallets 
        ADD COLUMN "cashAtHand" DECIMAL(10, 2) DEFAULT 0;
      `);
      
      // Add comment
      await sequelize.query(`
        COMMENT ON COLUMN admin_wallets."cashAtHand" IS 'Cash at hand amount for admin (calculated from cash orders - settlements - submissions)';
      `);
      
      console.log('✅ Column cashAtHand added successfully!');
      
      // Verify it was added
      const [verifyResults] = await sequelize.query(`
        SELECT 
          column_name, 
          data_type, 
          column_default,
          is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_wallets' 
        AND column_name = 'cashAtHand';
      `);
      
      console.log('\n📊 Column details:');
      console.log(JSON.stringify(verifyResults[0], null, 2));
    }

    // Also check all columns in admin_wallets for comparison
    console.log('\n📋 All columns in admin_wallets table:');
    const [allColumns] = await sequelize.query(`
      SELECT 
        column_name, 
        data_type, 
        column_default,
        is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'admin_wallets'
      ORDER BY ordinal_position;
    `);
    
    console.table(allColumns);

    await sequelize.close();
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error running migration:', error.message);
    if (error.original) {
      console.error('   Original error:', error.original.message);
    }
    process.exit(1);
  }
}

// Run the migration
addCashAtHandColumn();
