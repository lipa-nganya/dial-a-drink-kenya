const { Sequelize } = require('sequelize');

// Database connection
const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/dialadrink', {
  dialect: 'postgres',
  logging: false
});

async function createKeyBrandyProducts() {
  console.log('🍷 Creating key brandy products...');

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

    // Key brandy products from the website
    const brandyProducts = [
      {
        name: 'Emperador Brandy',
        description: 'Emperador Brandy (ABV 36%), Philippine',
        price: 3500,
        capacity: ['750ML'],
        capacityPricing: [{ capacity: '750ML', originalPrice: 3500, currentPrice: 3500 }],
        abv: 36
      },
      {
        name: 'Don Montego VSOP',
        description: 'Don Montego VSOP (ABV 40%), Moldova',
        price: 2100,
        capacity: ['750ML'],
        capacityPricing: [{ capacity: '750ML', originalPrice: 2100, currentPrice: 2100 }],
        abv: 40
      },
      {
        name: 'Viceroy',
        description: 'Viceroy (ABV 43%), France',
        price: 1700,
        capacity: ['750ML'],
        capacityPricing: [{ capacity: '750ML', originalPrice: 1700, currentPrice: 1700 }],
        abv: 43
      },
      {
        name: 'St Remy XO',
        description: 'St Remy XO (ABV 40%), France',
        price: 3400,
        capacity: ['700ML'],
        capacityPricing: [{ capacity: '700ML', originalPrice: 3400, currentPrice: 3400 }],
        abv: 40
      },
      {
        name: 'Grand Marnier',
        description: 'Grand Marnier (ABV 40%), France',
        price: 4200,
        capacity: ['700ML'],
        capacityPricing: [{ capacity: '700ML', originalPrice: 4200, currentPrice: 4200 }],
        abv: 40
      },
      {
        name: 'Remy Martin XO',
        description: 'Remy Martin XO (ABV 40%), France',
        price: 28000,
        capacity: ['700ML'],
        capacityPricing: [{ capacity: '700ML', originalPrice: 28000, currentPrice: 28000 }],
        abv: 40
      }
    ];

    let totalCreated = 0;

    for (const product of brandyProducts) {
      try {
        // Check if product already exists
        const existingProduct = await sequelize.query(
          `SELECT id FROM drinks WHERE name = :name AND "categoryId" = :categoryId`,
          {
            replacements: { 
              name: product.name,
              categoryId: brandyCategory[0].id
            },
            type: Sequelize.QueryTypes.SELECT
          }
        );

        if (existingProduct.length > 0) {
          console.log(`  ⏭️  Skipping existing product: ${product.name}`);
          continue;
        }

        // Create the product
        const newProduct = await sequelize.query(
          `INSERT INTO drinks (name, description, price, "categoryId", "subCategoryId", abv, capacity, "capacityPricing", "isAvailable", "originalPrice", "createdAt", "updatedAt")
           VALUES (:name, :description, :price, :categoryId, :subCategoryId, :abv, :capacity, :capacityPricing, :isAvailable, :originalPrice, NOW(), NOW())
           RETURNING id, name`,
          {
            replacements: {
              name: product.name,
              description: product.description,
              price: product.price,
              categoryId: brandyCategory[0].id,
              subCategoryId: brandySubcategory[0].id,
              abv: product.abv,
              capacity: JSON.stringify(product.capacity),
              capacityPricing: JSON.stringify(product.capacityPricing),
              isAvailable: true,
              originalPrice: product.price
            },
            type: Sequelize.QueryTypes.SELECT
          }
        );

        console.log(`  ✅ Created: ${newProduct[0].name} (ID: ${newProduct[0].id}) - KES ${product.price}`);
        totalCreated++;

      } catch (error) {
        console.error(`  ❌ Error creating ${product.name}:`, error.message);
      }
    }

    console.log(`\n🎉 Import completed!`);
    console.log(`✅ Created: ${totalCreated} brandy products`);

    // Show all brandy drinks
    const brandyDrinks = await sequelize.query(
      `SELECT d.id, d.name, d.price FROM drinks d 
       JOIN categories c ON d."categoryId" = c.id 
       WHERE c.name = 'Brandy'
       ORDER BY d.name`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    console.log(`\n🍷 Total brandy drinks in database: ${brandyDrinks.length}`);
    brandyDrinks.forEach(drink => {
      console.log(`- ${drink.name} - KES ${drink.price}`);
    });

  } catch (error) {
    console.error('❌ Error during brandy creation:', error.message);
  } finally {
    await sequelize.close();
  }
}

createKeyBrandyProducts();
































