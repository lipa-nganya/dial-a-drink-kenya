require('dotenv').config();
const { Sequelize } = require('sequelize');
const config = require('../config');
const migration = require('../migrations/add-partner-environment-fields');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  ...dbConfig,
  logging: false,
});

const queryInterface = sequelize.getQueryInterface();

async function runMigration() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    console.log('🔄 Running partner environment fields migration...');
    await migration.up(queryInterface, Sequelize);
    console.log('✅ Partner environment fields migration completed successfully!');
  } catch (error) {
    console.error('❌ Partner environment fields migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

runMigration();














