/**
 * Script to update all inventory items in cloud-dev database to have 10 stock quantity
 * Usage: node scripts/update-cloud-stock.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../models');

async function updateCloudStock() {
  try {
    console.log('🔌 Connecting to cloud database...');
    await db.sequelize.authenticate();
    console.log('✅ Connected to database');

    console.log('\n📊 Current stock statistics:');
    const beforeStats = await db.Drink.findAll({
      attributes: [
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'total'],
        [db.sequelize.fn('SUM', db.sequelize.literal('CASE WHEN "stock" = 10 THEN 1 ELSE 0 END')), 'withStock10'],
        [db.sequelize.fn('SUM', db.sequelize.literal('CASE WHEN "isAvailable" = true THEN 1 ELSE 0 END')), 'available']
      ],
      raw: true
    });
    console.log(`Total items: ${beforeStats[0].total}`);
    console.log(`Items with stock = 10: ${beforeStats[0].withStock10}`);
    console.log(`Items marked as available: ${beforeStats[0].available}`);

    console.log('\n🔄 Updating all items to have 10 units in stock...');
    const result = await db.Drink.update(
      { 
        stock: 10, 
        isAvailable: true 
      }, 
      { 
        where: {} 
      }
    );

    console.log(`✅ Updated ${result[0]} items to have 10 units in stock and set as available`);

    console.log('\n📊 Final statistics:');
    const afterStats = await db.Drink.findAll({
      attributes: [
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'total'],
        [db.sequelize.fn('SUM', db.sequelize.literal('CASE WHEN "stock" = 10 THEN 1 ELSE 0 END')), 'withStock10'],
        [db.sequelize.fn('SUM', db.sequelize.literal('CASE WHEN "isAvailable" = true THEN 1 ELSE 0 END')), 'available']
      ],
      raw: true
    });
    console.log(`Total items: ${afterStats[0].total}`);
    console.log(`Items with stock = 10: ${afterStats[0].withStock10}`);
    console.log(`Items marked as available: ${afterStats[0].available}`);

    console.log('\n✅ Stock update completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating stock:', error);
    process.exit(1);
  }
}

updateCloudStock();



