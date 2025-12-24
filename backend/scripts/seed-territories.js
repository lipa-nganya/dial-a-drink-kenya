require('dotenv').config();
const db = require('../models');

const territoriesData = [
  { name: '1Default', deliveryFromCBD: 0, deliveryFromRuaka: 0 },
  { name: 'Bahati', deliveryFromCBD: 2000, deliveryFromRuaka: 1500 },
  { name: 'Banana', deliveryFromCBD: 600, deliveryFromRuaka: 250 },
  { name: 'Buruburu Phase 1', deliveryFromCBD: 500, deliveryFromRuaka: 0 },
  { name: 'Buruburu Phase 2', deliveryFromCBD: 500, deliveryFromRuaka: 0 },
  { name: 'Buruburu Phase 3', deliveryFromCBD: 500, deliveryFromRuaka: 0 },
  { name: 'Buruburu Phase 4', deliveryFromCBD: 400, deliveryFromRuaka: 0 },
  { name: 'Buruburu Phase 5', deliveryFromCBD: 400, deliveryFromRuaka: 0 }
];

async function seedTerritories() {
  try {
    console.log('🔌 Connecting to database...');
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful');

    console.log('\n📝 Seeding territories...');
    
    for (const territoryData of territoriesData) {
      const [territory, created] = await db.Territory.findOrCreate({
        where: { name: territoryData.name },
        defaults: {
          deliveryFromCBD: territoryData.deliveryFromCBD,
          deliveryFromRuaka: territoryData.deliveryFromRuaka
        }
      });

      if (created) {
        console.log(`✅ Created territory: ${territory.name}`);
      } else {
        // Update existing territory
        await territory.update({
          deliveryFromCBD: territoryData.deliveryFromCBD,
          deliveryFromRuaka: territoryData.deliveryFromRuaka
        });
        console.log(`🔄 Updated territory: ${territory.name}`);
      }
    }

    console.log('\n✅ Territories seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding territories:', error);
    process.exit(1);
  }
}

seedTerritories();

