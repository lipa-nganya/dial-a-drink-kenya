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
    await db.sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Run migrations in order
    const migrations = [
      { name: 'add-brands-table', fn: addBrandsTable },
      { name: 'add-brand-focus', fn: addBrandFocusColumn }
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
