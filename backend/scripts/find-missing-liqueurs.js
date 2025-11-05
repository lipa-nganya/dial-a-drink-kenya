const db = require('../models');

async function findMissingLiqueurs() {
  try {
    const liqueursCategory = await db.Category.findOne({
      where: { name: { [db.Sequelize.Op.iLike]: '%liqueur%' } }
    });

    // Get all current liqueurs
    const currentLiqueurs = await db.Drink.findAll({
      where: { categoryId: liqueursCategory.id },
      attributes: ['name']
    });

    const currentNames = currentLiqueurs.map(d => d.name.toLowerCase());

    // List of all liqueurs from Dial a Drink Kenya page
    const dialADrinkLiqueurs = [
      "Jagermeister",
      "Bols Vanilla", 
      "Underberg Bitters",
      "Monin Triple Sec Curacao Liqueur",
      "Tango sour apple",
      "Bailey's Cream",
      "8PM Honey",
      "Amarula Cream Liqueur",
      "Monin Strawberry Puree",
      "Monin Mango Puree", 
      "Monin Hibiscus Syrup",
      "Monin Apple Puree",
      "Monin Blueberry Puree",
      "Monin Chocolate Cookies Syrup",
      "Monin Mojito Mint Syrup",
      "Monin Peach Tea Syrup",
      "Monin Blue Curacao Syrup",
      "Monin Rose Syrup",
      "Monin Lavender Syrup",
      "Monin Almond Syrup",
      "Monin Coconut Syrup",
      "Monin Sugar Cane Syrup",
      "Monin Cucumber Syrup",
      "Monin Cloudy Lemonade Syrup",
      "Monin Green Mint Syrup",
      "Monin Watermelon Syrup",
      "Bumbu Cream Liqueur",
      "Bardinet Triple Sec Liqueur",
      "Jägermeister Charakter Scharf",
      "Butlers Espresso",
      "Bols Peppermint White",
      "Grande Absente",
      "Butlers Triple Sec",
      "Monin Blue Curacao Liqueur",
      "Cuerpo Raspberry",
      "Luxardo Limoncello",
      "Butlers Ginger",
      "Sidekick Cookies & Cream",
      "Cuerpo White Rum Liqueur",
      "Strawberry Lips",
      "Jumping Goat Vodka Liqueur",
      "New Grove Cafe Liqueur",
      "Frangelico Hazelnut Liqueur",
      "Bailey's Delight",
      "Zappa Sambuca White",
      "Angostura Bitters",
      "Tequila Rose",
      "Baileys Luxury Fudge Chocolate",
      "Sheridann's Liqueur",
      "Zappa Sambuca Black",
      "Kahawa Africa Gold",
      "Zappa Sambuca Blue",
      "Southern Comfort",
      "Kahlua",
      "Amarula Gold",
      "Zappa-Red",
      "Cointreau Whisky Chocolate",
      "Disaronno",
      "Patron XO Cafe",
      "Southern Comfort 750ml",
      "Cointreau 1litre",
      "Southern Comfort Lime",
      "Anthon Berg Chocolate",
      "Campari",
      "Fernet Branca",
      "Bols Triple Sec",
      "Southern Comfort Black",
      "Amarula Vanilla Spice Cream",
      "Jägermeister-manifest",
      "Martini Fiero",
      "Baileys Salted Caramel",
      "Tia Maria",
      "Grenadine Syrup",
      "8PM Fire Liqueur",
      "Panache Artisanal Mojito Srup",
      "Cointreau Blood Orange",
      "Magma Shock Hot Cinnamon",
      "Monin Peach Liqueur",
      "African Secret Marula Cream Liqueur",
      "Amarula Raspberry Chocolate",
      "Bols Blue Curacao",
      "Pernod",
      "Bailey's Expresso creme",
      "Zappa-Green",
      "Ricard",
      "Bailey's vanilla cinnamon",
      "Monin Kiwi Puree",
      "Monin Ruby Grapefruit Puree",
      "Monin Raspberry Puree",
      "Monin Peach Syrup",
      "Monin Caramel Syrup",
      "Monin Falernum Syrup",
      "Monin Hazelnut Syrup",
      "Monin Chocolate Frappe",
      "Monin Vanilla Syrup",
      "Monin Lime Puree",
      "Monin Pineapple Puree",
      "Monin Lemon Tea Syrup",
      "Monin Pop Corn Syrup",
      "Monin Strawberry Syrup",
      "Monin Coconut Puree",
      "Monin Vanilla Frappe",
      "Monin Passion Puree",
      "Jumping Goat Whisky Liqueur",
      "Bailey's Delight",
      "Zappa Sambuca White",
      "Angostura Bitters",
      "Tequila Rose",
      "Baileys Luxury Fudge Chocolate",
      "Sheridann's Liqueur",
      "Zappa Sambuca Black",
      "Kahawa Africa Gold",
      "Zappa Sambuca Blue",
      "Southern Comfort",
      "Kahlua",
      "Amarula Gold",
      "Zappa-Red",
      "Cointreau Whisky Chocolate",
      "Disaronno",
      "Patron XO Cafe",
      "Southern Comfort 750ml",
      "Cointreau 1litre",
      "Southern Comfort Lime",
      "Anthon Berg Chocolate",
      "Campari",
      "Fernet Branca",
      "Bols Triple Sec",
      "Southern Comfort Black",
      "Amarula Vanilla Spice Cream",
      "Jägermeister-manifest",
      "Martini Fiero",
      "Baileys Salted Caramel",
      "Tia Maria",
      "Grenadine Syrup",
      "8PM Fire Liqueur",
      "Panache Artisanal Mojito Srup",
      "Cointreau Blood Orange",
      "Magma Shock Hot Cinnamon",
      "Monin Peach Liqueur",
      "African Secret Marula Cream Liqueur",
      "Amarula Raspberry Chocolate",
      "Bols Blue Curacao",
      "Pernod",
      "Bailey's Expresso creme",
      "Zappa-Green",
      "Ricard",
      "Bailey's vanilla cinnamon"
    ];

    // Remove duplicates and find missing ones
    const uniqueDialADrinkLiqueurs = [...new Set(dialADrinkLiqueurs)];
    
    console.log(`Total unique liqueurs on Dial a Drink: ${uniqueDialADrinkLiqueurs.length}`);
    console.log(`Current liqueurs in database: ${currentNames.length}`);
    
    const missingLiqueurs = [];
    
    for (const liqueur of uniqueDialADrinkLiqueurs) {
      const found = currentNames.some(name => 
        name.includes(liqueur.toLowerCase()) || 
        liqueur.toLowerCase().includes(name)
      );
      
      if (!found) {
        missingLiqueurs.push(liqueur);
      }
    }

    console.log(`\nMissing liqueurs (${missingLiqueurs.length}):`);
    missingLiqueurs.forEach((liqueur, index) => {
      console.log(`${index + 1}. ${liqueur}`);
    });

    // Also check for any that might be named differently
    console.log(`\nChecking for similar names...`);
    for (const liqueur of uniqueDialADrinkLiqueurs) {
      const similar = currentNames.filter(name => 
        name.includes(liqueur.toLowerCase().substring(0, 10)) ||
        liqueur.toLowerCase().includes(name.substring(0, 10))
      );
      
      if (similar.length > 0) {
        console.log(`"${liqueur}" might match: ${similar.join(', ')}`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.sequelize.close();
  }
}

findMissingLiqueurs();
