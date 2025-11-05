const db = require('../models');
const fs = require('fs');
const path = require('path');

async function fixLiqueurImages() {
  try {
    console.log('Fixing liqueur image paths...');
    
    // Get all liqueurs
    const liqueurCategory = await db.Category.findOne({
      where: { name: { [db.Sequelize.Op.iLike]: '%liqueur%' } }
    });
    
    const liqueurs = await db.Drink.findAll({
      where: { categoryId: liqueurCategory.id },
      attributes: ['id', 'name', 'image']
    });
    
    console.log(`Found ${liqueurs.length} liqueurs to process`);
    
    // Ensure frontend images directory exists
    const frontendImagesDir = path.join(__dirname, '../../frontend/public/images');
    if (!fs.existsSync(frontendImagesDir)) {
      fs.mkdirSync(frontendImagesDir, { recursive: true });
      console.log('Created frontend/images directory');
    }
    
    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const liqueur of liqueurs) {
      try {
        let sourcePath = null;
        let targetPath = null;
        let newImagePath = null;
        
        // Check if image path points to old backend location
        if (liqueur.image && liqueur.image.includes('/drinks/liqueur/')) {
          // Old path: /images/drinks/liqueur/filename
          const filename = path.basename(liqueur.image);
          sourcePath = path.join(__dirname, '../public/images/drinks/liqueur', filename);
          targetPath = path.join(frontendImagesDir, filename);
          newImagePath = `/images/${filename}`;
        } else if (liqueur.image && liqueur.image.includes('/fallbacks/')) {
          // Fallback path: /images/fallbacks/filename
          const filename = path.basename(liqueur.image);
          sourcePath = path.join(__dirname, '../public/images/fallbacks', filename);
          targetPath = path.join(frontendImagesDir, filename);
          newImagePath = `/images/${filename}`;
        } else if (liqueur.image && liqueur.image.startsWith('/images/') && !liqueur.image.includes('/drinks/')) {
          // Already correct path
          console.log(`Skipping ${liqueur.name} - already has correct path: ${liqueur.image}`);
          skippedCount++;
          continue;
        } else {
          console.log(`Skipping ${liqueur.name} - no valid image path: ${liqueur.image}`);
          skippedCount++;
          continue;
        }
        
        // Check if source file exists
        if (!fs.existsSync(sourcePath)) {
          console.log(`Source file not found for ${liqueur.name}: ${sourcePath}`);
          errorCount++;
          continue;
        }
        
        // Copy file to frontend directory
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`Copied: ${liqueur.name} -> ${filename}`);
        
        // Update database
        await liqueur.update({ image: newImagePath });
        console.log(`Updated database: ${liqueur.name} -> ${newImagePath}`);
        
        fixedCount++;
        
      } catch (error) {
        console.log(`Error processing ${liqueur.name}: ${error.message}`);
        errorCount++;
      }
    }
    
    console.log(`\n=== FIX COMPLETE ===`);
    console.log(`✅ Fixed: ${fixedCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${liqueurs.length}`);
    
  } catch (error) {
    console.error('Fatal error:', error.message);
  } finally {
    await db.sequelize.close();
  }
}

fixLiqueurImages();
