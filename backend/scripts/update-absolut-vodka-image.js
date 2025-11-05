const db = require('../models');

async function updateAbsolutVodka() {
  try {
    console.log('Updating all Absolut Vodka entries...');
    
    const drinks = await db.Drink.findAll({
      where: {
        name: {
          [db.Sequelize.Op.iLike]: '%Absolut Vodka%'
        }
      }
    });

    console.log(`Found ${drinks.length} entry/entries:`);
    
    for (const drink of drinks) {
      // Skip flavored variants
      if (drink.name.includes('Oak') || 
          drink.name.includes('Elyx') || 
          drink.name.includes('Apeach') ||
          drink.name.includes('Pepper') ||
          drink.name.includes('Raspberri') ||
          drink.name.includes('Vanilla') ||
          drink.name.includes('Unique') ||
          drink.name.includes('Kurant') ||
          drink.name.includes('mango') ||
          drink.name.includes('Citron') ||
          drink.name.includes('Pears') ||
          drink.name.includes('Mandrin') ||
          drink.name.includes('Watkins')) {
        console.log(`  - Skipping: ${drink.name} (ID: ${drink.id})`);
        continue;
      }

      const imagePath = `/images/absolut-vodka.jpg`;
      drink.image = imagePath;
      await drink.save();
      console.log(`✅ Updated: ${drink.name} (ID: ${drink.id}) with image path: ${imagePath}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await db.sequelize.close();
  }
}

updateAbsolutVodka()
  .then(() => {
    console.log('Operation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

