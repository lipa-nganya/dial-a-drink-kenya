require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

// Production database credentials
const PROD_HOST = '35.223.10.1';
const PROD_PORT = 5432;
const PROD_USER = 'dialadrink_app';
const PROD_PASSWORD = 'E7A3IIa60hFD3bkGH1XAiryvB';
const PROD_DB = 'dialadrink_prod';

const dbClient = new Client({
  host: PROD_HOST,
  port: PROD_PORT,
  user: PROD_USER,
  password: PROD_PASSWORD,
  database: PROD_DB,
  ssl: { require: true, rejectUnauthorized: false },
});

async function createProductionAdmin() {
  console.log('🔄 Creating admin user in production database...\n');

  try {
    await dbClient.connect();
    console.log('✅ Connected to production database\n');

    const username = 'admin';
    const email = 'admin@ruakadrinksdelivery.co.ke';
    const password = 'admin123';
    const role = 'admin';

    // Check if admin user already exists
    const existingUser = await dbClient.query(
      'SELECT id, username, email FROM admins WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      console.log('⚠️  Admin user already exists:');
      existingUser.rows.forEach(user => {
        console.log(`   ID: ${user.id}, Username: ${user.username}, Email: ${user.email}`);
      });
      console.log('\n🔄 Updating password for existing admin user...\n');
      
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
      console.log('✅ Password hashed');

      // Update existing user
      await dbClient.query(
        'UPDATE admins SET password = $1, role = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE username = $3 OR email = $4',
        [hashedPassword, role, username, email]
      );

      console.log('✅ Admin user password updated successfully!\n');
      
      // Verify the update
      const updatedUser = await dbClient.query(
        'SELECT id, username, email, role FROM admins WHERE username = $1 OR email = $2',
        [username, email]
      );
      
      if (updatedUser.rows.length > 0) {
        console.log('📋 Updated admin user details:');
        updatedUser.rows.forEach(user => {
          console.log(`   ID: ${user.id}`);
          console.log(`   Username: ${user.username}`);
          console.log(`   Email: ${user.email}`);
          console.log(`   Role: ${user.role}`);
        });
      }
      
      console.log('\n✅ Admin user ready to use!');
      console.log('   Username: admin');
      console.log('   Password: admin123\n');
      
      return;
    }

    // Hash the password
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('✅ Password hashed');

    // Insert new admin user
    console.log('\n📝 Inserting admin user...');
    const result = await dbClient.query(
      `INSERT INTO admins (username, email, password, role, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, username, email, role`,
      [username, email, hashedPassword, role]
    );

    if (result.rows.length > 0) {
      const newAdmin = result.rows[0];
      console.log('\n✅ Admin user created successfully!\n');
      console.log('📋 Admin user details:');
      console.log(`   ID: ${newAdmin.id}`);
      console.log(`   Username: ${newAdmin.username}`);
      console.log(`   Email: ${newAdmin.email}`);
      console.log(`   Role: ${newAdmin.role}`);
      console.log('\n✅ Admin user ready to use!');
      console.log('   Username: admin');
      console.log('   Password: admin123\n');
    } else {
      console.error('❌ Failed to create admin user - no rows returned');
    }

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    if (error.code === '23505') {
      console.error('   This username or email already exists');
    }
    throw error;
  } finally {
    await dbClient.end();
    console.log('🔌 Database connection closed\n');
  }
}

// Run the script
createProductionAdmin()
  .then(() => {
    console.log('✅ Script completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
