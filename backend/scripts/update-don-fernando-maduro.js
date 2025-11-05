const db = require('../models');

async function run() {
  try {
    console.log("Updating Don Fernando Maduro image...");
    const drink = await db.Drink.findOne({ where: { name: 'Don Fernando Maduro' } });
    if (!drink) {
      console.log("Not found: Don Fernando Maduro");
      process.exit(0);
    }
    await drink.update({ image: '/images/don-fernando-maduro-correct.webp' });
    console.log("✅ Updated: Don Fernando Maduro -> /images/don-fernando-maduro-correct.webp");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();
