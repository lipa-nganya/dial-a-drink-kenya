#!/usr/bin/env node

/**
 * Run database migrations on Cloud SQL instance
 * 
 * Usage:
 *   NODE_ENV=production DATABASE_URL="your-cloud-sql-url" node backend/scripts/run-cloud-sql-migrations.js
 * 
 * Or with gcloud proxy:
 *   cloud_sql_proxy -instances=drink-suite:us-central1:drink-suite-db=tcp:5432 &
 *   DATABASE_URL="postgres://user:password@localhost:5432/database" node backend/scripts/run-cloud-sql-migrations.js
 */

const db = require('../models');

async function addBrandsTable() {
  try {
    console.log('📦 Running migration: add-brands-table');
    console.log('   Add brands table and brandId to drinks table');
    
    // Test connection
    await db.sequelize.authenticate();
    console.log('   ✅ Database connection established');

    // Sync Brand model (creates table if it doesn't exist)
    await db.Brand.sync({ alter: false });
    console.log('   ✅ Brands table created/verified');

    // Add brandId column to drinks table if it doesn't exist
    const queryInterface = db.sequelize.getQueryInterface();
    
    // Check if brandId column exists
    const tableDescription = await queryInterface.describeTable('drinks');
    
    if (!tableDescription.brandId) {
      await queryInterface.addColumn('drinks', 'brandId', {
        type: db.Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'brands',
          key: 'id'
        },
        onDelete: 'SET NULL'
      });
      
      // Add index for better query performance
      await queryInterface.addIndex('drinks', ['brandId'], {
        name: 'drinks_brandId_idx'
      });
      
      console.log('   ✅ brandId column added to drinks table');
    } else {
      console.log('   ⏭️  brandId column already exists in drinks table');
    }

    console.log('   ✅ Migration add-brands-table completed\n');
    return true;
  } catch (error) {
    console.error('   ❌ Migration add-brands-table failed:', error.message);
    throw error;
  }
}

