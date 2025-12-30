const db = require('../models');

// Brands data from https://www.dialadrinkkenya.com/mybrands
const brandsData = [
  // Gin Brands
  { name: 'Tanqueray Gin', country: 'United Kingdom' },
  { name: 'Drumshanbo', country: null },
  { name: 'Stretton-gin', country: null },
  { name: 'Hendricks Gin', country: null },
  { name: 'Gilbey\'s Gin', country: null },
  { name: 'Beefeater Gin', country: null },
  { name: 'Bombay-Sapphire-Gin', country: null },
  { name: 'Kenyan-Originals', country: 'Kenya' },
  { name: 'Gordon\'s Gin', country: 'London' },
  { name: 'Gibson\'s', country: null },
  { name: 'Bulldog-Gin', country: null },
  { name: 'Aviation Gin', country: 'Portland' },
  { name: 'Black Forest Distillery', country: null },
  { name: 'Whitley-Neil-Gin', country: null },
  { name: 'Hayman\'s', country: null },
  { name: 'Seagram\'s', country: null },
  { name: 'Antidote', country: 'France' },
  { name: 'Bloedlemoen', country: null },
  { name: 'Brooklyn-Gin', country: null },
  { name: 'Larios Gin', country: null },
  { name: 'Colombian Aged', country: null },
  { name: 'Citrum-Gin', country: null },
  { name: 'Malfy Gin', country: 'Italy' },
  { name: 'Gin Society Gin', country: 'South Africa' },
  { name: 'Finery Gin', country: null },
  { name: 'D\'Argent', country: null },
  { name: 'Stirling', country: null },
  { name: 'Musgrave', country: null },
  { name: 'Greenall\'s', country: null },
  { name: 'Brockmans Gin', country: null },
  { name: 'Bobby\'s Gin', country: null },
  { name: 'Bloom Gin', country: null },
  { name: 'Levantine', country: null },
  { name: 'Wilderer Gin', country: null },
  { name: 'Botanist-Islay-Gin', country: null },
  { name: 'Jaisalmer', country: null },
  { name: 'Inverroche Gin', country: 'South African' },
  { name: 'Kensington', country: null },
  { name: 'Ginebra San Miguel', country: null },
  { name: 'Agnes Arber', country: 'England' },
  { name: 'Broker\'s Gin', country: 'England' },
  { name: 'Opihr', country: null },
  { name: 'MG-Distilleries', country: null },
  { name: 'Four Pillars', country: 'Australia' },
  { name: 'Beam-Suntory', country: null },
  { name: 'Botanic/Cubical gin', country: null },
  { name: 'Sakurao', country: 'Japan' },
  { name: 'Mermaid gin', country: null },
  { name: 'Gin-Mare', country: null },
  { name: 'Berkeley Square Gin', country: null },
  { name: 'Six Dogs', country: 'South Africa' },
  { name: 'Nginious', country: 'Switzerland' },
  { name: 'Sharish', country: null },
  
  // Smokes Brands
  { name: 'Sweet Menthol', country: null },
  { name: 'Embassy', country: null },
  { name: 'Sportsman', country: null },
  { name: 'Classic Raw Rolling', country: null },
  { name: 'Dunhill', country: null },
  { name: 'Marlboro', country: 'USA' },
  { name: 'Vazo Zippo Vapes', country: null },
  { name: 'Villiger Cigars', country: null },
  { name: 'Organic Hemp Rolling Paper', country: null },
  { name: 'Nicotine-Pouches', country: 'Kenya' },
  { name: 'Bongani Cigars', country: null },
  { name: 'Sky-Nicotine-Pouches', country: 'Poland' },
  { name: 'Solo-X', country: null },
  { name: 'Kafie Cigars', country: 'Honduras' },
  { name: 'Montecristo Cigars', country: null },
  { name: 'Hart-Vape', country: null },
  
  // Rum Brands
  { name: 'Captain Morgan', country: null },
  { name: 'Old Monk', country: null },
  { name: 'Malibu', country: null },
  { name: 'Bumbu rum', country: null },
  { name: 'Bacardi Rum', country: null },
  { name: 'Myer\'s', country: null },
  { name: 'Don papa Rum', country: null },
  { name: 'Ron Zacapa', country: null },
  { name: 'Spytail', country: null },
  { name: 'Mount Gay Rum', country: null },
  { name: 'Diplomatico', country: null },
  { name: 'Bayou', country: null },
  { name: 'New Grove', country: null },
  { name: 'Contessa', country: null },
  { name: 'Bacardi Breezers', country: null },
  { name: 'Afri Bull', country: 'India' },
  { name: 'Tanduay', country: null },
  
  // Champagne Brands
  { name: 'Moët & Chandon Champagne', country: null },
  { name: 'Dom Pérignon Champagne', country: null },
  { name: 'Belaire Champagne Price in Kenya', country: null },
  { name: 'Veuve Clicquot', country: null },
  { name: 'Laurent Perrier', country: null },
  { name: 'Perrier Jouet', country: null },
  { name: 'GH-Mumm', country: null },
  { name: 'Arthur Metz Crémant', country: 'France' },
  { name: 'Taittinger Champagne', country: 'France' },
  { name: 'Perle Noir', country: 'France' },
  
  // Vapes Brands
  { name: 'Refillable Gas Lighter', country: null },
  { name: 'Irish Whiskey Chocolate', country: null },
  { name: 'Woosh Vapes', country: 'China' },
  { name: 'Beast-Vapes', country: 'Kenya' },
  { name: 'Tugboat vape pens', country: null },
  { name: 'AKSO VAPES', country: 'Malasyia' },
  { name: 'ZMR-Vapes', country: null },
  { name: 'Hart-Vape', country: 'China' },
  
  // Mixer spirit Brands
  { name: 'Red Bull GmbH', country: null }
];

async function importBrands() {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection established');

    const addedBrands = [];
    const existingBrands = [];
    const errors = [];

    for (const brandData of brandsData) {
      try {
        // Check if brand already exists
        const existing = await db.Brand.findOne({
          where: { name: brandData.name.trim() }
        });

        if (!existing) {
          // Create new brand
          const newBrand = await db.Brand.create({
            name: brandData.name.trim(),
            description: brandData.country ? `Country: ${brandData.country}` : null,
            isActive: true
          });
          addedBrands.push(newBrand);
          console.log(`✅ Added brand: ${brandData.name}`);
        } else {
          existingBrands.push(existing);
          console.log(`⏭️  Brand already exists: ${brandData.name}`);
        }
      } catch (error) {
        console.error(`❌ Error processing brand ${brandData.name}:`, error.message);
        errors.push({ brand: brandData.name, error: error.message });
      }
    }

    console.log('\n📊 Import Summary:');
    console.log(`✅ Added: ${addedBrands.length} brands`);
    console.log(`⏭️  Already existed: ${existingBrands.length} brands`);
    console.log(`❌ Errors: ${errors.length} brands`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(e => console.log(`  - ${e.brand}: ${e.error}`));
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await db.sequelize.close();
  }
}

// Run import
importBrands();

