/**
 * Update admin user to super_admin role
 * This script updates admin@dialadrink.com to super_admin role
 * Super admins can:
 * - Set other super admins
 * - Approve their own cash submissions
 */

const db = require('../models');

async function updateAdminToSuperAdmin() {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Find the admin user
    const admin = await db.Admin.findOne({
      where: {
        email: 'admin@dialadrink.com'
      }
    });
    
    if (!admin) {
      console.error('❌ Admin user with email admin@dialadrink.com not found');
      console.log('\n📋 Available admin users:');
      const allAdmins = await db.Admin.findAll({
        attributes: ['id', 'username', 'email', 'role']
      });
      allAdmins.forEach(a => {
        console.log(`   - ${a.email} (${a.username}) - Role: ${a.role}`);
      });
      process.exit(1);
    }
    
    console.log(`\n📋 Found admin user:`);
    console.log(`   ID: ${admin.id}`);
    console.log(`   Username: ${admin.username}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Current Role: ${admin.role}`);
    
    if (admin.role === 'super_admin') {
      console.log('\n✅ Admin is already a super_admin. No changes needed.');
      process.exit(0);
    }
    
    // Update to super_admin
    await admin.update({ role: 'super_admin' });
    
    // Reload to verify
    await admin.reload();
    
    console.log(`\n✅ Successfully updated admin to super_admin!`);
    console.log(`   New Role: ${admin.role}`);
    console.log(`\n🎯 Super admin capabilities:`);
    console.log(`   ✓ Can set other super admins`);
    console.log(`   ✓ Can approve their own cash submissions`);
    console.log(`   ✓ Can approve/reject all cash submissions`);
    
  } catch (error) {
    console.error('❌ Error updating admin:', error);
    process.exit(1);
  } finally {
    await db.sequelize.close();
  }
}

// Run the script
updateAdminToSuperAdmin();
