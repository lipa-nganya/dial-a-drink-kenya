const db = require('../models');

async function addRemainingLiqueurs() {
  try {
    const liqueursCategory = await db.Category.findOne({
      where: { name: { [db.Sequelize.Op.iLike]: '%liqueur%' } }
    });

    // First clean up remaining invalid entries
    const invalidEntries = await db.Drink.findAll({
      where: {
        categoryId: liqueursCategory.id,
        name: {
          [db.Sequelize.Op.or]: [
            { [db.Sequelize.Op.iLike]: '(%ABV%' },
            { [db.Sequelize.Op.iLike]: '%Litres%' },
            { [db.Sequelize.Op.iLike]: '%ml%' }
          ]
        }
      }
    });

    for (const entry of invalidEntries) {
      console.log(`Deleting invalid: ${entry.name}`);
      await entry.destroy();
    }

    // Add remaining liqueurs from Dial a Drink Kenya
    const remainingLiqueurs = [
      { name: "Jagermeister", price: 3595, capacity: ["1 Litre"], abv: 35, description: "Jagermeister (ABV 35%), Germany" },
      { name: "Monin Strawberry Puree", price: 3800, capacity: ["1 Litre"], abv: null, description: "Monin Strawberry Puree" },
      { name: "Monin Mango Puree", price: 3600, capacity: ["1 Litre"], abv: null, description: "Monin Mango Puree" },
      { name: "Monin Hibiscus Syrup", price: 2200, capacity: ["700ML"], abv: null, description: "Monin Hibiscus Syrup" },
      { name: "Monin Apple Puree", price: 3200, capacity: ["1 Litre"], abv: null, description: "Monin Apple Puree" },
      { name: "Monin Blueberry Puree", price: 4200, capacity: ["1 Litre"], abv: null, description: "Monin Blueberry Puree" },
      { name: "Monin Chocolate Cookies Syrup", price: 2200, capacity: ["700ML"], abv: null, description: "Monin Chocolate Cookies Syrup" },
      { name: "Monin Mojito Mint Syrup", price: 2200, capacity: ["700ML"], abv: null, description: "Monin Mojito Mint Syrup" },
      { name: "Monin Peach Tea Syrup", price: 2200, capacity: ["700ML"], abv: null, description: "Monin Peach Tea Syrup" },
      { name: "Monin Blue Curacao Syrup", price: 2400, capacity: ["700ML"], abv: null, description: "Monin Blue Curacao Syrup" },
      { name: "Monin Rose Syrup", price: 2200, capacity: ["700ML"], abv: null, description: "Monin Rose Syrup" },
      { name: "Monin Lavender Syrup", price: 2200, capacity: ["700ML"], abv: null, description: "Monin Lavender Syrup" },
      { name: "Monin Almond Syrup", price: 2200, capacity: ["700ML"], abv: null, description: "Monin Almond Syrup" },
      { name: "Monin Coconut Syrup", price: 2200, capacity: ["700ML"], abv: null, description: "Monin Coconut Syrup" },
      { name: "Monin Sugar Cane Syrup", price: 2200, capacity: ["700ML"], abv: null, description: "Monin Sugar Cane Syrup" },
      { name: "Monin Cucumber Syrup", price: 2200, capacity: ["700ML"], abv: null, description: "Monin Cucumber Syrup" },
      { name: "Monin Cloudy Lemonade Syrup", price: 2200, capacity: ["700ML"], abv: null, description: "Monin Cloudy Lemonade Syrup" },
      { name: "Monin Green Mint Syrup", price: 2500, capacity: ["700ML"], abv: null, description: "Monin Green Mint Syrup" },
      { name: "Monin Watermelon Syrup", price: 2200, capacity: ["700ML"], abv: null, description: "Monin Watermelon Syrup" },
      { name: "Monin Kiwi Puree", price: 3200, capacity: ["1 Litre"], abv: null, description: "Monin Kiwi Puree" },
      { name: "Monin Ruby Grapefruit Puree", price: 3200, capacity: ["1 Litre"], abv: null, description: "Monin Ruby Grapefruit Puree" },
      { name: "Monin Raspberry Puree", price: 3200, capacity: ["1 Litre"], abv: null, description: "Monin Raspberry Puree" },
      { name: "Monin Peach Syrup", price: 2200, capacity: ["700ML"], abv: null, description: "Monin Peach Syrup" },
      { name: "Monin Caramel Syrup", price: 2200, capacity: ["700ML"], abv: null, description: "Monin Caramel Syrup" },
      { name: "Monin Falernum Syrup", price: 2200, capacity: ["700ML"], abv: null, description: "Monin Falernum Syrup" },
      { name: "Monin Hazelnut Syrup", price: 2200, capacity: ["700ML"], abv: null, description: "Monin Hazelnut Syrup" },
      { name: "Monin Chocolate Frappe", price: 2200, capacity: ["700ML"], abv: null, description: "Monin Chocolate Frappe" },
      { name: "Monin Vanilla Syrup", price: 2200, capacity: ["700ML"], abv: null, description: "Monin Vanilla Syrup" },
      { name: "Monin Lime Puree", price: 3200, capacity: ["1 Litre"], abv: null, description: "Monin Lime Puree" },
      { name: "Monin Pineapple Puree", price: 3200, capacity: ["1 Litre"], abv: null, description: "Monin Pineapple Puree" },
      { name: "Monin Lemon Tea Syrup", price: 2200, capacity: ["700ML"], abv: null, description: "Monin Lemon Tea Syrup" },
      { name: "Monin Pop Corn Syrup", price: 2200, capacity: ["700ML"], abv: null, description: "Monin Pop Corn Syrup" },
      { name: "Monin Strawberry Syrup", price: 2200, capacity: ["700ML"], abv: null, description: "Monin Strawberry Syrup" },
      { name: "Monin Coconut Puree", price: 3200, capacity: ["1 Litre"], abv: null, description: "Monin Coconut Puree" },
      { name: "Monin Vanilla Frappe", price: 5000, capacity: ["1.5 Litres"], abv: null, description: "Monin Vanilla Frappe" },
      { name: "Monin Passion Puree", price: 3200, capacity: ["1 Litre"], abv: null, description: "Monin Passion Puree" },
      { name: "Jumping Goat Whisky Liqueur", price: 4400, capacity: ["700ML"], abv: 33, description: "Jumping Goat Whisky Liqueur (ABV 33%), New Zealand" },
      { name: "Bailey's Delight", price: 1395, capacity: ["750ML"], abv: 15, description: "Bailey's Delight (ABV 15%), Ireland" },
      { name: "Zappa Sambuca White", price: 2000, capacity: ["750ML"], abv: 35, description: "Zappa Sambuca White (ABV 35%), South Africa" },
      { name: "Angostura Bitters", price: 3400, capacity: ["200ml"], abv: 44.7, description: "Angostura Bitters (ABV 44.7%), South Africa" },
      { name: "Tequila Rose", price: 3600, capacity: ["750ML"], abv: 15, description: "Tequila Rose (ABV 15%), Mexico" },
      { name: "Sheridann's Liqueur", price: 5900, capacity: ["1 Litre"], abv: 17, description: "Sheridann's Liqueur (ABV 17%), Ireland" },
      { name: "Zappa Sambuca Black", price: 2000, capacity: ["750ML"], abv: 35, description: "Zappa Sambuca Black (ABV 35%), South Africa" },
      { name: "Kahawa Africa Gold", price: 1995, capacity: ["750ml"], abv: 25.7, description: "Kahawa Africa Gold (ABV 25.7%), Kenya" },
      { name: "Zappa Sambuca Blue", price: 2000, capacity: ["750ML"], abv: 35, description: "Zappa Sambuca Blue (ABV 35%), South Africa" },
      { name: "Southern Comfort", price: 2995, capacity: ["1 Litre"], abv: 35, description: "Southern Comfort (ABV 35%), United States" },
      { name: "Kahlua", price: 3900, capacity: ["1 Litre"], abv: 36, description: "Kahlua (ABV 36%), Mexico" },
      { name: "Amarula Gold", price: 3200, capacity: ["1 Litre"], abv: 30, description: "Amarula Gold (ABV 30%), South Africa" },
      { name: "Zappa-Red", price: 2000, capacity: ["750ML"], abv: 35, description: "Zappa-Red (ABV 35%), South Africa" },
      { name: "Cointreau Whisky Chocolate", price: 1000, capacity: ["1 Piece"], abv: null, description: "Cointreau Whisky Chocolate" },
      { name: "Disaronno", price: 3800, capacity: ["1 Litre"], abv: 28, description: "Disaronno (ABV 28%), Italy" },
      { name: "Patron XO Cafe", price: 5800, capacity: ["750ml"], abv: 40, description: "Patron XO Cafe (ABV 40%), Mexico" },
      { name: "Southern Comfort 750ml", price: 2795, capacity: ["750ML"], abv: 35, description: "Southern Comfort 750ml (ABV 35%), United Kingdom" },
      { name: "Cointreau 1litre", price: 4200, capacity: ["750ml"], abv: 40, description: "Cointreau 1litre (ABV 40%), France" },
      { name: "Southern Comfort Lime", price: 3200, capacity: ["750ML"], abv: 35, description: "Southern Comfort Lime (ABV 35%)" },
      { name: "Anthon Berg Chocolate", price: 600, capacity: ["Packet"], abv: null, description: "Anthon Berg Chocolate" },
      { name: "Campari", price: 3500, capacity: ["1 Litre"], abv: 28, description: "Campari (ABV 28%), Italy" },
      { name: "Fernet Branca", price: 3995, capacity: ["1 Litre"], abv: 39, description: "Fernet Branca (ABV 39%), Italy" },
      { name: "Bols Triple Sec", price: 2200, capacity: ["750ML"], abv: 38, description: "Bols Triple Sec (ABV 38%), Netherlands" },
      { name: "Southern Comfort Black", price: 2600, capacity: ["750ML"], abv: 35, description: "Southern Comfort Black (ABV 35%), England" },
      { name: "Amarula Vanilla Spice Cream", price: 2495, capacity: ["1 Litre"], abv: 15.5, description: "Amarula Vanilla Spice Cream (ABV 15.5%), South Africa" },
      { name: "Jägermeister-manifest", price: 6600, capacity: ["1 Litre"], abv: 37, description: "Jägermeister-manifest (ABV 37%), Germany" },
      { name: "Martini Fiero", price: 2300, capacity: ["750ml"], abv: 15, description: "Martini Fiero (ABV 15%), Italy" },
      { name: "Baileys Salted Caramel", price: 3200, capacity: ["1 Litre"], abv: 17, description: "Baileys Salted Caramel (ABV 17%), Ireland" },
      { name: "Tia Maria", price: 3800, capacity: ["1 Litre"], abv: 20, description: "Tia Maria (ABV 20%), Jamaica" },
      { name: "Grenadine Syrup", price: 995, capacity: ["750ML"], abv: null, description: "Grenadine Syrup" },
      { name: "8PM Fire Liqueur", price: 1300, capacity: ["750ML"], abv: 35, description: "8PM Fire Liqueur (ABV 35%), India" },
      { name: "Panache Artisanal Mojito Srup", price: 1300, capacity: ["750ml"], abv: null, description: "Panache Artisanal Mojito Srup" },
      { name: "Cointreau Blood Orange", price: 3800, capacity: ["750ML"], abv: 40, description: "Cointreau Blood Orange (ABV 40%), France" },
      { name: "Magma Shock Hot Cinnamon", price: 2200, capacity: ["750ML"], abv: 30, description: "Magma Shock Hot Cinnamon (ABV 30%)" },
      { name: "Monin Peach Liqueur", price: 2800, capacity: ["700ML"], abv: 16, description: "Monin Peach Liqueur (ABV 16%), France" },
      { name: "African Secret Marula Cream Liqueur", price: 1700, capacity: ["750ml"], abv: 15.5, description: "African Secret Marula Cream Liqueur (ABV 15.5%), South Africa" },
      { name: "Amarula Raspberry Chocolate", price: 2495, capacity: ["1 Litre"], abv: 15.5, description: "Amarula Raspberry Chocolate (ABV 15.5%), South Africa" },
      { name: "Bols Blue Curacao", price: 2950, capacity: ["700ML"], abv: 21, description: "Bols Blue Curacao (ABV 21%), The Netherlands" },
      { name: "Pernod", price: 4200, capacity: ["1 Litre"], abv: null, description: "Pernod" },
      { name: "Bailey's Expresso creme", price: 3200, capacity: ["1 Litre"], abv: 17, description: "Bailey's Expresso creme (ABV 17%), Ireland" },
      { name: "Zappa-Green", price: 2000, capacity: ["750ML"], abv: 35, description: "Zappa-Green (ABV 35%), South Africa" },
      { name: "Ricard", price: 2400, capacity: ["1 Litre"], abv: 45, description: "Ricard (ABV 45%), France" },
      { name: "Bailey's vanilla cinnamon", price: 3200, capacity: ["1 Litre"], abv: 17, description: "Bailey's vanilla cinnamon (ABV 17%), Ireland" }
    ];

    let added = 0;
    for (const liqueur of remainingLiqueurs) {
      const existing = await db.Drink.findOne({
        where: {
          name: { [db.Sequelize.Op.iLike]: `%${liqueur.name}%` },
          categoryId: liqueursCategory.id
        }
      });

      if (!existing) {
        await db.Drink.create({
          ...liqueur,
          categoryId: liqueursCategory.id,
          isAvailable: true,
          image: '/images/placeholder.svg'
        });
        console.log(`Added: ${liqueur.name}`);
        added++;
      }
    }

    console.log(`\nAdded ${added} new liqueurs`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.sequelize.close();
  }
}

addRemainingLiqueurs();
