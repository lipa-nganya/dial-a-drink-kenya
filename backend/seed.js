const db = require('./models');

const seedData = async () => {
  try {
    // Create categories
    const categories = await db.Category.bulkCreate([
      {
        name: 'Soft Drinks',
        description: 'Refreshing non-alcoholic beverages',
        image: 'https://via.placeholder.com/300x200/FF6B6B/FFFFFF?text=Soft+Drinks'
      },
      {
        name: 'Alcoholic Drinks',
        description: 'Premium alcoholic beverages',
        image: 'https://via.placeholder.com/300x200/4ECDC4/FFFFFF?text=Alcoholic+Drinks'
      },
      {
        name: 'Hot Beverages',
        description: 'Warm and comforting drinks',
        image: 'https://via.placeholder.com/300x200/45B7D1/FFFFFF?text=Hot+Beverages'
      },
      {
        name: 'Fresh Juices',
        description: 'Freshly squeezed fruit juices',
        image: 'https://via.placeholder.com/300x200/96CEB4/FFFFFF?text=Fresh+Juices'
      }
    ]);

    // Create drinks
    await db.Drink.bulkCreate([
      // Soft Drinks
      {
        name: 'Coca Cola',
        description: 'Classic Coca Cola soft drink',
        price: 50.00,
        image: 'https://via.placeholder.com/200x200/FF6B6B/FFFFFF?text=Coca+Cola',
        categoryId: categories[0].id,
        isPopular: true
      },
      {
        name: 'Sprite',
        description: 'Lemon-lime flavored soft drink',
        price: 50.00,
        image: 'https://via.placeholder.com/200x200/4ECDC4/FFFFFF?text=Sprite',
        categoryId: categories[0].id
      },
      {
        name: 'Fanta Orange',
        description: 'Orange flavored soft drink',
        price: 50.00,
        image: 'https://via.placeholder.com/200x200/45B7D1/FFFFFF?text=Fanta',
        categoryId: categories[0].id
      },
      {
        name: 'Mountain Dew',
        description: 'Citrus flavored soft drink',
        price: 60.00,
        image: 'https://via.placeholder.com/200x200/96CEB4/FFFFFF?text=Mountain+Dew',
        categoryId: categories[0].id
      },

      // Alcoholic Drinks
      {
        name: 'Tusker Lager',
        description: 'Premium Kenyan lager beer',
        price: 120.00,
        image: 'https://via.placeholder.com/200x200/FF6B6B/FFFFFF?text=Tusker',
        categoryId: categories[1].id,
        isPopular: true
      },
      {
        name: 'White Cap Lager',
        description: 'Smooth and refreshing lager',
        price: 110.00,
        image: 'https://via.placeholder.com/200x200/4ECDC4/FFFFFF?text=White+Cap',
        categoryId: categories[1].id
      },
      {
        name: 'Smirnoff Vodka',
        description: 'Premium vodka, 50ml',
        price: 200.00,
        image: 'https://via.placeholder.com/200x200/45B7D1/FFFFFF?text=Smirnoff',
        categoryId: categories[1].id
      },
      {
        name: 'Johnnie Walker Red',
        description: 'Premium scotch whisky, 50ml',
        price: 300.00,
        image: 'https://via.placeholder.com/200x200/96CEB4/FFFFFF?text=Johnnie+Walker',
        categoryId: categories[1].id
      },

      // Hot Beverages
      {
        name: 'Kenyan Tea',
        description: 'Traditional Kenyan black tea',
        price: 30.00,
        image: 'https://via.placeholder.com/200x200/FF6B6B/FFFFFF?text=Kenyan+Tea',
        categoryId: categories[2].id,
        isPopular: true
      },
      {
        name: 'Coffee',
        description: 'Freshly brewed coffee',
        price: 40.00,
        image: 'https://via.placeholder.com/200x200/4ECDC4/FFFFFF?text=Coffee',
        categoryId: categories[2].id
      },
      {
        name: 'Hot Chocolate',
        description: 'Rich and creamy hot chocolate',
        price: 60.00,
        image: 'https://via.placeholder.com/200x200/45B7D1/FFFFFF?text=Hot+Chocolate',
        categoryId: categories[2].id
      },

      // Fresh Juices
      {
        name: 'Orange Juice',
        description: 'Freshly squeezed orange juice',
        price: 80.00,
        image: 'https://via.placeholder.com/200x200/FF6B6B/FFFFFF?text=Orange+Juice',
        categoryId: categories[3].id,
        isPopular: true
      },
      {
        name: 'Mango Juice',
        description: 'Fresh mango juice',
        price: 90.00,
        image: 'https://via.placeholder.com/200x200/4ECDC4/FFFFFF?text=Mango+Juice',
        categoryId: categories[3].id
      },
      {
        name: 'Passion Fruit Juice',
        description: 'Tropical passion fruit juice',
        price: 85.00,
        image: 'https://via.placeholder.com/200x200/45B7D1/FFFFFF?text=Passion+Juice',
        categoryId: categories[3].id
      },
      {
        name: 'Pineapple Juice',
        description: 'Fresh pineapple juice',
        price: 85.00,
        image: 'https://via.placeholder.com/200x200/96CEB4/FFFFFF?text=Pineapple+Juice',
        categoryId: categories[3].id
      }
    ]);

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
};

module.exports = seedData;

