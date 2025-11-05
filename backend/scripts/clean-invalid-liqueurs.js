const db = require('../models');

async function cleanInvalidLiqueurs() {
  try {
    console.log('Cleaning invalid liqueur entries...');
    
    // Find the liqueurs category
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

    // Get all liqueurs
    const liqueurs = await db.Drink.findAll({
      where: {
        categoryId: liqueursCategory.id
      }
    });

    console.log(`Found ${liqueurs.length} liqueurs in database`);

    // Delete invalid entries (fragmented data)
    const invalidPatterns = [
      /^\(ABV \d+%\),/i,  // (ABV 35%), Germany
      /^\d+(\.\d+)?\s*(ml|ML|litre|Litre|L|pack|Pack)\.?$/i,  // 750ML., 1 Litre
      /^Monin.*\.\.\.$/i,  // Monin Chocolate...
      /^Panache Artisanal\.\.\.$/i,  // Panache Artisanal...
      /^Cointreau 1litre$/i,  // Cointreau 1litre
      /^Southern comfort 750ml$/i,  // Southern comfort 750ml
      /^Grenadine Syrup$/i,  // Grenadine Syrup
      /^Pernod$/i,  // Pernod
      /^Tango sour apple$/i,  // Tango sour apple
      /^Monin.*Puree$/i,  // Monin Strawberry Puree, etc.
      /^Monin.*Syrup$/i,  // Monin Rose Syrup, etc.
      /^Monin.*Frappe$/i,  // Monin Vanilla Frappe
    ];

    let deletedCount = 0;
    for (const liqueur of liqueurs) {
      const shouldDelete = invalidPatterns.some(pattern => pattern.test(liqueur.name));
      
      if (shouldDelete) {
        console.log(`Deleting invalid entry: ${liqueur.name}`);
        await liqueur.destroy();
        deletedCount++;
      }
    }

    console.log(`\nDeleted ${deletedCount} invalid entries`);

    // Show remaining liqueurs
    const remainingLiqueurs = await db.Drink.findAll({
      where: {
        categoryId: liqueursCategory.id
      }
    });

    console.log(`\nRemaining ${remainingLiqueurs.length} liqueurs:`);
    remainingLiqueurs.forEach((liqueur, index) => {
      console.log(`${index + 1}. ${liqueur.name}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await db.sequelize.close();
  }
}

cleanInvalidLiqueurs()
  .then(() => {
    console.log('Cleanup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
