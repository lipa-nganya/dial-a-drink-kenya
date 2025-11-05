const db = require('../models');

async function checkFitchLeedesPinkTonic() {
  try {
    console.log('Checking Fitch & Leedes Pink Tonic entries in database...');
    
    const drinks = await db.Drink.findAll({
      where: {
        name: {
          [db.Sequelize.Op.iLike]: '%Fitch%Leedes%Pink Tonic%'
        }
      }
    });

    console.log(`Found ${drinks.length} entry/entries:`);
    drinks.forEach(drink => {
      console.log(`  - ID: ${drink.id}, Name: ${drink.name}, Image: ${drink.image}`);
    });

    if (drinks.length > 0) {
      for (const drink of drinks) {
        const imagePath = `/images/fitch-leedes-pink-tonic.jpg`;
        drink.image = imagePath;
        await drink.save();
        console.log(`\n✅ Updated database: ${drink.name} (ID: ${drink.id}) with image path: ${imagePath}`);
      }
    } else {
      console.log('⚠️  No Fitch & Leedes Pink Tonic entries found.');
    }

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await db.sequelize.close();
  }
}

checkFitchLeedesPinkTonic()
  .then(() => {
    console.log('Operation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

