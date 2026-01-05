require('dotenv').config();
const db = require('../models');
const crypto = require('crypto');

async function testSandboxCreation() {
  console.log('🧪 Testing Sandbox Account Creation\n');
  
  const testEmail = `test-${Date.now()}@example.com`;
  const apiKey = `sk_test_${crypto.randomBytes(32).toString('hex')}`;
  
  console.log('Test data:');
  console.log('  Email:', testEmail);
  console.log('  API Key:', apiKey.substring(0, 20) + '...');
  console.log('');
  
  // Test 1: Check if model is available
  console.log('Test 1: Checking model availability...');
  if (!db.ValkyriePartner) {
    console.error('❌ ValkyriePartner model not available');
    process.exit(1);
  }
  console.log('✅ ValkyriePartner model is available');
  console.log('');
  
  // Test 2: Check database connection
  console.log('Test 2: Checking database connection...');
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
  console.log('');
  
  // Test 3: Check table structure
  console.log('Test 3: Checking table structure...');
  try {
    const [results] = await db.sequelize.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'valkyrie_partners'
      AND column_name = 'allowedCities'
    `);
    
    if (results.length > 0) {
      console.log('✅ allowedCities column exists:');
      console.log('   Type:', results[0].data_type);
      console.log('   Default:', results[0].column_default);
      console.log('   Nullable:', results[0].is_nullable);
    } else {
      console.log('⚠️  allowedCities column not found');
    }
  } catch (error) {
    console.error('❌ Error checking table structure:', error.message);
  }
  console.log('');
  
  // Test 4: Check for triggers
  console.log('Test 4: Checking for triggers...');
  try {
    const [triggers] = await db.sequelize.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'valkyrie_partners'
    `);
    
    if (triggers.length > 0) {
      console.log('⚠️  Found triggers on valkyrie_partners:');
      triggers.forEach(t => {
        console.log(`   - ${t.trigger_name} (${t.event_manipulation})`);
      });
    } else {
      console.log('✅ No triggers found');
    }
  } catch (error) {
    console.error('❌ Error checking triggers:', error.message);
  }
  console.log('');
  
  // Test 5: Try creating with minimal data
  console.log('Test 5: Attempting to create partner with minimal data...');
  try {
    const partner = await db.ValkyriePartner.create({
      name: `Test Sandbox Partner (${testEmail})`,
      status: 'active',
      environment: 'sandbox',
      productionEnabled: false,
      billingPlan: 'sandbox',
      apiRateLimit: 100,
      apiKey: apiKey,
      zeusManaged: false
    });
    console.log('✅ Partner created successfully!');
    console.log('   ID:', partner.id);
    console.log('   Name:', partner.name);
    
    // Clean up
    await partner.destroy();
    console.log('✅ Test partner cleaned up');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating partner:', error.message);
    console.error('   Error name:', error.name);
    console.error('   Error code:', error.code);
    if (error.stack) {
      console.error('   Stack:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
    console.log('');
    
    // Test 6: Try with raw SQL
    console.log('Test 6: Attempting with raw SQL (excluding allowedCities)...');
    try {
      const [results] = await db.sequelize.query(`
        INSERT INTO valkyrie_partners (
          name, status, environment, "productionEnabled", 
          "billingPlan", "apiRateLimit", "apiKey", "zeusManaged",
          "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
        ) RETURNING id, name
      `, {
        bind: [
          `Test Sandbox Partner (${testEmail})`,
          'active',
          'sandbox',
          false,
          'sandbox',
          100,
          apiKey,
          false
        ]
      });
      
      console.log('✅ Partner created with raw SQL!');
      console.log('   ID:', results[0].id);
      
      // Clean up
      await db.sequelize.query(`DELETE FROM valkyrie_partners WHERE id = $1`, {
        bind: [results[0].id]
      });
      console.log('✅ Test partner cleaned up');
      process.exit(0);
    } catch (rawError) {
      console.error('❌ Error with raw SQL:', rawError.message);
      console.error('   Error name:', rawError.name);
      console.error('   Error code:', rawError.code);
      if (rawError.stack) {
        console.error('   Stack:', rawError.stack.split('\n').slice(0, 5).join('\n'));
      }
    }
    console.log('');
    
    // Test 7: Check if there's a default value issue
    console.log('Test 7: Checking default value behavior...');
    try {
      const [defaultCheck] = await db.sequelize.query(`
        SELECT column_default
        FROM information_schema.columns
        WHERE table_name = 'valkyrie_partners'
        AND column_name = 'allowedCities'
      `);
      
      if (defaultCheck.length > 0 && defaultCheck[0].column_default) {
        console.log('⚠️  Default value found:', defaultCheck[0].column_default);
        console.log('   This might be causing the issue if it\'s trying to set a string');
      } else {
        console.log('✅ No problematic default value');
      }
    } catch (error) {
      console.error('❌ Error checking default:', error.message);
    }
    
    process.exit(1);
  }
}

// Run the test
testSandboxCreation().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});














