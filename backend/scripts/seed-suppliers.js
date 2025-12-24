require('dotenv').config();
const db = require('../models');

// Suppliers data from the website
const suppliersData = [
  {
    name: '254 brewing co',
    phone: '0711545',
    email: null,
    openingBalance: 0
  },
  {
    name: 'Baraka Israel Enterprises Ltd',
    phone: '0743688892',
    email: 'office@barakaholy.com', // Inferred from truncated "office@barakaholyl"
    openingBalance: 0
  },
  {
    name: 'Benchmark Distributors Itd',
    phone: null,
    email: null,
    openingBalance: 0
  },
  {
    name: 'Brian vape',
    phone: '0720955915',
    email: null,
    openingBalance: 0
  }
];

async function seedSuppliers() {
  try {
    console.log('🔌 Connecting to database...');
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful');

    console.log('\n📝 Seeding suppliers...');
    
    let createdCount = 0;
    let updatedCount = 0;
    
    for (const supplierData of suppliersData) {
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
        console.log(`✅ Created supplier: ${supplier.name}`);
        createdCount++;
      } else {
        // Update existing supplier if data has changed
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
        
        if (needsUpdate) {
          await supplier.update(updates);
          console.log(`🔄 Updated supplier: ${supplier.name}`);
          updatedCount++;
        } else {
          console.log(`⏭️  Skipped supplier (no changes): ${supplier.name}`);
        }
      }
    }

    console.log('\n✅ Suppliers seeding completed!');
    console.log(`   Created: ${createdCount}`);
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Skipped: ${suppliersData.length - createdCount - updatedCount}`);
    
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

