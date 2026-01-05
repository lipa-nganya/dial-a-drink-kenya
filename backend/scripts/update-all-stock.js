#!/usr/bin/env node

/**
 * Update all inventory items in production to have stock of 20
 */

const { Sequelize } = require('sequelize');

// Production database connection
const prodDb = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('/cloudsql/') ? {
      require: true,
      rejectUnauthorized: false
    } : {}
  }
});

async function updateAllStock() {
  try {
    const targetStock = parseInt(process.env.TARGET_STOCK || '20');
    
    console.log(`🔌 Connecting to production database...`);
    await prodDb.authenticate();
    console.log('✅ Connected to production database');
    
    // Check current stock status
    console.log('\n📊 Checking current stock status...');
    const [beforeStats] = await prodDb.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN stock IS NULL THEN 1 END) as null_stock,
        COUNT(CASE WHEN stock IS NOT NULL THEN 1 END) as has_stock,
        AVG(stock) as avg_stock,
        MIN(stock) as min_stock,
        MAX(stock) as max_stock
      FROM drinks
    `, { type: Sequelize.QueryTypes.SELECT });
    
    console.log('   Total drinks:', beforeStats.total);
    console.log('   Drinks with NULL stock:', beforeStats.null_stock);
    console.log('   Drinks with stock:', beforeStats.has_stock);
    console.log('   Average stock:', Math.round(beforeStats.avg_stock || 0));
    console.log('   Min stock:', beforeStats.min_stock || 'N/A');
    console.log('   Max stock:', beforeStats.max_stock || 'N/A');
    
    // Update all drinks to have stock of targetStock
    console.log(`\n🔄 Updating all drinks to stock = ${targetStock}...`);
    const [updateResult] = await prodDb.query(`
      UPDATE drinks 
      SET stock = :targetStock, "updatedAt" = NOW()
      WHERE stock IS NULL OR stock != :targetStock
    `, {
      replacements: { targetStock }
    });
    
    console.log(`   ✅ Updated ${updateResult[1]} drinks`);
    
    // Verify the update
    console.log('\n🔍 Verifying update...');
    const [afterStats] = await prodDb.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN stock = :targetStock THEN 1 END) as correct_stock,
        COUNT(CASE WHEN stock != :targetStock THEN 1 END) as incorrect_stock,
        COUNT(CASE WHEN stock IS NULL THEN 1 END) as null_stock
      FROM drinks
    `, {
      replacements: { targetStock },
      type: Sequelize.QueryTypes.SELECT
    });
    
    console.log('   Total drinks:', afterStats.total);
    console.log(`   Drinks with stock = ${targetStock}:`, afterStats.correct_stock);
    console.log('   Drinks with different stock:', afterStats.incorrect_stock);
    console.log('   Drinks with NULL stock:', afterStats.null_stock);
    
    // Show sample updated drinks
    const sampleDrinks = await prodDb.query(`
      SELECT id, name, stock 
      FROM drinks 
      ORDER BY "updatedAt" DESC 
      LIMIT 10
    `, { type: Sequelize.QueryTypes.SELECT });
    
    console.log('\n📦 Sample updated drinks:');
    sampleDrinks.forEach(drink => {
      console.log(`   - ${drink.name}: stock = ${drink.stock}`);
    });
    
    if (afterStats.correct_stock === parseInt(afterStats.total)) {
      console.log('\n🎉 All inventory items successfully updated to stock =', targetStock);
    } else {
      console.log('\n⚠️  Some drinks may not have been updated. Check the stats above.');
    }
    
    await prodDb.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

updateAllStock();



