#!/usr/bin/env node

/**
 * Sync brand assignments from local database to production
 * Matches drinks by name and updates brandId in production
 */

const { Sequelize } = require('sequelize');

// Local database connection
const localDb = new Sequelize(process.env.LOCAL_DATABASE_URL || 'postgres://postgres:password@localhost:5432/dialadrink', {
  dialect: 'postgres',
  logging: false
});

// Production database connection
const prodDb = new Sequelize(process.env.DATABASE_URL || process.env.PROD_DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('/cloudsql/') ? {
      require: true,
      rejectUnauthorized: false
    } : {}
  }
});

async function syncBrandsToProduction() {
  try {
    console.log('🔌 Connecting to databases...');
    await localDb.authenticate();
    console.log('✅ Connected to local database');
    
    await prodDb.authenticate();
    console.log('✅ Connected to production database');
    
    // Get all drinks with brands from local
    console.log('\n📦 Fetching drinks with brands from local database...');
    const localDrinks = await localDb.query(`
      SELECT d.id, d.name, d."brandId", b.name as brand_name
      FROM drinks d
      INNER JOIN brands b ON d."brandId" = b.id
      WHERE d."brandId" IS NOT NULL
      ORDER BY d.name
    `, { type: Sequelize.QueryTypes.SELECT });
    
    console.log(`   Found ${localDrinks.length} drinks with brands in local database`);
    
    // Get all brands from production (to map brand names to IDs)
    console.log('\n📦 Fetching brands from production database...');
    const prodBrands = await prodDb.query(`
      SELECT id, name FROM brands ORDER BY name
    `, { type: Sequelize.QueryTypes.SELECT });
    
    const brandMap = new Map();
    prodBrands.forEach(brand => {
      brandMap.set(brand.name.toLowerCase().trim(), brand.id);
    });
    
    console.log(`   Found ${prodBrands.length} brands in production database`);
    
    // Get all drinks from production
    console.log('\n📦 Fetching drinks from production database...');
    const prodDrinks = await prodDb.query(`
      SELECT id, name, "brandId" FROM drinks ORDER BY name
    `, { type: Sequelize.QueryTypes.SELECT });
    
    const prodDrinkMap = new Map();
    prodDrinks.forEach(drink => {
      prodDrinkMap.set(drink.name.toLowerCase().trim(), drink);
    });
    
    console.log(`   Found ${prodDrinks.length} drinks in production database`);
    
    // Match and update
    console.log('\n🔄 Syncing brand assignments...');
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const errorsList = [];
    
    for (const localDrink of localDrinks) {
      try {
        const drinkNameLower = localDrink.name.toLowerCase().trim();
        const prodDrink = prodDrinkMap.get(drinkNameLower);
        
        if (!prodDrink) {
          skipped++;
          continue;
        }
        
        // Skip if already has the same brand
        if (prodDrink.brandId === localDrink.brandId) {
          skipped++;
          continue;
        }
        
        // Get production brand ID
        const brandNameLower = localDrink.brand_name.toLowerCase().trim();
        const prodBrandId = brandMap.get(brandNameLower);
        
        if (!prodBrandId) {
          errors++;
          errorsList.push(`Brand "${localDrink.brand_name}" not found in production for drink "${localDrink.name}"`);
          continue;
        }
        
        // Update production drink
        await prodDb.query(`
          UPDATE drinks 
          SET "brandId" = :brandId, "updatedAt" = NOW()
          WHERE id = :drinkId
        `, {
          replacements: {
            brandId: prodBrandId,
            drinkId: prodDrink.id
          }
        });
        
        updated++;
        if (updated % 50 === 0) {
          console.log(`   Updated ${updated} drinks...`);
        }
      } catch (error) {
        errors++;
        errorsList.push(`Error updating "${localDrink.name}": ${error.message}`);
      }
    }
    
    console.log('\n📊 Sync Summary:');
    console.log(`   ✅ Updated: ${updated} drinks`);
    console.log(`   ⏭️  Skipped: ${skipped} drinks (already matched or not found)`);
    console.log(`   ❌ Errors: ${errors} drinks`);
    
    if (errorsList.length > 0) {
      console.log('\n⚠️  Errors:');
      errorsList.slice(0, 10).forEach(err => console.log(`   - ${err}`));
      if (errorsList.length > 10) {
        console.log(`   ... and ${errorsList.length - 10} more errors`);
      }
    }
    
    // Verify results
    console.log('\n🔍 Verifying results...');
    const prodDrinksWithBrands = await prodDb.query(`
      SELECT COUNT(*) as count FROM drinks WHERE "brandId" IS NOT NULL
    `, { type: Sequelize.QueryTypes.SELECT });
    
    console.log(`   Production drinks with brands: ${prodDrinksWithBrands[0].count}`);
    
    if (updated > 0) {
      console.log('\n🎉 Brand assignment sync completed successfully!');
    } else {
      console.log('\n⚠️  No drinks were updated. Check if drinks match by name.');
    }
    
    await localDb.close();
    await prodDb.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

syncBrandsToProduction();



