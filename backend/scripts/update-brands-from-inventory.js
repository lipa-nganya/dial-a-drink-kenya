const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const db = require('../models');

/**
 * Convert brand name to a URL-friendly slug
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

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
  
  // Try partial match (for single-word brands or common variations)
  for (const brand of brands) {
    const brandLower = brand.name.toLowerCase().trim();
    const brandWords = brandLower.split(/\s+/);
    
    // For single-word brands, check if it's a significant part of the drink name
    if (brandWords.length === 1 && drinkLower.includes(brandWords[0]) && brandWords[0].length > 3) {
      // Make sure it's not just a common word
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
 * Main function to update brands from inventory
 */
async function updateBrandsFromInventory(csvFilePath) {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Read brands from CSV
    if (!fs.existsSync(csvFilePath)) {
      console.error(`❌ CSV file not found: ${csvFilePath}`);
      process.exit(1);
    }

    const csvBrands = await readBrandsFromCSV(csvFilePath);
    console.log(`📄 Read ${csvBrands.length} brands from CSV\n`);

    // Get or create brands in database
    const brands = [];
    for (const csvBrand of csvBrands) {
      let brand = await db.Brand.findOne({
        where: { name: csvBrand.name.trim() }
      });

      if (!brand) {
        const imageSlug = slugify(csvBrand.name);
        const imagePath = `/images/brands/${imageSlug}.jpg`;

        brand = await db.Brand.create({
          name: csvBrand.name.trim(),
          country: csvBrand.country || null,
          image: imagePath,
          isActive: true
        });
        console.log(`✅ Created brand: ${brand.name}`);
      } else {
        // Update country if missing
        if (!brand.country && csvBrand.country) {
          await brand.update({ country: csvBrand.country });
        }
      }

      brands.push(brand);
    }

    console.log(`\n📦 Processing ${brands.length} brands\n`);

    // Step 1: Update brands with images from their drinks
    console.log('🔍 Step 1: Finding brand images from inventory items...\n');
    
    const brandImagesUpdated = [];
    const brandImagesSkipped = [];

    for (const brand of brands) {
      try {
        // Find drinks that belong to this brand
        const drinks = await db.Drink.findAll({
          where: { brandId: brand.id },
          limit: 10
        });

        // If no drinks linked yet, try to find drinks by name matching
        if (drinks.length === 0) {
          const allDrinks = await db.Drink.findAll({
            limit: 1000 // Get a batch to search through
          });

          for (const drink of allDrinks) {
            const match = findMatchingBrand(drink.name, [brand]);
            if (match) {
              drinks.push(drink);
              break; // Use first match
            }
          }
        }

        // Find a drink with an image
        const drinkWithImage = drinks.find(d => d.image && d.image.trim() !== '');

        if (drinkWithImage) {
          // Use this drink's image as the brand logo
          const brandImagePath = drinkWithImage.image;
          
          // Don't overwrite if brand already has a good image
          if (!brand.image || brand.image.includes('placeholder') || brand.image.includes('default')) {
            await brand.update({ image: brandImagePath });
            brandImagesUpdated.push({ brand: brand.name, image: brandImagePath });
            console.log(`✅ Updated brand image for "${brand.name}" from drink: ${drinkWithImage.name}`);
          } else {
            brandImagesSkipped.push(brand.name);
          }
        } else {
          console.log(`⚠️  No drinks with images found for brand: ${brand.name}`);
        }
      } catch (error) {
        console.error(`❌ Error processing brand ${brand.name}:`, error.message);
      }
    }

    console.log(`\n📊 Brand Images: ${brandImagesUpdated.length} updated, ${brandImagesSkipped.length} skipped\n`);

    // Step 2: Link all drinks to their brands
    console.log('🔗 Step 2: Linking inventory items to brands...\n');

    const allDrinks = await db.Drink.findAll();
    console.log(`📦 Found ${allDrinks.length} drinks to process\n`);

    let drinksLinked = 0;
    let drinksAlreadyLinked = 0;
    let drinksNoMatch = 0;

    for (const drink of allDrinks) {
      try {
        // Skip if already linked to a valid brand
        if (drink.brandId) {
          const existingBrand = brands.find(b => b.id === drink.brandId);
          if (existingBrand) {
            drinksAlreadyLinked++;
            continue;
          }
        }

        // Find matching brand
        const matchingBrand = findMatchingBrand(drink.name, brands);

        if (matchingBrand) {
          await drink.update({ brandId: matchingBrand.id });
          drinksLinked++;
          console.log(`✅ Linked "${drink.name}" to brand "${matchingBrand.name}"`);
        } else {
          drinksNoMatch++;
          // Uncomment to see drinks without matches
          // console.log(`⚠️  No brand match found for: ${drink.name}`);
        }
      } catch (error) {
        console.error(`❌ Error processing drink ${drink.name}:`, error.message);
      }
    }

    console.log('\n📊 Linking Summary:');
    console.log(`✅ Linked: ${drinksLinked} drinks to brands`);
    console.log(`⏭️  Already linked: ${drinksAlreadyLinked} drinks`);
    console.log(`⚠️  No match: ${drinksNoMatch} drinks`);

    await db.sequelize.close();
    console.log('\n✅ Brand update completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Update failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  const csvFilePath = process.argv[2] || path.join(__dirname, '../../Downloads/brands.csv');
  updateBrandsFromInventory(csvFilePath);
}

module.exports = updateBrandsFromInventory;