async function addBrandFocusColumn() {
  try {
    console.log('📦 Running migration: add-brand-focus');
    console.log('   Add isBrandFocus column to drinks table');
    
    // Test connection
    await db.sequelize.authenticate();
    console.log('   ✅ Database connection established');

    // Add isBrandFocus column to drinks table if it doesn't exist
    const queryInterface = db.sequelize.getQueryInterface();
    
    // Check if isBrandFocus column exists
    const tableDescription = await queryInterface.describeTable('drinks');
    
    if (!tableDescription.isBrandFocus) {
      await queryInterface.addColumn('drinks', 'isBrandFocus', {
        type: db.Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
      console.log('   ✅ isBrandFocus column added to drinks table');
      
      // Add index for better query performance
      try {
        await queryInterface.addIndex('drinks', ['isBrandFocus'], {
          name: 'drinks_isBrandFocus_idx'
        });
        console.log('   ✅ Index created for isBrandFocus column');
      } catch (indexError) {
        // Index might already exist, that's okay
        console.log('   ℹ️  Index may already exist, skipping...');
      }
    } else {
      console.log('   ⏭️  isBrandFocus column already exists');
    }

    console.log('   ✅ Migration add-brand-focus completed\n');
    return true;
  } catch (error) {
    console.error('   ❌ Migration add-brand-focus failed:', error.message);
    throw error;
  }
}

async function addDriverLocationColumns() {
  try {
    console.log('📦 Running migration: add-driver-location-columns');
    console.log('   Add locationLatitude and locationLongitude to drivers table');
    
    // Check if locationLatitude column exists
    const [locationLatitudeResults] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'drivers' AND column_name = 'locationLatitude'
    `);
    
    if (locationLatitudeResults.length === 0) {
      await db.sequelize.query(`
        ALTER TABLE drivers 
        ADD COLUMN "locationLatitude" DECIMAL(10, 8)
      `);
      console.log('   ✅ locationLatitude column added to drivers table');
    } else {
      console.log('   ⏭️  locationLatitude column already exists in drivers table');
    }
    
    // Check if locationLongitude column exists
    const [locationLongitudeResults] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'drivers' AND column_name = 'locationLongitude'
    `);
    
    if (locationLongitudeResults.length === 0) {
      await db.sequelize.query(`
        ALTER TABLE drivers 
        ADD COLUMN "locationLongitude" DECIMAL(11, 8)
      `);
      console.log('   ✅ locationLongitude column added to drivers table');
    } else {
      console.log('   ⏭️  locationLongitude column already exists in drivers table');
    }
    
    console.log('   ✅ Migration add-driver-location-columns completed\n');
    return true;
  } catch (error) {
    console.error('   ❌ Migration add-driver-location-columns failed:', error.message);
    throw error;
  }
}

async function addOrderAdminIdAndCancellationColumns() {
  try {
    console.log('📦 Running migration: add-order-adminId-and-cancellation-columns');
    console.log('   Add adminId and cancellation-related columns to orders table');
    
    const queryInterface = db.sequelize.getQueryInterface();
    
    // Add adminId column if it doesn't exist
    const [adminIdResults] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'adminId'
    `);
    
    if (adminIdResults.length === 0) {
      await queryInterface.addColumn('orders', 'adminId', {
        type: db.Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'admins',
          key: 'id'
        },
        onDelete: 'SET NULL',
        comment: 'Admin who serviced/created the POS order'
      });
      console.log('   ✅ adminId column added to orders table');
    } else {
      console.log('   ⏭️  adminId column already exists in orders table');
    }
    
    // Add cancellationRequested column if it doesn't exist
    const [cancellationRequestedResults] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'cancellationRequested'
    `);
    
    if (cancellationRequestedResults.length === 0) {
      await queryInterface.addColumn('orders', 'cancellationRequested', {
        type: db.Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether driver has requested cancellation of this order'
      });
      console.log('   ✅ cancellationRequested column added to orders table');
    } else {
      console.log('   ⏭️  cancellationRequested column already exists in orders table');
    }
    
    // Add cancellationReason column if it doesn't exist
    const [cancellationReasonResults] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'cancellationReason'
    `);
    
    if (cancellationReasonResults.length === 0) {
      await queryInterface.addColumn('orders', 'cancellationReason', {
        type: db.Sequelize.TEXT,
        allowNull: true,
        comment: 'Reason provided by driver for cancellation request'
      });
      console.log('   ✅ cancellationReason column added to orders table');
    } else {
      console.log('   ⏭️  cancellationReason column already exists in orders table');
    }
    
    // Add cancellationRequestedAt column if it doesn't exist
    const [cancellationRequestedAtResults] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'cancellationRequestedAt'
    `);
    
    if (cancellationRequestedAtResults.length === 0) {
      await queryInterface.addColumn('orders', 'cancellationRequestedAt', {
        type: db.Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when cancellation was requested'
      });
      console.log('   ✅ cancellationRequestedAt column added to orders table');
    } else {
      console.log('   ⏭️  cancellationRequestedAt column already exists in orders table');
    }
    
    // Add cancellationApproved column if it doesn't exist
    const [cancellationApprovedResults] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'cancellationApproved'
    `);
    
    if (cancellationApprovedResults.length === 0) {
      await queryInterface.addColumn('orders', 'cancellationApproved', {
        type: db.Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: null,
        comment: 'Whether admin approved the cancellation (null = pending, true = approved, false = rejected)'
      });
      console.log('   ✅ cancellationApproved column added to orders table');
    } else {
      console.log('   ⏭️  cancellationApproved column already exists in orders table');
    }
    
    // Add cancellationApprovedAt column if it doesn't exist
    const [cancellationApprovedAtResults] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'cancellationApprovedAt'
    `);
    
    if (cancellationApprovedAtResults.length === 0) {
      await queryInterface.addColumn('orders', 'cancellationApprovedAt', {
        type: db.Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when cancellation was approved/rejected by admin'
      });
      console.log('   ✅ cancellationApprovedAt column added to orders table');
    } else {
      console.log('   ⏭️  cancellationApprovedAt column already exists in orders table');
    }
    
    // Add cancellationApprovedBy column if it doesn't exist
    const [cancellationApprovedByResults] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'cancellationApprovedBy'
    `);
    
    if (cancellationApprovedByResults.length === 0) {
      await queryInterface.addColumn('orders', 'cancellationApprovedBy', {
        type: db.Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'admins',
          key: 'id'
        },
        onDelete: 'SET NULL',
        comment: 'Admin who approved/rejected the cancellation'
      });
      console.log('   ✅ cancellationApprovedBy column added to orders table');
    } else {
      console.log('   ⏭️  cancellationApprovedBy column already exists in orders table');
    }
    
    console.log('   ✅ Migration add-order-adminId-and-cancellation-columns completed\n');
    return true;
  } catch (error) {
    console.error('   ❌ Migration add-order-adminId-and-cancellation-columns failed:', error.message);
    throw error;
  }
}

async function addPurchasePriceToDrinks() {
  try {
    console.log('📦 Running migration: add-purchase-price-to-drinks');
    console.log('   Add purchasePrice column to drinks table');
    
    // Check if column already exists
    const [results] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'drinks' 
      AND column_name = 'purchasePrice'
    `);
    
    if (results.length > 0) {
      console.log('   ⏭️  purchasePrice column already exists in drinks table');
      console.log('   ✅ Migration add-purchase-price-to-drinks completed (already exists)\n');
      return true;
    }
    
    // Add the column
    await db.sequelize.query(`
      ALTER TABLE drinks 
      ADD COLUMN "purchasePrice" DECIMAL(10, 2) NULL
    `);
    
    console.log('   ✅ purchasePrice column added to drinks table');
    console.log('   ✅ Migration add-purchase-price-to-drinks completed\n');
    return true;
  } catch (error) {
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      console.log('   ⏭️  purchasePrice column already exists, skipping...');
      console.log('   ✅ Migration add-purchase-price-to-drinks completed (already exists)\n');
      return true;
    }
    console.error('   ❌ Migration add-purchase-price-to-drinks failed:', error.message);
    throw error;
  }
}

