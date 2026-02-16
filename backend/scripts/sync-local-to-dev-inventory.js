/**
 * Sync Local Inventory and Categories to Development Database
 * 
 * This script:
 * 1. Exports categories, subcategories, brands, and drinks from local database
 * 2. Clears them from development database
 * 3. Imports them into development database
 * 
 * Usage: 
 *   NODE_ENV=development node backend/scripts/sync-local-to-dev-inventory.js
 *   Then set DATABASE_URL to dev and run import
 */

const fs = require('fs');
const path = require('path');
const db = require('../models');
const { getDatabaseConfigName } = require('../utils/envDetection');

async function exportFromLocal() {
  console.log('📦 Step 1: Exporting from LOCAL database...');
  console.log('================================================\n');
  
  // Force local database connection by removing DATABASE_URL
  const originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  process.env.NODE_ENV = 'development';
  
  // Clear require cache to force re-initialization with local config
  delete require.cache[require.resolve('../models')];
  delete require.cache[require.resolve('../config')];
  delete require.cache[require.resolve('../utils/envDetection')];
  
  const localDb = require('../models');
  await localDb.sequelize.authenticate();
  console.log('✅ Connected to LOCAL database\n');

  try {
    // Export Categories
    console.log('📋 Exporting categories...');
    const categories = await localDb.Category.findAll({
      order: [['id', 'ASC']],
      raw: true
    });
    console.log(`   Found ${categories.length} categories`);

    // Export SubCategories
    console.log('📋 Exporting subcategories...');
    const subcategories = await localDb.SubCategory.findAll({
      order: [['id', 'ASC']],
      raw: true
    });
    console.log(`   Found ${subcategories.length} subcategories`);

    // Export Brands
    console.log('📋 Exporting brands...');
    const brands = await localDb.Brand.findAll({
      order: [['id', 'ASC']],
      raw: true
    });
    console.log(`   Found ${brands.length} brands`);

    // Export Drinks
    console.log('📋 Exporting drinks...');
    const drinks = await localDb.Drink.findAll({
      include: [
        {
          model: localDb.Category,
          as: 'category',
          required: false,
          attributes: ['id', 'name']
        },
        {
          model: localDb.SubCategory,
          as: 'subCategory',
          required: false,
          attributes: ['id', 'name']
        },
        {
          model: localDb.Brand,
          as: 'brand',
          required: false,
          attributes: ['id', 'name']
        }
      ],
      order: [['id', 'ASC']],
      attributes: [
        'id', 'name', 'description', 'price', 'image', 
        'categoryId', 'subCategoryId', 'brandId',
        'isAvailable', 'isPopular', 'isBrandFocus', 
        'isOnOffer', 'limitedTimeOffer', 'originalPrice',
        'capacity', 'capacityPricing', 'abv', 
        'barcode', 'stock', 'purchasePrice',
        'createdAt', 'updatedAt'
      ]
    });

    // Transform drinks to JSON format
    const drinksData = drinks.map(drink => {
      const drinkData = drink.toJSON();
      // Ensure JSON fields are properly formatted
      if (drinkData.capacity && typeof drinkData.capacity === 'string') {
        try {
          drinkData.capacity = JSON.parse(drinkData.capacity);
        } catch (e) {
          drinkData.capacity = [];
        }
      }
      if (drinkData.capacityPricing && typeof drinkData.capacityPricing === 'string') {
        try {
          drinkData.capacityPricing = JSON.parse(drinkData.capacityPricing);
        } catch (e) {
          drinkData.capacityPricing = [];
        }
      }
      return drinkData;
    });

    console.log(`   Found ${drinksData.length} drinks\n`);

    // Save to JSON file
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        source: 'local',
        categories: categories.length,
        subcategories: subcategories.length,
        brands: brands.length,
        drinks: drinksData.length
      },
      categories,
      subcategories,
      brands,
      drinks: drinksData
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fileName = `local-inventory-export-${timestamp}.json`;
    const filePath = path.join(process.cwd(), fileName);
    
    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf8');
    
    console.log(`✅ Export complete!`);
    console.log(`📄 Export file: ${fileName}`);
    console.log(`📁 Location: ${filePath}\n`);

    await localDb.sequelize.close();
    
    // Restore original DATABASE_URL
    if (originalDatabaseUrl) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
    
    return { filePath, exportData };
  } catch (error) {
    console.error('❌ Error exporting from local:', error);
    await localDb.sequelize.close();
    // Restore original DATABASE_URL
    if (originalDatabaseUrl) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
    throw error;
  }
}

