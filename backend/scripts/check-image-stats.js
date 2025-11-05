const db = require('../models');
const fs = require('fs');
const path = require('path');

async function checkImageStats() {
  try {
    console.log('=== Image Statistics ===\n');
    
    // Get all categories
    const categories = await db.Category.findAll({
      include: [{
        model: db.Drink,
        as: 'drinks'
      }]
    });
    
    let totalProducts = 0;
    let totalWithImages = 0;
    
    for (const category of categories) {
      const drinks = category.drinks || [];
      const withImages = drinks.filter(drink => drink.image && drink.image !== null);
      
      totalProducts += drinks.length;
      totalWithImages += withImages.length;
      
      console.log(`${category.name}:`);
      console.log(`  Total products: ${drinks.length}`);
      console.log(`  With images: ${withImages.length}`);
      console.log(`  Without images: ${drinks.length - withImages.length}`);
      console.log(`  Coverage: ${drinks.length > 0 ? Math.round((withImages.length / drinks.length) * 100) : 0}%\n`);
    }
    
    console.log('=== Overall Statistics ===');
    console.log(`Total products: ${totalProducts}`);
    console.log(`With images: ${totalWithImages}`);
    console.log(`Without images: ${totalProducts - totalWithImages}`);
    console.log(`Overall coverage: ${totalProducts > 0 ? Math.round((totalWithImages / totalProducts) * 100) : 0}%`);
    
    // Check physical image files
    const imagesDir = path.join(__dirname, '../public/images/drinks');
    if (fs.existsSync(imagesDir)) {
      const categories = fs.readdirSync(imagesDir);
      let totalFiles = 0;
      
      console.log('\n=== Physical Image Files ===');
      for (const category of categories) {
        const categoryPath = path.join(imagesDir, category);
        if (fs.statSync(categoryPath).isDirectory()) {
          const files = fs.readdirSync(categoryPath);
          const imageFiles = files.filter(file => 
            file.endsWith('.jpg') || file.endsWith('.jpeg') || 
            file.endsWith('.png') || file.endsWith('.webp')
          );
          totalFiles += imageFiles.length;
          console.log(`${category}: ${imageFiles.length} image files`);
        }
      }
      console.log(`Total image files: ${totalFiles}`);
    }
    
  } catch (error) {
    console.error('Error checking image stats:', error);
  } finally {
    await db.sequelize.close();
  }
}

checkImageStats();

