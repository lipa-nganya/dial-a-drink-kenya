/**
 * Sync Categories, SubCategories, and Brands from Export Data
 * 
 * This script reads the extracted entities from the products export
 * and creates missing categories, subcategories, and brands in the database.
 * 
 * Usage: node backend/scripts/sync-entities-from-export.js
 */

const fs = require('fs');
const path = require('path');
const db = require('../models');

// Category name mappings (old name -> new name)
const categoryNameMappings = {
  'Liqueurs': 'Liqueur',  // Plural to singular
  'Beers': 'Beer',        // Plural to singular
  'Mixer spirit': 'Soft Drinks' // Map to existing category
};

async function syncEntities() {
  try {
    console.log('🔌 Connecting to database...');
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful\n');

    // Read extracted data
    const categoriesPath = path.join(process.cwd(), 'extracted-categories.json');
    const subcategoriesPath = path.join(process.cwd(), 'extracted-subcategories.json');
    const brandsPath = path.join(process.cwd(), 'extracted-brands.json');

    if (!fs.existsSync(categoriesPath) || !fs.existsSync(brandsPath)) {
      console.error('❌ Error: Extracted data files not found. Please run the extraction script first.');
      process.exit(1);
    }

    const extractedCategories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
    const extractedBrands = JSON.parse(fs.readFileSync(brandsPath, 'utf8'));
    const extractedSubcategories = fs.existsSync(subcategoriesPath) 
      ? JSON.parse(fs.readFileSync(subcategoriesPath, 'utf8'))
      : {};

    console.log(`📋 Found ${Object.keys(extractedCategories).length} categories in export`);
    console.log(`📋 Found ${Object.keys(extractedSubcategories).length} subcategories in export`);
    console.log(`📋 Found ${Object.keys(extractedBrands).length} brands in export\n`);

    // Get existing entities from database
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

    console.log(`📊 Database currently has:`);
    console.log(`   ${existingCategories.length} categories`);
    console.log(`   ${existingSubcategories.length} subcategories`);
    console.log(`   ${existingBrands.length} brands\n`);

    // Sync Categories
    console.log('🔄 Syncing Categories...');
    let categoriesCreated = 0;
    let categoriesSkipped = 0;

    for (const [oldId, categoryName] of Object.entries(extractedCategories)) {
      // Apply name mapping
      const mappedName = categoryNameMappings[categoryName] || categoryName;
      const key = mappedName.toLowerCase();

      if (!categoryMap[key]) {
        try {
          const newCategory = await db.Category.create({
            name: mappedName,
            description: `${mappedName} category`,
            isActive: true
          });
          categoryMap[key] = newCategory;
          categoriesCreated++;
          console.log(`   ✅ Created category: ${mappedName}`);
        } catch (error) {
          if (error.name === 'SequelizeUniqueConstraintError') {
            // Category exists but wasn't in our map (case sensitivity issue)
            const existing = await db.Category.findOne({ where: { name: mappedName } });
            if (existing) {
              categoryMap[key] = existing;
              categoriesSkipped++;
            }
          } else {
            console.error(`   ❌ Error creating category ${mappedName}:`, error.message);
          }
        }
      } else {
        categoriesSkipped++;
      }
    }

    console.log(`   ✅ Created ${categoriesCreated} categories, ${categoriesSkipped} already existed\n`);

    // Sync Brands
    console.log('🔄 Syncing Brands...');
    let brandsCreated = 0;
    let brandsSkipped = 0;

    for (const [oldId, brandName] of Object.entries(extractedBrands)) {
      if (!brandName || brandName.trim() === '') continue;
      
      const trimmedName = brandName.trim();
      const key = trimmedName.toLowerCase();

      if (!brandMap[key]) {
        try {
          const newBrand = await db.Brand.create({
            name: trimmedName,
            description: `${trimmedName} brand`,
            isActive: true
          });
          brandMap[key] = newBrand;
          brandsCreated++;
          if (brandsCreated % 50 === 0) {
            console.log(`   Processed ${brandsCreated} brands...`);
          }
        } catch (error) {
          if (error.name === 'SequelizeUniqueConstraintError') {
            const existing = await db.Brand.findOne({ where: { name: trimmedName } });
            if (existing) {
              brandMap[key] = existing;
              brandsSkipped++;
            }
          } else {
            console.error(`   ❌ Error creating brand ${trimmedName}:`, error.message);
          }
        }
      } else {
        brandsSkipped++;
      }
    }

    console.log(`   ✅ Created ${brandsCreated} brands, ${brandsSkipped} already existed\n`);

    // Sync SubCategories (need category mapping)
    console.log('🔄 Syncing SubCategories...');
    let subcategoriesCreated = 0;
    let subcategoriesSkipped = 0;

    // We need to map subcategories to categories
    // For now, we'll create a simple mapping based on common patterns
    // This might need manual adjustment
    
    // First, let's get all products to understand subcategory-category relationships
    const productsPath = path.join(process.cwd(), 'new-inventory-raw.json');
    if (fs.existsSync(productsPath)) {
      const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
      
      // Build subcategory to category mapping
      const subcatToCategoryMap = {};
      for (const product of products) {
        const fields = product.fields || {};
        if (fields.subCategory && fields.category) {
          const subcat = fields.subCategory;
          const cat = fields.category;
          if (subcat.name && cat.name) {
            const mappedCatName = categoryNameMappings[cat.name] || cat.name;
            const catKey = mappedCatName.toLowerCase();
            if (categoryMap[catKey]) {
              subcatToCategoryMap[subcat.name] = categoryMap[catKey].id;
            }
          }
        }
      }

      // Create unique subcategories
      const uniqueSubcategories = new Map();
      for (const product of products) {
        const fields = product.fields || {};
        if (fields.subCategory && fields.category) {
          const subcat = fields.subCategory;
          const cat = fields.category;
          if (subcat.name && cat.name) {
            const mappedCatName = categoryNameMappings[cat.name] || cat.name;
            const catKey = mappedCatName.toLowerCase();
            if (categoryMap[catKey]) {
              const key = `${subcat.name}_${categoryMap[catKey].id}`;
              if (!uniqueSubcategories.has(key)) {
                uniqueSubcategories.set(key, {
                  name: subcat.name,
                  categoryId: categoryMap[catKey].id
                });
              }
            }
          }
        }
      }

      for (const [key, subcatData] of uniqueSubcategories) {
        const subcatKey = `${subcatData.name.toLowerCase()}_${subcatData.categoryId}`;
        if (!subcategoryMap[subcatKey]) {
          try {
            const newSubcategory = await db.SubCategory.create({
              name: subcatData.name,
              categoryId: subcatData.categoryId,
              isActive: true
            });
            subcategoryMap[subcatKey] = newSubcategory;
            subcategoriesCreated++;
            if (subcategoriesCreated % 20 === 0) {
              console.log(`   Processed ${subcategoriesCreated} subcategories...`);
            }
          } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
              const existing = await db.SubCategory.findOne({
                where: {
                  name: subcatData.name,
                  categoryId: subcatData.categoryId
                }
              });
              if (existing) {
                subcategoryMap[subcatKey] = existing;
                subcategoriesSkipped++;
              }
            } else {
              console.error(`   ❌ Error creating subcategory ${subcatData.name}:`, error.message);
            }
          }
        } else {
          subcategoriesSkipped++;
        }
      }
    }

    console.log(`   ✅ Created ${subcategoriesCreated} subcategories, ${subcategoriesSkipped} already existed\n`);

    // Final summary
    const finalCategories = await db.Category.count();
    const finalSubcategories = await db.SubCategory.count();
    const finalBrands = await db.Brand.count();

    console.log('📊 Final Summary:');
    console.log(`   Categories: ${finalCategories}`);
    console.log(`   Subcategories: ${finalSubcategories}`);
    console.log(`   Brands: ${finalBrands}\n`);

    console.log('✅ Entity sync complete!');
    console.log('   You can now re-run the import script to fix foreign key issues.\n');

  } catch (error) {
    console.error('❌ Error syncing entities:', error);
    process.exit(1);
  } finally {
    await db.sequelize.close();
  }
}

// Run the sync
syncEntities();
