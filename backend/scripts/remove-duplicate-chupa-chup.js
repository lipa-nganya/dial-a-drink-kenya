const db = require('../models');

async function run() {
  try {
    console.log('🔎 Finding duplicate "Chupa Chup Drinks" in Soft Drinks...');

    const category = await db.Category.findOne({ where: { name: 'Soft Drinks' } });
    if (!category) {
      console.log('❌ Soft Drinks category not found');
      process.exit(0);
    }

    const drinks = await db.Drink.findAll({
      where: { name: 'Chupa Chup Drinks', categoryId: category.id },
      order: [['id', 'ASC']],
    });

    if (drinks.length <= 1) {
      console.log('No duplicates found.');
      process.exit(0);
    }

    const keep = drinks[0];
    const toRemove = drinks.slice(1);

    for (const d of toRemove) {
      await d.destroy();
      console.log(`🗑️ Removed duplicate id=${d.id}`);
    }

    console.log(`✅ Kept id=${keep.id}. Removed ${toRemove.length} duplicate(s).`);
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  }
}

run();
