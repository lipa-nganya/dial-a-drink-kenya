const db = require('../models');

async function checkSeagramms() {
  try {
    console.log('Checking Seagramm\'s entries in database...');
    
    const drinks = await db.Drink.findAll({
      where: {
        name: {
          [db.Sequelize.Op.iLike]: '%Seagramm%'
        }
      }
    });

    console.log(`Found ${drinks.length} entry/entries:`);
    drinks.forEach(drink => {
      console.log(`  - ID: ${drink.id}, Name: ${drink.name}, Image: ${drink.image}`);
    });

    if (drinks.length === 0) {
      console.log('\n⚠️  No Seagramm\'s entries found. Trying alternative spelling...');
      const drinksAlt = await db.Drink.findAll({
        where: {
          name: {
            [db.Sequelize.Op.iLike]: '%Seagram%'
          }
        }
      });
      
      console.log(`Found ${drinksAlt.length} entry/entries with alternative spelling:`);
      drinksAlt.forEach(drink => {
        console.log(`  - ID: ${drink.id}, Name: ${drink.name}, Image: ${drink.image}`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await db.sequelize.close();
  }
}

checkSeagramms()
  .then(() => {
    console.log('Operation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

