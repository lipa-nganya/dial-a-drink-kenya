/**
 * Update purchase price for all products matching "1659 Sauvignon Blanc"
 * Sets purchasePrice to 2850.00 for all matching products
 */

const db = require('../models');

async function updatePurchasePrice() {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Find all products with names matching "1659 Sauvignon Blanc" (case-insensitive, partial match)
    const matchingProducts = await db.Drink.findAll({
      where: {
        name: {
          [db.Sequelize.Op.iLike]: '%1659%sauvignon%blanc%'
        }
      },
      attributes: ['id', 'name', 'purchasePrice', 'price']
    });
    
    console.log(`\n📊 Found ${matchingProducts.length} products matching "1659 Sauvignon Blanc"\n`);
    
    if (matchingProducts.length === 0) {
      console.log('⚠️  No matching products found. Nothing to update.');
      process.exit(0);
    }
    
    // Display found products
    console.log('Products to update:');
    matchingProducts.forEach(product => {
      console.log(`  - ID ${product.id}: "${product.name}" (Current purchasePrice: ${product.purchasePrice || 'null'})`);
    });
    console.log('');
    
    const newPurchasePrice = 1350.00;
    let updated = 0;
    let errors = 0;
    
    // Update each product
    for (const product of matchingProducts) {
      try {
        await product.update({ purchasePrice: newPurchasePrice });
        console.log(`✅ Updated: ID ${product.id} - "${product.name}" → Purchase Price: KES ${newPurchasePrice.toFixed(2)}`);
        updated++;
      } catch (error) {
        console.error(`❌ Error updating product ID ${product.id} (${product.name}):`, error.message);
        errors++;
      }
    }
    
    console.log(`\n✅ Successfully updated ${updated} products`);
    if (errors > 0) {
      console.log(`⚠️  ${errors} errors occurred`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

updatePurchasePrice();
