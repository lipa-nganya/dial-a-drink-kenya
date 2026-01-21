const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const db = require('../models');

/**
 * Convert brand name to a URL-friendly slug for image filename
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // Replace spaces with -
    .replace(/[^\w\-]+/g, '')    // Remove all non-word chars
    .replace(/\-\-+/g, '-')      // Replace multiple - with single -
    .replace(/^-+/, '')          // Trim - from start of text
    .replace(/-+$/, '');         // Trim - from end of text
}

async function importBrandsFromCSV(csvFilePath) {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection established');

    const brands = [];
    
    // Read CSV file
    return new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
          // Skip header row or empty rows
          if (row.id && row.name) {
            brands.push({
              id: parseInt(row.id),
              name: row.name.trim(),
              country: row.country ? row.country.trim() : null
            });
          }
        })
        .on('end', async () => {
          console.log(`📄 Read ${brands.length} brands from CSV`);
          
          const addedBrands = [];
          const updatedBrands = [];
          const errors = [];

          for (const brandData of brands) {
            try {
              // Generate image path based on brand name
              const imageSlug = slugify(brandData.name);
              const imagePath = `/images/brands/${imageSlug}.jpg`;

              // Check if brand already exists by ID or name
              let existing = null;
              
              // First try to find by ID (if it exists in DB)
              if (brandData.id) {
                existing = await db.Brand.findByPk(brandData.id);
              }
              
              // If not found by ID, try by name
              if (!existing) {
                existing = await db.Brand.findOne({
                  where: { name: brandData.name.trim() }
                });
              }

              if (existing) {
                // Update existing brand
                await existing.update({
                  name: brandData.name.trim(),
                  country: brandData.country || existing.country,
                  image: imagePath,
                  isActive: true
                });
                updatedBrands.push(existing);
                console.log(`🔄 Updated brand: ${brandData.name} (ID: ${existing.id})`);
              } else {
                // Create new brand
                const newBrand = await db.Brand.create({
                  name: brandData.name.trim(),
                  country: brandData.country || null,
                  image: imagePath,
                  isActive: true
                });
                addedBrands.push(newBrand);
                console.log(`✅ Added brand: ${brandData.name} (ID: ${newBrand.id})`);
              }
            } catch (error) {
              console.error(`❌ Error processing brand ${brandData.name}:`, error.message);
              errors.push({ brand: brandData.name, error: error.message });
            }
          }

          console.log('\n📊 Import Summary:');
          console.log(`✅ Added: ${addedBrands.length} brands`);
          console.log(`🔄 Updated: ${updatedBrands.length} brands`);
          console.log(`❌ Errors: ${errors.length} brands`);
          
          if (errors.length > 0) {
            console.log('\n❌ Errors:');
            errors.forEach(e => console.log(`  - ${e.brand}: ${e.error}`));
          }

          console.log('\n📸 Image Paths:');
          console.log('Brand images should be placed in: frontend/public/images/brands/');
          console.log('Image naming convention: {brand-slug}.jpg');
          console.log('Example: "4th Street Wine" -> /images/brands/4th-street-wine.jpg');

          resolve({ added: addedBrands.length, updated: updatedBrands.length, errors: errors.length });
        })
        .on('error', (error) => {
          console.error('❌ Error reading CSV file:', error);
          reject(error);
        });
    });
  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  } finally {
    await db.sequelize.close();
  }
}

// Run import if called directly
if (require.main === module) {
  const csvFilePath = process.argv[2] || path.join(__dirname, '../../Downloads/brands.csv');
  
  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ CSV file not found: ${csvFilePath}`);
    console.log('Usage: node import-brands-from-csv.js [path-to-brands.csv]');
    process.exit(1);
  }

  importBrandsFromCSV(csvFilePath)
    .then(() => {
      console.log('\n✅ Brand import completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Brand import failed:', error);
      process.exit(1);
    });
}

module.exports = importBrandsFromCSV;
