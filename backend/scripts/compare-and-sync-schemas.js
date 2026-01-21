#!/usr/bin/env node

/**
 * Compare local and cloud SQL database schemas and generate migrations
 * 
 * Usage:
 *   # Using Cloud SQL Proxy
 *   cloud_sql_proxy -instances=drink-suite:us-central1:drink-suite-db=tcp:5432 &
 *   CLOUD_DATABASE_URL="postgres://user:password@localhost:5432/database" node backend/scripts/compare-and-sync-schemas.js
 * 
 *   # Direct Cloud SQL connection
 *   CLOUD_DATABASE_URL="postgres://user:password@host/database" node backend/scripts/compare-and-sync-schemas.js
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // Load .env after .env.local

const { Sequelize } = require('sequelize');
const db = require('../models');

// Get local database config
const localConfig = require('../config').development;
const cloudDatabaseUrl = process.env.CLOUD_DATABASE_URL || process.env.DATABASE_URL;
const dryRun = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');

if (!cloudDatabaseUrl) {
  console.error('❌ Error: CLOUD_DATABASE_URL or DATABASE_URL environment variable is not set');
  console.error('   Please set it to your Cloud SQL connection string');
  process.exit(1);
}

if (dryRun) {
  console.log('🔍 DRY RUN MODE: No changes will be applied\n');
}

// Create separate Sequelize instances for local and cloud
const localSequelize = new Sequelize(
  localConfig.database,
  localConfig.username,
  localConfig.password,
  {
    host: localConfig.host,
    port: localConfig.port,
    dialect: 'postgres',
    logging: false
  }
);

const cloudSequelize = new Sequelize(cloudDatabaseUrl, {
  dialect: 'postgres',
  dialectOptions: cloudDatabaseUrl.includes('cloudsql') || cloudDatabaseUrl.includes('localhost:5432')
    ? { ssl: false }
    : { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});

// Function to get all tables from a database
async function getTables(sequelize) {
  const [tables] = await sequelize.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  return tables.map(t => t.table_name);
}

// Function to get columns for a table
async function getTableColumns(sequelize, tableName) {
  const [columns] = await sequelize.query(`
    SELECT 
      column_name,
      data_type,
      character_maximum_length,
      is_nullable,
      column_default,
      udt_name
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = :tableName
    ORDER BY ordinal_position;
  `, {
    replacements: { tableName }
  });
  return columns;
}

// Function to get constraints for a table
async function getTableConstraints(sequelize, tableName) {
  const [constraints] = await sequelize.query(`
    SELECT 
      tc.constraint_name,
      tc.constraint_type,
      kcu.column_name
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
      AND tc.table_name = kcu.table_name
    WHERE tc.table_schema = 'public' 
    AND tc.table_name = :tableName
    ORDER BY tc.constraint_type, tc.constraint_name;
  `, {
    replacements: { tableName }
  });
  return constraints;
}

// Function to map PostgreSQL data type to Sequelize type
function getSequelizeType(column) {
  const dataType = column.data_type.toLowerCase();
  const udtName = column.udt_name ? column.udt_name.toLowerCase() : '';

  if (udtName === 'bool' || dataType === 'boolean') {
    return { type: Sequelize.BOOLEAN };
  }
  if (udtName === 'int4' || dataType === 'integer') {
    return { type: Sequelize.INTEGER };
  }
  if (udtName === 'int8' || dataType === 'bigint') {
    return { type: Sequelize.BIGINT };
  }
  if (udtName === 'float8' || dataType === 'double precision') {
    return { type: Sequelize.DOUBLE };
  }
  if (udtName === 'numeric' || dataType === 'numeric') {
    return { type: Sequelize.DECIMAL };
  }
  if (udtName === 'varchar' || dataType === 'character varying') {
    return { type: Sequelize.STRING, length: column.character_maximum_length };
  }
  if (udtName === 'text' || dataType === 'text') {
    return { type: Sequelize.TEXT };
  }
  if (udtName === 'date' || dataType === 'date') {
    return { type: Sequelize.DATEONLY };
  }
  if (udtName === 'timestamp' || udtName === 'timestamptz' || dataType.includes('timestamp')) {
    return { type: Sequelize.DATE };
  }
  if (udtName === 'json' || dataType === 'json') {
    return { type: Sequelize.JSON };
  }
  if (udtName === 'jsonb' || dataType === 'jsonb') {
    return { type: Sequelize.JSONB };
  }
  
  // Default to STRING for unknown types
  return { type: Sequelize.STRING };
}

// Function to generate column definition
function generateColumnDefinition(column) {
  const typeDef = getSequelizeType(column);
  return {
    ...typeDef,
    allowNull: column.is_nullable === 'YES',
    defaultValue: column.column_default
  };
}

// Main comparison function
async function compareAndSyncSchemas() {
  try {
    console.log('🔍 Comparing Local and Cloud SQL Database Schemas\n');
    console.log('='.repeat(60));

    // Connect to both databases
    console.log('\n📊 Connecting to local database...');
    await localSequelize.authenticate();
    console.log('✅ Local database connected');

    console.log('\n📊 Connecting to cloud database...');
    await cloudSequelize.authenticate();
    console.log('✅ Cloud database connected');

    // Get all tables from both databases
    console.log('\n📋 Fetching table lists...');
    const localTables = await getTables(localSequelize);
    const cloudTables = await getTables(cloudSequelize);

    console.log(`   Local tables: ${localTables.length}`);
    console.log(`   Cloud tables: ${cloudTables.length}`);

    // Find missing tables in cloud
    const missingTables = localTables.filter(t => !cloudTables.includes(t));
    const extraCloudTables = cloudTables.filter(t => !localTables.includes(t));

    if (missingTables.length > 0) {
      console.log(`\n⚠️  Missing tables in cloud: ${missingTables.length}`);
      missingTables.forEach(t => console.log(`   - ${t}`));
    }

    if (extraCloudTables.length > 0) {
      console.log(`\nℹ️  Extra tables in cloud (not in local): ${extraCloudTables.length}`);
      extraCloudTables.forEach(t => console.log(`   - ${t}`));
    }

    // Compare columns for each table
    const allTables = [...new Set([...localTables, ...cloudTables])];
    const missingColumns = [];
    const columnDifferences = [];
    const nullabilityMismatches = [];

    console.log('\n🔍 Comparing columns...\n');

    for (const tableName of allTables) {
      if (!localTables.includes(tableName)) continue; // Skip tables not in local
      if (!cloudTables.includes(tableName)) continue; // Skip tables not in cloud (handled separately)

      const localColumns = await getTableColumns(localSequelize, tableName);
      const cloudColumns = await getTableColumns(cloudSequelize, tableName);

      const localColumnMap = new Map(localColumns.map(c => [c.column_name.toLowerCase(), c]));
      const cloudColumnMap = new Map(cloudColumns.map(c => [c.column_name.toLowerCase(), c]));
      const localColumnNames = new Set(localColumns.map(c => c.column_name.toLowerCase()));
      const cloudColumnNames = new Set(cloudColumns.map(c => c.column_name.toLowerCase()));

      // Find missing columns
      const missing = localColumns.filter(c => !cloudColumnNames.has(c.column_name.toLowerCase()));
      
      if (missing.length > 0) {
        missingColumns.push({
          table: tableName,
          columns: missing
        });
        console.log(`   📋 ${tableName}: ${missing.length} missing column(s)`);
      }

      // Find nullability mismatches: columns that are NULL in local but NOT NULL in cloud
      const commonColumns = localColumns.filter(c => cloudColumnNames.has(c.column_name.toLowerCase()));
      for (const localCol of commonColumns) {
        const cloudCol = cloudColumnMap.get(localCol.column_name.toLowerCase());
        if (cloudCol) {
          const localIsNullable = localCol.is_nullable === 'YES';
          const cloudIsNullable = cloudCol.is_nullable === 'YES';
          
          // Column is nullable in local but NOT NULL in cloud
          if (localIsNullable && !cloudIsNullable) {
            nullabilityMismatches.push({
              table: tableName,
              column: localCol.column_name,
              local: localIsNullable ? 'NULL' : 'NOT NULL',
              cloud: cloudIsNullable ? 'NULL' : 'NOT NULL'
            });
          }
        }
      }
    }

    // Report nullability mismatches
    if (nullabilityMismatches.length > 0) {
      console.log(`\n⚠️  Nullability mismatches: ${nullabilityMismatches.length}`);
      nullabilityMismatches.forEach(m => {
        console.log(`   - ${m.table}.${m.column}: Local=${m.local}, Cloud=${m.cloud}`);
      });
    }

    // Generate and apply migrations
    if (missingTables.length === 0 && missingColumns.length === 0 && nullabilityMismatches.length === 0) {
      console.log('\n✅ Schemas are in sync! No migrations needed.');
      return;
    }

    console.log('\n📝 Generating migrations...\n');

    const queryInterface = cloudSequelize.getQueryInterface();
    let migrationCount = 0;

    // Create missing tables
    for (const tableName of missingTables) {
      try {
        console.log(`\n🔨 Creating table: ${tableName}`);
        const localColumns = await getTableColumns(localSequelize, tableName);
        const columns = {};
        
        for (const col of localColumns) {
          columns[col.column_name] = generateColumnDefinition(col);
        }

        // Get primary key from constraints
        const constraints = await getTableConstraints(localSequelize, tableName);
        const primaryKey = constraints.find(c => c.constraint_type === 'PRIMARY KEY');

        if (primaryKey) {
          const pkColumn = columns[primaryKey.column_name];
          if (pkColumn) {
            pkColumn.primaryKey = true;
            if (pkColumn.type === Sequelize.INTEGER || pkColumn.type === Sequelize.BIGINT) {
              pkColumn.autoIncrement = true;
            }
          }
        }

        if (dryRun) {
          console.log(`   [DRY RUN] Would create table ${tableName}`);
        } else {
          await queryInterface.createTable(tableName, columns);
          console.log(`   ✅ Table ${tableName} created`);
        }
        migrationCount++;
      } catch (error) {
        console.error(`   ❌ Failed to create table ${tableName}:`, error.message);
      }
    }

    // Add missing columns
    for (const { table, columns } of missingColumns) {
      for (const column of columns) {
        try {
          console.log(`\n🔨 Adding column: ${table}.${column.column_name}`);
          const columnDef = generateColumnDefinition(column);
          
          if (dryRun) {
            console.log(`   [DRY RUN] Would add column ${table}.${column.column_name}`);
          } else {
            await queryInterface.addColumn(table, column.column_name, columnDef);
            console.log(`   ✅ Column ${table}.${column.column_name} added`);
          }
          migrationCount++;
        } catch (error) {
          console.error(`   ❌ Failed to add column ${table}.${column.column_name}:`, error.message);
        }
      }
    }

    // Fix nullability mismatches: Make columns nullable in cloud to match local
    for (const { table, column } of nullabilityMismatches) {
      try {
        console.log(`\n🔨 Altering column nullability: ${table}.${column} (making it nullable)`);
        
        if (dryRun) {
          console.log(`   [DRY RUN] Would alter ${table}.${column} to allow NULL`);
        } else {
          // Get the column definition from local to preserve data type
          const localColumns = await getTableColumns(localSequelize, table);
          const localCol = localColumns.find(c => c.column_name.toLowerCase() === column.toLowerCase());
          
          if (localCol) {
            const columnDef = generateColumnDefinition(localCol);
            // Use changeColumn to update nullability
            await queryInterface.changeColumn(table, column, columnDef);
            console.log(`   ✅ Column ${table}.${column} is now nullable`);
          } else {
            console.log(`   ⚠️  Could not find local column definition for ${table}.${column}`);
          }
        }
        migrationCount++;
      } catch (error) {
        console.error(`   ❌ Failed to alter column ${table}.${column}:`, error.message);
      }
    }

    if (dryRun) {
      console.log(`\n🔍 [DRY RUN] Would apply ${migrationCount} change(s).\n`);
      console.log('💡 To apply changes, run without --dry-run flag\n');
    } else {
      console.log(`\n✅ Migration complete! ${migrationCount} change(s) applied.\n`);
    }

  } catch (error) {
    console.error('\n❌ Error comparing schemas:', error);
    throw error;
  } finally {
    await localSequelize.close();
    await cloudSequelize.close();
  }
}

// Run the comparison
compareAndSyncSchemas()
  .then(() => {
    console.log('✅ Schema comparison completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Schema comparison failed:', error);
    process.exit(1);
  });
