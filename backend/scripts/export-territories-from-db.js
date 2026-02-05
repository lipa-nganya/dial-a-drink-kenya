/**
 * Export territories from the current database to JSON file
 */

const db = require('../models');
const fs = require('fs');
const path = require('path');

async function exportTerritories() {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Connected to database\n');
    
    const territories = await db.Territory.findAll({
      order: [['name', 'ASC']],
      attributes: ['name', 'deliveryFromCBD', 'deliveryFromRuaka']
    });
    
    console.log(`📦 Found ${territories.length} territories in database\n`);
    
    const territoriesData = territories.map(t => ({
      name: t.name,
      deliveryFromCBD: t.deliveryFromCBD || 0,
      deliveryFromRuaka: t.deliveryFromRuaka || 0
    }));
    
    const territoriesFile = path.join(__dirname, 'territories-data.json');
    fs.writeFileSync(territoriesFile, JSON.stringify(territoriesData, null, 2));
    
    console.log(`💾 Exported ${territoriesData.length} territories to ${territoriesFile}`);
    console.log('\nSample territories:');
    territoriesData.slice(0, 5).forEach(t => {
      console.log(`   - ${t.name} (CBD: ${t.deliveryFromCBD}, Ruaka: ${t.deliveryFromRuaka})`);
    });
    
    await db.sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await db.sequelize.close();
    process.exit(1);
  }
}

exportTerritories();
