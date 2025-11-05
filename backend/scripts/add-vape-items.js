const db = require('../models');

async function addVapeItems() {
  try {
    console.log('Adding vape items from Dial a Drink Kenya website...');

    const vapeCategory = await db.Category.findOne({ where: { name: 'Vapes' } });
    if (!vapeCategory) {
      console.error('Vapes category not found!');
      return;
    }
    console.log('Vapes category found:', vapeCategory.name);

    const allVapesSubCategory = await db.SubCategory.findOne({ 
      where: { name: 'All Vapes', categoryId: vapeCategory.id } 
    });
    if (!allVapesSubCategory) {
      // Create the subcategory if it doesn't exist
      const newSubCategory = await db.SubCategory.create({
        name: 'All Vapes',
        description: 'All types of vapes and vaping products',
        categoryId: vapeCategory.id
      });
      console.log('Created All Vapes subcategory');
    } else {
      console.log('All Vapes subcategory found:', allVapesSubCategory.name);
    }

    // Vape items from the actual Dial a Drink Kenya website
    const vapeItems = [
      {
        name: "Hart Vape Ice Appletini 3500 puffs",
        description: "Hart Vape Ice Appletini 3500 puffs",
        price: 1795,
        capacity: ["3500 puffs"],
        capacityPricing: [
          { capacity: "3500 puffs", originalPrice: 1795, currentPrice: 1795 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Hart Vape Manhattan Mint 3500 puffs",
        description: "Hart Vape Manhattan Mint 3500 puffs",
        price: 1795,
        capacity: ["3500 puffs"],
        capacityPricing: [
          { capacity: "3500 puffs", originalPrice: 1795, currentPrice: 1795 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Hart Vape Peach Ice 3500 puffs",
        description: "Hart Vape Peach Ice 3500 puffs",
        price: 1795,
        capacity: ["3500 puffs"],
        capacityPricing: [
          { capacity: "3500 puffs", originalPrice: 1795, currentPrice: 1795 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Hart Vape Blueberry Razz Ice",
        description: "Hart Vape Blueberry Razz Ice",
        price: 1795,
        capacity: ["3500 puffs"],
        capacityPricing: [
          { capacity: "3500 puffs", originalPrice: 1795, currentPrice: 1795 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Hart Vape Cola 3500 puffs",
        description: "Hart Vape Cola 3500 puffs",
        price: 1795,
        capacity: ["3500 puffs"],
        capacityPricing: [
          { capacity: "3500 puffs", originalPrice: 1795, currentPrice: 1795 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Hart Vape Pineapple Ice 3500 puffs",
        description: "Hart Vape Pineapple Ice 3500 puffs",
        price: 1795,
        capacity: ["3500 puffs"],
        capacityPricing: [
          { capacity: "3500 puffs", originalPrice: 1795, currentPrice: 1795 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Hart Vape Strawberry Cosmo 3500 puffs",
        description: "Hart Vape Strawberry Cosmo 3500 puffs",
        price: 1795,
        capacity: ["3500 puffs"],
        capacityPricing: [
          { capacity: "3500 puffs", originalPrice: 1795, currentPrice: 1795 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Hart Vape Watermelon Ice 3500 puffs",
        description: "Hart Vape Watermelon Ice 3500 puffs",
        price: 1795,
        capacity: ["3500 puffs"],
        capacityPricing: [
          { capacity: "3500 puffs", originalPrice: 1795, currentPrice: 1795 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Hart Vape Grape Ice 3500 puffs",
        description: "Hart Vape Grape Ice 3500 puffs",
        price: 1795,
        capacity: ["3500 puffs"],
        capacityPricing: [
          { capacity: "3500 puffs", originalPrice: 1795, currentPrice: 1795 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Woosh Vape Ice Sparkling Orange",
        description: "Woosh Vape Ice Sparkling Orange",
        price: 2400,
        capacity: ["9000 Puffs"],
        capacityPricing: [
          { capacity: "9000 Puffs", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Woosh Vape Chizi Mint Vape",
        description: "Woosh Vape Chizi Mint Vape",
        price: 2400,
        capacity: ["9000 Puffs"],
        capacityPricing: [
          { capacity: "9000 Puffs", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "ZMR Absolute Sprite Vape",
        description: "ZMR Absolute Sprite Vape",
        price: 2400,
        capacity: ["15000 Puffs"],
        capacityPricing: [
          { capacity: "15000 Puffs", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "ZMR Miami Mint Vape",
        description: "ZMR Miami Mint Vape",
        price: 2400,
        capacity: ["15000 Puffs"],
        capacityPricing: [
          { capacity: "15000 Puffs", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "ZMR Iced Cola Vape",
        description: "ZMR Iced Cola Vape",
        price: 2400,
        capacity: ["15000 Puffs"],
        capacityPricing: [
          { capacity: "15000 Puffs", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Woosh Vape Pineapple Mango Mint Gold Puffs",
        description: "Woosh Vape Pineapple Mango Mint Gold Puffs",
        price: 2400,
        capacity: ["9000 Puffs"],
        capacityPricing: [
          { capacity: "9000 Puffs", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "ZMR Redbull Vape",
        description: "ZMR Redbull Vape",
        price: 2400,
        capacity: ["15000 Puffs"],
        capacityPricing: [
          { capacity: "15000 Puffs", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Woosh Vape Dawa Cocktail",
        description: "Woosh Vape Dawa Cocktail",
        price: 2400,
        capacity: ["9000 Puffs"],
        capacityPricing: [
          { capacity: "9000 Puffs", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "ZMR Hazelnut Cream Vape",
        description: "ZMR Hazelnut Cream Vape",
        price: 2400,
        capacity: ["15000 Puffs"],
        capacityPricing: [
          { capacity: "15000 Puffs", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Woosh Vape Strawberry Icecream",
        description: "Woosh Vape Strawberry Icecream",
        price: 2400,
        capacity: ["9000 Puffs"],
        capacityPricing: [
          { capacity: "9000 Puffs", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "ZMR Kiwano Melon Vape",
        description: "ZMR Kiwano Melon Vape",
        price: 2400,
        capacity: ["15000 Puffs"],
        capacityPricing: [
          { capacity: "15000 Puffs", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "ZMR Mango Royale Vape",
        description: "ZMR Mango Royale Vape",
        price: 2400,
        capacity: ["15000 Puffs"],
        capacityPricing: [
          { capacity: "15000 Puffs", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Woosh Vape Australian Mango",
        description: "Woosh Vape Australian Mango",
        price: 2095,
        capacity: ["3000 Puffs"],
        capacityPricing: [
          { capacity: "3000 Puffs", originalPrice: 2095, currentPrice: 2095 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "ZMR Fizzy Orange Vape",
        description: "ZMR Fizzy Orange Vape",
        price: 2400,
        capacity: ["15000 Puffs"],
        capacityPricing: [
          { capacity: "15000 Puffs", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Beast vapes Strawberry",
        description: "Beast vapes Strawberry",
        price: 1800,
        capacity: ["1500 Puffs"],
        capacityPricing: [
          { capacity: "1500 Puffs", originalPrice: 1800, currentPrice: 1800 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "ZMR Passion Fruit Vape",
        description: "ZMR Passion Fruit Vape",
        price: 2400,
        capacity: ["15000 Puffs"],
        capacityPricing: [
          { capacity: "15000 Puffs", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Woosh Vape Frost Apple",
        description: "Woosh Vape Frost Apple",
        price: 2400,
        capacity: ["9000 Puffs"],
        capacityPricing: [
          { capacity: "9000 Puffs", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Woosh Vape Sun Kissed Grape",
        description: "Woosh Vape Sun Kissed Grape",
        price: 2400,
        capacity: ["9000 Puffs"],
        capacityPricing: [
          { capacity: "9000 Puffs", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Refillable Gas Lighter",
        description: "Refillable Gas Lighter",
        price: 150,
        capacity: ["1 Piece"],
        capacityPricing: [
          { capacity: "1 Piece", originalPrice: 150, currentPrice: 150 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Yuoto Vape Passion Fruit",
        description: "Yuoto Vape Passion Fruit",
        price: 1295,
        capacity: ["2500 PUFFS"],
        capacityPricing: [
          { capacity: "2500 PUFFS", originalPrice: 1295, currentPrice: 1295 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "ZMR Grapefruit Vape",
        description: "ZMR Grapefruit Vape",
        price: 2400,
        capacity: ["15000 Puffs"],
        capacityPricing: [
          { capacity: "15000 Puffs", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Woosh Vape Kiwi Dragon Strawberry Blend",
        description: "Woosh Vape Kiwi Dragon Strawberry Blend",
        price: 2400,
        capacity: ["9000 Puffs"],
        capacityPricing: [
          { capacity: "9000 Puffs", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Woosh Vape Peach Mirage",
        description: "Woosh Vape Peach Mirage",
        price: 2400,
        capacity: ["9000 Puffs"],
        capacityPricing: [
          { capacity: "9000 Puffs", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Yuoto Thanos",
        description: "Yuoto Thanos (ABV 100%), China",
        price: 1900,
        capacity: ["5000 Puffs"],
        capacityPricing: [
          { capacity: "5000 Puffs", originalPrice: 1900, currentPrice: 1900 }
        ],
        abv: 100.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Elf Bar Vape",
        description: "Elf Bar Vape",
        price: 3195,
        capacity: ["1 Piece"],
        capacityPricing: [
          { capacity: "1 Piece", originalPrice: 3195, currentPrice: 3195 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Tugboat Mesh Coil Green Apple Ice",
        description: "Tugboat Mesh Coil Green Apple Ice",
        price: 2000,
        capacity: ["4500 puffs"],
        capacityPricing: [
          { capacity: "4500 puffs", originalPrice: 2300, currentPrice: 2000 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Beast Vape Cool Mint",
        description: "Beast Vape Cool Mint",
        price: 1800,
        capacity: ["1500 Puffs"],
        capacityPricing: [
          { capacity: "1500 Puffs", originalPrice: 1800, currentPrice: 1800 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Woosh Vape Chilly Lemon Soda",
        description: "Woosh Vape Chilly Lemon Soda",
        price: 2400,
        capacity: ["9000 Puffs"],
        capacityPricing: [
          { capacity: "9000 Puffs", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Woosh Vape Ice Watermelon Bliss",
        description: "Woosh Vape Ice Watermelon Bliss",
        price: 2095,
        capacity: ["3000 Puffs"],
        capacityPricing: [
          { capacity: "3000 Puffs", originalPrice: 2095, currentPrice: 2095 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Woosh Vape Caramel Hazelnut",
        description: "Woosh Vape Caramel Hazelnut",
        price: 2400,
        capacity: ["9000 Puffs"],
        capacityPricing: [
          { capacity: "9000 Puffs", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Solo X Grape Ice",
        description: "Solo X Grape Ice",
        price: 1800,
        capacity: ["1500 Puffs"],
        capacityPricing: [
          { capacity: "1500 Puffs", originalPrice: 1800, currentPrice: 1800 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Solo X Tropical",
        description: "Solo X Tropical",
        price: 1800,
        capacity: ["1500 Puffs"],
        capacityPricing: [
          { capacity: "1500 Puffs", originalPrice: 1800, currentPrice: 1800 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Woosh Fresh Lychee",
        description: "Woosh Fresh Lychee",
        price: 2400,
        capacity: ["9000 Puffs"],
        capacityPricing: [
          { capacity: "9000 Puffs", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Akso Strawberry Ice",
        description: "Akso Strawberry Ice",
        price: 1500,
        capacity: ["2600 puffs"],
        capacityPricing: [
          { capacity: "2600 puffs", originalPrice: 1500, currentPrice: 1500 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Yuoto Mint Ice",
        description: "Yuoto Mint Ice",
        price: 1295,
        capacity: ["2500 PUFFS"],
        capacityPricing: [
          { capacity: "2500 PUFFS", originalPrice: 1295, currentPrice: 1295 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Beast Vape Mango Ice",
        description: "Beast Vape Mango Ice",
        price: 1800,
        capacity: ["1500 Puffs"],
        capacityPricing: [
          { capacity: "1500 Puffs", originalPrice: 1800, currentPrice: 1800 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Vazo ice Mango Vape",
        description: "Vazo ice Mango Vape",
        price: 1900,
        capacity: ["5000 Puffs"],
        capacityPricing: [
          { capacity: "5000 Puffs", originalPrice: 1900, currentPrice: 1900 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Whisky Flask",
        description: "Whisky Flask",
        price: 1000,
        capacity: ["1 Piece"],
        capacityPricing: [
          { capacity: "1 Piece", originalPrice: 1000, currentPrice: 1000 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Vazo Ice Grape Vape",
        description: "Vazo Ice Grape Vape",
        price: 1800,
        capacity: ["5000 Puffs"],
        capacityPricing: [
          { capacity: "5000 Puffs", originalPrice: 1800, currentPrice: 1800 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Tugboat Vape Grape Ice",
        description: "Tugboat Vape Grape Ice",
        price: 2000,
        capacity: ["2500 PUFFS"],
        capacityPricing: [
          { capacity: "2500 PUFFS", originalPrice: 2000, currentPrice: 2000 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Vazo-Ice-Passion-Fruit",
        description: "Vazo-Ice-Passion-Fruit",
        price: 1800,
        capacity: ["5000 Puffs"],
        capacityPricing: [
          { capacity: "5000 Puffs", originalPrice: 1800, currentPrice: 1800 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Yuoto Blueberry Ice",
        description: "Yuoto Blueberry Ice",
        price: 0,
        capacity: ["2500 PUFFS"],
        capacityPricing: [
          { capacity: "2500 PUFFS", originalPrice: 0, currentPrice: 0 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Akso Grape Ice",
        description: "Akso Grape Ice",
        price: 1800,
        capacity: ["3500 puffs"],
        capacityPricing: [
          { capacity: "3500 puffs", originalPrice: 1800, currentPrice: 1800 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Vazo Pineapple Mint vape",
        description: "Vazo Pineapple Mint vape",
        price: 1800,
        capacity: ["5000 Puffs"],
        capacityPricing: [
          { capacity: "5000 Puffs", originalPrice: 1800, currentPrice: 1800 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Woosh Blue Razz",
        description: "Woosh Blue Razz",
        price: 2400,
        capacity: ["9000 Puffs"],
        capacityPricing: [
          { capacity: "9000 Puffs", originalPrice: 2400, currentPrice: 2400 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: true
      },
      {
        name: "Akso Mango Ice",
        description: "Akso Mango Ice",
        price: 1500,
        capacity: ["2600 puffs"],
        capacityPricing: [
          { capacity: "2600 puffs", originalPrice: 1500, currentPrice: 1500 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Irish Whiskey Chocolate",
        description: "Irish Whiskey Chocolate",
        price: 895,
        capacity: ["1 Piece"],
        capacityPricing: [
          { capacity: "1 Piece", originalPrice: 895, currentPrice: 895 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Tugboat Mesh Coil Red Energy",
        description: "Tugboat Mesh Coil Red Energy",
        price: 2000,
        capacity: ["4500 puffs"],
        capacityPricing: [
          { capacity: "4500 puffs", originalPrice: 2000, currentPrice: 2000 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Akso Energy Drink",
        description: "Akso Energy Drink",
        price: 1500,
        capacity: ["2600 puffs"],
        capacityPricing: [
          { capacity: "2600 puffs", originalPrice: 1500, currentPrice: 1500 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Akso Melon Ice",
        description: "Akso Melon Ice",
        price: 1800,
        capacity: ["3500 puffs"],
        capacityPricing: [
          { capacity: "3500 puffs", originalPrice: 1800, currentPrice: 1800 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Vazo Ice Super Mint",
        description: "Vazo Ice Super Mint",
        price: 1800,
        capacity: ["5000 Puffs"],
        capacityPricing: [
          { capacity: "5000 Puffs", originalPrice: 1800, currentPrice: 1800 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Beast Vape 3000 Puffs",
        description: "Beast Vape 3000 Puffs",
        price: 1900,
        capacity: ["1 Piece"],
        capacityPricing: [
          { capacity: "1 Piece", originalPrice: 2200, currentPrice: 1900 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Tugboat Mesh Coil Hawaiian Fruit",
        description: "Tugboat Mesh Coil Hawaiian Fruit",
        price: 2000,
        capacity: ["4500 puffs"],
        capacityPricing: [
          { capacity: "4500 puffs", originalPrice: 2300, currentPrice: 2000 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Akso Strawberry pitaya",
        description: "Akso Strawberry pitaya",
        price: 1500,
        capacity: ["2600 puffs"],
        capacityPricing: [
          { capacity: "2600 puffs", originalPrice: 1500, currentPrice: 1500 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Akso Aloe Grapes",
        description: "Akso Aloe Grapes",
        price: 2500,
        capacity: ["8000 puffs"],
        capacityPricing: [
          { capacity: "8000 puffs", originalPrice: 2500, currentPrice: 2500 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Akso Apple Ice",
        description: "Akso Apple Ice",
        price: 1500,
        capacity: ["2600 puffs"],
        capacityPricing: [
          { capacity: "2600 puffs", originalPrice: 1500, currentPrice: 1500 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      },
      {
        name: "Tugboat Mesh Coil Guava Blue Razz",
        description: "Tugboat Mesh Coil Guava Blue Razz",
        price: 2000,
        capacity: ["4500 puffs"],
        capacityPricing: [
          { capacity: "4500 puffs", originalPrice: 2300, currentPrice: 2000 }
        ],
        abv: 0.0,
        isPopular: false,
        isAvailable: false // Sold out on website
      }
    ];

    let addedCount = 0;
    let skippedCount = 0;

    for (const vape of vapeItems) {
      const existingDrink = await db.Drink.findOne({ 
        where: { name: vape.name, categoryId: vapeCategory.id } 
      });
      
      if (existingDrink) {
        console.log(`Skipping ${vape.name} - already exists`);
        skippedCount++;
        continue;
      }

      const drink = await db.Drink.create({
        name: vape.name,
        description: vape.description,
        price: vape.price.toString(),
        originalPrice: vape.price.toString(),
        categoryId: vapeCategory.id,
        subCategoryId: allVapesSubCategory.id,
        capacity: vape.capacity,
        capacityPricing: vape.capacityPricing,
        abv: vape.abv,
        isAvailable: vape.isAvailable,
        isPopular: vape.isPopular || false,
        isOnOffer: false,
        image: null
      });
      
      addedCount++;
      console.log(`Added vape: ${vape.name} - KES ${vape.price} (Available: ${vape.isAvailable})`);
    }

    console.log(`\nCompleted adding vape items:`);
    console.log(`- Added: ${addedCount}`);
    console.log(`- Skipped: ${skippedCount}`);
    console.log(`- Total processed: ${vapeItems.length}`);

  } catch (error) {
    console.error('Error adding vape items:', error);
  } finally {
    await db.sequelize.close();
  }
}

addVapeItems();

