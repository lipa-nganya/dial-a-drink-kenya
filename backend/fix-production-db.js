require('dotenv').config();
const { Sequelize } = require('sequelize');

// Get production DATABASE_URL from environment
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Error: DATABASE_URL environment variable is not set');
  console.error('Please set DATABASE_URL to your production database connection string');
  process.exit(1);
}

console.log('🔌 Connecting to database...');
const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: databaseUrl.includes('cloudsql') ? false : {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: console.log
});

async function fixDatabase() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    console.log('📝 Adding missing columns to orders table...');
    
    // Add adminOrder column
    await sequelize.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS "adminOrder" BOOLEAN NOT NULL DEFAULT false;
    `);
    console.log('✅ Added adminOrder column');
    
    // Add territoryId column
    await sequelize.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS "territoryId" INTEGER REFERENCES territories(id);
    `);
    console.log('✅ Added territoryId column');
    
    console.log('✅ Database update complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating database:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

fixDatabase();
