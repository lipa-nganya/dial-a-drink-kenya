// Run pending migrations
const { Sequelize } = require('sequelize');
const config = require('./config');
const { getDatabaseConfigName } = require('./utils/envDetection');
const fs = require('fs');
const path = require('path');

const env = getDatabaseConfigName();
const dbConfig = config[env];

let sequelize;

async function runMigrations() {
  try {
    // Initialize Sequelize
    if (dbConfig.use_env_variable) {
      const databaseUrl = process.env[dbConfig.use_env_variable];
      if (!databaseUrl || databaseUrl.includes('[YOUR_DB_URL]') || databaseUrl.includes('placeholder')) {
        console.error('❌ DATABASE_URL is not properly set');
        process.exit(1);
      }
      sequelize = new Sequelize(databaseUrl, {
        ...dbConfig,
        logging: console.log
      });
    } else {
      sequelize = new Sequelize(
        dbConfig.database,
        dbConfig.username,
        dbConfig.password,
        {
          host: dbConfig.host,
          port: dbConfig.port,
          dialect: dbConfig.dialect,
          logging: console.log
        }
      );
    }

    await sequelize.authenticate();
    console.log('✅ Database connection established');

    const queryInterface = sequelize.getQueryInterface();

    // Run tracking token migration
    console.log('\n📦 Running migration: add-tracking-token-to-orders');
    try {
      const trackingTokenMigration = require('./migrations/add-tracking-token-to-orders');
      await trackingTokenMigration.up(queryInterface, Sequelize);
      console.log('✅ Tracking token migration completed');
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log('⚠️  Tracking token column/index already exists, skipping...');
      } else {
        throw error;
      }
    }

    // Run brands image/country migration
    console.log('\n📦 Running migration: add-image-country-to-brands');
    try {
      const brandsMigration = require('./migrations/add-image-country-to-brands');
      await brandsMigration.up(queryInterface, Sequelize);
      console.log('✅ Brands image/country migration completed');
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log('⚠️  Brands image/country columns already exist, skipping...');
      } else {
        throw error;
      }
    }

    console.log('\n✅ All migrations completed successfully!');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    console.error(error.stack);
    if (sequelize) {
      await sequelize.close();
    }
    process.exit(1);
  }
}

runMigrations();
