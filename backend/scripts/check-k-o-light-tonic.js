const db = require('../models');

async function checkKOLightTonic() {
  try {
    console.log('Checking K.O Light Tonic entries in database...');
    
    const drinks = await db.Drink.findAll({
      where: {
        name: {
          [db.Sequelize.Op.iLike]: '%K.O Light Tonic%'
        }
      }
    });

    console.log(`Found ${drinks.length} entry/entries:`);
    drinks.forEach(drink => {
      console.log(`  - ID: ${drink.id}, Name: ${drink.name}, Image: ${drink.image}`);
    });

    if (drinks.length > 0) {
      for (const drink of drinks) {
        const imagePath = `/images/k-o-light-tonic.jpg`;
        drink.image = imagePath;
        await drink.save();
        console.log(`\n✅ Updated database: ${drink.name} (ID: ${drink.id}) with image path: ${imagePath}`);
      }
    } else {
      console.log('⚠️  No K.O Light Tonic entries found.');
    }

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await db.sequelize.close();
  }
}

checkKOLightTonic()
  .then(() => {
    console.log('Operation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

