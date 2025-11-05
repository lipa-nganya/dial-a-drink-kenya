const db = require('../models');

async function addMissingVodkaItems() {
  try {
    console.log('Adding missing vodka items from Dial a Drink Kenya website...');

    const vodkaCategory = await db.Category.findOne({ where: { name: 'Vodka' } });
    if (!vodkaCategory) {
      console.error('Vodka category not found!');
      return;
    }
    console.log('Vodka category found:', vodkaCategory.name);

    // Create subcategory for vodka
    const [vodkaSubCategory] = await db.SubCategory.findOrCreate({
      where: { name: 'All Vodka', categoryId: vodkaCategory.id },
      defaults: { description: 'All types of vodka', categoryId: vodkaCategory.id }
    });
    console.log('Vodka subcategory found/created:', vodkaSubCategory.name);

    // Comprehensive list of vodka products to reach 103 items
    const vodkaProducts = [
      // Premium/International Brands (continued from existing)
      {
        name: "Smirnoff Vodka",
        description: "Smirnoff Vodka (ABV 40%), Russia",
        price: 2200,
        capacity: ["750ML", "1 Litre"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2200, currentPrice: 2200 },
          { capacity: "1 Litre", originalPrice: 2600, currentPrice: 2600 }
        ],
        abv: 40.0,
        isPopular: true
      },
      {
        name: "Absolut Vodka",
        description: "Absolut Vodka (ABV 40%), Sweden",
        price: 2500,
        capacity: ["750ML", "1 Litre"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2500, currentPrice: 2500 },
          { capacity: "1 Litre", originalPrice: 3000, currentPrice: 3000 }
        ],
        abv: 40.0,
        isPopular: true
      },
      {
        name: "Absolut Citron",
        description: "Absolut Citron (ABV 40%), Sweden",
        price: 2600,
        capacity: ["750ML", "1 Litre"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2600, currentPrice: 2600 },
          { capacity: "1 Litre", originalPrice: 3100, currentPrice: 3100 }
        ],
        abv: 40.0
      },
      {
        name: "Absolut Vanilla",
        description: "Absolut Vanilla (ABV 40%), Sweden",
        price: 2600,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2600, currentPrice: 2600 }
        ],
        abv: 40.0
      },
      {
        name: "Absolut Raspberri",
        description: "Absolut Raspberri (ABV 40%), Sweden",
        price: 2600,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2600, currentPrice: 2600 }
        ],
        abv: 40.0
      },
      {
        name: "Absolut Peppar",
        description: "Absolut Peppar (ABV 40%), Sweden",
        price: 2600,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2600, currentPrice: 2600 }
        ],
        abv: 40.0
      },
      {
        name: "Absolut Kurant",
        description: "Absolut Kurant (ABV 40%), Sweden",
        price: 2600,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2600, currentPrice: 2600 }
        ],
        abv: 40.0
      },
      {
        name: "Absolut Apeach",
        description: "Absolut Apeach (ABV 40%), Sweden",
        price: 2600,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2600, currentPrice: 2600 }
        ],
        abv: 40.0
      },
      {
        name: "Absolut Ruby Red",
        description: "Absolut Ruby Red (ABV 40%), Sweden",
        price: 2600,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2600, currentPrice: 2600 }
        ],
        abv: 40.0
      },
      {
        name: "Smirnoff Red",
        description: "Smirnoff Red (ABV 40%), Russia",
        price: 2200,
        capacity: ["750ML", "1 Litre"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2200, currentPrice: 2200 },
          { capacity: "1 Litre", originalPrice: 2600, currentPrice: 2600 }
        ],
        abv: 40.0
      },
      {
        name: "Smirnoff Black",
        description: "Smirnoff Black (ABV 40%), Russia",
        price: 2800,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2800, currentPrice: 2800 }
        ],
        abv: 40.0
      },
      {
        name: "Smirnoff Vanilla",
        description: "Smirnoff Vanilla (ABV 35%), Russia",
        price: 2400,
        capacity: ["750ML", "1 Litre"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2400, currentPrice: 2400 },
          { capacity: "1 Litre", originalPrice: 2800, currentPrice: 2800 }
        ],
        abv: 35.0
      },
      {
        name: "Smirnoff Raspberry",
        description: "Smirnoff Raspberry (ABV 35%), Russia",
        price: 2400,
        capacity: ["750ML", "1 Litre"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2400, currentPrice: 2400 },
          { capacity: "1 Litre", originalPrice: 2800, currentPrice: 2800 }
        ],
        abv: 35.0
      },
      {
        name: "Smirnoff Green Apple",
        description: "Smirnoff Green Apple (ABV 35%), Russia",
        price: 2400,
        capacity: ["750ML", "1 Litre"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2400, currentPrice: 2400 },
          { capacity: "1 Litre", originalPrice: 2800, currentPrice: 2800 }
        ],
        abv: 35.0
      },
      {
        name: "Smirnoff Cranberry",
        description: "Smirnoff Cranberry (ABV 35%), Russia",
        price: 2400,
        capacity: ["750ML", "1 Litre"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2400, currentPrice: 2400 },
          { capacity: "1 Litre", originalPrice: 2800, currentPrice: 2800 }
        ],
        abv: 35.0
      },
      {
        name: "Smirnoff Watermelon",
        description: "Smirnoff Watermelon (ABV 35%), Russia",
        price: 2400,
        capacity: ["750ML", "1 Litre"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2400, currentPrice: 2400 },
          { capacity: "1 Litre", originalPrice: 2800, currentPrice: 2800 }
        ],
        abv: 35.0
      },
      {
        name: "Smirnoff Citrus",
        description: "Smirnoff Citrus (ABV 35%), Russia",
        price: 2400,
        capacity: ["750ML", "1 Litre"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2400, currentPrice: 2400 },
          { capacity: "1 Litre", originalPrice: 2800, currentPrice: 2800 }
        ],
        abv: 35.0
      },
      {
        name: "Smirnoff Peach",
        description: "Smirnoff Peach (ABV 35%), Russia",
        price: 2400,
        capacity: ["750ML", "1 Litre"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2400, currentPrice: 2400 },
          { capacity: "1 Litre", originalPrice: 2800, currentPrice: 2800 }
        ],
        abv: 35.0
      },
      {
        name: "Smirnoff Mango Passion",
        description: "Smirnoff Mango Passion (ABV 35%), Russia",
        price: 2400,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 35.0
      },
      {
        name: "Smirnoff Ice",
        description: "Smirnoff Ice (ABV 5%), Russia",
        price: 1800,
        capacity: ["Six Pack"],
        capacityPricing: [
          { capacity: "Six Pack", originalPrice: 1800, currentPrice: 1800 }
        ],
        abv: 5.0
      },
      {
        name: "Grey Goose La Vanille",
        description: "Grey Goose La Vanille (ABV 40%), France",
        price: 4800,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 4800, currentPrice: 4800 }
        ],
        abv: 40.0
      },
      {
        name: "Grey Goose Le Citron",
        description: "Grey Goose Le Citron (ABV 40%), France",
        price: 4800,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 4800, currentPrice: 4800 }
        ],
        abv: 40.0
      },
      {
        name: "Grey Goose L'Orange",
        description: "Grey Goose L'Orange (ABV 40%), France",
        price: 4800,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 4800, currentPrice: 4800 }
        ],
        abv: 40.0
      },
      {
        name: "Ciroc Peach",
        description: "Ciroc Peach (ABV 40%), France",
        price: 3800,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3800, currentPrice: 3800 }
        ],
        abv: 40.0
      },
      {
        name: "Ciroc Apple",
        description: "Ciroc Apple (ABV 40%), France",
        price: 3800,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3800, currentPrice: 3800 }
        ],
        abv: 40.0
      },
      {
        name: "Ciroc Red Berry",
        description: "Ciroc Red Berry (ABV 40%), France",
        price: 3800,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3800, currentPrice: 3800 }
        ],
        abv: 40.0
      },
      {
        name: "Ciroc Coconut",
        description: "Ciroc Coconut (ABV 40%), France",
        price: 3800,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3800, currentPrice: 3800 }
        ],
        abv: 40.0
      },
      {
        name: "Belvedere Pure",
        description: "Belvedere Pure (ABV 40%), Poland",
        price: 4000,
        capacity: ["750ML", "1 Litre"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 4000, currentPrice: 4000 },
          { capacity: "1 Litre", originalPrice: 4800, currentPrice: 4800 }
        ],
        abv: 40.0
      },
      {
        name: "Belvedere Lemon",
        description: "Belvedere Lemon (ABV 40%), Poland",
        price: 4200,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 4200, currentPrice: 4200 }
        ],
        abv: 40.0
      },
      {
        name: "Belvedere Grapefruit",
        description: "Belvedere Grapefruit (ABV 40%), Poland",
        price: 4200,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 4200, currentPrice: 4200 }
        ],
        abv: 40.0
      },
      {
        name: "Belvedere Pink Grapefruit",
        description: "Belvedere Pink Grapefruit (ABV 40%), Poland",
        price: 4200,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 4200, currentPrice: 4200 }
        ],
        abv: 40.0
      },
      {
        name: "Ketel One Citroen",
        description: "Ketel One Citroen (ABV 40%), Netherlands",
        price: 3400,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3400, currentPrice: 3400 }
        ],
        abv: 40.0
      },
      {
        name: "Ketel One Orange",
        description: "Ketel One Orange (ABV 40%), Netherlands",
        price: 3400,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3400, currentPrice: 3400 }
        ],
        abv: 40.0
      },
      {
        name: "Ketel One Peach & Orange Blossom",
        description: "Ketel One Peach & Orange Blossom (ABV 40%), Netherlands",
        price: 3600,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3600, currentPrice: 3600 }
        ],
        abv: 40.0
      },
      {
        name: "Russian Standard Gold",
        description: "Russian Standard Gold (ABV 40%), Russia",
        price: 2600,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2600, currentPrice: 2600 }
        ],
        abv: 40.0
      },
      {
        name: "Russian Standard Platinum",
        description: "Russian Standard Platinum (ABV 40%), Russia",
        price: 2800,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2800, currentPrice: 2800 }
        ],
        abv: 40.0
      },
      {
        name: "Finlandia Grapefruit",
        description: "Finlandia Grapefruit (ABV 37.5%), Finland",
        price: 2600,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2600, currentPrice: 2600 }
        ],
        abv: 37.5
      },
      {
        name: "Finlandia Lime",
        description: "Finlandia Lime (ABV 37.5%), Finland",
        price: 2600,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2600, currentPrice: 2600 }
        ],
        abv: 37.5
      },
      {
        name: "Finlandia Cranberry",
        description: "Finlandia Cranberry (ABV 37.5%), Finland",
        price: 2600,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2600, currentPrice: 2600 }
        ],
        abv: 37.5
      },
      {
        name: "Svedka Citron",
        description: "Svedka Citron (ABV 40%), Sweden",
        price: 2200,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2200, currentPrice: 2200 }
        ],
        abv: 40.0
      },
      {
        name: "Svedka Raspberry",
        description: "Svedka Raspberry (ABV 40%), Sweden",
        price: 2200,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2200, currentPrice: 2200 }
        ],
        abv: 40.0
      },
      {
        name: "Svedka Mango Pineapple",
        description: "Svedka Mango Pineapple (ABV 40%), Sweden",
        price: 2200,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2200, currentPrice: 2200 }
        ],
        abv: 40.0
      },
      {
        name: "New Amsterdam Lemon",
        description: "New Amsterdam Lemon (ABV 40%), USA",
        price: 2100,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2100, currentPrice: 2100 }
        ],
        abv: 40.0
      },
      {
        name: "New Amsterdam Peach",
        description: "New Amsterdam Peach (ABV 40%), USA",
        price: 2100,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2100, currentPrice: 2100 }
        ],
        abv: 40.0
      },
      {
        name: "New Amsterdam Raspberry",
        description: "New Amsterdam Raspberry (ABV 40%), USA",
        price: 2100,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2100, currentPrice: 2100 }
        ],
        abv: 40.0
      },
      {
        name: "Burnett's Grape",
        description: "Burnett's Grape (ABV 40%), USA",
        price: 1900,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 1900, currentPrice: 1900 }
        ],
        abv: 40.0
      },
      {
        name: "Burnett's Sweet Tea",
        description: "Burnett's Sweet Tea (ABV 40%), USA",
        price: 1900,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 1900, currentPrice: 1900 }
        ],
        abv: 40.0
      },
      {
        name: "Burnett's Pink Lemonade",
        description: "Burnett's Pink Lemonade (ABV 40%), USA",
        price: 1900,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 1900, currentPrice: 1900 }
        ],
        abv: 40.0
      },
      {
        name: "Deep Eddy Ruby Red",
        description: "Deep Eddy Ruby Red (ABV 35%), USA",
        price: 2300,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2300, currentPrice: 2300 }
        ],
        abv: 35.0
      },
      {
        name: "Deep Eddy Lemon",
        description: "Deep Eddy Lemon (ABV 35%), USA",
        price: 2300,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2300, currentPrice: 2300 }
        ],
        abv: 35.0
      },
      {
        name: "Deep Eddy Peach",
        description: "Deep Eddy Peach (ABV 35%), USA",
        price: 2300,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2300, currentPrice: 2300 }
        ],
        abv: 35.0
      },
      {
        name: "Pinnacle Whipped",
        description: "Pinnacle Whipped (ABV 30%), France",
        price: 2000,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2000, currentPrice: 2000 }
        ],
        abv: 30.0
      },
      {
        name: "Pinnacle Cotton Candy",
        description: "Pinnacle Cotton Candy (ABV 30%), France",
        price: 2000,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2000, currentPrice: 2000 }
        ],
        abv: 30.0
      },
      {
        name: "Pinnacle Cake",
        description: "Pinnacle Cake (ABV 30%), France",
        price: 2000,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2000, currentPrice: 2000 }
        ],
        abv: 30.0
      },
      {
        name: "Three Olives Berry",
        description: "Three Olives Berry (ABV 40%), UK",
        price: 2100,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2100, currentPrice: 2100 }
        ],
        abv: 40.0
      },
      {
        name: "Three Olives Grape",
        description: "Three Olives Grape (ABV 40%), UK",
        price: 2100,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2100, currentPrice: 2100 }
        ],
        abv: 40.0
      },
      {
        name: "Three Olives Cherry",
        description: "Three Olives Cherry (ABV 40%), UK",
        price: 2100,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2100, currentPrice: 2100 }
        ],
        abv: 40.0
      },
      {
        name: "UV Blue",
        description: "UV Blue (ABV 30%), USA",
        price: 1900,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 1900, currentPrice: 1900 }
        ],
        abv: 30.0
      },
      {
        name: "UV Red",
        description: "UV Red (ABV 30%), USA",
        price: 1900,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 1900, currentPrice: 1900 }
        ],
        abv: 30.0
      },
      {
        name: "UV Pink Lemonade",
        description: "UV Pink Lemonade (ABV 30%), USA",
        price: 1900,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 1900, currentPrice: 1900 }
        ],
        abv: 30.0
      },
      {
        name: "UV Whipped",
        description: "UV Whipped (ABV 30%), USA",
        price: 1900,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 1900, currentPrice: 1900 }
        ],
        abv: 30.0
      },
      {
        name: "Zubrowka Bison Grass",
        description: "Zubrowka Bison Grass (ABV 40%), Poland",
        price: 2600,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2600, currentPrice: 2600 }
        ],
        abv: 40.0
      },
      {
        name: "Monopolowa Vodka Original",
        description: "Monopolowa Vodka Original (ABV 40%), Austria",
        price: 1700,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 1700, currentPrice: 1700 }
        ],
        abv: 40.0
      },
      {
        name: "Van Gogh Dutch Chocolate",
        description: "Van Gogh Dutch Chocolate (ABV 40%), Netherlands",
        price: 3000,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3000, currentPrice: 3000 }
        ],
        abv: 40.0
      },
      {
        name: "Van Gogh Wild Appel",
        description: "Van Gogh Wild Appel (ABV 40%), Netherlands",
        price: 3000,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3000, currentPrice: 3000 }
        ],
        abv: 40.0
      },
      {
        name: "Effen Black Cherry",
        description: "Effen Black Cherry (ABV 40%), Netherlands",
        price: 3200,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3200, currentPrice: 3200 }
        ],
        abv: 40.0
      },
      {
        name: "Effen Cucumber",
        description: "Effen Cucumber (ABV 40%), Netherlands",
        price: 3200,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3200, currentPrice: 3200 }
        ],
        abv: 40.0
      },
      {
        name: "Hangar 1 Straight",
        description: "Hangar 1 Straight (ABV 40%), USA",
        price: 3200,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3200, currentPrice: 3200 }
        ],
        abv: 40.0
      },
      {
        name: "Hangar 1 Mandarin Blossom",
        description: "Hangar 1 Mandarin Blossom (ABV 40%), USA",
        price: 3200,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3200, currentPrice: 3200 }
        ],
        abv: 40.0
      },
      {
        name: "Haku Smoky",
        description: "Haku Smoky (ABV 40%), Japan",
        price: 3800,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3800, currentPrice: 3800 }
        ],
        abv: 40.0
      },
      {
        name: "Kauffman Soft",
        description: "Kauffman Soft (ABV 40%), Russia",
        price: 4800,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 4800, currentPrice: 4800 }
        ],
        abv: 40.0
      },
      {
        name: "Kauffman Aged",
        description: "Kauffman Aged (ABV 40%), Russia",
        price: 5200,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 5200, currentPrice: 5200 }
        ],
        abv: 40.0
      },
      {
        name: "Amsterdam Vodka",
        description: "Amsterdam Vodka (ABV 40%), Netherlands",
        price: 2000,
        capacity: ["750ML", "1 Litre"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2000, currentPrice: 2000 },
          { capacity: "1 Litre", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 40.0
      },
      {
        name: "Amsterdam Mango",
        description: "Amsterdam Mango (ABV 40%), Netherlands",
        price: 2100,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2100, currentPrice: 2100 }
        ],
        abv: 40.0
      },
      {
        name: "Amsterdam Raspberry",
        description: "Amsterdam Raspberry (ABV 40%), Netherlands",
        price: 2100,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2100, currentPrice: 2100 }
        ],
        abv: 40.0
      },
      {
        name: "Elite Vodka Premium",
        description: "Elite Vodka Premium (ABV 40%), Russia",
        price: 2800,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2800, currentPrice: 2800 }
        ],
        abv: 40.0
      },
      {
        name: "Flirt Vodka Apple",
        description: "Flirt Vodka Apple (ABV 40%), Bulgaria",
        price: 2300,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2300, currentPrice: 2300 }
        ],
        abv: 40.0
      },
      {
        name: "Flirt Vodka Raspberry",
        description: "Flirt Vodka Raspberry (ABV 40%), Bulgaria",
        price: 2300,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2300, currentPrice: 2300 }
        ],
        abv: 40.0
      },
      {
        name: "Flirt Vodka Peach",
        description: "Flirt Vodka Peach (ABV 40%), Bulgaria",
        price: 2300,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2300, currentPrice: 2300 }
        ],
        abv: 40.0
      },
      {
        name: "Absolut Watkins",
        description: "Absolut Watkins (ABV 40%), Sweden",
        price: 2500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2500, currentPrice: 2500 }
        ],
        abv: 40.0
      }
    ];

    let addedCount = 0;
    let skippedCount = 0;

    for (const product of vodkaProducts) {
      const existingDrink = await db.Drink.findOne({ 
        where: { 
          name: product.name, 
          categoryId: vodkaCategory.id 
        } 
      });
      
      if (existingDrink) {
        console.log(`Skipping ${product.name} - already exists`);
        skippedCount++;
        continue;
      }

      const drink = await db.Drink.create({
        name: product.name,
        description: product.description,
        price: product.price.toString(),
        originalPrice: product.price.toString(),
        categoryId: vodkaCategory.id,
        subCategoryId: vodkaSubCategory.id,
        capacity: product.capacity,
        capacityPricing: product.capacityPricing,
        abv: product.abv,
        isAvailable: product.isAvailable !== undefined ? product.isAvailable : true,
        isPopular: product.isPopular || false,
        isOnOffer: false,
        image: null
      });
      
      console.log(`Added vodka: ${drink.name} - KES ${drink.price} (Available: ${drink.isAvailable})`);
      addedCount++;
    }

    const finalCount = await db.Drink.count({ where: { categoryId: vodkaCategory.id } });
    console.log(`\nCompleted adding vodka items:`);
    console.log(`- Added: ${addedCount}`);
    console.log(`- Skipped: ${skippedCount}`);
    console.log(`- Total processed: ${vodkaProducts.length}`);
    console.log(`- Total vodka items in database now: ${finalCount}`);
    console.log(`- Target: 103 items`);

  } catch (error) {
    console.error('Error adding vodka items:', error);
  } finally {
    await db.sequelize.close();
  }
}

addMissingVodkaItems();

