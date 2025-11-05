const db = require('../models');

async function addBeerItems() {
  try {
    console.log('Adding beer items from Dial a Drink Kenya website...');

    const beerCategory = await db.Category.findOne({ where: { name: 'Beer' } });
    if (!beerCategory) {
      console.error('Beer category not found!');
      return;
    }
    console.log('Beer category found:', beerCategory.name);

    let allBeerSubCategory = await db.SubCategory.findOne({ 
      where: { name: 'All Beers', categoryId: beerCategory.id } 
    });
    if (!allBeerSubCategory) {
      // Create the subcategory if it doesn't exist
      allBeerSubCategory = await db.SubCategory.create({
        name: 'All Beers',
        description: 'All types of beers, ciders, and alcoholic beverages',
        categoryId: beerCategory.id
      });
      console.log('Created All Beers subcategory');
    } else {
      console.log('All Beers subcategory found:', allBeerSubCategory.name);
    }

    // Beer items from the actual Dial a Drink Kenya website
    const beerItems = [
      {
        name: "Smirnoff Ice Pineapple Punch",
        description: "Smirnoff Ice Pineapple Punch (ABV 5.5%), Russia",
        price: 1495,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1495, currentPrice: 1495 },
          { capacity: "12 PACK", originalPrice: 2795, currentPrice: 2795 }
        ],
        abv: 5.5,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Tusker Cider",
        description: "Tusker Cider (ABV 4.5%), Kenya",
        price: 1595,
        capacity: ["Six Pack", "12 PACK", "24 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1595, currentPrice: 1595 },
          { capacity: "12 PACK", originalPrice: 3095, currentPrice: 3095 },
          { capacity: "24 PACK", originalPrice: 5695, currentPrice: 5695 }
        ],
        abv: 4.5,
        isPopular: true,
        isAvailable: true
      },
      {
        name: "Tusker Lite",
        description: "Tusker Lite (ABV 4%), Kenya",
        price: 1699,
        capacity: ["Six Pack", "12 PACK", "24 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1699, currentPrice: 1699 },
          { capacity: "12 PACK", originalPrice: 3200, currentPrice: 3200 },
          { capacity: "24 PACK", originalPrice: 6200, currentPrice: 6200 }
        ],
        abv: 4.0,
        isPopular: true,
        isAvailable: true
      },
      {
        name: "Tusker Lager",
        description: "Tusker Lager (ABV 4.2%), Kenya",
        price: 1595,
        capacity: ["Six Pack", "12 PACK", "24 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1595, currentPrice: 1595 },
          { capacity: "12 PACK", originalPrice: 3000, currentPrice: 3000 },
          { capacity: "24 PACK", originalPrice: 5800, currentPrice: 5800 }
        ],
        abv: 4.2,
        isPopular: true,
        isAvailable: true
      },
      {
        name: "Tusker Malt",
        description: "Tusker Malt (ABV 5%), Kenya",
        price: 1695,
        capacity: ["Six Pack", "12 PACK", "24 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1695, currentPrice: 1695 },
          { capacity: "12 PACK", originalPrice: 2895, currentPrice: 2895 },
          { capacity: "24 PACK", originalPrice: 5695, currentPrice: 5695 }
        ],
        abv: 5.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "K.O Passion & Lime",
        description: "K.O Passion & Lime (ABV 8%), Kenya",
        price: 1699,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1699, currentPrice: 1699 },
          { capacity: "12 PACK", originalPrice: 4000, currentPrice: 4000 }
        ],
        abv: 8.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Balozi Can",
        description: "Balozi Can (ABV 4.2%), Kenya",
        price: 1495,
        capacity: ["Six Pack", "12 PACK", "24 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1495, currentPrice: 1495 },
          { capacity: "12 PACK", originalPrice: 2895, currentPrice: 2895 },
          { capacity: "24 PACK", originalPrice: 5799, currentPrice: 5799 }
        ],
        abv: 4.2,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "K.O Beer - Mango and Ginger",
        description: "K.O Beer - Mango and Ginger (ABV 8%), Kenya",
        price: 1795,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1795, currentPrice: 1795 },
          { capacity: "12 PACK", originalPrice: 3500, currentPrice: 3500 }
        ],
        abv: 8.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "K.O - Lime & Ginger",
        description: "K.O - Lime & Ginger (ABV 8%), Kenya",
        price: 1795,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1795, currentPrice: 1795 },
          { capacity: "12 PACK", originalPrice: 3500, currentPrice: 3500 }
        ],
        abv: 8.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "K.O Beer - Pineapple & Mint",
        description: "K.O Beer - Pineapple & Mint (ABV 8%), Kenya",
        price: 1795,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1795, currentPrice: 1795 },
          { capacity: "12 PACK", originalPrice: 3700, currentPrice: 3700 }
        ],
        abv: 8.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Guinness can",
        description: "Guinness can (ABV 4.2%), Ireland",
        price: 1800,
        capacity: ["Six Pack", "12 PACK", "24 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1800, currentPrice: 1800 },
          { capacity: "12 PACK", originalPrice: 3200, currentPrice: 3200 },
          { capacity: "24 PACK", originalPrice: 6200, currentPrice: 6200 }
        ],
        abv: 4.2,
        isPopular: true,
        isAvailable: true
      },
      {
        name: "Whitecap",
        description: "Whitecap (ABV 4.2%), Kenya",
        price: 1700,
        capacity: ["Six Pack", "12 PACK", "24 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1700, currentPrice: 1700 },
          { capacity: "12 PACK", originalPrice: 3200, currentPrice: 3200 },
          { capacity: "24 PACK", originalPrice: 6200, currentPrice: 6200 }
        ],
        abv: 4.2,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Snapp",
        description: "Snapp (ABV 4.5%), Sweden",
        price: 1500,
        capacity: ["Six Pack", "12 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1500, currentPrice: 1500 },
          { capacity: "12 PACK", originalPrice: 2600, currentPrice: 2600 }
        ],
        abv: 4.5,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Savanna Cider",
        description: "Savanna Cider (ABV 5.5%), Western Cape",
        price: 2100,
        capacity: ["Six Pack", "12 PACK", "24 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 2100, currentPrice: 2100 },
          { capacity: "12 PACK", originalPrice: 4000, currentPrice: 4000 },
          { capacity: "24 PACK", originalPrice: 8000, currentPrice: 8000 }
        ],
        abv: 5.5,
        isPopular: true,
        isAvailable: true
      },
      {
        name: "Heineken Lager 500ml Can",
        description: "Heineken Lager 500ml Can (ABV 5%), The Netherlands",
        price: 2280,
        capacity: ["Six Pack", "12 PACK", "24 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 2280, currentPrice: 2280 },
          { capacity: "12 PACK", originalPrice: 4200, currentPrice: 4200 },
          { capacity: "24 PACK", originalPrice: 8160, currentPrice: 8160 }
        ],
        abv: 5.0,
        isPopular: true,
        isAvailable: true
      },
      {
        name: "Pilsner lager",
        description: "Pilsner lager (ABV 4.7%), Kenya",
        price: 1600,
        capacity: ["Six Pack", "12 PACK", "24 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1600, currentPrice: 1600 },
          { capacity: "12 PACK", originalPrice: 3000, currentPrice: 3000 },
          { capacity: "24 PACK", originalPrice: 5800, currentPrice: 5800 }
        ],
        abv: 4.7,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Desperados",
        description: "Desperados (ABV 5.9%), France",
        price: 2199,
        capacity: ["Six Pack", "12 PACK", "24 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 2199, currentPrice: 2199 },
          { capacity: "12 PACK", originalPrice: 3699, currentPrice: 3699 },
          { capacity: "24 PACK", originalPrice: 7200, currentPrice: 7200 }
        ],
        abv: 5.9,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Bavaria Original 8.6%",
        description: "Bavaria Original 8.6% (ABV 8.6%), Netherlands",
        price: 2100,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 2100, currentPrice: 2100 }
        ],
        abv: 8.6,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Bavaria Black",
        description: "Bavaria Black (ABV 7.9%), Netherlands",
        price: 1800,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1800, currentPrice: 1800 }
        ],
        abv: 7.9,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "O J 16% Beer",
        description: "O J 16% Beer (ABV 16%), Netherlands Belgium",
        price: 1800,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1800, currentPrice: 1800 }
        ],
        abv: 16.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Jack Daniel's Honey Lemonade",
        description: "Jack Daniel's Honey Lemonade (ABV 5%), USA",
        price: 3500,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 3500, currentPrice: 3500 }
        ],
        abv: 5.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "O J 12% Beer",
        description: "O J 12% Beer (ABV 12%), Netherlands, Belgium",
        price: 1800,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1800, currentPrice: 1800 }
        ],
        abv: 12.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Obolon Strong 8.6%",
        description: "Obolon Strong 8.6% (ABV 8.6%), Ukraine",
        price: 1500,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1500, currentPrice: 1500 }
        ],
        abv: 8.6,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Coolberg Malt 0.0 Beer",
        description: "Coolberg Malt 0.0 Beer",
        price: 300,
        capacity: ["330ml"],
        capacityPricing: [
          { capacity: "330ml", originalPrice: 300, currentPrice: 300 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Bavaria 0.0% Original",
        description: "Bavaria 0.0% Original",
        price: 1950,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1950, currentPrice: 1950 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Coolberg Peach 0.0 Beer",
        description: "Coolberg Peach 0.0 Beer",
        price: 300,
        capacity: ["330ml"],
        capacityPricing: [
          { capacity: "330ml", originalPrice: 300, currentPrice: 300 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Bavaria 0.0 Apple Beer",
        description: "Bavaria 0.0 Apple Beer",
        price: 400,
        capacity: ["500ml"],
        capacityPricing: [
          { capacity: "500ml", originalPrice: 400, currentPrice: 400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Jack Daniel's Apple Tonic Beer",
        description: "Jack Daniel's Apple Tonic Beer (ABV 5%), USA",
        price: 3500,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 3500, currentPrice: 3500 }
        ],
        abv: 5.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Bila Shaka IPA",
        description: "Bila Shaka IPA (ABV 6.5%), Kenya",
        price: 1800,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1800, currentPrice: 1800 }
        ],
        abv: 6.5,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Manyatta Cider Beer",
        description: "Manyatta Cider Beer (ABV 7%), Kenya",
        price: 2100,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 2100, currentPrice: 2100 }
        ],
        abv: 7.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Faxe 10% Extra",
        description: "Faxe 10% Extra (ABV 10%), Denmark",
        price: 2250,
        capacity: ["Six Pack", "12 PACK", "24 PACK"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 2250, currentPrice: 2250 },
          { capacity: "12 PACK", originalPrice: 4200, currentPrice: 4200 },
          { capacity: "24 PACK", originalPrice: 8000, currentPrice: 8000 }
        ],
        abv: 10.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Hunter's Gold Cider",
        description: "Hunter's Gold Cider",
        price: 2100,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 2100, currentPrice: 2100 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "K.O Light Tonic",
        description: "K.O Light Tonic",
        price: 150,
        capacity: ["330ml"],
        capacityPricing: [
          { capacity: "330ml", originalPrice: 150, currentPrice: 150 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Peroni",
        description: "Peroni (ABV 5.1%), Italy",
        price: 1400,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1400, currentPrice: 1400 }
        ],
        abv: 5.1,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Oettinger Pils 4.7%",
        description: "Oettinger Pils 4.7% (ABV 4.7%), Germany",
        price: 1500,
        capacity: ["500ml"],
        capacityPricing: [
          { capacity: "500ml", originalPrice: 1500, currentPrice: 1500 }
        ],
        abv: 4.7,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Hopsmith Lager Gluten Free",
        description: "Hopsmith Lager Gluten Free (ABV 4.4%), Kenya",
        price: 480,
        capacity: ["330ml"],
        capacityPricing: [
          { capacity: "330ml", originalPrice: 480, currentPrice: 480 }
        ],
        abv: 4.4,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Karibrew beer",
        description: "Karibrew beer (ABV 5.3%), Kenya",
        price: 1450,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1450, currentPrice: 1450 }
        ],
        abv: 5.3,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "K.O Chilli and Turmeric Tonic Water",
        description: "K.O Chilli and Turmeric Tonic Water",
        price: 1600,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1600, currentPrice: 1600 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Bavaria 0.0 Mango Passion",
        description: "Bavaria 0.0 Mango Passion",
        price: 200,
        capacity: ["500ml"],
        capacityPricing: [
          { capacity: "500ml", originalPrice: 200, currentPrice: 200 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Golden Rump beer",
        description: "Golden Rump beer (ABV 4.5%), Kenya",
        price: 1450,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1450, currentPrice: 1450 }
        ],
        abv: 4.5,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Summit Lager",
        description: "Summit Lager (ABV 4.2%), Kenya",
        price: 230,
        capacity: ["500ml"],
        capacityPricing: [
          { capacity: "500ml", originalPrice: 230, currentPrice: 230 }
        ],
        abv: 4.2,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Sikera Apple Cider",
        description: "Sikera Apple Cider (ABV 4.5%), Kenya",
        price: 1299,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1299, currentPrice: 1299 }
        ],
        abv: 4.5,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Budweiser Beer Can",
        description: "Budweiser Beer Can (ABV 5%), USA",
        price: 1500,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1500, currentPrice: 1500 }
        ],
        abv: 5.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Guinness Smooth 330ml",
        description: "Guinness Smooth 330ml",
        price: 2100,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 2100, currentPrice: 2100 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Tusker Ndimu",
        description: "Tusker Ndimu",
        price: 2100,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 2100, currentPrice: 2100 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Bila Shaka Jua Kali-Hopped Lager",
        description: "Bila Shaka Jua Kali-Hopped Lager (ABV 4.6%), Kenya",
        price: 1650,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1650, currentPrice: 1650 }
        ],
        abv: 4.6,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Atlas Ultra Strong 14",
        description: "Atlas Ultra Strong 14 (ABV 14%), Netherlands",
        price: 1600,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1600, currentPrice: 1600 }
        ],
        abv: 14.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Bila Shaka Fruity Fly-Mango IPA",
        description: "Bila Shaka Fruity Fly-Mango IPA (ABV 5.5%), Kenya",
        price: 1500,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1500, currentPrice: 1500 }
        ],
        abv: 5.5,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Castle Milk Stout",
        description: "Castle Milk Stout (ABV 6%), Tanzania",
        price: 300,
        capacity: ["500ml"],
        capacityPricing: [
          { capacity: "500ml", originalPrice: 300, currentPrice: 300 }
        ],
        abv: 6.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Coolberg Cranberry Beer 0.0",
        description: "Coolberg Cranberry Beer 0.0",
        price: 300,
        capacity: ["330ml"],
        capacityPricing: [
          { capacity: "330ml", originalPrice: 300, currentPrice: 300 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Obolon Premium",
        description: "Obolon Premium (ABV 5%), Ukraine",
        price: 300,
        capacity: ["500ml"],
        capacityPricing: [
          { capacity: "500ml", originalPrice: 300, currentPrice: 300 }
        ],
        abv: 5.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Guinness Hop house beer",
        description: "Guinness Hop house beer (ABV 5%), Ireland",
        price: 1650,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1650, currentPrice: 1650 }
        ],
        abv: 5.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Bavaria 0.0 Ginger Lime",
        description: "Bavaria 0.0 Ginger Lime",
        price: 400,
        capacity: ["500ml"],
        capacityPricing: [
          { capacity: "500ml", originalPrice: 400, currentPrice: 400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Coolberg Ginger Beer 0.0",
        description: "Coolberg Ginger Beer 0.0",
        price: 300,
        capacity: ["330ml"],
        capacityPricing: [
          { capacity: "330ml", originalPrice: 300, currentPrice: 300 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Bila Shaka Chez Guerrilla-Imperial Stout",
        description: "Bila Shaka Chez Guerrilla-Imperial Stout (ABV 9%), Kenya",
        price: 1500,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1500, currentPrice: 1500 }
        ],
        abv: 9.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Castle Lite Can",
        description: "Castle Lite Can (ABV 4%), South Africa",
        price: 1450,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1695, currentPrice: 1450 }
        ],
        abv: 4.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "K.O Hibiscus and lime",
        description: "K.O Hibiscus and lime",
        price: 1500,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1500, currentPrice: 1500 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Budweiser Beer 355ml",
        description: "Budweiser Beer 355ml (ABV 5%), USA",
        price: 1500,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1500, currentPrice: 1500 }
        ],
        abv: 5.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Bila Shaka Dirty Hairy-Copper Ale",
        description: "Bila Shaka Dirty Hairy-Copper Ale (ABV 5%), Kenya",
        price: 1500,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1500, currentPrice: 1500 }
        ],
        abv: 5.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Coolberg Strawberry 0.0 Beer",
        description: "Coolberg Strawberry 0.0 Beer",
        price: 300,
        capacity: ["330ml"],
        capacityPricing: [
          { capacity: "330ml", originalPrice: 300, currentPrice: 300 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Coolberg Mint 0.0 Beer",
        description: "Coolberg Mint 0.0 Beer",
        price: 300,
        capacity: ["330ml"],
        capacityPricing: [
          { capacity: "330ml", originalPrice: 300, currentPrice: 300 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Curonia Beer 16%",
        description: "Curonia Beer 16% (ABV 16%)",
        price: 380,
        capacity: ["500ml"],
        capacityPricing: [
          { capacity: "500ml", originalPrice: 380, currentPrice: 380 }
        ],
        abv: 16.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Carlsberg",
        description: "Carlsberg (ABV 3.8%), Denmark",
        price: 220,
        capacity: ["330ml"],
        capacityPricing: [
          { capacity: "330ml", originalPrice: 220, currentPrice: 220 }
        ],
        abv: 3.8,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Castle Lite",
        description: "Castle Lite (ABV 4%), South Africa",
        price: 1500,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1500, currentPrice: 1500 }
        ],
        abv: 4.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      }
    ];

    let addedCount = 0;
    let skippedCount = 0;

    for (const beer of beerItems) {
      const existingDrink = await db.Drink.findOne({ 
        where: { name: beer.name, categoryId: beerCategory.id } 
      });
      
      if (existingDrink) {
        console.log(`Skipping ${beer.name} - already exists`);
        skippedCount++;
        continue;
      }

      const drink = await db.Drink.create({
        name: beer.name,
        description: beer.description,
        price: beer.price.toString(),
        originalPrice: beer.price.toString(),
        categoryId: beerCategory.id,
        subCategoryId: allBeerSubCategory.id,
        capacity: beer.capacity,
        capacityPricing: beer.capacityPricing,
        abv: beer.abv,
        isAvailable: beer.isAvailable,
        isPopular: beer.isPopular || false,
        isOnOffer: false,
        image: null
      });
      
      addedCount++;
      console.log(`Added beer: ${beer.name} - KES ${beer.price} (Available: ${beer.isAvailable})`);
    }

    console.log(`\nCompleted adding beer items:`);
    console.log(`- Added: ${addedCount}`);
    console.log(`- Skipped: ${skippedCount}`);
    console.log(`- Total processed: ${beerItems.length}`);

  } catch (error) {
    console.error('Error adding beer items:', error);
  } finally {
    await db.sequelize.close();
  }
}

addBeerItems();
