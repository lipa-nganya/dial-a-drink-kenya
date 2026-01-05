#!/usr/bin/env node

/**
 * Migrate brands table and data to Google Cloud SQL instance
 * 
 * Usage:
 *   DATABASE_URL="your-cloud-sql-url" node backend/scripts/migrate-brands-to-cloud-sql.js
 * 
 * For Cloud SQL Proxy:
 *   cloud_sql_proxy -instances=PROJECT:REGION:INSTANCE=tcp:5432 &
 *   DATABASE_URL="postgres://user:password@localhost:5432/database" node backend/scripts/migrate-brands-to-cloud-sql.js
 */

const db = require('../models');

// Combined brands data from import-brands.js and add-missing-brands.js
const brandsData = [
  // Gin Brands
  { name: 'Tanqueray Gin', country: 'United Kingdom' },
  { name: 'Drumshanbo', country: null },
  { name: 'Stretton-gin', country: null },
  { name: 'Hendricks Gin', country: null },
  { name: 'Gilbey\'s Gin', country: null },
  { name: 'Beefeater Gin', country: null },
  { name: 'Bombay-Sapphire-Gin', country: null },
  { name: 'Kenyan-Originals', country: 'Kenya' },
  { name: 'Gordon\'s Gin', country: 'London' },
  { name: 'Gibson\'s', country: null },
  { name: 'Bulldog-Gin', country: null },
  { name: 'Aviation Gin', country: 'Portland' },
  { name: 'Black Forest Distillery', country: null },
  { name: 'Whitley-Neil-Gin', country: null },
  { name: 'Hayman\'s', country: null },
  { name: 'Seagram\'s', country: null },
  { name: 'Antidote', country: 'France' },
  { name: 'Bloedlemoen', country: null },
  { name: 'Brooklyn-Gin', country: null },
  { name: 'Larios Gin', country: null },
  { name: 'Colombian Aged', country: null },
  { name: 'Citrum-Gin', country: null },
  { name: 'Malfy Gin', country: 'Italy' },
  { name: 'Gin Society Gin', country: 'South Africa' },
  { name: 'Finery Gin', country: null },
  { name: 'D\'Argent', country: null },
  { name: 'Stirling', country: null },
  { name: 'Musgrave', country: null },
  { name: 'Greenall\'s', country: null },
  { name: 'Brockmans Gin', country: null },
  { name: 'Bobby\'s Gin', country: null },
  { name: 'Bloom Gin', country: null },
  { name: 'Levantine', country: null },
  { name: 'Wilderer Gin', country: null },
  { name: 'Botanist-Islay-Gin', country: null },
  { name: 'Jaisalmer', country: null },
  { name: 'Inverroche Gin', country: 'South African' },
  { name: 'Kensington', country: null },
  { name: 'Ginebra San Miguel', country: null },
  { name: 'Agnes Arber', country: 'England' },
  { name: 'Broker\'s Gin', country: 'England' },
  { name: 'Opihr', country: null },
  { name: 'MG-Distilleries', country: null },
  { name: 'Four Pillars', country: 'Australia' },
  { name: 'Beam-Suntory', country: null },
  { name: 'Botanic/Cubical gin', country: null },
  { name: 'Sakurao', country: 'Japan' },
  { name: 'Mermaid gin', country: null },
  { name: 'Gin-Mare', country: null },
  { name: 'Berkeley Square Gin', country: null },
  { name: 'Six Dogs', country: 'South Africa' },
  { name: 'Nginious', country: 'Switzerland' },
  { name: 'Sharish', country: null },
  
  // Smokes Brands
  { name: 'Sweet Menthol', country: null },
  { name: 'Embassy', country: null },
  { name: 'Sportsman', country: null },
  { name: 'Classic Raw Rolling', country: null },
  { name: 'Dunhill', country: null },
  { name: 'Marlboro', country: 'USA' },
  { name: 'Vazo Zippo Vapes', country: null },
  { name: 'Villiger Cigars', country: null },
  { name: 'Organic Hemp Rolling Paper', country: null },
  { name: 'Nicotine-Pouches', country: 'Kenya' },
  { name: 'Bongani Cigars', country: null },
  { name: 'Sky-Nicotine-Pouches', country: 'Poland' },
  { name: 'Solo-X', country: null },
  { name: 'Kafie Cigars', country: 'Honduras' },
  { name: 'Montecristo Cigars', country: null },
  { name: 'Hart-Vape', country: null },
  
  // Rum Brands
  { name: 'Captain Morgan', country: null },
  { name: 'Old Monk', country: null },
  { name: 'Malibu', country: null },
  { name: 'Bumbu rum', country: null },
  { name: 'Bacardi Rum', country: null },
  { name: 'Myer\'s', country: null },
  { name: 'Don papa Rum', country: null },
  { name: 'Ron Zacapa', country: null },
  { name: 'Spytail', country: null },
  { name: 'Mount Gay Rum', country: null },
  { name: 'Diplomatico', country: null },
  { name: 'Bayou', country: null },
  { name: 'New Grove', country: null },
  { name: 'Contessa', country: null },
  { name: 'Bacardi Breezers', country: null },
  { name: 'Afri Bull', country: 'India' },
  { name: 'Tanduay', country: null },
  
  // Champagne Brands
  { name: 'Moët & Chandon Champagne', country: null },
  { name: 'Dom Pérignon Champagne', country: null },
  { name: 'Belaire Champagne Price in Kenya', country: null },
  { name: 'Veuve Clicquot', country: null },
  { name: 'Laurent Perrier', country: null },
  { name: 'Perrier Jouet', country: null },
  { name: 'GH-Mumm', country: null },
  { name: 'Arthur Metz Crémant', country: 'France' },
  { name: 'Taittinger Champagne', country: 'France' },
  { name: 'Perle Noir', country: 'France' },
  
  // Vapes Brands
  { name: 'Refillable Gas Lighter', country: null },
  { name: 'Irish Whiskey Chocolate', country: null },
  { name: 'Woosh Vapes', country: 'China' },
  { name: 'Beast-Vapes', country: 'Kenya' },
  { name: 'Tugboat vape pens', country: null },
  { name: 'AKSO VAPES', country: 'Malasyia' },
  { name: 'ZMR-Vapes', country: null },
  
  // Mixer spirit Brands
  { name: 'Red Bull GmbH', country: null },
  
  // Whisky/Whiskey (from add-missing-brands.js)
  { name: 'Jameson', country: 'Ireland' },
  { name: 'Jack Daniel\'s', country: 'USA' },
  { name: 'Johnnie Walker', country: 'Scotland' },
  { name: 'Glenfiddich', country: 'Scotland' },
  { name: 'Singleton', country: 'Scotland' },
  { name: 'Jim Beam', country: 'USA' },
  { name: 'Monkey Shoulder', country: 'Scotland' },
  { name: 'Black and White', country: 'Scotland' },
  { name: 'JnB', country: 'Scotland' },
  
  // Vodka
  { name: 'Absolut', country: 'Sweden' },
  { name: 'Smirnoff', country: 'Russia' },
  { name: 'Ciroc', country: 'France' },
  
  // Tequila
  { name: 'Don Julio', country: 'Mexico' },
  { name: 'Patron', country: 'Mexico' },
  { name: 'Jose Cuervo', country: 'Mexico' },
  { name: 'Olmeca', country: 'Mexico' },
  
  // Cognac/Brandy
  { name: 'Hennessy', country: 'France' },
  { name: 'Martell', country: 'France' },
  
  // Other popular brands
  { name: 'The Guv\'nor', country: null },
  { name: 'Mucho Mas', country: 'Spain' },
  { name: 'Olepasu', country: 'Italy' },
  { name: 'Bitola', country: 'Portugal' },
  { name: 'Choco Toffee', country: 'Germany' },
  { name: 'Bianco Nobile', country: 'Germany' },
];

