const express = require('express');
const router = express.Router();
const db = require('../models');
const { verifyAdmin, enforceAdminAccessPaywall } = require('./admin');

// Run slug migrations (admin only)
router.post('/run-slug-migrations', verifyAdmin, enforceAdminAccessPaywall, async (req, res) => {
  try {
    console.log('🚀 Running slug migrations...');
    
    // Check and add slug column to drinks table
    console.log('📝 Checking drinks table...');
    const [drinksCheck] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'drinks' 
      AND column_name = 'slug'
    `);
    
    const results = {
      drinks: { alreadyExists: false, added: false },
      categories: { alreadyExists: false, added: false }
    };
    
    if (drinksCheck.length === 0) {
      console.log('   Adding slug column to drinks table...');
      await db.sequelize.query(`
        ALTER TABLE drinks 
        ADD COLUMN slug VARCHAR(255)
      `);
      await db.sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS drinks_slug_idx ON drinks(slug)
      `);
      results.drinks.added = true;
      console.log('   ✅ Added slug column to drinks table');
    } else {
      results.drinks.alreadyExists = true;
      console.log('   ⚠️  Column slug already exists in drinks table');
    }

    // Check and add slug column to categories table
    console.log('📝 Checking categories table...');
    const [categoriesCheck] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'categories' 
      AND column_name = 'slug'
    `);
    
    if (categoriesCheck.length === 0) {
      console.log('   Adding slug column to categories table...');
      await db.sequelize.query(`
        ALTER TABLE categories 
        ADD COLUMN slug VARCHAR(255)
      `);
      await db.sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_idx ON categories(slug)
      `);
      results.categories.added = true;
      console.log('   ✅ Added slug column to categories table');
    } else {
      results.categories.alreadyExists = true;
      console.log('   ⚠️  Column slug already exists in categories table');
    }

    console.log('✅ All migrations completed');
    res.json({ 
      success: true, 
      message: 'Migrations completed successfully',
      results 
    });
  } catch (error) {
    console.error('❌ Migration error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Migration failed',
      message: error.message 
    });
  }
});

module.exports = router;
