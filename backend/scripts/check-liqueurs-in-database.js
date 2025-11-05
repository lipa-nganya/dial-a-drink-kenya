const db = require('../models');

async function checkLiqueursInDatabase() {
  try {
    console.log('Checking liqueurs in database...');
    
    // First, find the liqueurs category ID
    const liqueursCategory = await db.Category.findOne({
      where: {
        name: {
          [db.Sequelize.Op.iLike]: '%liqueur%'
        }
      }
    });

    if (!liqueursCategory) {
      console.log('Liqueurs category not found');
      return;
    }

    console.log(`Liqueurs category ID: ${liqueursCategory.id}`);

    // Get all drinks in the liqueurs category
    const liqueurs = await db.Drink.findAll({
      where: {
        categoryId: liqueursCategory.id
      },
      include: [{
        model: db.Category,
        as: 'category'
      }]
    });

    console.log(`\nFound ${liqueurs.length} liqueurs in database:`);
    liqueurs.forEach((drink, index) => {
      console.log(`${index + 1}. ${drink.name} (ID: ${drink.id})`);
    });

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await db.sequelize.close();
  }
}

checkLiqueursInDatabase()
  .then(() => {
    console.log('Operation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });

