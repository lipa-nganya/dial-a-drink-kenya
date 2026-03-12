require('dotenv').config();
const { Sequelize } = require('sequelize');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

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

async function runMigrations() {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Check and add slug column to drinks table
    console.log('📝 Checking drinks table...');
    const [drinksCheck] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'drinks' 
      AND column_name = 'slug'
    `);
    
    if (drinksCheck.length === 0) {
      console.log('   Adding slug column to drinks table...');
      await sequelize.query(`
        ALTER TABLE drinks 
        ADD COLUMN slug VARCHAR(255) UNIQUE
      `);
      console.log('   ✅ Added slug column to drinks table');
      
      // Add index
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS drinks_slug_idx ON drinks(slug)
      `);
      console.log('   ✅ Added index on drinks.slug');
    } else {
      console.log('   ⚠️  Column slug already exists in drinks table');
    }

    // Check and add slug column to categories table
    console.log('\n📝 Checking categories table...');
    const [categoriesCheck] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'categories' 
      AND column_name = 'slug'
    `);
    
    if (categoriesCheck.length === 0) {
      console.log('   Adding slug column to categories table...');
      await sequelize.query(`
        ALTER TABLE categories 
        ADD COLUMN slug VARCHAR(255) UNIQUE
      `);
      console.log('   ✅ Added slug column to categories table');
      
      // Add index
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_idx ON categories(slug)
      `);
      console.log('   ✅ Added index on categories.slug');
    } else {
      console.log('   ⚠️  Column slug already exists in categories table');
    }

    // Add stockByCapacity to drinks (per-capacity stock) and capacity to inventory_checks
    console.log('\n📝 Checking drinks.stockByCapacity...');
    const [stockByCapCheck] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'drinks' 
      AND column_name = 'stockByCapacity'
    `);
    if (stockByCapCheck.length === 0) {
      console.log('   Adding stockByCapacity column to drinks table...');
      await sequelize.query(`
        ALTER TABLE drinks 
        ADD COLUMN "stockByCapacity" JSON DEFAULT NULL
      `);
      console.log('   ✅ Added stockByCapacity to drinks');
    } else {
      console.log('   ⚠️  drinks.stockByCapacity already exists');
    }

    console.log('\n📝 Checking inventory_checks.capacity...');
    const [capacityCheck] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'inventory_checks' 
      AND column_name = 'capacity'
    `);
    if (capacityCheck.length === 0) {
      console.log('   Adding capacity column to inventory_checks table...');
      await sequelize.query(`
        ALTER TABLE inventory_checks 
        ADD COLUMN capacity VARCHAR(100)
      `);
      console.log('   ✅ Added capacity to inventory_checks');
    } else {
      console.log('   ⚠️  inventory_checks.capacity already exists');
    }

    console.log('\n✅ All migrations completed');
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    console.error(error.stack);
    await sequelize.close();
    process.exit(1);
  }
}

runMigrations();