async function clearDevelopment() {
  console.log('🗑️  Step 2: Clearing DEVELOPMENT database...');
  console.log('================================================\n');
  
  // Force development database connection
  // Development DB connection string
  const DEV_DATABASE_URL = 'postgresql://dialadrink_app:o61yqm5fLiTwWnk5@34.41.187.250:5432/dialadrink_dev?sslmode=require';
  
  process.env.DATABASE_URL = DEV_DATABASE_URL;
  process.env.NODE_ENV = 'development';
  
  // Clear require cache to force re-initialization with dev config
  delete require.cache[require.resolve('../models')];
  delete require.cache[require.resolve('../config')];
  delete require.cache[require.resolve('../utils/envDetection')];
  
  const devDb = require('../models');
  await devDb.sequelize.authenticate();
  console.log('✅ Connected to DEVELOPMENT database\n');

  try {
    const transaction = await devDb.sequelize.transaction();

    try {
      // Get counts before deletion
      const drinksCount = await devDb.Drink.count({ transaction });
      const categoriesCount = await devDb.Category.count({ transaction });
      const subcategoriesCount = await devDb.SubCategory.count({ transaction });
      const brandsCount = await devDb.Brand.count({ transaction });

      console.log(`📊 Current counts in development:`);
      console.log(`   Drinks: ${drinksCount}`);
      console.log(`   Categories: ${categoriesCount}`);
      console.log(`   Subcategories: ${subcategoriesCount}`);
      console.log(`   Brands: ${brandsCount}\n`);

      if (drinksCount === 0 && categoriesCount === 0 && subcategoriesCount === 0 && brandsCount === 0) {
        console.log('✅ Development database is already empty.\n');
        await transaction.commit();
        await devDb.sequelize.close();
        return;
      }

      console.log('⚠️  WARNING: Deleting all data from development database...\n');

      // Delete related records first
      console.log('🗑️  Deleting related records...');
      
      const relatedTables = [
        { name: 'inventory_checks', display: 'inventory_checks' },
        { name: 'order_items', display: 'order_items' },
        { name: 'cart_items', display: 'cart_items' }
      ];

      for (const table of relatedTables) {
        try {
          // Check if table exists first
          const tableExists = await devDb.sequelize.query(
            `SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = '${table.name}'
            )`,
            { type: devDb.sequelize.QueryTypes.SELECT }
          );
          
          if (tableExists[0].exists) {
            const result = await devDb.sequelize.query(`SELECT COUNT(*) as count FROM ${table.name}`, {
              type: devDb.sequelize.QueryTypes.SELECT
            });
            const count = parseInt(result[0].count);
            if (count > 0) {
              await devDb.sequelize.query(`DELETE FROM ${table.name}`);
              console.log(`   ✅ Deleted ${count} records from ${table.display}`);
            } else {
              console.log(`   ⚠️  ${table.display} table is empty`);
            }
          } else {
            console.log(`   ⚠️  ${table.display} table not found (this is okay)`);
          }
        } catch (e) {
          console.log(`   ⚠️  Error with ${table.display}: ${e.message}`);
        }
      }

      // Delete drinks (must be before subcategories/categories/brands due to foreign keys)
      console.log('\n🗑️  Deleting drinks...');
      await devDb.sequelize.query('DELETE FROM "drinks"');
      console.log(`   ✅ Deleted ${drinksCount} drinks`);

      // Delete subcategories (before categories due to foreign key)
      console.log('🗑️  Deleting subcategories...');
      await devDb.sequelize.query('DELETE FROM "subcategories"');
      console.log(`   ✅ Deleted ${subcategoriesCount} subcategories`);

      // Delete categories
      console.log('🗑️  Deleting categories...');
      await devDb.sequelize.query('DELETE FROM "categories"');
      console.log(`   ✅ Deleted ${categoriesCount} categories`);

      // Delete brands
      console.log('🗑️  Deleting brands...');
      await devDb.sequelize.query('DELETE FROM "brands"');
      console.log(`   ✅ Deleted ${brandsCount} brands`);

      // Reset sequences
      console.log('\n🔄 Resetting sequences...');
      try {
        await devDb.sequelize.query('ALTER SEQUENCE drinks_id_seq RESTART WITH 1');
        await devDb.sequelize.query('ALTER SEQUENCE categories_id_seq RESTART WITH 1');
        await devDb.sequelize.query('ALTER SEQUENCE subcategories_id_seq RESTART WITH 1');
        await devDb.sequelize.query('ALTER SEQUENCE brands_id_seq RESTART WITH 1');
        console.log('   ✅ Sequences reset');
      } catch (seqError) {
        console.log('   ⚠️  Could not reset sequences (this is okay)');
      }

      console.log('\n✅ Development database cleared successfully!\n');
      
      await devDb.sequelize.close();
    } catch (error) {
      console.error('❌ Error during clearing:', error);
      await devDb.sequelize.close();
      throw error;
    }
  } catch (error) {
    console.error('❌ Error clearing development database:', error);
    await devDb.sequelize.close();
    throw error;
  }
}

