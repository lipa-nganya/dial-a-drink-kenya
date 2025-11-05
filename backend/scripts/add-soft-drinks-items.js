const db = require('../models');

async function addSoftDrinksItems() {
  try {
    console.log('Adding soft drinks items from Dial a Drink Kenya website...');

    const softDrinksCategory = await db.Category.findOrCreate({
      where: { name: 'Soft Drinks' },
      defaults: { description: 'Various soft drinks and mixers' }
    });
    console.log('Soft Drinks category found/created:', softDrinksCategory[0].name);

    const allSoftDrinksSubCategory = await db.SubCategory.findOrCreate({
      where: { name: 'All Soft Drinks', categoryId: softDrinksCategory[0].id },
      defaults: { description: 'All types of soft drinks', categoryId: softDrinksCategory[0].id }
    });
    console.log('Soft Drinks subcategory found/created:', allSoftDrinksSubCategory[0].name);

    const softDrinks = [
      // Carbonated Drinks
      {
        name: "Fanta Black Currant",
        description: "Fanta Black Currant (2 Litres)",
        price: 250,
        capacity: ["2 Litres"],
        capacityPricing: [{ capacity: "2 Litres", originalPrice: 250, currentPrice: 250 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Coca Cola Original",
        description: "Coca Cola Original",
        price: 200,
        capacity: ["1 Litre", "2 Litres"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 200, currentPrice: 200 },
          { capacity: "2 Litres", originalPrice: 250, currentPrice: 250 }
        ],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Sprite",
        description: "Sprite (2 Litres)",
        price: 250,
        capacity: ["2 Litres"],
        capacityPricing: [{ capacity: "2 Litres", originalPrice: 250, currentPrice: 250 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Fanta Orange",
        description: "Fanta Orange (2 Litres)",
        price: 250,
        capacity: ["2 Litres"],
        capacityPricing: [{ capacity: "2 Litres", originalPrice: 250, currentPrice: 250 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Fanta Orange 500ml",
        description: "Fanta Orange (500ml)",
        price: 100,
        capacity: ["500ml"],
        capacityPricing: [{ capacity: "500ml", originalPrice: 100, currentPrice: 100 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Coca Cola Can",
        description: "Coca Cola Can (330ml)",
        price: 150,
        capacity: ["330ml"],
        capacityPricing: [{ capacity: "330ml", originalPrice: 150, currentPrice: 150 }],
        abv: 0,
        isAvailable: false
      },
      // Monin Syrups and Purees
      {
        name: "Monin Strawberry Puree",
        description: "Monin Strawberry Puree (1 Litre)",
        price: 3800,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 3800, currentPrice: 3800 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Monin Mango Puree",
        description: "Monin Mango Puree (1 Litre)",
        price: 3600,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 3600, currentPrice: 3600 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Monin Hibiscus Syrup",
        description: "Monin Hibiscus Syrup (700ML)",
        price: 2200,
        capacity: ["700ML"],
        capacityPricing: [{ capacity: "700ML", originalPrice: 2200, currentPrice: 2200 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Monin Apple Puree",
        description: "Monin Apple Puree (1 Litre)",
        price: 3200,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 3200, currentPrice: 3200 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Monin Blueberry Puree",
        description: "Monin Blueberry Puree (1 Litre)",
        price: 4200,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 4200, currentPrice: 4200 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Monin Chocolate Cookies Syrup",
        description: "Monin Chocolate Cookies Syrup (700ML)",
        price: 2200,
        capacity: ["700ML"],
        capacityPricing: [{ capacity: "700ML", originalPrice: 2200, currentPrice: 2200 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Monin Mojito Mint Syrup",
        description: "Monin Mojito Mint Syrup (700ML)",
        price: 2200,
        capacity: ["700ML"],
        capacityPricing: [{ capacity: "700ML", originalPrice: 2200, currentPrice: 2200 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monin Peach Tea Syrup",
        description: "Monin Peach Tea Syrup (700ML)",
        price: 2200,
        capacity: ["700ML"],
        capacityPricing: [{ capacity: "700ML", originalPrice: 2200, currentPrice: 2200 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monin Blue Curacao Syrup",
        description: "Monin Blue Curacao Syrup (700ML)",
        price: 2400,
        capacity: ["700ML"],
        capacityPricing: [{ capacity: "700ML", originalPrice: 2400, currentPrice: 2400 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Monin Rose Syrup",
        description: "Monin Rose Syrup (700ML)",
        price: 2200,
        capacity: ["700ML"],
        capacityPricing: [{ capacity: "700ML", originalPrice: 2200, currentPrice: 2200 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Monin Lavender Syrup",
        description: "Monin Lavender Syrup (700ML)",
        price: 2200,
        capacity: ["700ML"],
        capacityPricing: [{ capacity: "700ML", originalPrice: 2200, currentPrice: 2200 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Monin Almond Syrup",
        description: "Monin Almond Syrup (700ML)",
        price: 2200,
        capacity: ["700ML"],
        capacityPricing: [{ capacity: "700ML", originalPrice: 2200, currentPrice: 2200 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Monin Coconut Syrup",
        description: "Monin Coconut Syrup (700ML)",
        price: 2200,
        capacity: ["700ML"],
        capacityPricing: [{ capacity: "700ML", originalPrice: 2200, currentPrice: 2200 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monin Sugar Cane Syrup",
        description: "Monin Sugar Cane Syrup (700ML)",
        price: 2200,
        capacity: ["700ML"],
        capacityPricing: [{ capacity: "700ML", originalPrice: 2200, currentPrice: 2200 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Monin Cucumber Syrup",
        description: "Monin Cucumber Syrup (700ML)",
        price: 2200,
        capacity: ["700ML"],
        capacityPricing: [{ capacity: "700ML", originalPrice: 2200, currentPrice: 2200 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monin Cloudy Lemonade Syrup",
        description: "Monin Cloudy Lemonade Syrup (700ML)",
        price: 2200,
        capacity: ["700ML"],
        capacityPricing: [{ capacity: "700ML", originalPrice: 2200, currentPrice: 2200 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Monin Green Mint Syrup",
        description: "Monin Green Mint Syrup (700ML)",
        price: 2500,
        capacity: ["700ML"],
        capacityPricing: [{ capacity: "700ML", originalPrice: 2500, currentPrice: 2500 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Monin Watermelon Syrup",
        description: "Monin Watermelon Syrup (700ML)",
        price: 2200,
        capacity: ["700ML"],
        capacityPricing: [{ capacity: "700ML", originalPrice: 2200, currentPrice: 2200 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Monin Kiwi Puree",
        description: "Monin Kiwi Puree (1 Litre)",
        price: 3200,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 3200, currentPrice: 3200 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monin Ruby Grapefruit Puree",
        description: "Monin Ruby Grapefruit Puree (1 Litre)",
        price: 3200,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 3200, currentPrice: 3200 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monin Raspberry Puree",
        description: "Monin Raspberry Puree (1 Litre)",
        price: 3200,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 3200, currentPrice: 3200 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monin Peach Syrup",
        description: "Monin Peach Syrup (700ML)",
        price: 2200,
        capacity: ["700ML"],
        capacityPricing: [{ capacity: "700ML", originalPrice: 2200, currentPrice: 2200 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monin Caramel Syrup",
        description: "Monin Caramel Syrup (700ML)",
        price: 2200,
        capacity: ["700ML"],
        capacityPricing: [{ capacity: "700ML", originalPrice: 2200, currentPrice: 2200 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monin Falernum Syrup",
        description: "Monin Falernum Syrup (700ML)",
        price: 2200,
        capacity: ["700ML"],
        capacityPricing: [{ capacity: "700ML", originalPrice: 2200, currentPrice: 2200 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monin Hazelnut Syrup",
        description: "Monin Hazelnut Syrup (700ML)",
        price: 2200,
        capacity: ["700ML"],
        capacityPricing: [{ capacity: "700ML", originalPrice: 2200, currentPrice: 2200 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monin Chocolate Frappe",
        description: "Monin Chocolate Frappe (1.5 Litres)",
        price: 5000,
        capacity: ["1.5 Litres"],
        capacityPricing: [{ capacity: "1.5 Litres", originalPrice: 5000, currentPrice: 5000 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monin Lemon Tea Syrup",
        description: "Monin Lemon Tea Syrup (700ML)",
        price: 2200,
        capacity: ["700ML"],
        capacityPricing: [{ capacity: "700ML", originalPrice: 2200, currentPrice: 2200 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monin Pop Corn Syrup",
        description: "Monin Pop Corn Syrup (700ML)",
        price: 2200,
        capacity: ["700ML"],
        capacityPricing: [{ capacity: "700ML", originalPrice: 2200, currentPrice: 2200 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monin Vanilla Syrup",
        description: "Monin Vanilla Syrup (700ML)",
        price: 2200,
        capacity: ["700ML"],
        capacityPricing: [{ capacity: "700ML", originalPrice: 2200, currentPrice: 2200 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monin Lime Puree",
        description: "Monin Lime Puree (1 Litre)",
        price: 3200,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 3200, currentPrice: 3200 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monin Pineapple Puree",
        description: "Monin Pineapple Puree (1 Litre)",
        price: 3200,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 3200, currentPrice: 3200 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monin Vanilla Frappe",
        description: "Monin Vanilla Frappe (1.5 Litres)",
        price: 5000,
        capacity: ["1.5 Litres"],
        capacityPricing: [{ capacity: "1.5 Litres", originalPrice: 5000, currentPrice: 5000 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monin Passion Puree",
        description: "Monin Passion Puree (1 Litre)",
        price: 3200,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 3200, currentPrice: 3200 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monin Strawberry Syrup",
        description: "Monin Strawberry Syrup (700ML)",
        price: 2200,
        capacity: ["700ML"],
        capacityPricing: [{ capacity: "700ML", originalPrice: 2200, currentPrice: 2200 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Monin Coconut Puree",
        description: "Monin Coconut Puree (1 Litre)",
        price: 3200,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 3200, currentPrice: 3200 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monin Grenadine Syrup",
        description: "Monin Grenadine Syrup (700ML)",
        price: 2200,
        capacity: ["700ML"],
        capacityPricing: [{ capacity: "700ML", originalPrice: 2200, currentPrice: 2200 }],
        abv: 0,
        isAvailable: true
      },
      // Fitch & Leedes Mixers
      {
        name: "Fitch & Leedes Club Soda",
        description: "Fitch & Leedes Club Soda (200ml)",
        price: 250,
        capacity: ["200ml"],
        capacityPricing: [{ capacity: "200ml", originalPrice: 250, currentPrice: 250 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Fitch & Leedes Pink Tonic Sugar Free",
        description: "Fitch & Leedes Pink Tonic Sugar Free (200ml)",
        price: 250,
        capacity: ["200ml"],
        capacityPricing: [{ capacity: "200ml", originalPrice: 250, currentPrice: 250 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Fitch & Leedes Lemonade",
        description: "Fitch & Leedes Lemonade (200ml)",
        price: 250,
        capacity: ["200ml"],
        capacityPricing: [{ capacity: "200ml", originalPrice: 250, currentPrice: 250 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Fitch & Leedes Indian Tonic Sugar Free",
        description: "Fitch & Leedes Indian Tonic Sugar Free (200ml)",
        price: 250,
        capacity: ["200ml"],
        capacityPricing: [{ capacity: "200ml", originalPrice: 250, currentPrice: 250 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Fitch & Leedes Classic Passionade",
        description: "Fitch & Leedes Classic Passionade (300ml)",
        price: 300,
        capacity: ["300ml"],
        capacityPricing: [{ capacity: "300ml", originalPrice: 300, currentPrice: 300 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Fitch Leedes Cheeky Cranberry",
        description: "Fitch Leedes Cheeky Cranberry (200ml)",
        price: 200,
        capacity: ["200ml"],
        capacityPricing: [{ capacity: "200ml", originalPrice: 200, currentPrice: 200 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Fitch & Leedes Grapefruit Tonic",
        description: "Fitch & Leedes Grapefruit Tonic (200ml)",
        price: 250,
        capacity: ["200ml"],
        capacityPricing: [{ capacity: "200ml", originalPrice: 250, currentPrice: 250 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Fitch & Leedes Moments Pink G&T",
        description: "Fitch & Leedes Moments Pink G&T (300ml)",
        price: 300,
        capacity: ["300ml"],
        capacityPricing: [{ capacity: "300ml", originalPrice: 300, currentPrice: 300 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Fitch & Leedes Indian Tonic",
        description: "Fitch & Leedes Indian Tonic (200ml)",
        price: 250,
        capacity: ["200ml"],
        capacityPricing: [{ capacity: "200ml", originalPrice: 250, currentPrice: 250 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Fitch & Leedes Classic Lime Twist",
        description: "Fitch & Leedes Classic Lime Twist (300ml)",
        price: 300,
        capacity: ["300ml"],
        capacityPricing: [{ capacity: "300ml", originalPrice: 300, currentPrice: 300 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Fitch & Leedes Classic Ginger Beer",
        description: "Fitch & Leedes Classic Ginger Beer (300ml)",
        price: 300,
        capacity: ["300ml"],
        capacityPricing: [{ capacity: "300ml", originalPrice: 300, currentPrice: 300 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Fitch & Leedes Pink Tonic",
        description: "Fitch & Leedes Pink Tonic (200ml)",
        price: 200,
        capacity: ["200ml"],
        capacityPricing: [{ capacity: "200ml", originalPrice: 200, currentPrice: 200 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Fitch & Leedes Ginger Ale",
        description: "Fitch & Leedes Ginger Ale (200ml)",
        price: 200,
        capacity: ["200ml"],
        capacityPricing: [{ capacity: "200ml", originalPrice: 200, currentPrice: 200 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Fitch & Leedes Moments Shirley Temple",
        description: "Fitch & Leedes Moments Shirley Temple (300ml)",
        price: 300,
        capacity: ["300ml"],
        capacityPricing: [{ capacity: "300ml", originalPrice: 300, currentPrice: 300 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Fitch & leedes blue tonic",
        description: "Fitch & leedes blue tonic (200ml)",
        price: 200,
        capacity: ["200ml"],
        capacityPricing: [{ capacity: "200ml", originalPrice: 200, currentPrice: 200 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Fitch & leedes Bitter lemon",
        description: "Fitch & leedes Bitter lemon (200ml)",
        price: 200,
        capacity: ["200ml"],
        capacityPricing: [{ capacity: "200ml", originalPrice: 200, currentPrice: 200 }],
        abv: 0,
        isAvailable: false
      },
      // Other Mixers and Sodas
      {
        name: "Soda Water",
        description: "Soda Water (500ml)",
        price: 100,
        capacity: ["500ml"],
        capacityPricing: [{ capacity: "500ml", originalPrice: 100, currentPrice: 100 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Krest",
        description: "Krest (1 Litre)",
        price: 200,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 200, currentPrice: 200 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Schweppes Tonic Water",
        description: "Schweppes Tonic Water (500ml)",
        price: 100,
        capacity: ["500ml"],
        capacityPricing: [{ capacity: "500ml", originalPrice: 100, currentPrice: 100 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Schweppes Ginger Ale",
        description: "Schweppes Ginger Ale (300ml)",
        price: 99,
        capacity: ["300ml"],
        capacityPricing: [{ capacity: "300ml", originalPrice: 99, currentPrice: 99 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Schweppes C+",
        description: "Schweppes C+ (330ml)",
        price: 100,
        capacity: ["330ml"],
        capacityPricing: [{ capacity: "330ml", originalPrice: 100, currentPrice: 100 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Indian Tonic Water",
        description: "Indian Tonic Water (200ml)",
        price: 50,
        capacity: ["200ml"],
        capacityPricing: [{ capacity: "200ml", originalPrice: 50, currentPrice: 50 }],
        abv: 0,
        isAvailable: false
      },
      // Water
      {
        name: "Keringet Sparkling Water",
        description: "Keringet Sparkling Water (1 Litre)",
        price: 150,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 150, currentPrice: 150 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Dasani Water",
        description: "Dasani Water",
        price: 50,
        capacity: ["500ml", "1 Litre"],
        capacityPricing: [
          { capacity: "500ml", originalPrice: 50, currentPrice: 50 },
          { capacity: "1 Litre", originalPrice: 100, currentPrice: 100 }
        ],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Keringet Still Water",
        description: "Keringet Still Water (1 Litre)",
        price: 160,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 160, currentPrice: 160 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Aquamist sparkling water",
        description: "Aquamist sparkling water (1 Litre)",
        price: 100,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 100, currentPrice: 100 }],
        abv: 0,
        isAvailable: true
      },
      // Juices
      {
        name: "Delmonte Passion",
        description: "Delmonte Passion (1 Litre)",
        price: 300,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 300, currentPrice: 300 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Delmonte Mixed Berry",
        description: "Delmonte Mixed Berry (1 Litre)",
        price: 300,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 300, currentPrice: 300 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Delmonte Orange",
        description: "Delmonte Orange (1 Litre)",
        price: 300,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 300, currentPrice: 300 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Delmonte pineapple",
        description: "Delmonte pineapple (1 Litre)",
        price: 300,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 300, currentPrice: 300 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Delmonte Tropical",
        description: "Delmonte Tropical (1 Litre)",
        price: 300,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 300, currentPrice: 300 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Delmonte Mango",
        description: "Delmonte Mango (1 Litre)",
        price: 300,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 300, currentPrice: 300 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Lime cordial",
        description: "Lime cordial (1.5 Litres)",
        price: 250,
        capacity: ["1.5 Litres"],
        capacityPricing: [{ capacity: "1.5 Litres", originalPrice: 250, currentPrice: 250 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Gofrut Lemon Mint Mojito",
        description: "Gofrut Lemon Mint Mojito (1 Litre)",
        price: 199,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 199, currentPrice: 199 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Safari Lemonade",
        description: "Safari Lemonade (300ml)",
        price: 80,
        capacity: ["300ml"],
        capacityPricing: [{ capacity: "300ml", originalPrice: 80, currentPrice: 80 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Stoney Tangawizi Zero 1litre",
        description: "Stoney Tangawizi Zero (1 Litre)",
        price: 200,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 200, currentPrice: 200 }],
        abv: 0,
        isAvailable: false
      },
      // Energy Drinks
      {
        name: "Monster Energy Ultra Blue",
        description: "Monster Energy Ultra Blue (500ml)",
        price: 300,
        capacity: ["500ml"],
        capacityPricing: [{ capacity: "500ml", originalPrice: 300, currentPrice: 300 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monster Energy",
        description: "Monster Energy (500ml)",
        price: 350,
        capacity: ["500ml"],
        capacityPricing: [{ capacity: "500ml", originalPrice: 350, currentPrice: 350 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Monster Energy Gronk",
        description: "Monster Energy Gronk (500ml)",
        price: 300,
        capacity: ["500ml"],
        capacityPricing: [{ capacity: "500ml", originalPrice: 300, currentPrice: 300 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monster Energy Uber",
        description: "Monster Energy Uber (500ml)",
        price: 300,
        capacity: ["500ml"],
        capacityPricing: [{ capacity: "500ml", originalPrice: 300, currentPrice: 300 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monster Energy Import Light",
        description: "Monster Energy Import Light (500ml)",
        price: 200,
        capacity: ["500ml"],
        capacityPricing: [{ capacity: "500ml", originalPrice: 200, currentPrice: 200 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monster Assault",
        description: "Monster Assault (500ml)",
        price: 300,
        capacity: ["500ml"],
        capacityPricing: [{ capacity: "500ml", originalPrice: 300, currentPrice: 300 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Monster Energy Lo Carb",
        description: "Monster Energy Lo Carb (500ml)",
        price: 200,
        capacity: ["500ml"],
        capacityPricing: [{ capacity: "500ml", originalPrice: 200, currentPrice: 200 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Monster Energy Import",
        description: "Monster Energy Import (500ml)",
        price: 200,
        capacity: ["500ml"],
        capacityPricing: [{ capacity: "500ml", originalPrice: 200, currentPrice: 200 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Beast Mode Energy Drink",
        description: "Beast Mode Energy Drink (250ml)",
        price: 150,
        capacity: ["250ml"],
        capacityPricing: [{ capacity: "250ml", originalPrice: 150, currentPrice: 150 }],
        abv: 0,
        isAvailable: false
      },
      // K.O Products
      {
        name: "K.O Pink Tonic Rose & Cucumber",
        description: "K.O Pink Tonic Rose & Cucumber (330ml)",
        price: 150,
        capacity: ["330ml"],
        capacityPricing: [{ capacity: "330ml", originalPrice: 150, currentPrice: 150 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "K.O Hibiscus & lime ice tea",
        description: "K.O Hibiscus & lime ice tea (330ml)",
        price: 150,
        capacity: ["330ml"],
        capacityPricing: [{ capacity: "330ml", originalPrice: 150, currentPrice: 150 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "K.O Light Tonic",
        description: "K.O Light Tonic (330ml)",
        price: 150,
        capacity: ["330ml"],
        capacityPricing: [{ capacity: "330ml", originalPrice: 150, currentPrice: 150 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "K.O Chilli and Turmeric Tonic Water",
        description: "K.O Chilli and Turmeric Tonic Water (Six Pack)",
        price: 1600,
        capacity: ["Six Pack"],
        capacityPricing: [{ capacity: "Six Pack", originalPrice: 1600, currentPrice: 1600 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "K.O passion Fruit American ice tea",
        description: "K.O passion Fruit American ice tea (330ml)",
        price: 195,
        capacity: ["330ml"],
        capacityPricing: [{ capacity: "330ml", originalPrice: 195, currentPrice: 195 }],
        abv: 0,
        isAvailable: false
      },
      // Other Products
      {
        name: "San-pellegrino Aranciata can",
        description: "San-pellegrino Aranciata can (Six Pack)",
        price: 1500,
        capacity: ["Six Pack"],
        capacityPricing: [{ capacity: "Six Pack", originalPrice: 1500, currentPrice: 1500 }],
        abv: 0,
        isAvailable: true
      },
      {
        name: "Chupa Chup Drinks",
        description: "Chupa Chup Drinks (330ml)",
        price: 250,
        capacity: ["330ml"],
        capacityPricing: [{ capacity: "330ml", originalPrice: 250, currentPrice: 250 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "Grenadine Syrup",
        description: "Grenadine Syrup (750ML)",
        price: 995,
        capacity: ["750ML"],
        capacityPricing: [{ capacity: "750ML", originalPrice: 995, currentPrice: 995 }],
        abv: 0,
        isAvailable: false
      },
      // Alcoholic Mixers (low ABV)
      {
        name: "Martini Rosso",
        description: "Martini Rosso (ABV 15%), Italy",
        price: 2300,
        capacity: ["750ML"],
        capacityPricing: [{ capacity: "750ML", originalPrice: 2300, currentPrice: 2300 }],
        abv: 15.0,
        isAvailable: true
      },
      {
        name: "Martini Bianco",
        description: "Martini Bianco (ABV 15%), Italy",
        price: 2500,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 2500, currentPrice: 2500 }],
        abv: 15.0,
        isAvailable: true
      },
      {
        name: "Cinzano Rosso",
        description: "Cinzano Rosso (ABV 15%), Italy",
        price: 1900,
        capacity: ["750ML"],
        capacityPricing: [{ capacity: "750ML", originalPrice: 1900, currentPrice: 1900 }],
        abv: 15.0,
        isAvailable: false
      },
      {
        name: "Cinzano Bianco",
        description: "Cinzano Bianco (ABV 15%), Italy",
        price: 1650,
        capacity: ["750ML"],
        capacityPricing: [{ capacity: "750ML", originalPrice: 1650, currentPrice: 1650 }],
        abv: 15.0,
        isAvailable: false
      },
      {
        name: "Pimm's",
        description: "Pimm's (ABV 25%), England",
        price: 2500,
        capacity: ["750ML"],
        capacityPricing: [{ capacity: "750ML", originalPrice: 2500, currentPrice: 2500 }],
        abv: 25.0,
        isAvailable: true
      },
      {
        name: "Ricard",
        description: "Ricard (ABV 45%), France",
        price: 2400,
        capacity: ["1 Litre"],
        capacityPricing: [{ capacity: "1 Litre", originalPrice: 2400, currentPrice: 2400 }],
        abv: 45.0,
        isAvailable: false
      },
      // Grape Juices
      {
        name: "1857 Grape juice red",
        description: "1857 Grape juice red (750ml)",
        price: 1700,
        capacity: ["750ml"],
        capacityPricing: [{ capacity: "750ml", originalPrice: 1700, currentPrice: 1700 }],
        abv: 0,
        isAvailable: false
      },
      {
        name: "1857 Grape juice white",
        description: "1857 Grape juice white (750ml)",
        price: 1700,
        capacity: ["750ml"],
        capacityPricing: [{ capacity: "750ml", originalPrice: 1700, currentPrice: 1700 }],
        abv: 0,
        isAvailable: false
      }
    ];

    let addedCount = 0;
    let skippedCount = 0;

    for (const drink of softDrinks) {
      const existingDrink = await db.Drink.findOne({ 
        where: { name: drink.name, categoryId: softDrinksCategory[0].id } 
      });
      
      if (existingDrink) {
        console.log(`Skipping ${drink.name} - already exists`);
        skippedCount++;
        continue;
      }

      const newDrink = await db.Drink.create({
        name: drink.name,
        description: drink.description,
        price: drink.price.toString(),
        originalPrice: drink.price.toString(),
        categoryId: softDrinksCategory[0].id,
        subCategoryId: allSoftDrinksSubCategory[0].id,
        capacity: drink.capacity,
        capacityPricing: drink.capacityPricing,
        abv: drink.abv,
        isAvailable: drink.isAvailable !== undefined ? drink.isAvailable : true,
        isPopular: drink.isPopular || false,
        isOnOffer: false,
        image: null
      });
      
      console.log(`Added soft drink: ${drink.name} - KES ${drink.price.toFixed(2)} (Available: ${drink.isAvailable})`);
      addedCount++;
    }

    console.log(`\nCompleted adding soft drinks items:`);
    console.log(`- Added: ${addedCount}`);
    console.log(`- Skipped: ${skippedCount}`);
    console.log(`- Total processed: ${softDrinks.length}`);

  } catch (error) {
    console.error('Error adding soft drinks items:', error);
  } finally {
    await db.sequelize.close();
  }
}

addSoftDrinksItems();


