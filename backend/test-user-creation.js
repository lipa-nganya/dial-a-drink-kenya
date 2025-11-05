require('dotenv').config();
const db = require('./models');

async function testUserCreation() {
  try {
    console.log('🔍 Testing database connection...');
    await db.sequelize.authenticate();
    console.log('✅ Database connected');
    
    console.log('\n🔍 Testing Admin model...');
    const Admin = db.Admin;
    console.log('✅ Admin model loaded');
    
    console.log('\n🔍 Checking if admins table exists...');
    const tableExists = await db.sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'admins'
      );
    `);
    console.log('✅ Admins table exists:', tableExists[0][0].exists);
    
    console.log('\n🔍 Checking table structure...');
    const columns = await db.sequelize.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'admins'
      ORDER BY ordinal_position;
    `);
    console.log('📋 Table columns:');
    columns[0].forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });
    
    console.log('\n🔍 Testing user creation...');
    const testUser = await Admin.create({
      username: 'test_' + Date.now(),
      email: 'test_' + Date.now() + '@test.com',
      role: 'manager',
      inviteToken: 'test_token',
      inviteTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      password: null
    });
    
    console.log('✅ Test user created:', testUser.id);
    
    // Clean up
    await testUser.destroy();
    console.log('✅ Test user deleted');
    
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.name);
    console.error('❌ Message:', error.message);
    if (error.original) {
      console.error('❌ Original:', error.original.message);
    }
    if (error.errors) {
      console.error('❌ Sequelize errors:');
      error.errors.forEach(e => {
        console.error(`  - ${e.path}: ${e.message} (value: ${e.value})`);
      });
    }
    console.error('\n❌ Stack:', error.stack);
    process.exit(1);
  }
}

testUserCreation();

