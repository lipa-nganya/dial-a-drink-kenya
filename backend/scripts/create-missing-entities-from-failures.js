/**
 * Create Missing Brands and Categories from Failed Imports
 * 
 * Analyzes the original export and transformed data to find and create
 * missing brands and categories that caused import failures.
 */

const fs = require('fs');
const path = require('path');
const db = require('../models');

async function createMissingEntities() {
  try {
    console.log('🔌 Connecting to database...');
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful\n');

    // Read data files
    const transformedPath = path.join(process.cwd(), 'new-inventory-transformed-v2.json');
    const originalPath = path.join(process.cwd(), 'new-inventory-raw.json');

    if (!fs.existsSync(transformedPath) || !fs.existsSync(originalPath)) {
      console.error('❌ Error: Required data files not found');
      process.exit(1);
    }

    const transformed = JSON.parse(fs.readFileSync(transformedPath, 'utf8'));
    const original = JSON.parse(fs.readFileSync(originalPath, 'utf8'));

    const drinks = transformed.drinks || [];
    console.log(`📋 Analyzing ${drinks.length} drinks...\n`);

    // Get existing entities
    const existingCategories = await db.Category.findAll();
    const existingBrands = await db.Brand.findAll();

    const categoryMap = {};
    existingCategories.forEach(cat => {
      categoryMap[cat.name.toLowerCase()] = cat;
    });

    const brandMap = {};
    existingBrands.forEach(brand => {
      brandMap[brand.name.toLowerCase()] = brand;
    });

    // Category name mappings
    const categoryNameMappings = {
      'Liqueurs': 'Liqueur',
      'Beers': 'Beer',
      'Mixer spirit': 'Soft Drinks'
    };

    // Map original to transformed by name (approximate matching)
    const nameToOriginal = new Map();
    original.forEach((item, i) => {
      const name = (item.name || item.fields?.name || '').trim();
      if (name && i < drinks.length) {
        nameToOriginal.set(name.toLowerCase(), item);
      }
    });

    // Find missing brands
    const missingBrandNames = new Set();
    const missingCategoryNames = new Set();

    for (let i = 0; i < drinks.length; i++) {
      const drink = drinks[i];
      const drinkName = drink.name?.toLowerCase();

      if (drinkName && nameToOriginal.has(drinkName)) {
        const orig = nameToOriginal.get(drinkName);
        const fields = orig.fields || orig;

        // Check for missing brand
        if (!drink.brandId && fields.brand) {
          let brandName = null;
          if (typeof fields.brand === 'object' && fields.brand.name) {
            brandName = fields.brand.name.trim();
          } else if (typeof fields.brand === 'string') {
            brandName = fields.brand.trim();
          }

          if (brandName && !brandMap[brandName.toLowerCase()]) {
            missingBrandNames.add(brandName);
          }
        }

        // Check for missing category
        if (!drink.categoryId && fields.category) {
          let categoryName = null;
          if (typeof fields.category === 'object' && fields.category.name) {
            categoryName = fields.category.name;
          } else if (typeof fields.category === 'string') {
            categoryName = fields.category;
          }

          if (categoryName) {
            const mappedName = categoryNameMappings[categoryName] || categoryName;
            if (!categoryMap[mappedName.toLowerCase()]) {
              missingCategoryNames.add(mappedName);
            }
          }
        }
      }
    }

    console.log(`📊 Found ${missingBrandNames.size} missing brands`);
    console.log(`📊 Found ${missingCategoryNames.size} missing categories\n`);

    // Create missing categories
    if (missingCategoryNames.size > 0) {
      console.log('🔄 Creating missing categories...');
      let created = 0;
      for (const categoryName of missingCategoryNames) {
        try {
          const newCategory = await db.Category.create({
            name: categoryName,
            description: `${categoryName} category`,
            isActive: true
          });
          categoryMap[categoryName.toLowerCase()] = newCategory;
          created++;
          console.log(`   ✅ Created category: ${categoryName}`);
        } catch (error) {
          if (error.name !== 'SequelizeUniqueConstraintError') {
            console.error(`   ❌ Error creating category ${categoryName}:`, error.message);
          }
        }
      }
      console.log(`   ✅ Created ${created} categories\n`);
    }

    // Create missing brands
    if (missingBrandNames.size > 0) {
      console.log('🔄 Creating missing brands...');
      let created = 0;
      let count = 0;
      for (const brandName of missingBrandNames) {
        try {
          const newBrand = await db.Brand.create({
            name: brandName,
            description: `${brandName} brand`,
            isActive: true
          });
          brandMap[brandName.toLowerCase()] = newBrand;
          created++;
          count++;
          if (count % 50 === 0) {
            console.log(`   Processed ${count}/${missingBrandNames.size} brands...`);
          }
        } catch (error) {
          if (error.name !== 'SequelizeUniqueConstraintError') {
            console.error(`   ❌ Error creating brand ${brandName}:`, error.message);
          }
        }
      }
      console.log(`   ✅ Created ${created} brands\n`);
    }

    // Final summary
    const finalCategories = await db.Category.count();
    const finalBrands = await db.Brand.count();

    console.log('📊 Final Summary:');
    console.log(`   Categories: ${finalCategories}`);
    console.log(`   Brands: ${finalBrands}\n`);

    console.log('✅ Missing entities created!');
    console.log('   You can now re-run the import script.\n');

  } catch (error) {
    console.error('❌ Error creating missing entities:', error);
    process.exit(1);
  } finally {
    await db.sequelize.close();
  }
}

createMissingEntities();
