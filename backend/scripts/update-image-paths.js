const db = require('../models');

async function updateImagePaths() {
  console.log('=== Updating Image Paths to Processed Images ===\n');
  
  try {
    // Get all drinks with images
    const drinks = await db.Drink.findAll({
      where: {
        image: {
          [db.Sequelize.Op.ne]: null
        }
      },
      attributes: ['id', 'name', 'image']
    });
    
    console.log(`Found ${drinks.length} drinks with images`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const drink of drinks) {
      try {
        // Update the image path to point to processed images
        const oldPath = drink.image;
        
        // Convert path from /images/drinks/category/filename to /images/processed/category/filename.png
        if (oldPath.includes('/images/drinks/')) {
          const newPath = oldPath.replace('/images/drinks/', '/images/processed/');
          
          // Ensure it ends with .png
          const finalPath = newPath.endsWith('.png') ? newPath : newPath.replace(/\.[^.]+$/, '.png');
          
          await drink.update({ image: finalPath });
          console.log(`✓ Updated: ${drink.name} -> ${finalPath}`);
          updatedCount++;
        } else {
          console.log(`- Skipped: ${drink.name} (not a drinks image)`);
          skippedCount++;
        }
      } catch (error) {
        console.error(`✗ Error updating ${drink.name}: ${error.message}`);
      }
    }
    
    console.log(`\n=== Update Complete ===`);
    console.log(`Updated: ${updatedCount} drinks`);
    console.log(`Skipped: ${skippedCount} drinks`);
    
    return { updated: updatedCount, skipped: skippedCount };
    
  } catch (error) {
    console.error('Error updating image paths:', error);
    return { updated: 0, skipped: 0 };
  }
}

// Run the update
updateImagePaths().then((result) => {
  console.log('\n=== Final Results ===');
  console.log(`Successfully updated ${result.updated} image paths`);
  if (result.skipped > 0) {
    console.log(`Skipped ${result.skipped} drinks`);
  }
  process.exit(0);
}).catch(error => {
  console.error('Update failed:', error);
  process.exit(1);
});

