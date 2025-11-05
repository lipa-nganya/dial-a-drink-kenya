const db = require('../models');

async function addProperLiqueurs() {
  try {
    const liqueursCategory = await db.Category.findOne({
      where: { name: { [db.Sequelize.Op.iLike]: '%liqueur%' } }
    });

    const liqueurs = [
      { name: "Jagermeister", price: 3595, capacity: ["1 Litre"], abv: 35, description: "Jagermeister (ABV 35%), Germany" },
      { name: "Bols Vanilla", price: 2950, capacity: ["750ML"], abv: 24, description: "Bols Vanilla (ABV 24%), The Netherlands" },
      { name: "Underberg Bitters", price: 3750, capacity: ["12 PACK"], abv: 44, description: "Underberg Bitters (ABV 44%), Germany" },
      { name: "Monin Triple Sec Curacao Liqueur", price: 2800, capacity: ["700ML"], abv: 38, description: "Monin Triple Sec Curacao Liqueur (ABV 38%), France" },
      { name: "Bailey's Cream", price: 3195, capacity: ["1 Litre"], abv: 17, description: "Bailey's Cream (ABV 17%), Ireland" },
      { name: "8PM Honey", price: 1300, capacity: ["750ml"], abv: 35, description: "8PM Honey (ABV 35%), India" },
      { name: "Amarula Cream Liqueur", price: 2900, capacity: ["1 Litre"], abv: 17, description: "Amarula Cream Liqueur (ABV 17%), South Africa" },
      { name: "Bumbu Cream Liqueur", price: 6000, capacity: ["700ML"], abv: 15, description: "Bumbu Cream Liqueur (ABV 15%), Caribbean" },
      { name: "Bardinet Triple Sec Liqueur", price: 2200, capacity: ["700ML"], abv: 34, description: "Bardinet Triple Sec Liqueur (ABV 34%), France" },
      { name: "Jägermeister Charakter Scharf", price: 5500, capacity: ["750ml"], abv: 33, description: "Jägermeister Charakter Scharf (ABV 33%), Germany" },
      { name: "Butlers Espresso", price: 2200, capacity: ["750ML"], abv: 24, description: "Butlers Espresso (ABV 24%), South African" },
      { name: "Bols Peppermint White", price: 2950, capacity: ["750ML"], abv: 24, description: "Bols Peppermint White (ABV 24%), The Netherlands" },
      { name: "Grande Absente", price: 3500, capacity: ["750ML"], abv: 69, description: "Grande Absente (ABV 69%), France" },
      { name: "Butlers Triple Sec", price: 2200, capacity: ["750ML"], abv: 24, description: "Butlers Triple Sec (ABV 24%), South African" },
      { name: "Monin Blue Curacao Liqueur", price: 2700, capacity: ["700ML"], abv: 20, description: "Monin Blue Curacao Liqueur (ABV 20%), France" },
      { name: "Cuerpo Raspberry", price: 2900, capacity: ["750ML"], abv: 15, description: "Cuerpo Raspberry (ABV 15%), France" },
      { name: "Luxardo Limoncello", price: 3800, capacity: ["700ML"], abv: 27, description: "Luxardo Limoncello (ABV 27%), Italy" },
      { name: "Butlers Ginger", price: 2500, capacity: ["750ML"], abv: 24, description: "Butlers Ginger (ABV 24%), South Africa" },
      { name: "Sidekick Cookies & Cream", price: 2600, capacity: ["750ML"], abv: 15.5, description: "Sidekick Cookies & Cream (ABV 15.5%), South Africa" },
      { name: "Cuerpo White Rum Liqueur", price: 2800, capacity: ["750ML"], abv: 15, description: "Cuerpo White Rum Liqueur (ABV 15%), France" },
      { name: "Strawberry Lips", price: 1599, capacity: ["700ML"], abv: 16.5, description: "Strawberry Lips (ABV 16.5%), South Africa" },
      { name: "Jumping Goat Vodka Liqueur", price: 4000, capacity: ["700ML"], abv: 33, description: "Jumping Goat Vodka Liqueur (ABV 33%), New Zealand" },
      { name: "New Grove Cafe Liqueur", price: 2400, capacity: ["700ML"], abv: 26, description: "New Grove Cafe Liqueur (ABV 26%), Mauritius" },
      { name: "Frangelico Hazelnut Liqueur", price: 2500, capacity: ["700ML"], abv: 20, description: "Frangelico Hazelnut Liqueur (ABV 20%), Italy" },
      { name: "Bailey's Delight", price: 1800, capacity: ["750ML"], abv: 15, description: "Bailey's Delight (ABV 15%), Ireland" },
      { name: "Zappa Sambuca White", price: 2000, capacity: ["750ML"], abv: 35, description: "Zappa Sambuca White (ABV 35%), South Africa" },
      { name: "Angostura Bitters", price: 6400, capacity: ["473ml"], abv: 44.7, description: "Angostura Bitters (ABV 44.7%), South Africa" },
      { name: "Tequila Rose", price: 3600, capacity: ["750ML"], abv: 15, description: "Tequila Rose (ABV 15%), Mexico" },
      { name: "Baileys Luxury Fudge Chocolate", price: 1950, capacity: ["Packet"], abv: null, description: "Baileys Luxury Fudge Chocolate" },
      { name: "Sheridann's Liqueur", price: 4500, capacity: ["750ml"], abv: 17, description: "Sheridann's Liqueur (ABV 17%), Ireland" },
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
      { name: "Cointreau 1litre", price: 4600, capacity: ["1 Litre"], abv: 40, description: "Cointreau 1litre (ABV 40%), France" },
      { name: "Southern Comfort Lime", price: 3200, capacity: ["750ML"], abv: 35, description: "Southern Comfort Lime (ABV 35%)" },
      { name: "Anthon Berg Chocolate", price: 600, capacity: ["Packet"], abv: null, description: "Anthon Berg Chocolate" },
      { name: "Campari", price: 2900, capacity: ["750ML"], abv: 28, description: "Campari (ABV 28%), Italy" },
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
    for (const liqueur of liqueurs) {
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

addProperLiqueurs();
