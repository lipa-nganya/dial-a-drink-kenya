require('dotenv').config();
const db = require('../models');

async function updatePhonePrefixes() {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection established');
    
    const drivers = await db.Driver.findAll({
      where: {
        phoneNumber: {
          [db.Sequelize.Op.like]: '254%'
        }
      }
    });
    
    console.log(`\n📋 Found ${drivers.length} drivers with 254 prefix\n`);
    
    for (const driver of drivers) {
      const oldPhone = driver.phoneNumber;
      const newPhone = '0' + oldPhone.substring(3);
      await driver.update({ phoneNumber: newPhone });
      console.log(`✅ Updated: ${driver.name} - ${oldPhone} → ${newPhone}`);
    }
    
    console.log(`\n✅ Successfully updated ${drivers.length} drivers`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updatePhonePrefixes();

