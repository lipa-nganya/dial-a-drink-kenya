/**
 * Fix Missing Brands and Categories
 * 
 * This script analyzes the failed imports and creates missing brands and categories.
 * 
 * Usage: node backend/scripts/fix-missing-entities.js
 */

const fs = require('fs');
const path = require('path');
const db = require('../models');

async function fixMissingEntities() {
  try {
    console.log('🔌 Connecting to database...');
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful\n');

    // Read the transformed data
    const transformedPath = path.join(process.cwd(), 'new-inventory-transformed-v2.json');
    if (!fs.existsSync(transformedPath)) {
      console.error('❌ Error: Transformed inventory file not found');
      process.exit(1);
    }

    const transformedData = JSON.parse(fs.readFileSync(transformedPath, 'utf8'));
    const drinks = transformedData.drinks || [];

    console.log(`📋 Analyzing ${drinks.length} drinks...\n`);

    // Get existing entities
    const existingCategories = await db.Category.findAll();
    const existingBrands = await db.Brand.findAll();
    const existingSubcategories = await db.SubCategory.findAll();

    const categoryMap = {};
    existingCategories.forEach(cat => {
      categoryMap[cat.name.toLowerCase()] = cat;
    });

    const brandMap = {};
    existingBrands.forEach(brand => {
      brandMap[brand.name.toLowerCase()] = brand;
    });

    const subcategoryMap = {};
    existingSubcategories.forEach(sub => {
      const key = `${sub.name.toLowerCase()}_${sub.categoryId}`;
      subcategoryMap[key] = sub;
    });

    // Find missing categories
    const missingCategories = new Set();
    const missingBrands = new Set();
    const missingSubcategories = new Map(); // categoryId -> Set of subcategory names

    for (const drink of drinks) {
      // Check for missing category
      if (drink.categoryId === null || drink.categoryId === undefined) {
        // Try to infer from drink data or use a default
        // For now, we'll skip items without categoryId - they need manual assignment
        continue;
      }

      // Check if category exists
      const category = existingCategories.find(c => c.id === drink.categoryId);
      if (!category) {
        // Category ID doesn't exist - this is a data issue
        continue;
      }

      // Check for missing brand
      if (drink.brandId === null || drink.brandId === undefined) {
        // No brand assigned - this is okay, brand is optional
        continue;
      }

      const brand = existingBrands.find(b => b.id === drink.brandId);
      if (!brand && drink.brandId) {
        // Brand ID doesn't exist - need to find the brand name from original data
        // We'll need to check the original export for brand names
        missingBrands.add(drink.brandId);
      }

      // Check for missing subcategory
      if (drink.subCategoryId === null || drink.subCategoryId === undefined) {
        // No subcategory - this is okay, subcategory is optional
        continue;
      }

      const subcategory = existingSubcategories.find(s => s.id === drink.subCategoryId);
      if (!subcategory && drink.subCategoryId) {
        // Subcategory ID doesn't exist
        if (!missingSubcategories.has(drink.categoryId)) {
          missingSubcategories.set(drink.categoryId, new Set());
        }
        missingSubcategories.get(drink.categoryId).add(drink.subCategoryId);
      }
    }

    // Now let's check the original export to get brand names for missing brands
    const originalPath = path.join(process.cwd(), 'new-inventory-raw.json');
    if (fs.existsSync(originalPath)) {
      console.log('📖 Reading original export to find missing brand names...\n');
      const originalData = JSON.parse(fs.readFileSync(originalPath, 'utf8'));
      
      // Build a map of brand IDs to names from original data
      const brandIdToName = new Map();
      for (const item of originalData) {
        const fields = item.fields || item;
        if (fields.brand && typeof fields.brand === 'object' && fields.brand.id && fields.brand.name) {
          brandIdToName.set(fields.brand.id, fields.brand.name.trim());
        }
      }

      // Create missing brands
      console.log('🔄 Creating missing brands...');
      let brandsCreated = 0;
      for (const brandId of missingBrands) {
        const brandName = brandIdToName.get(brandId);
        if (brandName && !brandMap[brandName.toLowerCase()]) {
          try {
            const newBrand = await db.Brand.create({
              name: brandName,
              description: `${brandName} brand`,
              isActive: true
            });
            brandMap[brandName.toLowerCase()] = newBrand;
            brandsCreated++;
            console.log(`   ✅ Created brand: ${brandName}`);
          } catch (error) {
            if (error.name !== 'SequelizeUniqueConstraintError') {
              console.error(`   ❌ Error creating brand ${brandName}:`, error.message);
            }
          }
        }
      }
      console.log(`   ✅ Created ${brandsCreated} brands\n`);
    }

    // Create missing categories for items with null categoryId
    // We'll need to infer categories from the original data
    if (fs.existsSync(originalPath)) {
      console.log('🔄 Creating missing categories for items without categoryId...\n');
      const originalData = JSON.parse(fs.readFileSync(originalPath, 'utf8'));
      
      // Category name mappings
      const categoryNameMappings = {
        'Liqueurs': 'Liqueur',
        'Beers': 'Beer',
        'Mixer spirit': 'Soft Drinks'
      };

      // Find items without categoryId and their category names from original data
      const itemsWithoutCategory = [];
      for (let i = 0; i < originalData.length && i < drinks.length; i++) {
        if (drinks[i].categoryId === null || drinks[i].categoryId === undefined) {
          const fields = originalData[i].fields || originalData[i];
          if (fields.category) {
            const categoryName = typeof fields.category === 'object' 
              ? fields.category.name 
              : fields.category;
            if (categoryName) {
              const mappedName = categoryNameMappings[categoryName] || categoryName;
              if (!categoryMap[mappedName.toLowerCase()]) {
                itemsWithoutCategory.push({
                  drinkIndex: i,
                  categoryName: mappedName
                });
              }
            }
          }
        }
      }

      // Create missing categories
      const categoriesToCreate = new Set();
      itemsWithoutCategory.forEach(item => {
        categoriesToCreate.add(item.categoryName);
      });

      let categoriesCreated = 0;
      for (const categoryName of categoriesToCreate) {
        try {
          const newCategory = await db.Category.create({
            name: categoryName,
            description: `${categoryName} category`,
            isActive: true
          });
          categoryMap[categoryName.toLowerCase()] = newCategory;
          categoriesCreated++;
          console.log(`   ✅ Created category: ${categoryName}`);
        } catch (error) {
          if (error.name !== 'SequelizeUniqueConstraintError') {
            console.error(`   ❌ Error creating category ${categoryName}:`, error.message);
          }
        }
      }
      console.log(`   ✅ Created ${categoriesCreated} categories\n`);
    }

    // Final summary
    const finalCategories = await db.Category.count();
    const finalBrands = await db.Brand.count();
    const finalSubcategories = await db.SubCategory.count();

    console.log('📊 Final Summary:');
    console.log(`   Categories: ${finalCategories}`);
    console.log(`   Brands: ${finalBrands}`);
    console.log(`   Subcategories: ${finalSubcategories}\n`);

    console.log('✅ Missing entities fixed!');
    console.log('   You can now re-run the import script.\n');

  } catch (error) {
    console.error('❌ Error fixing missing entities:', error);
    process.exit(1);
  } finally {
    await db.sequelize.close();
  }
}

// Run the script
fixMissingEntities();
