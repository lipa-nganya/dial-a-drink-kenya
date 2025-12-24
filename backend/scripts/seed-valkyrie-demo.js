const db = require('../models');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * Seed script for Valkyrie demo partner
 * Creates a demo partner with sample users and drivers
 */
async function seedValkyrieDemo() {
  try {
    console.log('🌱 Seeding Valkyrie demo data...');

    // Generate API key and secret
    const apiKey = crypto.randomBytes(32).toString('hex');
    const apiSecret = crypto.randomBytes(32).toString('hex');

    // Create demo partner
    const partner = await db.ValkyriePartner.create({
      name: 'Demo Partner Company',
      status: 'active',
      allowedCities: ['Nairobi', 'Mombasa'],
      allowedVehicleTypes: ['motorcycle', 'car'],
      billingPlan: 'enterprise',
      apiKey: apiKey,
      apiSecret: apiSecret,
      webhookUrl: null, // Partner can configure this later
      webhookSecret: crypto.randomBytes(32).toString('hex')
    });

    console.log(`✅ Created demo partner: ${partner.name} (ID: ${partner.id})`);
    console.log(`   API Key: ${apiKey.substring(0, 16)}...`);

    // Create partner users
    const adminPassword = await bcrypt.hash('admin123', 10);
    const opsPassword = await bcrypt.hash('ops123', 10);
    const financePassword = await bcrypt.hash('finance123', 10);

    const adminUser = await db.ValkyriePartnerUser.create({
      partnerId: partner.id,
      email: 'admin@demopartner.com',
      password: adminPassword,
      role: 'admin',
      status: 'active'
    });

    const opsUser = await db.ValkyriePartnerUser.create({
      partnerId: partner.id,
      email: 'ops@demopartner.com',
      password: opsPassword,
      role: 'ops',
      status: 'active'
    });

    const financeUser = await db.ValkyriePartnerUser.create({
      partnerId: partner.id,
      email: 'finance@demopartner.com',
      password: financePassword,
      role: 'finance',
      status: 'active'
    });

    console.log(`✅ Created partner users:`);
    console.log(`   - Admin: admin@demopartner.com (password: admin123)`);
    console.log(`   - Ops: ops@demopartner.com (password: ops123)`);
    console.log(`   - Finance: finance@demopartner.com (password: finance123)`);

    // Get some existing drivers to add as partner-owned
    const existingDrivers = await db.Driver.findAll({
      limit: 3,
      order: [['createdAt', 'DESC']]
    });

    if (existingDrivers.length > 0) {
      for (const driver of existingDrivers) {
        await db.ValkyriePartnerDriver.create({
          partnerId: partner.id,
          driverId: driver.id,
          ownershipType: 'partner_owned',
          active: true
        });
      }
      console.log(`✅ Added ${existingDrivers.length} drivers as partner-owned`);
    } else {
      console.log(`ℹ️  No existing drivers found to add as partner-owned`);
    }

    // Mark some drivers as Valkyrie eligible (for DeliveryOS driver pool)
    // Check if column exists first
    try {
      const [results] = await db.sequelize.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'drivers' AND column_name = 'valkyrieEligible'
      `);
      
      if (results.length > 0) {
        const eligibleDrivers = await db.Driver.findAll({
          limit: 5,
          order: [['createdAt', 'DESC']],
          offset: 3 // Skip the ones we added as partner-owned
        });

        for (const driver of eligibleDrivers) {
          await driver.update({ valkyrieEligible: true });
        }
        console.log(`✅ Marked ${eligibleDrivers.length} drivers as Valkyrie eligible`);
      } else {
        console.log(`ℹ️  valkyrieEligible column not found - skipping driver eligibility marking`);
      }
    } catch (error) {
      console.log(`ℹ️  Could not mark drivers as eligible: ${error.message}`);
    }

    console.log(`✅ Marked ${eligibleDrivers.length} drivers as Valkyrie eligible`);

    console.log('\n📋 Demo Partner Summary:');
    console.log(`   Partner ID: ${partner.id}`);
    console.log(`   Partner Name: ${partner.name}`);
    console.log(`   API Key: ${apiKey}`);
    console.log(`   API Secret: ${apiSecret.substring(0, 16)}...`);
    console.log(`   Webhook Secret: ${partner.webhookSecret.substring(0, 16)}...`);
    console.log('\n✅ Valkyrie demo data seeded successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Set ENABLE_VALKYRIE=true in your environment');
    console.log('   2. Use the API key to authenticate: POST /api/valkyrie/v1/auth/token');
    console.log('   3. Or login to console: admin@demopartner.com / admin123');

    return {
      partner,
      apiKey,
      apiSecret
    };
  } catch (error) {
    console.error('❌ Error seeding Valkyrie demo data:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedValkyrieDemo()
    .then(() => {
      console.log('✅ Seed completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Seed failed:', error);
      process.exit(1);
    });
}

module.exports = seedValkyrieDemo;

