require('dotenv').config();
const db = require('../models');

// Full territories data from the website
const territoriesData = [
  { name: '1Default', deliveryFromCBD: 0, deliveryFromRuaka: 0 },
  { name: 'Bahati', deliveryFromCBD: 2000, deliveryFromRuaka: 1500 },
  { name: 'Banana', deliveryFromCBD: 600, deliveryFromRuaka: 250 },
  { name: 'Buruburu Phase 1', deliveryFromCBD: 500, deliveryFromRuaka: 0 },
  { name: 'Buruburu Phase 2', deliveryFromCBD: 500, deliveryFromRuaka: 0 },
  { name: 'Buruburu Phase 3', deliveryFromCBD: 500, deliveryFromRuaka: 0 },
  { name: 'Buruburu Phase 4', deliveryFromCBD: 400, deliveryFromRuaka: 0 },
  { name: 'Buruburu Phase 5', deliveryFromCBD: 400, deliveryFromRuaka: 0 },
  { name: 'CBD', deliveryFromCBD: 0, deliveryFromRuaka: 0 },
  { name: 'Dandora', deliveryFromCBD: 500, deliveryFromRuaka: 0 },
  { name: 'Donholm', deliveryFromCBD: 600, deliveryFromRuaka: 0 },
  { name: 'Eastleigh', deliveryFromCBD: 500, deliveryFromRuaka: 0 },
  { name: 'Embakasi', deliveryFromCBD: 800, deliveryFromRuaka: 0 },
  { name: 'Githurai', deliveryFromCBD: 800, deliveryFromRuaka: 0 },
  { name: 'Hurlingham', deliveryFromCBD: 300, deliveryFromRuaka: 0 },
  { name: 'Juja', deliveryFromCBD: 1500, deliveryFromRuaka: 0 },
  { name: 'Kahawa', deliveryFromCBD: 1000, deliveryFromRuaka: 0 },
  { name: 'Kasarani', deliveryFromCBD: 800, deliveryFromRuaka: 0 },
  { name: 'Kayole', deliveryFromCBD: 600, deliveryFromRuaka: 0 },
  { name: 'Kileleshwa', deliveryFromCBD: 400, deliveryFromRuaka: 0 },
  { name: 'Kilimani', deliveryFromCBD: 300, deliveryFromRuaka: 0 },
  { name: 'Kitisuru', deliveryFromCBD: 500, deliveryFromRuaka: 0 },
  { name: 'Lavington', deliveryFromCBD: 400, deliveryFromRuaka: 0 },
  { name: 'Muthaiga', deliveryFromCBD: 600, deliveryFromRuaka: 0 },
  { name: 'Ngong Road', deliveryFromCBD: 400, deliveryFromRuaka: 0 },
  { name: 'Parklands', deliveryFromCBD: 300, deliveryFromRuaka: 0 },
  { name: 'Rongai', deliveryFromCBD: 1200, deliveryFromRuaka: 0 },
  { name: 'Ruaka', deliveryFromCBD: 0, deliveryFromRuaka: 0 },
  { name: 'Runda', deliveryFromCBD: 800, deliveryFromRuaka: 0 },
  { name: 'South B', deliveryFromCBD: 500, deliveryFromRuaka: 0 },
  { name: 'South C', deliveryFromCBD: 500, deliveryFromRuaka: 0 },
  { name: 'Umoja', deliveryFromCBD: 600, deliveryFromRuaka: 0 },
  { name: 'Westlands', deliveryFromCBD: 400, deliveryFromRuaka: 0 }
];

async function seedTerritories() {
  try {
    console.log('🔌 Connecting to production database...');
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful');

    console.log('\n📝 Seeding territories...');
    
    let createdCount = 0;
    let updatedCount = 0;
    
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
        createdCount++;
      } else {
        // Update existing territory
        await territory.update({
          deliveryFromCBD: territoryData.deliveryFromCBD,
          deliveryFromRuaka: territoryData.deliveryFromRuaka
        });
        console.log(`🔄 Updated territory: ${territory.name}`);
        updatedCount++;
      }
    }

    console.log('\n✅ Territories seeding completed!');
    console.log(`   Created: ${createdCount}`);
    console.log(`   Updated: ${updatedCount}`);
    
    // Display summary
    const allTerritories = await db.Territory.findAll({
      order: [['name', 'ASC']]
    });
    console.log(`\n📊 Total territories in database: ${allTerritories.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding territories:', error);
    process.exit(1);
  }
}

seedTerritories();





