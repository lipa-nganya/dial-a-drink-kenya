const { Sequelize } = require('sequelize');

// Database connection
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false
});

const seedSubcategories = async () => {
  try {
    console.log('🌱 Starting subcategories seeding...');

    // First, get all categories
    const categories = await sequelize.query(`
      SELECT id, name FROM categories ORDER BY name
    `, { type: Sequelize.QueryTypes.SELECT });

    console.log('Found categories:', categories.map(c => c.name));

    // Define subcategories data
    const subcategoriesData = [
      // Whisky
      { categoryName: 'Whisky', subcategories: [
        'All Whiskys', 'Single Malt', 'Bourbon Whisky', 'Blended Scotch', 'Irish Whisky', 'Tennessee Whisky'
      ]},
      // Vodka
      { categoryName: 'Vodka', subcategories: [
        'All Vodka', 'Flavoured Vodka', 'Unflavoured Vodka'
      ]},
      // Wine
      { categoryName: 'Wine', subcategories: [
        'All Wine', 'Red Wine', 'White Wine', 'Rose Wine'
      ]},
      // Champagne
      { categoryName: 'Champagne', subcategories: [
        'All Champagne', 'Rose Champagne', 'Sparkling Wine'
      ]},
      // Beer
      { categoryName: 'Beer', subcategories: [
        'All Beer', 'Cider', 'Lager', 'Malt', 'Draught'
      ]},
      // Tequila
      { categoryName: 'Tequila', subcategories: [
        'All Tequila', 'Gold Tequila', 'Silver Tequila', 'Reposado Tequila'
      ]}
    ];

    let totalCreated = 0;

    for (const categoryData of subcategoriesData) {
      const category = categories.find(c => c.name === categoryData.categoryName);
      
      if (!category) {
        console.log(`⚠️  Category "${categoryData.categoryName}" not found, skipping...`);
        continue;
      }

      console.log(`\n📁 Processing category: ${categoryData.categoryName} (ID: ${category.id})`);

      for (const subcategoryName of categoryData.subcategories) {
        try {
          // Check if subcategory already exists
          const existing = await sequelize.query(`
            SELECT id FROM subcategories WHERE name = :name AND "categoryId" = :categoryId
          `, {
            replacements: { name: subcategoryName, categoryId: category.id },
            type: Sequelize.QueryTypes.SELECT
          });

          if (existing.length > 0) {
            console.log(`  ✅ "${subcategoryName}" already exists`);
            continue;
          }

          // Create subcategory
          await sequelize.query(`
            INSERT INTO subcategories (name, "categoryId", "isActive", "createdAt", "updatedAt")
            VALUES (:name, :categoryId, true, NOW(), NOW())
          `, {
            replacements: { 
              name: subcategoryName, 
              categoryId: category.id 
            }
          });

          console.log(`  ➕ Created: "${subcategoryName}"`);
          totalCreated++;

        } catch (error) {
          console.error(`  ❌ Error creating "${subcategoryName}":`, error.message);
        }
      }
    }

    console.log(`\n🎉 Subcategories seeding completed!`);
    console.log(`📊 Total subcategories created: ${totalCreated}`);

    // Show summary
    const allSubcategories = await sequelize.query(`
      SELECT c.name as category, s.name as subcategory 
      FROM subcategories s 
      JOIN categories c ON s."categoryId" = c.id 
      ORDER BY c.name, s.name
    `, { type: Sequelize.QueryTypes.SELECT });

    console.log('\n📋 All subcategories:');
    allSubcategories.forEach(item => {
      console.log(`  ${item.category} → ${item.subcategory}`);
    });

  } catch (error) {
    console.error('❌ Error seeding subcategories:', error);
  } finally {
    await sequelize.close();
  }
};

// Run the seeding
if (require.main === module) {
  seedSubcategories();
}

module.exports = seedSubcategories;