async function importToDevelopment(exportData) {
  console.log('📥 Step 3: Importing to DEVELOPMENT database...');
  console.log('================================================\n');
  
  // Force development database connection
  // Development DB connection string
  const DEV_DATABASE_URL = 'postgresql://dialadrink_app:o61yqm5fLiTwWnk5@34.41.187.250:5432/dialadrink_dev?sslmode=require';
  
  process.env.DATABASE_URL = DEV_DATABASE_URL;
  process.env.NODE_ENV = 'development';
  
  // Clear require cache to force re-initialization with dev config
  delete require.cache[require.resolve('../models')];
  delete require.cache[require.resolve('../config')];
  delete require.cache[require.resolve('../utils/envDetection')];
  
  const devDb = require('../models');
  await devDb.sequelize.authenticate();
  console.log('✅ Connected to DEVELOPMENT database\n');

  try {
    const transaction = await devDb.sequelize.transaction();

    try {
      // Import Categories
      console.log('📋 Importing categories...');
      let categoriesCreated = 0;
      for (const cat of exportData.categories) {
        try {
          await devDb.Category.create({
            id: cat.id,
            name: cat.name,
            description: cat.description || null,
            image: cat.image || null,
            createdAt: cat.createdAt,
            updatedAt: cat.updatedAt
          }, { transaction });
          categoriesCreated++;
        } catch (error) {
          if (error.name === 'SequelizeUniqueConstraintError') {
            // Update existing
            await devDb.Category.update({
              name: cat.name,
              description: cat.description || null,
              image: cat.image || null,
              updatedAt: cat.updatedAt
            }, {
              where: { id: cat.id },
              transaction
            });
          } else {
            throw error;
          }
        }
      }
      console.log(`   ✅ Imported ${categoriesCreated} categories`);

      // Import Brands
      console.log('📋 Importing brands...');
      let brandsCreated = 0;
      for (const brand of exportData.brands) {
        try {
          await devDb.Brand.create({
            id: brand.id,
            name: brand.name,
            description: brand.description || null,
            image: brand.image || null,
            createdAt: brand.createdAt,
            updatedAt: brand.updatedAt
          }, { transaction });
          brandsCreated++;
        } catch (error) {
          if (error.name === 'SequelizeUniqueConstraintError') {
            // Update existing
            await devDb.Brand.update({
              name: brand.name,
              description: brand.description || null,
              image: brand.image || null,
              updatedAt: brand.updatedAt
            }, {
              where: { id: brand.id },
              transaction
            });
          } else {
            throw error;
          }
        }
      }
      console.log(`   ✅ Imported ${brandsCreated} brands`);

      // Import SubCategories (after categories and brands)
      console.log('📋 Importing subcategories...');
      let subcategoriesCreated = 0;
      for (const subcat of exportData.subcategories) {
        try {
          await devDb.SubCategory.create({
            id: subcat.id,
            name: subcat.name,
            categoryId: subcat.categoryId,
            description: subcat.description || null,
            image: subcat.image || null,
            createdAt: subcat.createdAt,
            updatedAt: subcat.updatedAt
          }, { transaction });
          subcategoriesCreated++;
        } catch (error) {
          if (error.name === 'SequelizeUniqueConstraintError') {
            // Update existing
            await devDb.SubCategory.update({
              name: subcat.name,
              categoryId: subcat.categoryId,
              description: subcat.description || null,
              image: subcat.image || null,
              updatedAt: subcat.updatedAt
            }, {
              where: { id: subcat.id },
              transaction
            });
          } else {
            throw error;
          }
        }
      }
      console.log(`   ✅ Imported ${subcategoriesCreated} subcategories`);

      // Import Drinks
      console.log('📋 Importing drinks...');
      let drinksCreated = 0;
      let drinksUpdated = 0;
      
      for (let i = 0; i < exportData.drinks.length; i++) {
        const drinkData = exportData.drinks[i];
        
        try {
          const drinkUpdate = {
            name: drinkData.name,
            description: drinkData.description || null,
            price: drinkData.price || null,
            image: drinkData.image || null,
            categoryId: drinkData.categoryId || null,
            subCategoryId: drinkData.subCategoryId || null,
            brandId: drinkData.brandId || null,
            isAvailable: drinkData.isAvailable !== undefined ? drinkData.isAvailable : true,
            isPopular: drinkData.isPopular || false,
            isBrandFocus: drinkData.isBrandFocus || false,
            isOnOffer: drinkData.isOnOffer || false,
            limitedTimeOffer: drinkData.limitedTimeOffer || false,
            originalPrice: drinkData.originalPrice || null,
            capacity: drinkData.capacity ? JSON.stringify(drinkData.capacity) : null,
            capacityPricing: drinkData.capacityPricing ? JSON.stringify(drinkData.capacityPricing) : null,
            abv: drinkData.abv || null,
            barcode: drinkData.barcode ? String(drinkData.barcode).substring(0, 255) : null,
            stock: drinkData.stock !== undefined ? parseInt(drinkData.stock) || 0 : 0,
            purchasePrice: drinkData.purchasePrice || null,
            createdAt: drinkData.createdAt,
            updatedAt: drinkData.updatedAt
          };

          // Check if drink exists
          const existing = await devDb.Drink.findByPk(drinkData.id, { transaction });
          
          if (existing) {
            await devDb.Drink.update(drinkUpdate, {
              where: { id: drinkData.id },
              transaction
            });
            drinksUpdated++;
          } else {
            await devDb.Drink.create({
              id: drinkData.id,
              ...drinkUpdate
            }, { transaction });
            drinksCreated++;
          }

          if ((i + 1) % 50 === 0) {
            console.log(`   Processed ${i + 1}/${exportData.drinks.length} drinks...`);
          }
        } catch (error) {
          console.error(`   ❌ Error importing drink ${drinkData.id} (${drinkData.name}):`, error.message);
          // Continue with next drink
        }
      }

      console.log(`   ✅ Imported ${drinksCreated} drinks, updated ${drinksUpdated} drinks`);

      await transaction.commit();
      console.log('\n✅ Import to development database complete!\n');

      // Verify counts
      const finalCounts = {
        drinks: await devDb.Drink.count(),
        categories: await devDb.Category.count(),
        subcategories: await devDb.SubCategory.count(),
        brands: await devDb.Brand.count()
      };

      console.log('📊 Final counts in development database:');
      console.log(`   Drinks: ${finalCounts.drinks}`);
      console.log(`   Categories: ${finalCounts.categories}`);
      console.log(`   Subcategories: ${finalCounts.subcategories}`);
      console.log(`   Brands: ${finalCounts.brands}\n`);

      await devDb.sequelize.close();
    } catch (transactionError) {
      await transaction.rollback();
      console.error('❌ Error during import transaction:', transactionError);
      await devDb.sequelize.close();
      throw transactionError;
    }
  } catch (error) {
    console.error('❌ Error importing to development database:', error);
    await devDb.sequelize.close();
    throw error;
  }
}

async function syncLocalToDev() {
  try {
    console.log('🚀 Syncing Local Inventory to Development Database');
    console.log('================================================\n');

    // Step 1: Export from local
    const { filePath, exportData } = await exportFromLocal();

    // Step 2: Clear development
    await clearDevelopment();

    // Step 3: Import to development
    await importToDevelopment(exportData);

    console.log('✅ Sync complete!');
    console.log(`📄 Export file saved at: ${filePath}\n`);

  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  syncLocalToDev();
}

module.exports = { syncLocalToDev, exportFromLocal, clearDevelopment, importToDevelopment };
