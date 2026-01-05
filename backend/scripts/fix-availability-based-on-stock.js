#!/usr/bin/env node

/**
 * Fix availability based on stock - set isAvailable = true for all items with stock > 0
 * This ensures items with stock can be purchased
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

async function fixAvailabilityBasedOnStock() {
  try {
    console.log('🔌 Connecting to production database...');
    await prodDb.authenticate();
    console.log('✅ Connected to production database');
    
    // Check current status
    console.log('\n📊 Checking current availability status...');
    const [beforeStats] = await prodDb.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN stock > 0 AND "isAvailable" = true THEN 1 END) as available_with_stock,
        COUNT(CASE WHEN stock > 0 AND "isAvailable" = false THEN 1 END) as unavailable_with_stock,
        COUNT(CASE WHEN stock = 0 AND "isAvailable" = true THEN 1 END) as available_no_stock,
        COUNT(CASE WHEN stock = 0 AND "isAvailable" = false THEN 1 END) as unavailable_no_stock,
        COUNT(CASE WHEN "isBrandFocus" = true AND stock > 0 AND "isAvailable" = false THEN 1 END) as brand_focus_unavailable
      FROM drinks
    `, { type: Sequelize.QueryTypes.SELECT });
    
    console.log('   Total drinks:', beforeStats.total);
    console.log('   Available with stock > 0:', beforeStats.available_with_stock);
    console.log('   ❌ Unavailable with stock > 0:', beforeStats.unavailable_with_stock);
    console.log('   Available with stock = 0:', beforeStats.available_no_stock);
    console.log('   Unavailable with stock = 0:', beforeStats.unavailable_no_stock);
    console.log('   ❌ Brand focus items unavailable with stock > 0:', beforeStats.brand_focus_unavailable);
    
    // Update all items with stock > 0 to be available
    console.log('\n🔄 Fixing availability for items with stock > 0...');
    const [updateResult] = await prodDb.query(`
      UPDATE drinks 
      SET "isAvailable" = true, "updatedAt" = NOW()
      WHERE stock > 0 AND "isAvailable" = false
    `);
    
    console.log(`   ✅ Updated ${updateResult[1]} drinks to be available`);
    
    // Update all items with stock = 0 to be unavailable
    console.log('\n🔄 Fixing availability for items with stock = 0...');
    const [updateResult2] = await prodDb.query(`
      UPDATE drinks 
      SET "isAvailable" = false, "updatedAt" = NOW()
      WHERE stock = 0 AND "isAvailable" = true
    `);
    
    console.log(`   ✅ Updated ${updateResult2[1]} drinks to be unavailable`);
    
    // Verify the update
    console.log('\n🔍 Verifying update...');
    const [afterStats] = await prodDb.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN stock > 0 AND "isAvailable" = true THEN 1 END) as available_with_stock,
        COUNT(CASE WHEN stock > 0 AND "isAvailable" = false THEN 1 END) as unavailable_with_stock,
        COUNT(CASE WHEN stock = 0 AND "isAvailable" = true THEN 1 END) as available_no_stock,
        COUNT(CASE WHEN stock = 0 AND "isAvailable" = false THEN 1 END) as unavailable_no_stock,
        COUNT(CASE WHEN "isBrandFocus" = true AND stock > 0 AND "isAvailable" = true THEN 1 END) as brand_focus_available
      FROM drinks
    `, { type: Sequelize.QueryTypes.SELECT });
    
    console.log('   Total drinks:', afterStats.total);
    console.log('   ✅ Available with stock > 0:', afterStats.available_with_stock);
    console.log('   Unavailable with stock > 0:', afterStats.unavailable_with_stock);
    console.log('   Available with stock = 0:', afterStats.available_no_stock);
    console.log('   Unavailable with stock = 0:', afterStats.unavailable_no_stock);
    console.log('   ✅ Brand focus items available with stock > 0:', afterStats.brand_focus_available);
    
    // Show sample brand focus items
    const sampleBrandFocus = await prodDb.query(`
      SELECT id, name, stock, "isAvailable", "isBrandFocus"
      FROM drinks 
      WHERE "isBrandFocus" = true
      ORDER BY name
      LIMIT 10
    `, { type: Sequelize.QueryTypes.SELECT });
    
    console.log('\n📦 Sample brand focus items:');
    sampleBrandFocus.forEach(drink => {
      const status = drink.isAvailable ? '✅ Available' : '❌ Unavailable';
      console.log(`   - ${drink.name}: stock=${drink.stock}, ${status}`);
    });
    
    if (afterStats.unavailable_with_stock === 0 && afterStats.brand_focus_available > 0) {
      console.log('\n🎉 All items with stock > 0 are now available!');
      console.log('✅ Brand focus items can now be purchased.');
    } else {
      console.log('\n⚠️  Some items may still need attention. Check the stats above.');
    }
    
    await prodDb.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

fixAvailabilityBasedOnStock();



