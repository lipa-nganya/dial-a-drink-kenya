const fs = require('fs');
const path = require('path');
const db = require('../models');

/**
 * Find matching brand for image file
 */
function findBrandForImage(filename, brands) {
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '').toLowerCase().replace(/-/g, ' ');
  
  for (const brand of brands) {
    const brandLower = brand.name.toLowerCase();
    const brandWords = brandLower.split(/\s+/).join(' ');
    
    // Check if brand name matches filename
    if (nameWithoutExt.includes(brandWords) || brandWords.includes(nameWithoutExt)) {
      return brand;
    }
    
    // Try word-by-word matching
    const filenameWords = nameWithoutExt.split(/\s+/);
    const brandWordsArray = brandWords.split(/\s+/);
    
    if (brandWordsArray.length > 0 && filenameWords.some(fw => brandWordsArray.includes(fw))) {
      return brand;
    }
  }
  
  return null;
}

/**
 * Main function
 */
async function updateBrandsWithExistingImages() {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection established\n');

    const brandsDir = path.join(__dirname, '../../frontend/public/images/brands');
    
    if (!fs.existsSync(brandsDir)) {
      console.error(`❌ Brands directory not found: ${brandsDir}`);
      process.exit(1);
    }

    // Get all image files in brands directory
    const files = fs.readdirSync(brandsDir).filter(f => 
      f.match(/\.(jpg|jpeg|png|webp)$/i) && !f.toLowerCase().includes('readme')
    );

    console.log(`📸 Found ${files.length} images in brands directory\n`);

    // Get all brands
    const brands = await db.Brand.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'image'],
      order: [['name', 'ASC']]
    });

    console.log(`📦 Found ${brands.length} brands in database\n`);

    let updated = 0;
    let skipped = 0;

    // Update brands with matching images
    for (const file of files) {
      const brand = findBrandForImage(file, brands);
      
      if (brand) {
        const imagePath = `/images/brands/${file}`;
        
        // Only update if different from current
        if (brand.image !== imagePath) {
          await brand.update({ image: imagePath });
          updated++;
          console.log(`✅ Updated "${brand.name}" -> /images/brands/${file}`);
        } else {
          skipped++;
        }
      } else {
        console.log(`⚠️  No brand match for file: ${file}`);
      }
    }

    // Also check for brands with Cloudinary URLs (keep those)
    const cloudinaryBrands = brands.filter(b => b.image && b.image.startsWith('http'));
    console.log(`\n📊 Summary:`);
    console.log(`✅ Updated: ${updated} brands with local images`);
    console.log(`⏭️  Skipped: ${skipped} brands (already correct)`);
    console.log(`🌐 Cloudinary URLs: ${cloudinaryBrands.length} brands`);
    console.log(`📸 Total brands with images: ${updated + skipped + cloudinaryBrands.length}`);

    await db.sequelize.close();
    console.log('\n✅ Brand image update completed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Update failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  updateBrandsWithExistingImages();
}

module.exports = updateBrandsWithExistingImages;
