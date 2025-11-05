const db = require('../models');

async function checkAbsolutVodka() {
  try {
    console.log('Checking Absolut Vodka entries in database...');
    
    const drinks = await db.Drink.findAll({
      where: {
        name: {
          [db.Sequelize.Op.iLike]: '%Absolut Vodka%'
        }
      }
    });

    console.log(`Found ${drinks.length} entry/entries:`);
    drinks.forEach(drink => {
      console.log(`  - ID: ${drink.id}, Name: ${drink.name}, Image: ${drink.image}`);
    });

    if (drinks.length > 0) {
      const drink = drinks.find(d => 
        !d.name.includes('Oak') && 
        !d.name.includes('Elyx') && 
        !d.name.includes('Apeach') &&
        !d.name.includes('Pepper') &&
        !d.name.includes('Raspberri') &&
        !d.name.includes('Vanilla') &&
        !d.name.includes('Unique') &&
        !d.name.includes('Kurant') &&
        !d.name.includes('mango') &&
        !d.name.includes('Citron') &&
        !d.name.includes('Pears') &&
        !d.name.includes('Mandrin') &&
        !d.name.includes('Watkins')
      );

      if (drink) {
        const imagePath = `/images/absolut-vodka.jpg`;
        drink.image = imagePath;
        await drink.save();
        console.log(`\n✅ Updated database: ${drink.name} (ID: ${drink.id}) with image path: ${imagePath}`);
      } else {
        console.log('\n⚠️  Could not find base Absolut Vodka entry.');
      }
    } else {
      console.log('⚠️  No Absolut Vodka entries found.');
    }

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await db.sequelize.close();
  }
}

checkAbsolutVodka()
  .then(() => {
    console.log('Operation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

