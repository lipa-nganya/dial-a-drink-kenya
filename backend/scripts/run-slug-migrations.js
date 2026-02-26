require('dotenv').config();
const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is not set');
  console.error('   Please set it to your database connection string');
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

    const migrationsDir = path.join(__dirname, '../migrations');
    
    // Run slug migrations
    const migrations = [
      { name: 'add-slug-to-drinks', file: 'add-slug-to-drinks.js', table: 'drinks' },
      { name: 'add-slug-to-categories', file: 'add-slug-to-categories.js', table: 'categories' }
    ];

    for (const migration of migrations) {
      const migrationPath = path.join(migrationsDir, migration.file);
      if (fs.existsSync(migrationPath)) {
        console.log(`📝 Running ${migration.name}...`);
        try {
          // Check if column already exists
          const [results] = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = '${migration.table}' 
            AND column_name = 'slug'
          `);
          
          if (results.length > 0) {
            console.log(`   ⚠️  Column 'slug' already exists in ${migration.table}, skipping...`);
          } else {
            const migrationModule = require(migrationPath);
            await migrationModule.up(sequelize.getQueryInterface(), Sequelize);
            console.log(`   ✅ ${migration.name} completed`);
          }
        } catch (error) {
          if (error.message.includes('already exists') || error.message.includes('duplicate') || error.message.includes('already been defined')) {
            console.log(`   ⚠️  ${migration.name} already applied, skipping...`);
          } else {
            console.error(`   ❌ Error running ${migration.name}:`, error.message);
            throw error;
          }
        }
      } else {
        console.log(`   ⚠️  Migration file not found: ${migration.file}`);
      }
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
