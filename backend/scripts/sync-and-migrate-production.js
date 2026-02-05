require('dotenv').config();
const db = require('../models');

async function syncAndMigrate() {
  try {
    console.log('🚀 Starting Production Database Sync and Migration');
    console.log('==================================================\n');
    
    // Test connection
    console.log('🔌 Testing database connection...');
    await db.sequelize.authenticate();
    console.log('✅ Database connection established\n');
    
    // Sync database (create all tables)
    console.log('📦 Syncing database (creating tables)...');
    await db.sequelize.sync({ force: false, alter: false });
    console.log('✅ Database tables synced\n');
    
    // Now run migrations to add any additional columns
    console.log('📝 Running migrations...');
    
    const { Sequelize } = require('sequelize');
    const queryInterface = db.sequelize.getQueryInterface();
    
    // Run migrations that add columns to existing tables
    const migrations = [
      { name: 'add-cash-at-hand-to-admin-wallet', file: '../migrations/add-cash-at-hand-to-admin-wallet' },
      { name: 'add-cash-at-hand-to-drivers', file: '../migrations/add-cash-at-hand-to-drivers' },
      { name: 'add-savings-to-driver-wallets', file: '../migrations/add-savings-to-driver-wallets' },
      { name: 'add-tracking-token-to-orders', file: '../migrations/add-tracking-token-to-orders' },
      { name: 'add-image-country-to-brands', file: '../migrations/add-image-country-to-brands' },
    ];
    
    for (const migration of migrations) {
      try {
        console.log(`   Running: ${migration.name}...`);
        const migrationModule = require(migration.file);
        await migrationModule.up(queryInterface, Sequelize);
        console.log(`   ✅ ${migration.name} completed`);
      } catch (error) {
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate') ||
            error.message.includes('column') && error.message.includes('already exists')) {
          console.log(`   ⚠️  ${migration.name} already applied, skipping...`);
        } else {
          console.error(`   ❌ ${migration.name} failed:`, error.message);
          // Continue with other migrations
        }
      }
    }
    
    console.log('\n✅ Database sync and migrations completed successfully!');
    await db.sequelize.close();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.original) {
      console.error('   Original error:', error.original.message);
    }
    process.exit(1);
  }
}

syncAndMigrate();