async function migrateBrandsTable() {
  try {
    console.log('📦 Step 1: Creating/verifying brands table...');
    
    // Sync Brand model (creates table if it doesn't exist)
    await db.Brand.sync({ alter: false });
    console.log('   ✅ Brands table created/verified');

    // Add brandId column to drinks table if it doesn't exist
    const queryInterface = db.sequelize.getQueryInterface();
    
    // Check if brandId column exists
    try {
      const tableDescription = await queryInterface.describeTable('drinks');
      
      if (!tableDescription.brandId) {
        console.log('   📝 Adding brandId column to drinks table...');
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
    } catch (error) {
      if (error.message.includes('does not exist')) {
        console.log('   ⚠️  drinks table does not exist yet, skipping brandId column');
      } else {
        throw error;
      }
    }

    console.log('   ✅ Table migration completed\n');
    return true;
  } catch (error) {
    console.error('   ❌ Table migration failed:', error.message);
    throw error;
  }
}

async function importBrandsData() {
  try {
    console.log('📦 Step 2: Importing brands data...');
    
    const addedBrands = [];
    const existingBrands = [];
    const errors = [];

    for (const brandData of brandsData) {
      try {
        // Check if brand already exists
        const existing = await db.Brand.findOne({
          where: { name: brandData.name.trim() }
        });

        if (!existing) {
          // Create new brand
          const newBrand = await db.Brand.create({
            name: brandData.name.trim(),
            description: brandData.country ? `Country: ${brandData.country}` : null,
            isActive: true
          });
          addedBrands.push(newBrand);
          console.log(`   ✅ Added brand: ${brandData.name}`);
        } else {
          existingBrands.push(existing);
          console.log(`   ⏭️  Brand already exists: ${brandData.name}`);
        }
      } catch (error) {
        console.error(`   ❌ Error processing brand ${brandData.name}:`, error.message);
        errors.push({ brand: brandData.name, error: error.message });
      }
    }

    console.log('\n   📊 Import Summary:');
    console.log(`   ✅ Added: ${addedBrands.length} brands`);
    console.log(`   ⏭️  Already existed: ${existingBrands.length} brands`);
    console.log(`   ❌ Errors: ${errors.length} brands`);
    
    if (errors.length > 0) {
      console.log('\n   ❌ Errors:');
      errors.forEach(e => console.log(`      - ${e.brand}: ${e.error}`));
    }

    console.log('\n   ✅ Brands data import completed\n');
    return { addedBrands, existingBrands, errors };
  } catch (error) {
    console.error('   ❌ Brands data import failed:', error.message);
    throw error;
  }
}

async function runMigration() {
  try {
    console.log('🚀 Starting brands migration to Cloud SQL...\n');
    
    // Check DATABASE_URL
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error('❌ DATABASE_URL environment variable is not set');
      console.error('   Please set it to your Cloud SQL connection string');
      console.error('   Example: DATABASE_URL="postgres://user:password@host:port/database"');
      console.error('\n   For Cloud SQL, you can use:');
      console.error('   - Unix socket: postgres://user:password@/database?host=/cloudsql/PROJECT:REGION:INSTANCE');
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
      if (db.sequelize.config.dialectOptions) {
        db.sequelize.config.dialectOptions.ssl = false;
      }
    }
    
    await db.sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Run migration steps
    await migrateBrandsTable();
    const importResult = await importBrandsData();

    console.log('📊 Final Migration Summary:');
    console.log(`   ✅ Table migration: Completed`);
    console.log(`   ✅ Brands added: ${importResult.addedBrands.length}`);
    console.log(`   ⏭️  Brands already existed: ${importResult.existingBrands.length}`);
    console.log(`   ❌ Errors: ${importResult.errors.length}`);

    if (importResult.errors.length === 0) {
      console.log('\n🎉 Brands migration completed successfully!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Migration completed with some errors. Please review the errors above.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
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

// Run migration
runMigration();



