/**
 * Clean HTML from Drink Descriptions
 * 
 * Removes HTML tags and cleans up descriptions that contain HTML markup
 * (especially from Microsoft Word exports with MsoNormal classes)
 * 
 * Usage: node backend/scripts/clean-html-descriptions.js
 */

const db = require('../models');

// Simple HTML tag removal and text extraction
function cleanHtml(html) {
  if (!html || typeof html !== 'string') {
    return null;
  }

  // Remove HTML tags
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove styles
    .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
    .replace(/<[^>]+>/g, ' ') // Remove all HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&amp;/g, '&') // Decode &amp;
    .replace(/&lt;/g, '<') // Decode &lt;
    .replace(/&gt;/g, '>') // Decode &gt;
    .replace(/&quot;/g, '"') // Decode &quot;
    .replace(/&#39;/g, "'") // Decode &#39;
    .replace(/&apos;/g, "'") // Decode &apos;
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();

  // If result is empty or too short, return null
  if (!text || text.length < 10) {
    return null;
  }

  return text;
}

async function cleanDescriptions() {
  try {
    console.log('🔌 Connecting to database...');
    await db.sequelize.authenticate();
    console.log('✅ Database connection successful\n');

    // Find all drinks with HTML in description
    const drinks = await db.Drink.findAll({
      where: {
        description: {
          [db.Sequelize.Op.like]: '%<%'
        }
      },
      attributes: ['id', 'name', 'description']
    });

    console.log(`📋 Found ${drinks.length} drinks with HTML in description\n`);

    if (drinks.length === 0) {
      console.log('✅ No HTML found in descriptions. Nothing to clean.');
      return;
    }

    console.log('🧹 Cleaning descriptions...\n');

    let cleaned = 0;
    let setToNull = 0;
    let errors = 0;

    for (let i = 0; i < drinks.length; i++) {
      const drink = drinks[i];
      try {
        const cleanedDescription = cleanHtml(drink.description);

        if (cleanedDescription) {
          await db.Drink.update(
            { description: cleanedDescription },
            { where: { id: drink.id } }
          );
          cleaned++;
          
          if ((i + 1) % 100 === 0) {
            console.log(`   Processed ${i + 1}/${drinks.length} drinks...`);
          }
        } else {
          // Description was empty or too short after cleaning, set to null
          await db.Drink.update(
            { description: null },
            { where: { id: drink.id } }
          );
          setToNull++;
        }
      } catch (error) {
        console.error(`   ❌ Error cleaning drink "${drink.name}" (ID: ${drink.id}):`, error.message);
        errors++;
      }
    }

    console.log('\n✅ Cleaning complete!\n');
    console.log('📊 Summary:');
    console.log(`   ✅ Cleaned: ${cleaned} descriptions`);
    console.log(`   🗑️  Set to null: ${setToNull} descriptions (too short/empty after cleaning)`);
    console.log(`   ❌ Errors: ${errors}\n`);

    // Show a sample of cleaned descriptions
    const sample = await db.Drink.findAll({
      where: {
        description: {
          [db.Sequelize.Op.ne]: null,
          [db.Sequelize.Op.notLike]: '%<%'
        }
      },
      attributes: ['id', 'name', 'description'],
      limit: 3
    });

    if (sample.length > 0) {
      console.log('📝 Sample cleaned descriptions:');
      sample.forEach(d => {
        const preview = d.description.length > 100 
          ? d.description.substring(0, 100) + '...' 
          : d.description;
        console.log(`   "${d.name}": ${preview}\n`);
      });
    }

  } catch (error) {
    console.error('❌ Error cleaning descriptions:', error);
    process.exit(1);
  } finally {
    await db.sequelize.close();
  }
}

// Run the script
cleanDescriptions();
