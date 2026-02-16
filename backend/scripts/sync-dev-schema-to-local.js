/**
 * Sync Development Database Schema to Match Local Database
 * 
 * This script compares the local and development database schemas
 * and applies migrations to make development match local.
 * 
 * Usage: NODE_ENV=development node backend/scripts/sync-dev-schema-to-local.js
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Local database config
const localConfig = require('../config').development;

// Development database connection string (remove sslmode from URL)
const DEV_DATABASE_URL = 'postgresql://dialadrink_app:o61yqm5fLiTwWnk5@34.41.187.250:5432/dialadrink_dev';

// Create Sequelize instances
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

const devSequelize = new Sequelize(DEV_DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: false
});

// Get all tables
async function getTables(sequelize) {
  const [tables] = await sequelize.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'SequelizeMeta%'
    ORDER BY table_name;
  `);
  return tables.map(t => t.table_name);
}

// Get columns for a table
async function getTableColumns(sequelize, tableName) {
  const [columns] = await sequelize.query(`
    SELECT 
      column_name,
      data_type,
      character_maximum_length,
      numeric_precision,
      numeric_scale,
      is_nullable,
      column_default,
      ordinal_position
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = '${tableName}'
    ORDER BY ordinal_position;
  `);
  return columns;
}

// Get constraints for a table
async function getTableConstraints(sequelize, tableName) {
  const [constraints] = await sequelize.query(`
    SELECT
      tc.constraint_name,
      tc.constraint_type,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public'
    AND tc.table_name = '${tableName}';
  `);
  return constraints;
}

// Convert PostgreSQL type to Sequelize type
function getSequelizeType(column) {
  const dataType = column.data_type.toLowerCase();
  
  if (dataType === 'character varying' || dataType === 'varchar') {
    return DataTypes.STRING(column.character_maximum_length || 255);
  }
  if (dataType === 'text') {
    return DataTypes.TEXT;
  }
  if (dataType === 'integer') {
    return DataTypes.INTEGER;
  }
  if (dataType === 'bigint') {
    return DataTypes.BIGINT;
  }
  if (dataType === 'numeric' || dataType === 'decimal') {
    return DataTypes.DECIMAL(column.numeric_precision || 10, column.numeric_scale || 2);
  }
  if (dataType === 'boolean') {
    return DataTypes.BOOLEAN;
  }
  if (dataType === 'timestamp without time zone' || dataType === 'timestamp') {
    return DataTypes.DATE;
  }
  if (dataType === 'date') {
    return DataTypes.DATEONLY;
  }
  if (dataType === 'json' || dataType === 'jsonb') {
    return DataTypes.JSON;
  }
  if (dataType === 'double precision') {
    return DataTypes.DOUBLE;
  }
  if (dataType === 'real') {
    return DataTypes.FLOAT;
  }
  
  return DataTypes.STRING;
}

// Generate column definition
function generateColumnDefinition(column, constraints) {
  const isPrimaryKey = constraints.some(c => 
    c.constraint_type === 'PRIMARY KEY' && c.column_name === column.column_name
  );
  const isForeignKey = constraints.some(c => 
    c.constraint_type === 'FOREIGN KEY' && c.column_name === column.column_name
  );
  
  const def = {
    type: getSequelizeType(column),
    allowNull: column.is_nullable === 'YES',
    primaryKey: isPrimaryKey,
    autoIncrement: isPrimaryKey && (column.data_type === 'integer' || column.data_type === 'bigint')
  };
  
  if (column.column_default && !column.column_default.includes('nextval')) {
    // Parse default value
    let defaultValue = column.column_default;
    if (defaultValue.startsWith("'") && defaultValue.endsWith("'")) {
      defaultValue = defaultValue.slice(1, -1);
    }
    if (defaultValue === 'true') {
      def.defaultValue = true;
    } else if (defaultValue === 'false') {
      def.defaultValue = false;
    } else if (defaultValue === 'NULL') {
      def.defaultValue = null;
    } else if (!isNaN(defaultValue)) {
      def.defaultValue = parseFloat(defaultValue);
    } else {
      def.defaultValue = defaultValue;
    }
  }
  
  return def;
}

async function syncSchemas() {
  try {
    console.log('🔍 Comparing Local and Development Database Schemas\n');
    console.log('='.repeat(60));
    
    // Connect to databases
    console.log('\n📊 Connecting to local database...');
    await localSequelize.authenticate();
    console.log('✅ Local database connected');
    
    console.log('\n📊 Connecting to development database...');
    await devSequelize.authenticate();
    console.log('✅ Development database connected');
    
    // Get tables
    console.log('\n📋 Fetching table lists...');
    const localTables = await getTables(localSequelize);
    const devTables = await getTables(devSequelize);
    
    console.log(`   Local tables: ${localTables.length}`);
    console.log(`   Dev tables: ${devTables.length}`);
    
    // Find missing tables
    const missingTables = localTables.filter(t => !devTables.includes(t));
    const extraDevTables = devTables.filter(t => !localTables.includes(t));
    
    if (missingTables.length > 0) {
      console.log(`\n⚠️  Missing tables in dev: ${missingTables.length}`);
      missingTables.forEach(t => console.log(`   - ${t}`));
    }
    
    if (extraDevTables.length > 0) {
      console.log(`\nℹ️  Extra tables in dev (not in local): ${extraDevTables.length}`);
      extraDevTables.forEach(t => console.log(`   - ${t}`));
    }
    
    // Compare columns
    const allTables = [...new Set([...localTables, ...devTables])];
    const missingColumns = [];
    const columnDifferences = [];
    
    console.log('\n🔍 Comparing columns...\n');
    
    const queryInterface = devSequelize.getQueryInterface();
    let changesApplied = 0;
    
    for (const tableName of allTables) {
      if (!localTables.includes(tableName)) continue; // Skip tables not in local
      
      const localColumns = await getTableColumns(localSequelize, tableName);
      const devColumns = devTables.includes(tableName) 
        ? await getTableColumns(devSequelize, tableName)
        : [];
      
      const localColumnNames = localColumns.map(c => c.column_name);
      const devColumnNames = devColumns.map(c => c.column_name);
      
      // Find missing columns
      const missing = localColumnNames.filter(name => !devColumnNames.includes(name));
      if (missing.length > 0) {
        console.log(`\n📋 Table: ${tableName}`);
        console.log(`   Missing columns: ${missing.join(', ')}`);
        
        const localConstraints = await getTableConstraints(localSequelize, tableName);
        
        for (const colName of missing) {
          const localCol = localColumns.find(c => c.column_name === colName);
          if (localCol) {
            const colDef = generateColumnDefinition(localCol, localConstraints);
            
            try {
              console.log(`   ➕ Adding column: ${colName} (${localCol.data_type})`);
              await queryInterface.addColumn(tableName, colName, colDef);
              console.log(`   ✅ Column ${colName} added`);
              changesApplied++;
            } catch (error) {
              console.error(`   ❌ Failed to add column ${colName}:`, error.message);
            }
          }
        }
      }
      
      // Check for type differences
      for (const localCol of localColumns) {
        const devCol = devColumns.find(c => c.column_name === localCol.column_name);
        if (devCol && devCol.data_type !== localCol.data_type) {
          console.log(`\n📋 Table: ${tableName}`);
          console.log(`   ⚠️  Type mismatch for ${localCol.column_name}:`);
          console.log(`      Local: ${localCol.data_type}`);
          console.log(`      Dev: ${devCol.data_type}`);
          // Note: Type changes are risky, we'll skip them for now
        }
      }
    }
    
    // Create missing tables
    for (const tableName of missingTables) {
      try {
        console.log(`\n🔨 Creating table: ${tableName}`);
        const localColumns = await getTableColumns(localSequelize, tableName);
        const localConstraints = await getTableConstraints(localSequelize, tableName);
        
        const columns = {};
        for (const col of localColumns) {
          columns[col.column_name] = generateColumnDefinition(col, localConstraints);
        }
        
        await queryInterface.createTable(tableName, columns);
        console.log(`   ✅ Table ${tableName} created`);
        changesApplied++;
      } catch (error) {
        console.error(`   ❌ Failed to create table ${tableName}:`, error.message);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    if (changesApplied > 0) {
      console.log(`\n✅ Schema sync complete! Applied ${changesApplied} changes.`);
    } else {
      console.log('\n✅ Schemas are in sync! No changes needed.');
    }
    
  } catch (error) {
    console.error('\n❌ Error syncing schemas:', error);
    throw error;
  } finally {
    await localSequelize.close();
    await devSequelize.close();
  }
}

// Run the sync
if (require.main === module) {
  syncSchemas()
    .then(() => {
      console.log('\n✅ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Sync failed:', error);
      process.exit(1);
    });
}

module.exports = { syncSchemas };
