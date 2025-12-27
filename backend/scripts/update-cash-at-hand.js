require('dotenv').config();
const db = require('../models');

// Cash at hand data from old system (mapped by phone number with 0 prefix)
const cashAtHandData = {
  '0728157131': 20000,    // Albert Matata
  '0705579900': 20000,    // Benson Machembe
  '0719485814': 25000,    // Boniface Libabu
  '0729855347': 1000000,  // Bryan
  '0712158480': 50000,    // Charles Kagwi
  '0716634554': 20000,    // David Mwangi
  '0727907449': 1000000,  // Dennis
  '0725396746': 150000,   // Frazy
  '0729258359': 200000,   // James Maina
  '0700659300': 50000,    // joel munyao
  '0720308988': 20000,    // John Baoni
  '0715319566': 20000,    // Joram Ndungu
  '0722608815': 20000,    // Joseph kamau
  '0728126573': 20000,    // Julius Wambua
  '0720595452': 20000,    // Nick Musili
  '0713615495': 20000,    // Office Payable
  '0721757500': 5,        // Simon
  '0710550084': 100000,   // Stephen Njuguna
  '0705218430': 50000     // Victor Mwangi
};

async function updateCashAtHand() {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection established');
    
    let updated = 0;
    let notFound = 0;
    
    for (const [phone, cashAmount] of Object.entries(cashAtHandData)) {
      const driver = await db.Driver.findOne({
        where: { phoneNumber: phone }
      });
      
      if (driver) {
        await driver.update({ cashAtHand: cashAmount });
        console.log(`✅ Updated: ${driver.name} (${phone}) - Cash at hand: KES ${cashAmount.toLocaleString()}`);
        updated++;
      } else {
        console.log(`⚠️  Driver not found: ${phone}`);
        notFound++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⚠️  Not found: ${notFound}`);
    console.log(`   📦 Total: ${Object.keys(cashAtHandData).length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateCashAtHand();

