const db = require('../models');

/**
 * Add missing major brands that appear in product names
 */

const missingBrands = [
  // Whisky/Whiskey
  { name: 'Jameson', country: 'Ireland' },
  { name: 'Jack Daniel\'s', country: 'USA' },
  { name: 'Johnnie Walker', country: 'Scotland' },
  { name: 'Glenfiddich', country: 'Scotland' },
  { name: 'Singleton', country: 'Scotland' },
  { name: 'Jim Beam', country: 'USA' },
  { name: 'Monkey Shoulder', country: 'Scotland' },
  { name: 'Black and White', country: 'Scotland' },
  { name: 'JnB', country: 'Scotland' },
  
  // Vodka
  { name: 'Absolut', country: 'Sweden' },
  { name: 'Smirnoff', country: 'Russia' },
  { name: 'Ciroc', country: 'France' },
  
  // Tequila
  { name: 'Don Julio', country: 'Mexico' },
  { name: 'Patron', country: 'Mexico' },
  { name: 'Jose Cuervo', country: 'Mexico' },
  { name: 'Olmeca', country: 'Mexico' },
  
  // Cognac/Brandy
  { name: 'Hennessy', country: 'France' },
  { name: 'Martell', country: 'France' },
  
  // Other popular brands from the site
  { name: 'The Guv\'nor', country: null },
  { name: 'Mucho Mas', country: 'Spain' },
  { name: 'Olepasu', country: 'Italy' },
  { name: 'Bitola', country: 'Portugal' },
  { name: 'Choco Toffee', country: 'Germany' },
  { name: 'Bianco Nobile', country: 'Germany' },
];

async function addMissingBrands() {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection established');

    const added = [];
    const existing = [];

    for (const brandData of missingBrands) {
      try {
        // Check if brand already exists
        const existingBrand = await db.Brand.findOne({
          where: { name: brandData.name.trim() }
        });

        if (!existingBrand) {
          const newBrand = await db.Brand.create({
            name: brandData.name.trim(),
            description: brandData.country ? `Country: ${brandData.country}` : null,
            isActive: true
          });
          added.push(newBrand);
          console.log(`✅ Added brand: ${brandData.name}`);
        } else {
          existing.push(existingBrand);
          console.log(`⏭️  Brand already exists: ${brandData.name}`);
        }
      } catch (error) {
        console.error(`❌ Error processing brand ${brandData.name}:`, error.message);
      }
    }

    console.log(`\n📊 Summary: Added ${added.length}, Already existed: ${existing.length}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding brands:', error);
    process.exit(1);
  } finally {
    await db.sequelize.close();
  }
}

addMissingBrands();

