require('dotenv').config();
const { Sequelize } = require('sequelize');

async function compareSchemas() {
  try {
    console.log('📊 Comparing admin_wallets schema between local and dev databases\n');

    // Local database connection
    const localDb = process.env.DB_NAME || 'dialadrink';
    const localHost = process.env.DB_HOST || 'localhost';
    const localPort = process.env.DB_PORT || 5432;
    const localUser = process.env.DB_USER || 'postgres';
    const localPassword = process.env.DB_PASSWORD || 'password';

    const localSequelize = new Sequelize(localDb, localUser, localPassword, {
      host: localHost,
      port: localPort,
      dialect: 'postgres',
      logging: false
    });

    // Dev database connection (from DATABASE_URL)
    const devDatabaseUrl = process.env.DATABASE_URL;
    if (!devDatabaseUrl) {
      console.error('❌ DATABASE_URL not set. Cannot compare with dev database.');
      process.exit(1);
    }

    const devSequelize = new Sequelize(devDatabaseUrl, {
      dialect: 'postgres',
      dialectOptions: {
        ssl: devDatabaseUrl.includes('sslmode=require') && !devDatabaseUrl.includes('/cloudsql/') ? {
          require: true,
          rejectUnauthorized: false
        } : false
      },
      logging: false
    });

    // Set NODE_TLS_REJECT_UNAUTHORIZED for SSL
    if (devDatabaseUrl.includes('sslmode=require')) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    console.log('🔌 Connecting to local database...');
    await localSequelize.authenticate();
    console.log('✅ Local database connected');

    console.log('🔌 Connecting to dev database...');
    await devSequelize.authenticate();
    console.log('✅ Dev database connected\n');

    // Get columns from both databases
    const [localColumns] = await localSequelize.query(`
      SELECT 
        column_name, 
        data_type, 
        column_default,
        is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'admin_wallets'
      ORDER BY ordinal_position;
    `);

    const [devColumns] = await devSequelize.query(`
      SELECT 
        column_name, 
        data_type, 
        column_default,
        is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'admin_wallets'
      ORDER BY ordinal_position;
    `);

    console.log('📋 LOCAL DATABASE - admin_wallets columns:');
    console.table(localColumns);

    console.log('\n📋 DEV DATABASE - admin_wallets columns:');
    console.table(devColumns);

    // Compare columns
    const localColumnNames = localColumns.map(c => c.column_name).sort();
    const devColumnNames = devColumns.map(c => c.column_name).sort();

    console.log('\n🔍 Comparison:');
    console.log(`   Local columns: ${localColumnNames.length}`);
    console.log(`   Dev columns: ${devColumnNames.length}`);

    const missingInDev = localColumnNames.filter(name => !devColumnNames.includes(name));
    const missingInLocal = devColumnNames.filter(name => !localColumnNames.includes(name));

    if (missingInDev.length > 0) {
      console.log(`\n⚠️  Columns in LOCAL but missing in DEV: ${missingInDev.join(', ')}`);
    }

    if (missingInLocal.length > 0) {
      console.log(`\n⚠️  Columns in DEV but missing in LOCAL: ${missingInLocal.join(', ')}`);
    }

    if (missingInDev.length === 0 && missingInLocal.length === 0) {
      console.log('\n✅ Both databases have the same columns!');
    }

    // Check cashAtHand specifically
    const localHasCashAtHand = localColumnNames.includes('cashAtHand');
    const devHasCashAtHand = devColumnNames.includes('cashAtHand');

    console.log('\n💰 cashAtHand column status:');
    console.log(`   Local: ${localHasCashAtHand ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   Dev: ${devHasCashAtHand ? '✅ EXISTS' : '❌ MISSING'}`);

    await localSequelize.close();
    await devSequelize.close();

    console.log('\n✅ Schema comparison completed!');

  } catch (error) {
    console.error('\n❌ Error comparing schemas:', error.message);
    if (error.original) {
      console.error('   Original error:', error.original.message);
    }
    process.exit(1);
  }
}

compareSchemas();