async function runMigrations() {
  try {
    console.log('🚀 Starting Cloud SQL migrations...\n');
    
    // Check DATABASE_URL
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error('❌ DATABASE_URL environment variable is not set');
      console.error('   Please set it to your Cloud SQL connection string');
      console.error('   Example: DATABASE_URL="postgres://user:password@host:port/database"');
      console.error('\n   For Cloud SQL, you can use:');
      console.error('   - Unix socket: postgres://user:password@/database?host=/cloudsql/drink-suite:us-central1:drink-suite-db');
      console.error('   - TCP with proxy: postgres://user:password@localhost:5432/database');
      process.exit(1);
    }

    // Mask password in URL for logging
    const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ':***@');
    console.log(`📊 Connecting to: ${maskedUrl.substring(0, 100)}...\n`);

    // Test connection
    console.log('🔌 Testing database connection...');
    
    // Disable SSL for Cloud SQL Proxy connections
    if (databaseUrl.includes('localhost:5432') || databaseUrl.includes('/cloudsql/')) {
      console.log('   ℹ️  Detected Cloud SQL Proxy connection, disabling SSL...');
      // Update sequelize config to disable SSL
      db.sequelize.config.dialectOptions = {
        ...(db.sequelize.config.dialectOptions || {}),
        ssl: false
      };
    }
    
    await db.sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Run migrations in order
    const migrations = [
      { name: 'add-brands-table', fn: addBrandsTable },
      { name: 'add-brand-focus', fn: addBrandFocusColumn },
      { name: 'add-driver-location-columns', fn: addDriverLocationColumns },
      { name: 'add-order-adminId-and-cancellation-columns', fn: addOrderAdminIdAndCancellationColumns },
      { name: 'add-purchase-price-to-drinks', fn: addPurchasePriceToDrinks }
    ];

    let successCount = 0;
    let failCount = 0;

    for (const migration of migrations) {
      try {
        await migration.fn();
        successCount++;
      } catch (error) {
        console.error(`❌ Migration ${migration.name} failed:`, error.message);
        failCount++;
        // Continue with next migration
      }
    }

    console.log('📊 Migration Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);

    if (failCount === 0) {
      console.log('\n🎉 All migrations completed successfully!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some migrations failed. Please review the errors above.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Migration process failed:', error);
    console.error('   Error details:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    try {
      await db.sequelize.close();
      console.log('\n🔌 Database connection closed');
    } catch (closeError) {
      console.warn('⚠️  Error closing database connection:', closeError.message);
    }
  }
}

// Run migrations
runMigrations();
