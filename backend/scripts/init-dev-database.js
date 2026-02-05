require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { Sequelize } = require('sequelize');

// Development database connection
const DEV_DATABASE_URL = process.env.DEV_DATABASE_URL || 
  'postgresql://dialadrink_app:o61yqm5fLiTwWnk5@34.41.187.250:5432/dialadrink_dev?sslmode=require';

console.log('🔧 Initializing Development Database Schema...');
console.log('==============================================\n');

const sequelize = new Sequelize(DEV_DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: DEV_DATABASE_URL.includes('cloudsql') ? false : {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: false
});

async function initializeSchema() {
  try {
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Connected to development database\n');

    // Load models to create schema
    console.log('📦 Loading models...');
    const db = require('../models');
    console.log('✅ Models loaded\n');

    // Sync database (create tables if they don't exist)
    console.log('🔄 Creating database schema...');
    await db.sequelize.sync({ alter: false, force: false });
    console.log('✅ Schema created/verified\n');

    // Run any additional setup
    if (typeof db.seedData === 'function') {
      console.log('🌱 Running seed data (if any)...');
      await db.seedData();
      console.log('✅ Seed data complete\n');
    }

    console.log('✅ Development database initialized successfully!');
    
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

initializeSchema()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
