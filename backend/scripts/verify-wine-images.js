const db = require('../models');

(async () => {
  try {
    await db.sequelize.authenticate();
    const wineCategory = await db.Category.findOne({ where: { name: 'Wine' } });
    
    const items = [
      'Namaqua Red Dry',
      'Nederburg Cabernet Sauvignon',
      'Nederburg Chardonnay',
      'Nederburg Merlot',
      'Robertson Rose',
      'Rosso Nobile Cioccolata',
      'The Guv\'nor Red Wine'
    ];
    
    console.log('✅ Verification of updated images:\n');
    for (const name of items) {
      const drink = await db.Drink.findOne({
        where: { 
          name: { [db.Sequelize.Op.iLike]: name },
          categoryId: wineCategory.id 
        }
      });
      
      if (drink) {
        if (drink.image) {
          const isLogo = drink.image.includes('logo');
          console.log(`${drink.name}:`);
          console.log(`  ${isLogo ? '❌ Logo' : '✅ Product image'}`);
        } else {
          console.log(`${drink.name}: ❌ No image`);
        }
      } else {
        console.log(`❌ Not found: ${name}`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();

