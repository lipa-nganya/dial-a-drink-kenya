const { Sequelize } = require('sequelize');

// Database connection
const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/dialadrink', {
  dialect: 'postgres',
  logging: false
});

async function addBrandySubcategory() {
  console.log('🍷 Adding "All Brandy" subcategory...');

  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established.');

    // Find the Brandy category
    const brandyCategory = await sequelize.query(
      `SELECT id, name FROM categories WHERE name = 'Brandy'`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (brandyCategory.length === 0) {
      console.log('❌ Brandy category not found!');
      return;
    }

    console.log(`Found Brandy category: ${brandyCategory[0].name} (ID: ${brandyCategory[0].id})`);

    // Check if "All Brandy" subcategory already exists
    const existingSubcategory = await sequelize.query(
      `SELECT id, name FROM subcategories WHERE name = 'All Brandy' AND "categoryId" = :categoryId`,
      { 
        replacements: { categoryId: brandyCategory[0].id },
        type: Sequelize.QueryTypes.SELECT 
      }
    );

    if (existingSubcategory.length > 0) {
      console.log(`ℹ️ Subcategory "All Brandy" already exists (ID: ${existingSubcategory[0].id})`);
    } else {
      // Add "All Brandy" subcategory
      const subcategory = await sequelize.query(
        `INSERT INTO subcategories (name, "categoryId", "isActive", "createdAt", "updatedAt") 
         VALUES ('All Brandy', :categoryId, true, NOW(), NOW()) 
         RETURNING id, name`,
        { 
          replacements: { categoryId: brandyCategory[0].id },
          type: Sequelize.QueryTypes.SELECT 
        }
      );

      if (subcategory && subcategory.length > 0) {
        console.log(`✅ Created subcategory: ${subcategory[0].name} (ID: ${subcategory[0].id})`);
      }
    }

    // Show all subcategories for Brandy
    const brandySubcategories = await sequelize.query(
      `SELECT id, name FROM subcategories WHERE "categoryId" = :categoryId`,
      { 
        replacements: { categoryId: brandyCategory[0].id },
        type: Sequelize.QueryTypes.SELECT 
      }
    );

    console.log('\n📋 Brandy subcategories:');
    brandySubcategories.forEach(sub => {
      console.log(`- ${sub.name} (ID: ${sub.id})`);
    });

  } catch (error) {
    console.error('❌ Error adding brandy subcategory:', error.message);
  } finally {
    await sequelize.close();
  }
}

addBrandySubcategory();
