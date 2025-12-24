const db = require('../models');
const bcrypt = require('bcryptjs');

/**
 * Seed script for Zeus demo data
 * Creates a demo Zeus admin and sample geofence
 */
async function seedZeusDemo() {
  try {
    console.log('🌱 Seeding Zeus demo data...');

    // Create Zeus admin
    const adminPassword = await bcrypt.hash('zeus123', 10);
    
    const zeusAdmin = await db.ZeusAdmin.create({
      email: 'zeus@deliveryos.com',
      password: adminPassword,
      role: 'super_admin',
      status: 'active'
    });

    console.log(`✅ Created Zeus admin: ${zeusAdmin.email} (password: zeus123)`);

    // Get first partner (or create one if none exists)
    let partner = await db.ValkyriePartner.findOne({
      order: [['createdAt', 'DESC']]
    });

    if (!partner) {
      console.log('⚠️  No partners found. Creating demo partner...');
      partner = await db.ValkyriePartner.create({
        name: 'Demo Partner for Zeus',
        status: 'active',
        billingPlan: 'enterprise',
        apiRateLimit: 2000,
        zeusManaged: true
      });
      console.log(`✅ Created demo partner: ${partner.name}`);
    }

    // Create a sample Zeus geofence (Nairobi area - example coordinates)
    // This is a simple polygon around Nairobi
    const nairobiGeofence = {
      type: 'Polygon',
      coordinates: [[
        [36.7, -1.4],  // Southwest
        [36.9, -1.4],  // Southeast
        [36.9, -1.2],  // Northeast
        [36.7, -1.2],  // Northwest
        [36.7, -1.4]   // Close polygon
      ]]
    };

    const geofence = await db.PartnerGeofence.create({
      partnerId: partner.id,
      name: 'Nairobi Delivery Zone',
      geometry: nairobiGeofence,
      source: 'zeus',
      active: true,
      createdBy: zeusAdmin.id
    });

    console.log(`✅ Created Zeus geofence: ${geofence.name} for partner ${partner.name}`);

    console.log('\n📋 Zeus Demo Summary:');
    console.log(`   Zeus Admin: ${zeusAdmin.email} / zeus123`);
    console.log(`   Partner: ${partner.name} (ID: ${partner.id})`);
    console.log(`   Geofence: ${geofence.name} (ID: ${geofence.id})`);
    console.log('\n✅ Zeus demo data seeded successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Set ENABLE_ZEUS=true in your environment');
    console.log('   2. Login to Zeus Console: zeus@deliveryos.com / zeus123');
    console.log('   3. Manage partners and geofences via API or Console');

    return {
      zeusAdmin,
      partner,
      geofence
    };
  } catch (error) {
    console.error('❌ Error seeding Zeus demo data:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedZeusDemo()
    .then(() => {
      console.log('✅ Seed completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Seed failed:', error);
      process.exit(1);
    });
}

module.exports = seedZeusDemo;






