const db = require('../models');

async function removeSoftDrinksDescriptions() {
  try {
    console.log('Removing descriptions from Soft Drinks...\n');
    await db.sequelize.authenticate();
    console.log('Database connected\n');

    const softDrinksCategory = await db.Category.findOne({ where: { name: 'Soft Drinks' } });
    if (!softDrinksCategory) {
      console.error('Soft Drinks category not found!');
      return;
    }

    const result = await db.Drink.update(
      { description: null },
      {
        where: { categoryId: softDrinksCategory.id },
        returning: true
      }
    );

    console.log(`✅ Removed descriptions from ${result[0]} soft drinks items`);

  } catch (error) {
    console.error('Error removing descriptions:', error);
  } finally {
    await db.sequelize.close();
  }
}

removeSoftDrinksDescriptions()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

