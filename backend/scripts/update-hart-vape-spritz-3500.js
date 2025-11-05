const db = require('../models');

async function run() {
  try {
    console.log("Updating Hart Vape Spritz 3500 image...");
    const drink = await db.Drink.findOne({ where: { name: 'Hart Vape Spritz 3500' } });
    if (!drink) {
      console.log("Not found: Hart Vape Spritz 3500");
      process.exit(0);
    }
    await drink.update({ image: '/images/hart-vape-spritz-3500-correct.webp' });
    console.log("✅ Updated: Hart Vape Spritz 3500 -> /images/hart-vape-spritz-3500-correct.webp");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();
