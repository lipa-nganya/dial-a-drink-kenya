const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const db = require('../models');

/**
 * Find best matching brand for a drink name
 */
function findMatchingBrand(drinkName, brands) {
  const drinkLower = drinkName.toLowerCase().trim();
  
  // First try exact match
  for (const brand of brands) {
    if (drinkLower === brand.name.toLowerCase().trim()) {
      return brand;
    }
  }
  
  // Try if drink name starts with brand name
  for (const brand of brands) {
    const brandLower = brand.name.toLowerCase().trim();
    if (drinkLower.startsWith(brandLower + ' ') || drinkLower.startsWith(brandLower + '-')) {
      return brand;
    }
  }
  
  // Try if brand name is contained in drink name
  for (const brand of brands) {
    const brandLower = brand.name.toLowerCase().trim();
    const brandWords = brandLower.split(/\s+/).filter(w => w.length > 2);
    
    if (brandWords.length > 0) {
      const allWordsMatch = brandWords.every(word => drinkLower.includes(word));
      if (allWordsMatch && brandWords.length >= 2) {
        return brand;
      }
    }
  }
  
  // Try partial match for single-word brands
  for (const brand of brands) {
    const brandLower = brand.name.toLowerCase().trim();
    const brandWords = brandLower.split(/\s+/);
    
    if (brandWords.length === 1 && drinkLower.includes(brandWords[0]) && brandWords[0].length > 3) {
      const commonWords = ['the', 'and', 'or', 'of', 'in', 'on', 'at', 'for', 'with', 'by'];
      if (!commonWords.includes(brandWords[0])) {
        return brand;
      }
    }
  }
  
  return null;
}

/**
 * Read brands from CSV
 */
async function readBrandsFromCSV(csvFilePath) {
  return new Promise((resolve, reject) => {
    const brands = [];
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row) => {
        if (row.id && row.name) {
          brands.push({
            id: parseInt(row.id),
            name: row.name.trim(),
            country: row.country ? row.country.trim() : null
          });
        }
      })
      .on('end', () => resolve(brands))
      .on('error', reject);
  });
}

/**
 * Copy image file if needed
 */
async function copyImageToBrands(sourcePath, brandSlug, fileExtension) {
  try {
    const brandsDir = path.join(__dirname, '../../frontend/public/images/brands');
    
    if (!fs.existsSync(brandsDir)) {
      fs.mkdirSync(brandsDir, { recursive: true });
    }

    const filename = `${brandSlug}${fileExtension}`;
    const targetPath = path.join(brandsDir, filename);
    const targetImagePath = `/images/brands/${filename}`;

    // If target already exists, skip
    if (fs.existsSync(targetPath)) {
      return targetImagePath;
    }

    // Source path might be relative or absolute
    let sourceFullPath;
    if (sourcePath.startsWith('/')) {
      sourceFullPath = path.join(__dirname, '../../frontend/public', sourcePath);
    } else if (sourcePath.startsWith('http')) {
      // Can't copy from URL, just return the path
      return sourcePath;
    } else {
      sourceFullPath = path.join(__dirname, '../../frontend/public', sourcePath);
    }

    // Check if source exists
    if (!fs.existsSync(sourceFullPath)) {
      return null;
    }

    // Copy file
    fs.copyFileSync(sourceFullPath, targetPath);
    return targetImagePath;

  } catch (error) {
    console.error(`Error copying image: ${error.message}`);
    return null;
  }
}

/**
 * Main function to fix brand images
 */
async function fixBrandImages(csvFilePath) {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Read brands from CSV
    const csvBrands = await readBrandsFromCSV(csvFilePath);
    console.log(`📄 Read ${csvBrands.length} brands from CSV\n`);

    // Get all brands from database
    const brands = await db.Brand.findAll({
      where: { isActive: true },
      order: [['name', 'ASC']]
    });

    console.log(`📦 Found ${brands.length} brands in database\n`);

    // Get all drinks with images
    const allDrinks = await db.Drink.findAll({
      where: {
        image: { [db.Sequelize.Op.ne]: null },
        image: { [db.Sequelize.Op.ne]: '' }
      },
      attributes: ['id', 'name', 'image', 'brandId']
    });

    console.log(`🍺 Found ${allDrinks.length} drinks with images\n`);

    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    // Process each brand
    for (const brand of brands) {
      try {
        // Skip if brand already has an image that exists
        if (brand.image) {
          const imagePath = path.join(__dirname, '../../frontend/public', brand.image);
          if (fs.existsSync(imagePath)) {
            console.log(`⏭️  Skipping "${brand.name}" - image already exists`);
            skipped++;
            continue;
          }
        }

        // First, try to find drinks already linked to this brand
        let drinkWithImage = allDrinks.find(d => d.brandId === brand.id && d.image);

        // If not found, try to find by name matching
        if (!drinkWithImage) {
          drinkWithImage = allDrinks.find(d => {
            const match = findMatchingBrand(d.name, [brand]);
            return match !== null;
          });
        }

        if (drinkWithImage && drinkWithImage.image) {
          // Copy image to brands directory
          const brandSlug = brand.name.toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
          
          const fileExtension = path.extname(drinkWithImage.image.split('?')[0]) || '.jpg';
          
          // Copy or reference the image
          const brandImagePath = await copyImageToBrands(drinkWithImage.image, brandSlug, fileExtension);
          
          if (brandImagePath) {
            await brand.update({ image: brandImagePath });
            updated++;
            console.log(`✅ Updated "${brand.name}" with image from drink: ${drinkWithImage.name}`);
          } else {
            // If copy failed, just use the original path
            await brand.update({ image: drinkWithImage.image });
            updated++;
            console.log(`✅ Updated "${brand.name}" with drink image path: ${drinkWithImage.image}`);
          }
        } else {
          notFound++;
          console.log(`⚠️  No drink with image found for brand: "${brand.name}"`);
        }
      } catch (error) {
        console.error(`❌ Error processing brand "${brand.name}":`, error.message);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`✅ Updated: ${updated} brands`);
    console.log(`⏭️  Skipped: ${skipped} brands (already have images)`);
    console.log(`⚠️  Not found: ${notFound} brands (no drinks with images)`);

    await db.sequelize.close();
    console.log('\n✅ Brand image fix completed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  const csvFilePath = process.argv[2] || path.join(__dirname, '../../Downloads/brands.csv');
  fixBrandImages(csvFilePath);
}

module.exports = fixBrandImages;
