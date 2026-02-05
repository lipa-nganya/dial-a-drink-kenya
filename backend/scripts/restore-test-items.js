/**
 * Script to restore test items to the development database
 */

const { Client } = require('pg');

// Local database
const LOCAL_DB = {
  host: 'localhost',
  port: 5432,
  database: 'dialadrink',
  user: 'maria'
};

// Dev database
const DEV_DB = {
  host: '34.41.187.250',
  port: 5432,
  database: 'dialadrink_dev',
  user: 'dialadrink_app',
  password: 'o61yqm5fLiTwWnk5',
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
};

const localClient = new Client(LOCAL_DB);
const devClient = new Client(DEV_DB);

async function restoreTestItems() {
  try {
    console.log('🔌 Connecting to databases...');
    await localClient.connect();
    console.log('✅ Local database connected');
    
    await devClient.connect();
    console.log('✅ Dev database connected');

    // First, restore the Test category if it exists in local
    const testCategory = await localClient.query(`
      SELECT * FROM categories WHERE id = 18
    `);

    if (testCategory.rows.length > 0) {
      console.log('\n📋 Restoring Test category...');
      const cat = testCategory.rows[0];
      
      // Check if category already exists in dev
      const existingCat = await devClient.query('SELECT id FROM categories WHERE id = $1', [cat.id]);
      
      if (existingCat.rows.length === 0) {
        await devClient.query(`
          INSERT INTO categories (id, name, description, "isActive", "createdAt", "updatedAt", image)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          cat.id,
          cat.name,
          cat.description,
          cat.isActive,
          cat.createdAt,
          cat.updatedAt,
          cat.image
        ]);
        console.log('✅ Test category restored');
      } else {
        console.log('⚠️  Test category already exists in dev');
      }
    }

    // Get test items from local database
    const testItems = await localClient.query(`
      SELECT * FROM drinks 
      WHERE id IN (53, 1825, 1826, 1827)
      ORDER BY id
    `);

    console.log(`\n📋 Found ${testItems.rows.length} test items in local database:`);
    testItems.rows.forEach(item => {
      console.log(`   - ID: ${item.id}, Name: ${item.name}`);
    });

    if (testItems.rows.length === 0) {
      console.log('\n⚠️  No test items found in local database');
      await localClient.end();
      await devClient.end();
      return;
    }

    // Restore each test item
    console.log(`\n🔄 Restoring ${testItems.rows.length} test items...`);
    
    for (const item of testItems.rows) {
      // Check if item already exists
      const existing = await devClient.query('SELECT id FROM drinks WHERE id = $1', [item.id]);
      
      if (existing.rows.length === 0) {
        // Handle JSON fields properly
        const capacityPricing = typeof item.capacityPricing === 'string' 
          ? item.capacityPricing 
          : JSON.stringify(item.capacityPricing || null);
        const capacity = typeof item.capacity === 'string'
          ? item.capacity
          : JSON.stringify(item.capacity || null);
        
        // Insert the item
        await devClient.query(`
          INSERT INTO drinks (
            id, name, description, price, image, "categoryId", "subCategoryId", 
            "brandId", "isAvailable", "isPopular", "isBrandFocus", "isOnOffer", 
            "limitedTimeOffer", "originalPrice", capacity, "capacityPricing", 
            abv, barcode, stock, "createdAt", "updatedAt"
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        `, [
          item.id,
          item.name,
          item.description,
          item.price,
          item.image,
          item.categoryId,
          item.subCategoryId,
          item.brandId,
          item.isAvailable,
          item.isPopular,
          item.isBrandFocus,
          item.isOnOffer,
          item.limitedTimeOffer,
          item.originalPrice,
          capacity,
          capacityPricing,
          item.abv,
          item.barcode,
          item.stock,
          item.createdAt,
          item.updatedAt
        ]);
        console.log(`   ✅ Restored: ID ${item.id}, Name: ${item.name}`);
      } else {
        console.log(`   ⚠️  Item ID ${item.id} already exists in dev`);
      }
    }

    // Verify restoration
    const verifyResult = await devClient.query(`
      SELECT COUNT(*) as count 
      FROM drinks 
      WHERE id IN (53, 1825, 1826, 1827)
    `);

    console.log(`\n✅ Verification: ${verifyResult.rows[0].count} test items now in dev database`);

    await localClient.end();
    await devClient.end();
    console.log('\n✅ Script completed successfully');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    await localClient.end().catch(() => {});
    await devClient.end().catch(() => {});
    process.exit(1);
  }
}

restoreTestItems();
