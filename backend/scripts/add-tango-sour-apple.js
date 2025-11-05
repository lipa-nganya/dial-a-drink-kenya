const db = require('../models');

async function addTangoSourApple() {
  try {
    const liqueursCategory = await db.Category.findOne({
      where: { name: { [db.Sequelize.Op.iLike]: '%liqueur%' } }
    });

    // Add the missing Tango sour apple
    await db.Drink.create({
      name: "Tango sour apple",
      description: "Tango sour apple",
      price: 2600,
      capacity: ["750ML"],
      abv: null,
      categoryId: liqueursCategory.id,
      isAvailable: true,
      image: '/images/placeholder.svg'
    });

    console.log('Added: Tango sour apple');

    // Check final count
    const totalLiqueurs = await db.Drink.count({
      where: { categoryId: liqueursCategory.id }
    });

    console.log(`\nTotal liqueurs now: ${totalLiqueurs}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.sequelize.close();
  }
}

addTangoSourApple();
