require('dotenv').config();
const db = require('../models');
const fs = require('fs');
const path = require('path');

// Load suppliers from the JSON file
const suppliersFilePath = path.join(__dirname, 'all-suppliers.json');
let suppliersData = [];

if (fs.existsSync(suppliersFilePath)) {
  const fileContent = fs.readFileSync(suppliersFilePath, 'utf8');
  suppliersData = JSON.parse(fileContent);
  console.log(`📋 Loaded ${suppliersData.length} suppliers from ${suppliersFilePath}`);
} else {
  console.error(`❌ Error: ${suppliersFilePath} not found!`);
  console.log('Please run parse-and-load-suppliers.js first to generate the suppliers data.');
  process.exit(1);
}

async function seedSuppliers() {
  try {
    console.log('🔌 Connecting to production database...');
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful');

    console.log('\n📝 Seeding suppliers...');
    
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const supplierData of suppliersData) {
      try {
        const [supplier, created] = await db.Supplier.findOrCreate({
          where: { name: supplierData.name },
          defaults: {
            phone: supplierData.phone,
            email: supplierData.email,
            openingBalance: supplierData.openingBalance,
            isActive: true
          }
        });

        if (created) {
          console.log(`✅ Created: ${supplier.name}`);
          createdCount++;
        } else {
          // Update existing supplier
          let needsUpdate = false;
          const updates = {};
          
          if (supplier.phone !== supplierData.phone) {
            updates.phone = supplierData.phone;
            needsUpdate = true;
          }
          if (supplier.email !== supplierData.email) {
            updates.email = supplierData.email;
            needsUpdate = true;
          }
          if (Math.abs(parseFloat(supplier.openingBalance) - supplierData.openingBalance) > 0.01) {
            updates.openingBalance = supplierData.openingBalance;
            needsUpdate = true;
          }
          
          if (needsUpdate) {
            await supplier.update(updates);
            console.log(`🔄 Updated: ${supplier.name}`);
            updatedCount++;
          } else {
            skippedCount++;
          }
        }
      } catch (err) {
        console.error(`❌ Error processing ${supplierData.name}:`, err.message);
      }
    }

    console.log('\n✅ Suppliers seeding completed!');
    console.log(`   Created: ${createdCount}`);
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    
    // Display summary
    const allSuppliers = await db.Supplier.findAll({
      order: [['name', 'ASC']]
    });
    console.log(`\n📊 Total suppliers in database: ${allSuppliers.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding suppliers:', error);
    process.exit(1);
  }
}

seedSuppliers();





