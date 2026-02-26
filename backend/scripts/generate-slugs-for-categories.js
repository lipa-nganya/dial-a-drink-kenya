/**
 * Script to generate slugs for all existing categories
 * Run this after adding the slug column to the database
 */

const db = require('../models');
const { generateCategorySlug } = require('../utils/slugGenerator');

async function generateSlugsForAllCategories() {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful\n');

    // Get all categories without slugs or with null slugs
    const categories = await db.Category.findAll({
      where: {
        [db.Sequelize.Op.or]: [
          { slug: null },
          { slug: '' }
        ]
      },
      order: [['id', 'ASC']]
    });

    console.log(`📊 Found ${categories.length} categories without slugs\n`);

    let updated = 0;
    let errors = 0;

    for (const category of categories) {
      try {
        const slug = await generateCategorySlug(category, db.sequelize, category.id);
        await category.update({ slug });
        console.log(`✅ ID ${category.id}: "${category.name}" → slug: "${slug}"`);
        updated++;
      } catch (error) {
        console.error(`❌ Error generating slug for category ID ${category.id} (${category.name}):`, error.message);
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

generateSlugsForAllCategories();
