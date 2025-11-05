const db = require('../models');

async function addMissingTequilaItems() {
  try {
    console.log('Adding missing tequila items from Dial a Drink Kenya website...');

    const tequilaCategory = await db.Category.findOne({ where: { name: 'Tequila' } });
    if (!tequilaCategory) {
      console.error('Tequila category not found!');
      return;
    }
    console.log('Tequila category found:', tequilaCategory.name);

    // Create subcategory for tequila
    const [tequilaSubCategory] = await db.SubCategory.findOrCreate({
      where: { name: 'All Tequila', categoryId: tequilaCategory.id },
      defaults: { description: 'All types of tequila', categoryId: tequilaCategory.id }
    });
    console.log('Tequila subcategory found/created:', tequilaSubCategory.name);

    const tequilaProducts = [
      // Gold Tequilas
      {
        name: "Olmeca Gold",
        description: "Olmeca Gold (ABV 38%), Mexico",
        price: 3400,
        capacity: ["750ml", "1 Litre"],
        capacityPricing: [
          { capacity: "750ml", originalPrice: 3400, currentPrice: 3400 },
          { capacity: "1 Litre", originalPrice: 4200, currentPrice: 4200 }
        ],
        abv: 38.0,
        isAvailable: true
      },
      {
        name: "Jose Cuervo Gold",
        description: "Jose Cuervo Gold (ABV 40%), Mexico",
        price: 2895,
        capacity: ["750ml", "1 Litre"],
        capacityPricing: [
          { capacity: "750ml", originalPrice: 2895, currentPrice: 2895 },
          { capacity: "1 Litre", originalPrice: 3400, currentPrice: 3400 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Pepe Lopez Gold Tequila",
        description: "Pepe Lopez Gold Tequila (ABV 40%), Mexico",
        price: 3400,
        capacity: ["1 Litre"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 3400, currentPrice: 3400 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Azul Gold Tequila",
        description: "Azul Gold Tequila (ABV 40%), Mexico",
        price: 120499,
        capacity: ["700ml"],
        capacityPricing: [
          { capacity: "700ml", originalPrice: 120499, currentPrice: 120499 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "El Charro Gold",
        description: "El Charro Gold (ABV 40%), Mexico",
        price: 2999,
        capacity: ["750ml"],
        capacityPricing: [
          { capacity: "750ml", originalPrice: 2999, currentPrice: 2999 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Tequila Sauza Gold",
        description: "Tequila Sauza Gold (ABV 40%), Mexico",
        price: 4500,
        capacity: ["750ml", "1 Litre"],
        capacityPricing: [
          { capacity: "750ml", originalPrice: 4500, currentPrice: 4500 },
          { capacity: "1 Litre", originalPrice: 5500, currentPrice: 5500 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Sierra Gold",
        description: "Sierra Gold (ABV 38%), Mexico",
        price: 3200,
        capacity: ["1 Litre"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 3200, currentPrice: 3200 }
        ],
        abv: 38.0,
        isAvailable: true
      },
      {
        name: "Camino Gold",
        description: "Camino Gold (ABV 40%), Mexico",
        price: 2599,
        capacity: ["750ml"],
        capacityPricing: [
          { capacity: "750ml", originalPrice: 2599, currentPrice: 2599 }
        ],
        abv: 40.0,
        isAvailable: true
      },

      // Silver Tequilas
      {
        name: "Olmeca Silver",
        description: "Olmeca Silver (ABV 40%), Mexico",
        price: 3400,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 3400, currentPrice: 3400 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Jose Cuervo Silver",
        description: "Jose Cuervo Silver (ABV 40%), Mexico",
        price: 2995,
        capacity: ["750ML", "1 Litre"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2995, currentPrice: 2995 },
          { capacity: "1 Litre", originalPrice: 3195, currentPrice: 3195 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Patron Silver Tequila",
        description: "Patron Silver Tequila (ABV 40%), Mexico",
        price: 6795,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 6795, currentPrice: 6795 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "T1 Tequila Blanco",
        description: "T1 Tequila Blanco (ABV 40%), Mexico",
        price: 7499,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 7499, currentPrice: 7499 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Tequila 1800 Silver",
        description: "Tequila 1800 Silver (ABV 40%), Mexico",
        price: 6500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 6500, currentPrice: 6500 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Teremana Blanco Tequila",
        description: "Teremana Blanco Tequila (ABV 40%), Mexico",
        price: 15499,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 15499, currentPrice: 15499 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "KAH Blanco",
        description: "KAH Blanco (ABV 40%), Mexico",
        price: 7699,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 7699, currentPrice: 7699 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Camino Tequila Silver",
        description: "Camino Tequila Silver (ABV 40%), Mexico",
        price: 2799,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2799, currentPrice: 2799 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Clase Azul Plata Tequila",
        description: "Clase Azul Plata Tequila (ABV 40%), Mexico",
        price: 40499,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 40499, currentPrice: 40499 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Olmeca Tezon Blanco",
        description: "Olmeca Tezon Blanco (ABV 38%), Mexico",
        price: 9999,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 9999, currentPrice: 9999 }
        ],
        abv: 38.0,
        isAvailable: true
      },
      {
        name: "Curado Blanco Cupreata",
        description: "Curado Blanco Cupreata (ABV 40%), Mexico",
        price: 8500,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 8500, currentPrice: 8500 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Agavita Blanco",
        description: "Agavita Blanco (ABV 40%), Mexico",
        price: 6999,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 6999, currentPrice: 6999 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Patron Roca Silver",
        description: "Patron Roca Silver (ABV 45%), Mexico",
        price: 10499,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 10499, currentPrice: 10499 }
        ],
        abv: 45.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Sauza Tequila Silver",
        description: "Sauza Tequila Silver (ABV 40%), Mexico",
        price: 4500,
        capacity: ["750ML", "1 Litre"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 4500, currentPrice: 4500 },
          { capacity: "1 Litre", originalPrice: 5500, currentPrice: 5500 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Herradura Plata Tequila",
        description: "Herradura Plata Tequila (ABV 40%), Mexico",
        price: 10499,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 10499, currentPrice: 10499 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Sierra Silver",
        description: "Sierra Silver (ABV 38%), Mexico",
        price: 2199,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2199, currentPrice: 2199 }
        ],
        abv: 38.0,
        isAvailable: true
      },
      {
        name: "Tequila Cenote Blanco",
        description: "Tequila Cenote Blanco (ABV 40%), Mexico",
        price: 7600,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 7600, currentPrice: 7600 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Ponchos Blanco",
        description: "Ponchos Blanco (ABV 40%), Mexico",
        price: 4500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 4500, currentPrice: 4500 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "El Charro Silver",
        description: "El Charro Silver (ABV 40%), Mexico",
        price: 2999,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 2999, currentPrice: 2999 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Curado Blanco Cocido",
        description: "Curado Blanco Cocido (ABV 40%), Mexico",
        price: 8500,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 8500, currentPrice: 8500 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Corralejo Tequila Blanco",
        description: "Corralejo Tequila Blanco (ABV 38%), Mexico",
        price: 5499,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 5499, currentPrice: 5499 }
        ],
        abv: 38.0,
        isAvailable: true
      },
      {
        name: "Curado Espadin",
        description: "Curado Espadin (ABV 40%), Mexico",
        price: 8500,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 8500, currentPrice: 8500 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Lamborghini Blanco",
        description: "Lamborghini Blanco (ABV 40%), Mexico",
        price: 36500,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 36500, currentPrice: 36500 }
        ],
        abv: 40.0,
        isAvailable: true
      },

      // Reposado Tequilas
      {
        name: "Patron Reposado",
        description: "Patron Reposado (ABV 40%), Mexico",
        price: 9500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 9500, currentPrice: 9500 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Tequila 1800 Reposado",
        description: "Tequila 1800 Reposado (ABV 38%), Mexico",
        price: 6300,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 6300, currentPrice: 6300 }
        ],
        abv: 38.0,
        isAvailable: true
      },
      {
        name: "La Tilica Reposado",
        description: "La Tilica Reposado (ABV 40%), Mexico",
        price: 6799,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 6799, currentPrice: 6799 }
        ],
        abv: 40.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Patron Reposado 45%",
        description: "Patron Reposado (ABV 45%), Mexico",
        price: 10499,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 10499, currentPrice: 10499 }
        ],
        abv: 45.0,
        isAvailable: true
      },
      {
        name: "Azul Reposado Tequila",
        description: "Azul Reposado Tequila (ABV 40%), Mexico",
        price: 42000,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 42000, currentPrice: 42000 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Herradura Reposado Tequila",
        description: "Herradura Reposado Tequila (ABV 40%), Mexico",
        price: 10499,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 10499, currentPrice: 10499 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Casamigos Reposado",
        description: "Casamigos Reposado (ABV 40%), Mexico",
        price: 7800,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 7800, currentPrice: 7800 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Corralejo Tequila Reposado",
        description: "Corralejo Tequila Reposado (ABV 38%), Mexico",
        price: 5899,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 5899, currentPrice: 5899 }
        ],
        abv: 38.0,
        isAvailable: true
      },
      {
        name: "Kah Reposado",
        description: "Kah Reposado (ABV 40%), Mexico",
        price: 6799,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 6799, currentPrice: 6799 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "T1 Reposado",
        description: "T1 Reposado (ABV 40%), Mexico",
        price: 7499,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 7499, currentPrice: 7499 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Don Julio Reposado",
        description: "Don Julio Reposado (ABV 38%), Mexico",
        price: 8195,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 8195, currentPrice: 8195 }
        ],
        abv: 38.0,
        isAvailable: true
      },

      // Anejo Tequilas
      {
        name: "Teremana Anejo Tequila",
        description: "Teremana Anejo Tequila (ABV 40%), Mexico",
        price: 20499,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 20499, currentPrice: 20499 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Herradura Anejo Tequila",
        description: "Herradura Anejo Tequila (ABV 40%), Mexico",
        price: 12499,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 12499, currentPrice: 12499 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "El Jimador Anejo Tequila",
        description: "El Jimador Anejo Tequila (ABV 38%), Mexico",
        price: 5999,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 5999, currentPrice: 5999 }
        ],
        abv: 38.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Olmeca Anejo Extra Aged",
        description: "Olmeca Anejo Extra Aged (ABV 38%), Mexico",
        price: 5499,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 5499, currentPrice: 5499 }
        ],
        abv: 38.0,
        isAvailable: true
      },
      {
        name: "Agavita Anejo",
        description: "Agavita Anejo (ABV 40%), Mexico",
        price: 9999,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 9999, currentPrice: 9999 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Corralejo Tequila Anejo",
        description: "Corralejo Tequila Anejo (ABV 38%), Mexico",
        price: 8499,
        capacity: ["1 Litre"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 8499, currentPrice: 8499 }
        ],
        abv: 38.0,
        isAvailable: true
      },
      {
        name: "Kah Anejo",
        description: "Kah Anejo (ABV 40%), Mexico",
        price: 10499,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 10499, currentPrice: 10499 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "La Tilica Anejo",
        description: "La Tilica Anejo (ABV 40%), Mexico",
        price: 7699,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 7699, currentPrice: 7699 }
        ],
        abv: 40.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Tequila 1800 Anejo",
        description: "Tequila 1800 Anejo (ABV 38%), Mexico",
        price: 6400,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 6400, currentPrice: 6400 }
        ],
        abv: 38.0,
        isAvailable: true
      },
      {
        name: "Don Julio Anejo",
        description: "Don Julio Anejo (ABV 38%), Mexico",
        price: 9200,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 9200, currentPrice: 9200 }
        ],
        abv: 38.0,
        isAvailable: true
      },
      {
        name: "Lamborghini Anejo Tequila",
        description: "Lamborghini Anejo Tequila (ABV 40%), Mexico",
        price: 36500,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 36500, currentPrice: 36500 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Casamigos Anejo Tequila",
        description: "Casamigos Anejo Tequila (ABV 40%), Mexico",
        price: 7800,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 7800, currentPrice: 7800 }
        ],
        abv: 40.0,
        isAvailable: true
      },

      // Premium Tequilas
      {
        name: "Don Julio Blanco",
        description: "Don Julio Blanco (ABV 38%), Mexico",
        price: 7600,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 7600, currentPrice: 7600 }
        ],
        abv: 38.0,
        isAvailable: true
      },
      {
        name: "Don Julio Double Cask Lagavulin Finish",
        description: "Don Julio Double Cask Lagavulin Finish (ABV 40%), Mexico",
        price: 45999,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 45999, currentPrice: 45999 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Don Julio 70",
        description: "Don Julio 70 (ABV 40%), Mexico",
        price: 26000,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 26000, currentPrice: 26000 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Don Julio 1942",
        description: "Don Julio 1942 (ABV 38%), Mexico",
        price: 28500,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 28500, currentPrice: 28500 }
        ],
        abv: 38.0,
        isAvailable: true
      },
      {
        name: "Jose Cuervo Reserva De La Familia Platino",
        description: "Jose Cuervo Reserva De La Familia Platino (ABV 40%), Mexico",
        price: 15999,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 15999, currentPrice: 15999 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Jose Cuervo Reserva De La Familia Extra Anejo",
        description: "Jose Cuervo Reserva De La Familia Extra Anejo (ABV 40%), Mexico",
        price: 20999,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 20999, currentPrice: 20999 }
        ],
        abv: 40.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Gran Patron Burdeos",
        description: "Gran Patron Burdeos (ABV 40%), Mexico",
        price: 106999,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 106999, currentPrice: 106999 }
        ],
        abv: 40.0,
        isAvailable: true
      },

      // Flavored Tequilas
      {
        name: "Patron Xo Cafe Dark Cocoa",
        description: "Patron Xo Cafe Dark Cocoa (ABV 30%), Mexico",
        price: 5999,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 5999, currentPrice: 5999 }
        ],
        abv: 30.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Ponchos Chilli Choc (liqueur)",
        description: "Ponchos Chilli Choc (liqueur) (ABV 35%), Mexico",
        price: 4500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 4500, currentPrice: 4500 }
        ],
        abv: 35.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Tequila 1800 Coconut",
        description: "Tequila 1800 Coconut (ABV 35%), Mexico",
        price: 6499,
        capacity: ["1 Litre"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 6499, currentPrice: 6499 }
        ],
        abv: 35.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Patron Citronge Mango Liqueur",
        description: "Patron Citronge Mango Liqueur (ABV 35%), Mexico",
        price: 6499,
        capacity: ["1 Litre"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 6499, currentPrice: 6499 }
        ],
        abv: 35.0,
        isAvailable: true
      },
      {
        name: "Patron Citronge Orange Liqueur",
        description: "Patron Citronge Orange Liqueur (ABV 35%), Mexico",
        price: 6499,
        capacity: ["1 Litre"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 6499, currentPrice: 6499 }
        ],
        abv: 35.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Tequila Rose",
        description: "Tequila Rose (ABV 15%), Mexico",
        price: 3600,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3600, currentPrice: 3600 }
        ],
        abv: 15.0,
        isAvailable: true
      },
      {
        name: "Olmeca Dark Chocolate",
        description: "Olmeca Dark Chocolate (ABV 20%), Mexico",
        price: 3195,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3195, currentPrice: 3195 }
        ],
        abv: 20.0,
        isAvailable: true
      },
      {
        name: "Olmeca Fusion",
        description: "Olmeca Fusion (ABV 20%), Mexico",
        price: 4499,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 4499, currentPrice: 4499 }
        ],
        abv: 20.0,
        isAvailable: true
      },
      {
        name: "Olmeca Extra Aged",
        description: "Olmeca Extra Aged (ABV 40%), Mexico",
        price: 5499,
        capacity: ["1 Litre"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 5499, currentPrice: 5499 }
        ],
        abv: 40.0,
        isAvailable: true
      },
      {
        name: "Tijuana Sweet Heat",
        description: "Tijuana Sweet Heat (ABV 35%), Mexico",
        price: 3999,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3999, currentPrice: 3999 }
        ],
        abv: 35.0,
        isAvailable: true
      },
      {
        name: "Ponchos Caramel Infusion (liqueur)",
        description: "Ponchos Caramel Infusion (liqueur) (ABV 35%), Mexico",
        price: 4500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 4500, currentPrice: 4500 }
        ],
        abv: 35.0,
        isAvailable: false // Sold out on website
      },

      // Mezcal Tequilas
      {
        name: "Casamigos Mezcal",
        description: "Casamigos Mezcal (ABV 40%), Mexico",
        price: 15000,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 15000, currentPrice: 15000 }
        ],
        abv: 40.0,
        isAvailable: true
      },

      // Other Tequilas
      {
        name: "Montezuma Aztec Tequila",
        description: "Montezuma Aztec Tequila (ABV 38%), Mexico",
        price: 4499,
        capacity: ["1 Litre"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 4499, currentPrice: 4499 }
        ],
        abv: 38.0,
        isAvailable: true
      },
      {
        name: "Sierra Margarita",
        description: "Sierra Margarita (ABV 4.9%), Mexico",
        price: 3999,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3999, currentPrice: 3999 }
        ],
        abv: 4.9,
        isAvailable: true
      },
      {
        name: "Milagro Silver",
        description: "Milagro Silver (ABV 40%), Mexico",
        price: 6499,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 6499, currentPrice: 6499 }
        ],
        abv: 40.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Sierra Antiguo Anejo Tequila",
        description: "Sierra Antiguo Anejo Tequila (ABV 40%), Mexico",
        price: 4599,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 4599, currentPrice: 4599 }
        ],
        abv: 40.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Espolon Blanco Tequila",
        description: "Espolon Blanco Tequila (ABV 40%), Mexico",
        price: 4699,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 4699, currentPrice: 4699 }
        ],
        abv: 40.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Espolon Reposado Tequila",
        description: "Espolon Reposado Tequila (ABV 40%), Mexico",
        price: 3300,
        capacity: ["750ml"],
        capacityPricing: [
          { capacity: "750ml", originalPrice: 3300, currentPrice: 3300 }
        ],
        abv: 40.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Patron XO Cafe",
        description: "Patron XO Cafe (ABV 40%), Mexico",
        price: 5800,
        capacity: ["750ml"],
        capacityPricing: [
          { capacity: "750ml", originalPrice: 5800, currentPrice: 5800 }
        ],
        abv: 40.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Patron Anejo Tequila",
        description: "Patron Anejo Tequila (ABV 40%), Mexico",
        price: 11500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 11500, currentPrice: 11500 }
        ],
        abv: 40.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Tequila Ley 925",
        description: "Tequila Ley 925 (ABV 40%), Mexico",
        price: 4500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 4500, currentPrice: 4500 }
        ],
        abv: 40.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "Milagro Anejo",
        description: "Milagro Anejo (ABV 40%), Mexico",
        price: 6499,
        capacity: ["700ML"],
        capacityPricing: [
          { capacity: "700ML", originalPrice: 6499, currentPrice: 6499 }
        ],
        abv: 40.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "El Jimador Reposado Tequila",
        description: "El Jimador Reposado Tequila (ABV 40%), Mexico",
        price: 4499,
        capacity: ["1 Litre"],
        capacityPricing: [
          { capacity: "1 Litre", originalPrice: 4499, currentPrice: 4499 }
        ],
        abv: 40.0,
        isAvailable: false // Sold out on website
      },
      {
        name: "El Jimador Blanco Tequila",
        description: "El Jimador Blanco Tequila (ABV 38%), Mexico",
        price: 3999,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3999, currentPrice: 3999 }
        ],
        abv: 38.0,
        isAvailable: false // Sold out on website
      },

      // Additional items
      {
        name: "JP Chenet French Brandy XO",
        description: "JP Chenet French Brandy XO (ABV 36%), France",
        price: 3500,
        capacity: ["750ML"],
        capacityPricing: [
          { capacity: "750ML", originalPrice: 3500, currentPrice: 3500 }
        ],
        abv: 36.0,
        isAvailable: true
      }
    ];

    let addedCount = 0;
    let skippedCount = 0;

    for (const product of tequilaProducts) {
      const existingDrink = await db.Drink.findOne({ 
        where: { 
          name: product.name, 
          categoryId: tequilaCategory.id 
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
        categoryId: tequilaCategory.id,
        subCategoryId: tequilaSubCategory.id,
        capacity: product.capacity,
        capacityPricing: product.capacityPricing,
        abv: product.abv,
        isAvailable: product.isAvailable,
        isPopular: product.isPopular || false,
        isOnOffer: false,
        image: null
      });
      
      console.log(`Added tequila: ${drink.name} - KES ${drink.price} (Available: ${drink.isAvailable})`);
      addedCount++;
    }

    console.log(`\nCompleted adding tequila items:\n- Added: ${addedCount}\n- Skipped: ${skippedCount}\n- Total processed: ${tequilaProducts.length}`);

  } catch (error) {
    console.error('Error adding tequila items:', error);
  } finally {
    await db.sequelize.close();
  }
}

addMissingTequilaItems();

