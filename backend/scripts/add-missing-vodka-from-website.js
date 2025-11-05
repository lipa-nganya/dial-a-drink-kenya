const db = require('../models');

async function addMissingVodkaItems() {
  try {
    console.log('Adding missing vodka items from Dial a Drink Kenya website...\n');
    await db.sequelize.authenticate();
    console.log('Database connected\n');

    const vodkaCategory = await db.Category.findOne({ where: { name: 'Vodka' } });
    if (!vodkaCategory) {
      console.error('Vodka category not found!');
      return;
    }

    const [vodkaSubCategory] = await db.SubCategory.findOrCreate({
      where: { name: 'All Vodka', categoryId: vodkaCategory.id },
      defaults: { description: 'All types of vodka', categoryId: vodkaCategory.id }
    });

    // Items from the website that need to be added
    const missingItems = [
      { name: 'Belvedere Lake Bartezek', price: 6800, capacity: '1 Litre', abv: 40, description: 'Belvedere Lake Bartezek (ABV 40%), Poland' },
      { name: 'Grey Goose Vx', price: 16000, capacity: '1 Litre', abv: 40, description: 'Grey Goose Vx (ABV 40%), France' },
      { name: 'Bufalov French Wheat Sugar Free Vodka', price: 3500, capacity: '1 Litre', abv: 40, description: 'Bufalov French Wheat Sugar Free Vodka (ABV 40%), France' },
      { name: 'Belvedere Heritage 176', price: 6500, capacity: '1 Litre', abv: 40, description: 'Belvedere Heritage 176 (ABV 40%), Poland' },
      { name: 'Danzka Vodka', price: 2700, capacity: '750ml', abv: 40, description: 'Danzka Vodka (ABV 40%), Denmark' },
      { name: 'Belvedere Smogory Forest', price: 6800, capacity: '1 Litre', abv: 40, description: 'Belvedere Smogory Forest (ABV 40%), Poland' },
      { name: 'Jumping Goat Vodka Liqueur', price: 4000, capacity: '700ML', abv: 33, description: 'Jumping Goat Vodka Liqueur (ABV 33%), New Zealand' },
      { name: 'Bols Vodka', price: 1900, capacity: '700ML', abv: 37.5, description: 'Bols Vodka (ABV 37.5%), The Netherlands' },
      { name: 'Magic Moments Raspberry', price: 1595, capacity: '750ML.', abv: 37.5, description: 'Magic Moments Raspberry (ABV 37.5%), India' },
      { name: 'Magic Moments Lemon', price: 1595, capacity: '750ML.', abv: 37.5, description: 'Magic Moments Lemon (ABV 37.5%), India' },
      { name: 'Magic Moments Lemon & ginger', price: 1595, capacity: '750ML.', abv: 37.5, description: 'Magic Moments Lemon & ginger (ABV 37.5%), India' },
      { name: 'Magic Moments Green Apple', price: 1595, capacity: '750ML.', abv: 37.5, description: 'Magic Moments Green Apple (ABV 37.5%), India' },
      { name: 'Everclear 190 Proof', price: 5500, capacity: '1 Litre', abv: 95, description: 'Everclear 190 Proof (ABV 95%), United States' },
      { name: 'Sadko Vodka', price: 1800, capacity: '750ml', abv: 43, description: 'Sadko Vodka (ABV 43%), South Africa' },
      { name: 'Magic Moments Original', price: 1595, capacity: '750ML.', abv: 42.8, description: 'Magic Moments Original (ABV 42.8%), India' },
      { name: 'Kenya Cane Smooth', price: 1200, capacity: '750ML.', abv: 40, description: 'Kenya Cane Smooth (ABV 40%), Kenya' },
      { name: 'Smirnoff Blue Label', price: 2800, capacity: '1 Litre', abv: 50, description: 'Smirnoff Blue Label (ABV 50%), Russia' },
      { name: 'Caribia Cane', price: 1500, capacity: '750ML.', abv: 37.5, description: 'Caribia Cane (ABV 37.5%), Kenya' },
      { name: 'Spirytus Vodka', price: 3500, capacity: '750ML.', abv: 96, description: 'Spirytus Vodka (ABV 96%), Poland' },
      { name: 'Hlibny Dar Vodka', price: 2100, capacity: '1 Litre', abv: 40, description: 'Hlibny Dar Vodka (ABV 40%), Ukraine' },
      { name: 'Absolute Oak', price: 4550, capacity: '1 Litre', abv: 40, description: 'Absolute Oak (ABV 40%), Sweden' },
      { name: 'Beluga Transatlantic Racing', price: 6899, capacity: '700ML', abv: 40, description: 'Beluga Transatlantic Racing (ABV 40%), Russia' },
      { name: 'Absolut Elyx', price: 6200, capacity: '1 Litre', abv: 42.3, description: 'Absolut Elyx (ABV 42.3%), Sweden' },
      { name: 'Crystal Head Vodka Year Of The dragon', price: 0, capacity: null, abv: 40, description: 'Crystal Head Vodka Year Of The dragon (ABV 40%), Canada' },
      { name: 'Ciroc Pineapple', price: 5200, capacity: '750ML.', abv: 40, description: 'Ciroc Pineapple (ABV 40%), Ciroc' },
      { name: 'Billionaire Vodka', price: 0, capacity: '5 Litres', abv: 40, description: 'Billionaire Vodka (ABV 40%), Russia', priceUsd: 4 },
      { name: 'Absolute Apeach', price: 2600, capacity: '750ML.', abv: 40, description: 'Absolute Apeach (ABV 40%), Sweden' },
      { name: 'Absolute Pepper', price: 3500, capacity: '1 Litre', abv: 40, description: 'Absolute Pepper (ABV 40%), Sweden' },
      { name: 'Absolute Unique', price: 3500, capacity: '1 Litre', abv: 40, description: 'Absolute Unique (ABV 40%), Sweden' },
      { name: 'Rada Premium Vodka', price: 2495, capacity: '700ML', abv: 40, description: 'Rada Premium Vodka (ABV 40%), Ukraine' },
      { name: 'Absolute mango', price: 2400, capacity: '750ML.', abv: 40, description: 'Absolute mango (ABV 40%), Sweden' },
      { name: 'Beluga Noble Vodka', price: 6000, capacity: '750ml', abv: 40, description: 'Beluga Noble Vodka (ABV 40%), Russia' },
      { name: 'Crystal Head Aurora Vodka', price: 0, capacity: null, abv: 40, description: 'Crystal Head Aurora Vodka (ABV 40%), Canada' },
      { name: 'Belvedere Bloody Mary 70cl', price: 0, capacity: '70cl', abv: 40, description: 'Belvedere Bloody Mary 70cl (ABV 40%), Poland' },
      { name: 'Smirnoff Gold', price: 2500, capacity: '750ML.', abv: 37.5, description: 'Smirnoff Gold (ABV 37.5%), Russia' },
      { name: 'Danzka Citrus Vodka', price: 2700, capacity: '750ml', abv: 40, description: 'Danzka Citrus Vodka (ABV 40%), Denmark' },
      { name: 'Beluga Gold', price: 15500, capacity: '1 Litre', abv: 40, description: 'Beluga Gold (ABV 40%), Russia' },
      { name: 'Crystal Head Onyx Vodka', price: 0, capacity: null, abv: 40, description: 'Crystal Head Onyx Vodka (ABV 40%), Canada' },
      { name: 'Crystal Head Pride Vodka', price: 0, capacity: null, abv: 40, description: 'Crystal Head Pride Vodka (ABV 40%), Canada' },
      { name: 'Beluga Noble Silver', price: 8999, capacity: '1 Litre', abv: 40, description: 'Beluga Noble Silver (ABV 40%), Russia' },
      { name: 'Crystal Head Vodka Jeroboam', price: 6200, capacity: '700ML', abv: 40, description: 'Crystal Head Vodka Jeroboam (ABV 40%), Canada' },
      { name: 'Ciroc Vodka Summer Watermelon', price: 5200, capacity: '700ML', abv: 37.5, description: 'Ciroc Vodka Summer Watermelon (ABV 37.5%), France' },
      { name: 'Beluga Celebration', price: 8999, capacity: '1 Litre', abv: 40, description: 'Beluga Celebration (ABV 40%), Russia' },
      { name: 'Absolute Pears', price: 3500, capacity: '1 Litre', abv: 40, description: 'Absolute Pears (ABV 40%), Sweden' },
      { name: 'Leleshwa Vodka', price: 1800, capacity: '750ML.', abv: 36, description: 'Leleshwa Vodka (ABV 36%), Kenya' },
      { name: 'Skyy 90', price: 5300, capacity: '750ML.', abv: 40, description: 'Skyy 90 (ABV 40%), America' },
      { name: 'Crystal Head Bone Edition', price: 0, capacity: null, abv: 40, description: 'Crystal Head Bone Edition (ABV 40%), Canada' },
      { name: 'Smirnoff Vodka Red', price: 1500, capacity: '500ml', abv: 35, description: 'Smirnoff Vodka Red (ABV 35%), Russia' },
      { name: 'Crystal Head Alexander Series', price: 0, capacity: null, abv: 40, description: 'Crystal Head Alexander Series (ABV 40%), Canada' },
      { name: 'Crystal Head Pride Edition', price: 0, capacity: null, abv: 40, description: 'Crystal Head Pride Edition (ABV 40%), Canada' },
      { name: 'Ciroc Vodka 1.75Litres', price: 4700, capacity: '1.5 Litres', abv: 40, description: 'Ciroc Vodka 1.75Litres (ABV 40%), France' },
      { name: 'Celsius Vodka', price: 0, capacity: null, abv: null, description: 'Celsius Vodka' },
      { name: 'Belvedere Citron', price: 4800, capacity: '1 Litre', abv: 40, description: 'Belvedere Citron (ABV 40%), Poland' },
      { name: 'Smirnoff Espresso', price: 2500, capacity: '750ML.', abv: 40, description: 'Smirnoff Espresso (ABV 40%), Russia' },
      { name: 'Magic Moments Chocolate', price: 1395, capacity: '750ML.', abv: 37.5, description: 'Magic Moments Chocolate (ABV 37.5%), India' },
      { name: 'Red Army Vodka', price: 28000, capacity: '1 Litre', abv: 40, description: 'Red Army Vodka (ABV 40%), Poland' },
      { name: 'KGB vodka', price: 1750, capacity: '750ML.', abv: 37.5, description: 'KGB vodka (ABV 37.5%), Mauritius' }
    ];

    let addedCount = 0;
    let skippedCount = 0;

    for (const product of missingItems) {
      // Check if item already exists
      const existingDrink = await db.Drink.findOne({
        where: {
          name: product.name,
          categoryId: vodkaCategory.id
        }
      });

      if (existingDrink) {
        console.log(`⏭️  Skipping ${product.name} - already exists`);
        skippedCount++;
        continue;
      }

      // Create the drink
      const drink = await db.Drink.create({
        name: product.name,
        description: product.description,
        price: product.price.toString(),
        originalPrice: product.price.toString(),
        categoryId: vodkaCategory.id,
        subCategoryId: vodkaSubCategory.id,
        capacity: product.capacity,
        capacityPricing: product.capacity ? [{ capacity: product.capacity, originalPrice: product.price, currentPrice: product.price }] : null,
        abv: product.abv,
        isAvailable: product.price > 0,
        isPopular: false,
        isOnOffer: false,
        image: null
      });

      console.log(`✅ Added: ${drink.name} - KES ${drink.price} (Available: ${drink.isAvailable})`);
      addedCount++;
    }

    console.log(`\n✅ Completed adding missing vodka items!`);
    console.log(`- Added: ${addedCount}`);
    console.log(`- Skipped: ${skippedCount}`);
    console.log(`- Total processed: ${missingItems.length}`);

  } catch (error) {
    console.error('Error adding missing vodka items:', error);
  } finally {
    await db.sequelize.close();
  }
}

addMissingVodkaItems()
  .then(() => {
    console.log('\nScript completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

