const { Sequelize } = require('sequelize');

// Database connection
const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/dialadrink', {
  dialect: 'postgres',
  logging: false
});

async function createTestBrandy() {
  console.log('🍷 Creating test brandy product...');

  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established.');

    // Get brandy category and subcategory
    const brandyCategory = await sequelize.query(
      `SELECT id, name FROM categories WHERE name = 'Brandy'`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const brandySubcategory = await sequelize.query(
      `SELECT id, name FROM subcategories WHERE name = 'All Brandy' AND "categoryId" = :categoryId`,
      { 
        replacements: { categoryId: brandyCategory[0].id },
        type: Sequelize.QueryTypes.SELECT 
      }
    );

    console.log(`Brandy category: ${brandyCategory[0].name} (ID: ${brandyCategory[0].id})`);
    console.log(`Brandy subcategory: ${brandySubcategory[0].name} (ID: ${brandySubcategory[0].id})`);

    // Create a test brandy product
    const testBrandy = await sequelize.query(
      `INSERT INTO drinks (name, description, price, "categoryId", "subCategoryId", abv, capacity, "capacityPricing", "isAvailable", "originalPrice", "createdAt", "updatedAt")
       VALUES (:name, :description, :price, :categoryId, :subCategoryId, :abv, :capacity, :capacityPricing, :isAvailable, :originalPrice, NOW(), NOW())
       RETURNING id, name`,
      {
        replacements: {
          name: 'Test Emperador Brandy',
          description: 'Test Emperador Brandy (ABV 36%), Philippine',
          price: 3500,
          categoryId: brandyCategory[0].id,
          subCategoryId: brandySubcategory[0].id,
          abv: 36,
          capacity: JSON.stringify(['750ML']),
          capacityPricing: JSON.stringify([{
            capacity: '750ML',
            originalPrice: 3500,
            currentPrice: 3500
          }]),
          isAvailable: true,
          originalPrice: 3500
        },
        type: Sequelize.QueryTypes.SELECT
      }
    );

    console.log('✅ Test brandy created:', testBrandy[0]);

    // Check all brandy drinks
    const brandyDrinks = await sequelize.query(
      `SELECT d.id, d.name, c.name as category_name FROM drinks d 
       JOIN categories c ON d."categoryId" = c.id 
       WHERE c.name = 'Brandy'`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    console.log(`\n🍷 Brandy drinks in database: ${brandyDrinks.length}`);
    brandyDrinks.forEach(drink => {
      console.log(`- ${drink.name} (${drink.category_name})`);
    });

  } catch (error) {
    console.error('❌ Error creating test brandy:', error.message);
  } finally {
    await sequelize.close();
  }
}

createTestBrandy();
































