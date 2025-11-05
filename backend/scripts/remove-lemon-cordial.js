const db = require('../models');

async function removeLemonCordial() {
  try {
    console.log('Searching for Lemon Cordial in database...');
    
    const drinks = await db.Drink.findAll({
      where: {
        name: {
          [db.Sequelize.Op.iLike]: '%Lemon Cordial%'
        }
      }
    });

    if (drinks.length === 0) {
      console.log('⚠️  Lemon Cordial not found in database.');
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

    console.log('Lemon Cordial removal completed successfully');
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await db.sequelize.close();
  }
}

removeLemonCordial()
  .then(() => {
    console.log('Operation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

