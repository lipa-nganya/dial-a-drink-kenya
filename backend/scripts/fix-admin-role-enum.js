#!/usr/bin/env node

/**
 * Fix admin role enum to include 'shop_agent'
 * Adds 'shop_agent' to the enum if it doesn't exist
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { Sequelize } = require('sequelize');

const cloudDatabaseUrl = process.env.CLOUD_DATABASE_URL || process.env.DATABASE_URL;

if (!cloudDatabaseUrl) {
  console.error('❌ Error: CLOUD_DATABASE_URL or DATABASE_URL environment variable is not set');
  process.exit(1);
}

const cloudSequelize = new Sequelize(cloudDatabaseUrl, {
  dialect: 'postgres',
  dialectOptions: cloudDatabaseUrl.includes('cloudsql') || cloudDatabaseUrl.includes('localhost:5432')
    ? { ssl: false }
    : { ssl: { require: true, rejectUnauthorized: false } },
  logging: console.log
});

async function fixAdminRoleEnum() {
  try {
    console.log('🔍 Checking admin role enum...\n');
    
    await cloudSequelize.authenticate();
    console.log('✅ Connected to cloud database\n');

    // First, check what enum type name is actually used
    const [enumTypes] = await cloudSequelize.query(`
      SELECT t.typname as enum_name
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname LIKE '%admin%role%' OR t.typname LIKE '%admins_role%'
      GROUP BY t.typname;
    `);

    if (enumTypes.length === 0) {
      console.error('❌ Could not find admin role enum type');
      process.exit(1);
    }

    const enumTypeName = enumTypes[0].enum_name;
    console.log(`📋 Found enum type: ${enumTypeName}\n`);

    // Check current enum values
    const [currentValues] = await cloudSequelize.query(`
      SELECT enumlabel as value
      FROM pg_enum
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = :enumTypeName)
      ORDER BY enumsortorder;
    `, {
      replacements: { enumTypeName }
    });

    console.log('📋 Current enum values:');
    currentValues.forEach(v => console.log(`   - ${v.value}`));

    const hasShopAgent = currentValues.some(v => v.value === 'shop_agent');
    const hasSuperAdmin = currentValues.some(v => v.value === 'super_admin');

    if (hasShopAgent) {
      console.log('\n✅ "shop_agent" already exists in enum');
      if (!hasSuperAdmin) {
        console.log('⚠️  "super_admin" is missing. Adding it...');
        await cloudSequelize.query(`
          DO $$ BEGIN
            ALTER TYPE "${enumTypeName}" ADD VALUE IF NOT EXISTS 'super_admin';
          EXCEPTION
            WHEN duplicate_object THEN null;
          END $$;
        `);
        console.log('✅ "super_admin" added to enum');
      }
    } else {
      console.log('\n🔨 Adding "shop_agent" to enum...');
      
      // PostgreSQL doesn't support adding enum values in transactions easily,
      // so we'll use the same approach as the migration: create new enum, alter column, rename
      try {
        // Create new enum with all values
        await cloudSequelize.query(`
          DO $$ BEGIN
            CREATE TYPE "${enumTypeName}_new" AS ENUM ('admin', 'manager', 'shop_agent', 'super_admin');
          EXCEPTION
            WHEN duplicate_object THEN null;
          END $$;
        `);

        // Alter column to use new enum
        await cloudSequelize.query(`
          ALTER TABLE "admins" 
          ALTER COLUMN "role" TYPE "${enumTypeName}_new" 
          USING (
            CASE 
              WHEN "role"::text = 'shop_agent' THEN 'shop_agent'::"${enumTypeName}_new"
              WHEN "role"::text = 'super_admin' THEN 'super_admin'::"${enumTypeName}_new"
              ELSE "role"::text::"${enumTypeName}_new"
            END
          );
        `);

        // Drop old enum
        await cloudSequelize.query(`
          DROP TYPE IF EXISTS "${enumTypeName}";
        `);

        // Rename new enum to old name
        await cloudSequelize.query(`
          ALTER TYPE "${enumTypeName}_new" RENAME TO "${enumTypeName}";
        `);

        console.log('✅ "shop_agent" and "super_admin" added to enum');
      } catch (error) {
        // If the new enum already exists or something else fails, try simpler approach
        console.log('⚠️  First approach failed, trying alternative...');
        console.log(`   Error: ${error.message}`);
        
        // Try adding values one by one
        try {
          await cloudSequelize.query(`
            DO $$ BEGIN
              ALTER TYPE "${enumTypeName}" ADD VALUE IF NOT EXISTS 'shop_agent';
            EXCEPTION
              WHEN duplicate_object THEN null;
              WHEN OTHERS THEN
                RAISE NOTICE 'Could not add shop_agent: %', SQLERRM;
            END $$;
          `);
          
          if (!hasSuperAdmin) {
            await cloudSequelize.query(`
              DO $$ BEGIN
                ALTER TYPE "${enumTypeName}" ADD VALUE IF NOT EXISTS 'super_admin';
              EXCEPTION
                WHEN duplicate_object THEN null;
              END $$;
            `);
          }
          
          console.log('✅ Enum values added successfully');
        } catch (altError) {
          console.error('❌ Alternative approach also failed:', altError.message);
          throw altError;
        }
      }
    }

    // Verify final state
    const [finalValues] = await cloudSequelize.query(`
      SELECT enumlabel as value
      FROM pg_enum
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = :enumTypeName)
      ORDER BY enumsortorder;
    `, {
      replacements: { enumTypeName }
    });

    console.log('\n📋 Final enum values:');
    finalValues.forEach(v => console.log(`   - ${v.value}`));

    const expectedValues = ['admin', 'manager', 'shop_agent', 'super_admin'];
    const missing = expectedValues.filter(v => !finalValues.some(fv => fv.value === v));
    
    if (missing.length === 0) {
      console.log('\n✅ All required enum values are present!');
    } else {
      console.log(`\n⚠️  Missing values: ${missing.join(', ')}`);
    }

  } catch (error) {
    console.error('\n❌ Error fixing enum:', error);
    throw error;
  } finally {
    await cloudSequelize.close();
  }
}

fixAdminRoleEnum()
  .then(() => {
    console.log('\n✅ Enum fix completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Enum fix failed:', error);
    process.exit(1);
  });
