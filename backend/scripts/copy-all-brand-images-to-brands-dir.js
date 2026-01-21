const fs = require('fs');
const path = require('path');
const db = require('../models');

/**
 * Copy brand image to /images/brands/ directory
 */
async function copyBrandImageToBrandsDir(brand) {
  try {
    if (!brand.image || brand.image.startsWith('http')) {
      return brand.image; // Keep external URLs and null as-is
    }

    const brandsDir = path.join(__dirname, '../../frontend/public/images/brands');
    
    if (!fs.existsSync(brandsDir)) {
      fs.mkdirSync(brandsDir, { recursive: true });
    }

    // Generate brand slug for filename
    const brandSlug = brand.name.toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');

    const targetFilename = `${brandSlug}.jpg`;
    const targetPath = path.join(brandsDir, targetFilename);
    const targetImagePath = `/images/brands/${targetFilename}`;

    // If target already exists with this exact path, skip
    if (brand.image === targetImagePath && fs.existsSync(targetPath)) {
      return brand.image;
    }

    // Find source file
    let sourcePath;
    if (brand.image.startsWith('/')) {
      sourcePath = path.join(__dirname, '../../frontend/public', brand.image);
    } else {
      sourcePath = path.join(__dirname, '../../frontend/public', brand.image);
    }

    // Check if source exists
    if (!fs.existsSync(sourcePath)) {
      console.log(`⚠️  Source image not found for "${brand.name}": ${brand.image}`);
      return null;
    }

    // Determine file extension from source
    const sourceExt = path.extname(sourcePath) || '.jpg';
    const finalFilename = `${brandSlug}${sourceExt}`;
    const finalTargetPath = path.join(brandsDir, finalFilename);
    const finalImagePath = `/images/brands/${finalFilename}`;

    // If target already exists, skip copy
    if (fs.existsSync(finalTargetPath)) {
      return finalImagePath;
    }

    // Copy file
    fs.copyFileSync(sourcePath, finalTargetPath);
    console.log(`✅ Copied image for "${brand.name}": ${brand.image} -> ${finalImagePath}`);
    
    return finalImagePath;

  } catch (error) {
    console.error(`❌ Error copying image for "${brand.name}": ${error.message}`);
    return brand.image; // Return original on error
  }
}

/**
 * Main function
 */
async function copyAllBrandImages() {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection established\n');

    const brands = await db.Brand.findAll({
      where: { 
        isActive: true,
        image: { [db.Sequelize.Op.ne]: null }
      },
      order: [['name', 'ASC']]
    });

    console.log(`📦 Found ${brands.length} brands with images\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const brand of brands) {
      try {
        // Skip if already in /images/brands/
        if (brand.image && brand.image.startsWith('/images/brands/')) {
          const imagePath = path.join(__dirname, '../../frontend/public', brand.image);
          if (fs.existsSync(imagePath)) {
            skipped++;
            continue;
          }
        }

        // Copy image to brands directory
        const newImagePath = await copyBrandImageToBrandsDir(brand);
        
        if (newImagePath && newImagePath !== brand.image) {
          await brand.update({ image: newImagePath });
          updated++;
        } else if (!newImagePath) {
          errors++;
        } else {
          skipped++;
        }
      } catch (error) {
        console.error(`❌ Error processing brand "${brand.name}":`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`✅ Updated: ${updated} brands`);
    console.log(`⏭️  Skipped: ${skipped} brands (already in brands dir)`);
    console.log(`❌ Errors: ${errors} brands`);

    // Count images in brands directory
    const brandsDir = path.join(__dirname, '../../frontend/public/images/brands');
    if (fs.existsSync(brandsDir)) {
      const files = fs.readdirSync(brandsDir).filter(f => 
        f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.webp') || f.endsWith('.jpeg')
      );
      console.log(`\n📸 Total images in /images/brands/: ${files.length}`);

    }

    await db.sequelize.close();
    console.log('\n✅ Brand image copy completed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Copy failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  copyAllBrandImages();
}

module.exports = copyAllBrandImages;
