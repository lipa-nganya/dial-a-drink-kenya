const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Database connection
const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/dialadrink', {
  dialect: 'postgres',
  logging: false
});

async function importAllBrandy() {
  console.log('🍷 Importing all brandy products...');

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

    // Read CSV file
    const results = [];
    const csvFilePath = path.join(__dirname, '../../dial_a_drink_brandy_inventory_fixed.csv');

    console.log('Reading CSV file:', csvFilePath);
    console.log('File exists:', fs.existsSync(csvFilePath));

    if (!fs.existsSync(csvFilePath)) {
      console.log('❌ CSV file not found!');
      return;
    }

    await new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (data) => {
          console.log('Parsed row:', data['Drink Name']);
          results.push(data);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`Total rows in CSV: ${results.length}`);

    let totalImported = 0;
    let totalSkipped = 0;

    for (const row of results) {
      try {
        console.log(`Processing: ${row['Drink Name']}`);
        console.log(`  Price: ${row['Price (KES)']}`);
        console.log(`  Capacity: ${row.Capacity}`);
        console.log(`  ABV: ${row.ABV}`);

        // Check if product already exists
        const existingProduct = await sequelize.query(
          `SELECT id FROM drinks WHERE name = :name AND "categoryId" = :categoryId`,
          {
            replacements: { 
              name: row['Drink Name'],
              categoryId: brandyCategory[0].id
            },
            type: Sequelize.QueryTypes.SELECT
          }
        );

        if (existingProduct.length > 0) {
          console.log(`  ⏭️  Skipping existing product: ${row['Drink Name']}`);
          totalSkipped++;
          continue;
        }

        // Prepare capacity and pricing
        const capacity = row.Capacity ? [row.Capacity] : [];
        const capacityPricing = [];
        
        if (row.Capacity && row['Price (KES)'] && row['Price (KES)'].trim() !== '') {
          capacityPricing.push({
            capacity: row.Capacity,
            originalPrice: parseFloat(row['Price (KES)'].replace(/,/g, '')),
            currentPrice: parseFloat(row['Price (KES)'].replace(/,/g, ''))
          });
        }

        const price = row['Price (KES)'] && row['Price (KES)'].trim() !== ''
          ? parseFloat(row['Price (KES)'].replace(/,/g, ''))
          : 0;

        const abv = row.ABV ? parseFloat(row.ABV.replace('%', '')) : null;

        // Create the product
        const newProduct = await sequelize.query(
          `INSERT INTO drinks (name, description, price, "categoryId", "subCategoryId", abv, capacity, "capacityPricing", "isAvailable", "originalPrice", "createdAt", "updatedAt")
           VALUES (:name, :description, :price, :categoryId, :subCategoryId, :abv, :capacity, :capacityPricing, :isAvailable, :originalPrice, NOW(), NOW())
           RETURNING id, name`,
          {
            replacements: {
              name: row['Drink Name'],
              description: row.Description,
              price: price,
              categoryId: brandyCategory[0].id,
              subCategoryId: brandySubcategory[0].id,
              abv: abv,
              capacity: JSON.stringify(capacity),
              capacityPricing: JSON.stringify(capacityPricing),
              isAvailable: true,
              originalPrice: price
            },
            type: Sequelize.QueryTypes.SELECT
          }
        );

        console.log(`  ✅ Created: ${newProduct[0].name} (ID: ${newProduct[0].id})`);
        totalImported++;

      } catch (error) {
        console.error(`  ❌ Error creating ${row['Drink Name']}:`, error.message);
      }
    }

    console.log(`\n🎉 Import completed!`);
    console.log(`✅ Imported: ${totalImported} products`);
    console.log(`⏭️  Skipped: ${totalSkipped} existing products`);

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
    console.error('❌ Error during brandy import:', error.message);
  } finally {
    await sequelize.close();
  }
}

importAllBrandy();
