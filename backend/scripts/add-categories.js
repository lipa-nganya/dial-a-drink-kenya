const { Sequelize } = require('sequelize');

// Use the DATABASE_URL environment variable for Render
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: console.log
});

async function addCategories() {
  try {
    await sequelize.authenticate();
    console.log('Connection to database has been established successfully.');

    const categories = [
      'Whisky',
      'Vodka', 
      'Wine',
      'Champagne',
      'Vapes',
      'Brandy',
      'Cognac',
      'Beer',
      'Tequila',
      'Rum',
      'Gin',
      'Liqueur',
      'Soft Drinks',
      'Smokes'
    ];

    for (const categoryName of categories) {
      // Check if category already exists
      const [existing] = await sequelize.query(`
        SELECT id FROM categories WHERE name = :name
      `, {
        replacements: { name: categoryName }
      });

      if (existing.length === 0) {
        // Insert new category
        await sequelize.query(`
          INSERT INTO categories (name, "createdAt", "updatedAt") 
          VALUES (:name, NOW(), NOW())
        `, {
          replacements: { name: categoryName }
        });
        console.log(`✅ Added category: ${categoryName}`);
      } else {
        console.log(`⏭️  Category already exists: ${categoryName}`);
      }
    }
    
    console.log('✅ All categories processed successfully!');
  } catch (error) {
    console.error('❌ Error adding categories:', error);
  } finally {
    await sequelize.close();
  }
}

addCategories();
