const db = require('../models');

async function removeStirlingPinkGin() {
  try {
    console.log('Searching for Stirling Pink Gin in database...');
    
    const drinks = await db.Drink.findAll({
      where: {
        name: {
          [db.Sequelize.Op.iLike]: '%Stirling Pink Gin%'
        }
      }
    });

    if (drinks.length === 0) {
      console.log('⚠️  Stirling Pink Gin not found in database.');
      return;
    }

    console.log(`Found ${drinks.length} entry/entries:`);
    drinks.forEach(drink => {
      console.log(`  - ID: ${drink.id}, Name: ${drink.name}`);
    });

    for (const drink of drinks) {
      await drink.destroy();
      console.log(`✅ Deleted: ${drink.name} (ID: ${drink.id})`);
    }

    console.log('Stirling Pink Gin removal completed successfully');
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await db.sequelize.close();
  }
}

removeStirlingPinkGin()
  .then(() => {
    console.log('Operation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

