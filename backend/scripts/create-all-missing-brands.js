/**
 * Create All Missing Brands from Original Export
 * 
 * Creates all brands found in the original export that don't exist in the database.
 */

const fs = require('fs');
const path = require('path');
const db = require('../models');

async function createAllMissingBrands() {
  try {
    console.log('🔌 Connecting to database...');
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful\n');

    // Read original export
    const originalPath = path.join(process.cwd(), 'new-inventory-raw.json');
    if (!fs.existsSync(originalPath)) {
      console.error('❌ Error: Original export file not found');
      process.exit(1);
    }

    const original = JSON.parse(fs.readFileSync(originalPath, 'utf8'));
    console.log(`📋 Analyzing ${original.length} items from export...\n`);

    // Get existing brands
    const existingBrands = await db.Brand.findAll();
    const brandMap = {};
    existingBrands.forEach(brand => {
      brandMap[brand.name.toLowerCase()] = brand;
    });

    console.log(`📊 Database currently has ${existingBrands.length} brands\n`);

    // Extract all unique brands from export
    const brandsFromExport = new Set();
    for (const item of original) {
      const fields = item.fields || item;
      if (fields.brand) {
        let brandName = null;
        if (typeof fields.brand === 'object' && fields.brand.name) {
          brandName = fields.brand.name.trim();
        } else if (typeof fields.brand === 'string') {
          brandName = fields.brand.trim();
        }
        
        if (brandName && brandName.length > 0) {
          brandsFromExport.add(brandName);
        }
      }
    }

    console.log(`📊 Found ${brandsFromExport.size} unique brands in export\n`);

    // Find missing brands
    const missingBrands = [];
    for (const brandName of brandsFromExport) {
      if (!brandMap[brandName.toLowerCase()]) {
        missingBrands.push(brandName);
      }
    }

    console.log(`🔄 Creating ${missingBrands.length} missing brands...\n`);

    // Create missing brands
    let created = 0;
    let skipped = 0;
    for (let i = 0; i < missingBrands.length; i++) {
      const brandName = missingBrands[i];
      try {
        const newBrand = await db.Brand.create({
          name: brandName,
          description: `${brandName} brand`,
          isActive: true
        });
        brandMap[brandName.toLowerCase()] = newBrand;
        created++;
        if ((i + 1) % 50 === 0) {
          console.log(`   Processed ${i + 1}/${missingBrands.length} brands...`);
        }
      } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
          skipped++;
        } else {
          console.error(`   ❌ Error creating brand "${brandName}":`, error.message);
        }
      }
    }

    console.log(`\n✅ Created ${created} brands`);
    console.log(`   Skipped ${skipped} (already exist)\n`);

    // Final summary
    const finalBrands = await db.Brand.count();
    console.log(`📊 Final brand count: ${finalBrands}\n`);

    console.log('✅ All missing brands created!');

  } catch (error) {
    console.error('❌ Error creating missing brands:', error);
    process.exit(1);
  } finally {
    await db.sequelize.close();
  }
}

createAllMissingBrands();
