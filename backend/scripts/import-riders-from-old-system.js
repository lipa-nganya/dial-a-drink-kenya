require('dotenv').config();
const db = require('../models');
const bcrypt = require('bcryptjs');

/**
 * Import riders/drivers from old system
 * 
 * Usage:
 * 1. Create a JSON file with rider data or pass data directly
 * 2. Run: node backend/scripts/import-riders-from-old-system.js
 * 
 * Expected data format:
 * [
 *   {
 *     name: "Driver Name",
 *     phoneNumber: "254712345678", // or "0712345678"
 *     status: "offline" // optional: active, inactive, on_delivery, offline
 *   },
 *   ...
 * ]
 */

async function normalizePhoneNumber(phone) {
  if (!phone) return null;
  
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If starts with 0, replace with 254
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.substring(1);
  }
  
  // If doesn't start with 254, add it
  if (!cleaned.startsWith('254')) {
    cleaned = '254' + cleaned;
  }
  
  return cleaned;
}

async function importRiders(riderData) {
  console.log('🚴 Starting rider import...');
  console.log(`📊 Total riders to import: ${riderData.length}`);
  
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection established');
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const rider of riderData) {
      try {
        // Validate required fields
        if (!rider.name || !rider.phoneNumber) {
          console.log(`⚠️  Skipping rider: Missing name or phone number`, rider);
          skipped++;
          continue;
        }
        
        // Normalize phone number
        const normalizedPhone = await normalizePhoneNumber(rider.phoneNumber);
        if (!normalizedPhone || normalizedPhone.length < 10) {
          console.log(`⚠️  Skipping rider: Invalid phone number "${rider.phoneNumber}"`, rider);
          skipped++;
          continue;
        }
        
        // Check if driver already exists
        const existingDriver = await db.Driver.findOne({
          where: {
            phoneNumber: normalizedPhone
          }
        });
        
        if (existingDriver) {
          console.log(`ℹ️  Driver already exists: ${rider.name} (${normalizedPhone}) - Skipping`);
          skipped++;
          continue;
        }
        
        // Validate status
        const validStatuses = ['active', 'inactive', 'on_delivery', 'offline'];
        const status = rider.status && validStatuses.includes(rider.status.toLowerCase())
          ? rider.status.toLowerCase()
          : 'offline';
        
        // Create driver
        const driver = await db.Driver.create({
          name: rider.name.trim(),
          phoneNumber: normalizedPhone,
          status: status,
          valkyrieEligible: rider.valkyrieEligible || false
        });
        
        console.log(`✅ Imported driver: ${driver.name} (${driver.phoneNumber}) - ID: ${driver.id}`);
        
        // Create wallet for driver
        try {
          const wallet = await db.DriverWallet.create({
            driverId: driver.id,
            balance: 0,
            totalTipsReceived: 0,
            totalTipsCount: 0,
            totalDeliveryPay: 0,
            totalDeliveryPayCount: 0
          });
          console.log(`   💰 Created wallet for driver ${driver.id}`);
        } catch (walletError) {
          console.log(`   ⚠️  Wallet creation failed (may already exist): ${walletError.message}`);
        }
        
        imported++;
      } catch (error) {
        console.error(`❌ Error importing rider "${rider.name}":`, error.message);
        errors++;
      }
    }
    
    console.log('\n📊 Import Summary:');
    console.log(`   ✅ Imported: ${imported}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📦 Total: ${riderData.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// If running directly, check for data file or use sample data
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  
  // Check for JSON file with rider data
  const dataFile = path.join(__dirname, '../../riders-data.json');
  
  if (fs.existsSync(dataFile)) {
    console.log(`📁 Found data file: ${dataFile}`);
    const riderData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    importRiders(riderData);
  } else {
    console.log('📝 No data file found. Please create riders-data.json with the following format:');
    console.log(`
[
  {
    "name": "John Doe",
    "phoneNumber": "254712345678",
    "status": "offline"
  },
  {
    "name": "Jane Smith",
    "phoneNumber": "0712345678",
    "status": "active"
  }
]
    `);
    console.log('\nOr pass data directly by modifying this script.');
    process.exit(1);
  }
}

module.exports = { importRiders, normalizePhoneNumber };

