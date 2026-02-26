/**
 * Script to generate slugs for all existing products
 * Run this after adding the slug column to the database
 */

const db = require('../models');
const { generateDrinkSlug } = require('../utils/slugGenerator');

async function generateSlugsForAllProducts() {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful\n');

    // Get all drinks without slugs or with null slugs
    const drinks = await db.Drink.findAll({
      where: {
        [db.Sequelize.Op.or]: [
          { slug: null },
          { slug: '' }
        ]
      },
      include: [{
        model: db.Brand,
        as: 'brand',
        required: false
      }],
      order: [['id', 'ASC']]
    });

    console.log(`📊 Found ${drinks.length} products without slugs\n`);

    let updated = 0;
    let errors = 0;

    for (const drink of drinks) {
      try {
        const slug = await generateDrinkSlug(drink, db.sequelize, drink.id);
        await drink.update({ slug });
        console.log(`✅ ID ${drink.id}: "${drink.name}" → slug: "${slug}"`);
        updated++;
      } catch (error) {
        console.error(`❌ Error generating slug for product ID ${drink.id} (${drink.name}):`, error.message);
        errors++;
      }
    }

    console.log(`\n✅ Successfully generated ${updated} slugs`);
    if (errors > 0) {
      console.log(`⚠️  ${errors} errors occurred`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

generateSlugsForAllProducts();
