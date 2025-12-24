const { Sequelize } = require('sequelize');

// Database connection
const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/dialadrink', {
  dialect: 'postgres',
  logging: false
});

async function removeCategories() {
  console.log('🗑️ Removing "Hot Beverages" and "Alcoholic Drinks" categories...');

  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established.');

    // Get categories to remove
    const categoriesToRemove = await sequelize.query(
      `SELECT id, name FROM categories WHERE name IN ('Hot Beverages', 'Alcoholic Drinks')`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    console.log(`Found ${categoriesToRemove.length} categories to remove:`);
    categoriesToRemove.forEach(cat => {
      console.log(`- ${cat.name} (ID: ${cat.id})`);
    });

    if (categoriesToRemove.length === 0) {
      console.log('✅ No categories found to remove.');
      return;
    }

    // Remove each category
    for (const category of categoriesToRemove) {
      try {
        // First, delete any drinks in this category
        const drinksInCategory = await sequelize.query(
          `SELECT id, name FROM drinks WHERE "categoryId" = :categoryId`,
          { 
            replacements: { categoryId: category.id },
            type: Sequelize.QueryTypes.SELECT 
          }
        );
        
        if (drinksInCategory.length > 0) {
          console.log(`Deleting ${drinksInCategory.length} drinks from category "${category.name}"`);
          await sequelize.query(
            `DELETE FROM drinks WHERE "categoryId" = :categoryId`,
            { replacements: { categoryId: category.id } }
          );
        }

        // Delete any subcategories in this category
        const subcategoriesInCategory = await sequelize.query(
          `SELECT id, name FROM subcategories WHERE "categoryId" = :categoryId`,
          { 
            replacements: { categoryId: category.id },
            type: Sequelize.QueryTypes.SELECT 
          }
        );
        
        if (subcategoriesInCategory.length > 0) {
          console.log(`Deleting ${subcategoriesInCategory.length} subcategories from category "${category.name}"`);
          await sequelize.query(
            `DELETE FROM subcategories WHERE "categoryId" = :categoryId`,
            { replacements: { categoryId: category.id } }
          );
        }

        // Now delete the category itself
        await sequelize.query(
          `DELETE FROM categories WHERE id = :categoryId`,
          { replacements: { categoryId: category.id } }
        );
        console.log(`✅ Removed category: ${category.name}`);
        
      } catch (error) {
        console.error(`❌ Error removing category "${category.name}":`, error.message);
      }
    }

    console.log('\n🎉 Category removal completed!');
    
    // Show remaining categories
    const remainingCategories = await sequelize.query(
      `SELECT name FROM categories ORDER BY name`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    
    console.log('\n📋 Remaining categories:');
    remainingCategories.forEach(cat => {
      console.log(`- ${cat.name}`);
    });

  } catch (error) {
    console.error('❌ Error during category removal:', error.message);
  } finally {
    await sequelize.close();
  }
}

removeCategories();
































