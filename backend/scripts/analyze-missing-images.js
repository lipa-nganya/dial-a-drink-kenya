const db = require('../models');

async function analyzeMissingImages() {
  console.log('=== Analyzing Products Without Images ===\n');
  
  try {
    const categories = await db.Category.findAll({
      include: [{
        model: db.Drink,
        as: 'drinks',
        attributes: ['id', 'name', 'image']
      }]
    });
    
    const missingProducts = [];
    const productsWithImages = [];
    
    categories.forEach(category => {
      console.log(`\n${category.name}:`);
      console.log(`  Total products: ${category.drinks.length}`);
      
      const withImages = category.drinks.filter(drink => drink.image);
      const withoutImages = category.drinks.filter(drink => !drink.image);
      
      console.log(`  With images: ${withImages.length}`);
      console.log(`  Without images: ${withoutImages.length}`);
      console.log(`  Coverage: ${Math.round((withImages.length / category.drinks.length) * 100)}%`);
      
      if (withoutImages.length > 0) {
        console.log(`  Missing images:`);
        withoutImages.forEach(drink => {
          console.log(`    - ${drink.name} (ID: ${drink.id})`);
          missingProducts.push({
            id: drink.id,
            name: drink.name,
            category: category.name
          });
        });
      }
      
      productsWithImages.push(...withImages);
      missingProducts.push(...withoutImages.map(drink => ({
        id: drink.id,
        name: drink.name,
        category: category.name
      })));
    });
    
    console.log(`\n=== Summary ===`);
    console.log(`Total products: ${productsWithImages.length + missingProducts.length}`);
    console.log(`With images: ${productsWithImages.length}`);
    console.log(`Without images: ${missingProducts.length}`);
    console.log(`Overall coverage: ${Math.round((productsWithImages.length / (productsWithImages.length + missingProducts.length)) * 100)}%`);
    
    // Group missing products by category for easier analysis
    const missingByCategory = {};
    missingProducts.forEach(product => {
      if (!missingByCategory[product.category]) {
        missingByCategory[product.category] = [];
      }
      missingByCategory[product.category].push(product);
    });
    
    console.log(`\n=== Missing Images by Category ===`);
    Object.entries(missingByCategory).forEach(([category, products]) => {
      console.log(`\n${category} (${products.length} missing):`);
      products.forEach(product => {
        console.log(`  - ${product.name}`);
      });
    });
    
    // Save missing products to a file for reference
    const fs = require('fs');
    const path = require('path');
    
    const missingProductsFile = path.join(__dirname, 'missing-images-analysis.json');
    fs.writeFileSync(missingProductsFile, JSON.stringify({
      totalMissing: missingProducts.length,
      totalProducts: productsWithImages.length + missingProducts.length,
      coverage: Math.round((productsWithImages.length / (productsWithImages.length + missingProducts.length)) * 100),
      missingByCategory,
      missingProducts
    }, null, 2));
    
    console.log(`\nMissing products analysis saved to: ${missingProductsFile}`);
    
    return {
      totalMissing: missingProducts.length,
      totalProducts: productsWithImages.length + missingProducts.length,
      coverage: Math.round((productsWithImages.length / (productsWithImages.length + missingProducts.length)) * 100),
      missingByCategory,
      missingProducts
    };
    
  } catch (error) {
    console.error('Error analyzing missing images:', error);
    return null;
  }
}

// Run the analysis
analyzeMissingImages().then((result) => {
  if (result) {
    console.log('\n=== Analysis Complete ===');
    console.log(`Current coverage: ${result.coverage}%`);
    console.log(`Products without images: ${result.totalMissing}`);
    console.log(`Products with images: ${result.totalProducts - result.totalMissing}`);
  }
  process.exit(0);
}).catch(error => {
  console.error('Analysis failed:', error);
  process.exit(1);
});

