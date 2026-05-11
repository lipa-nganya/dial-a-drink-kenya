const express = require('express');
const router = express.Router();
const db = require('../models');

const CATEGORIES_CACHE_TTL_MS = 5 * 60 * 1000;
let categoriesCache = {
  data: null,
  expiresAt: 0,
  inFlight: null
};

const setPublicCategoriesCacheHeaders = (res) => {
  res.set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
};

const categoryOrder = [
  'Whisky',
  'Vodka',
  'Wine',
  'Champagne',
  'Brandy',
  'Cognac',
  'Beer',
  'Tequila',
  'Rum',
  'Gin',
  'Liqueur',
  'Soft Drinks',
  'Smokes'
];

async function loadActiveCategories() {
  try {
    return await db.Category.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'description', 'image', 'isActive', 'createdAt', 'updatedAt', 'slug']
    });
  } catch (error) {
    if (error.message && error.message.includes('column') && error.message.includes('slug')) {
      console.log('⚠️  slug column not found, querying without it...');
      return db.Category.findAll({
        where: { isActive: true },
        attributes: ['id', 'name', 'description', 'image', 'isActive', 'createdAt', 'updatedAt']
      });
    }
    throw error;
  }
}

async function loadCategoryDrinkSummaries(categoryIds) {
  if (!categoryIds.length) {
    return { countByCategoryId: new Map(), imageByCategoryId: new Map() };
  }

  const countRows = await db.Drink.findAll({
    where: { categoryId: { [db.Sequelize.Op.in]: categoryIds } },
    attributes: [
      'categoryId',
      [db.Sequelize.fn('COUNT', db.Sequelize.col('id')), 'drinksCount']
    ],
    group: ['categoryId'],
    raw: true
  });

  const imageRows = await db.sequelize.query(
    `
      WITH ranked_drinks AS (
        SELECT
          "categoryId",
          image,
          ROW_NUMBER() OVER (
            PARTITION BY "categoryId"
            ORDER BY
              CASE
                WHEN image LIKE '/images/%' THEN 0
                WHEN image IS NOT NULL AND image <> '' THEN 1
                ELSE 2
              END,
              id ASC
          ) AS rn
        FROM drinks
        WHERE "categoryId" IN (:categoryIds)
      )
      SELECT "categoryId", image
      FROM ranked_drinks
      WHERE rn = 1
    `,
    {
      replacements: { categoryIds },
      type: db.Sequelize.QueryTypes.SELECT
    }
  );

  return {
    countByCategoryId: new Map(
      countRows.map((row) => [
        Number(row.categoryId ?? row.categoryid),
        Number(row.drinksCount ?? row.drinkscount) || 0
      ])
    ),
    imageByCategoryId: new Map(
      imageRows.map((row) => [Number(row.categoryId ?? row.categoryid), row.image || null])
    )
  };
}

// Get all categories
router.get('/', async (req, res) => {
  setPublicCategoriesCacheHeaders(res);

  const now = Date.now();
  if (categoriesCache.data && categoriesCache.expiresAt > now) {
    return res.json(categoriesCache.data);
  }

  if (categoriesCache.inFlight) {
    try {
      const data = await categoriesCache.inFlight;
      return res.json(data);
    } catch {
      // Fall through and run a fresh query
    }
  }

  categoriesCache.inFlight = (async () => {
    try {
      const categories = await loadActiveCategories();
      const categoryIds = categories.map((category) => category.id);
      const { countByCategoryId, imageByCategoryId } = await loadCategoryDrinkSummaries(categoryIds);

      const categoriesWithData = categories.map((category) => {
        const categoryJson = typeof category.toJSON === 'function' ? category.toJSON() : category;
        return {
          id: categoryJson.id,
          name: categoryJson.name,
          description: categoryJson.description,
          isActive: categoryJson.isActive,
          createdAt: categoryJson.createdAt,
          updatedAt: categoryJson.updatedAt,
          slug: categoryJson.slug,
          image: imageByCategoryId.get(Number(categoryJson.id)) || null,
          drinksCount: countByCategoryId.get(Number(categoryJson.id)) || 0
        };
      });

      // Sort categories according to the defined order
      const sortedCategories = categoriesWithData.sort((a, b) => {
        const indexA = categoryOrder.indexOf(a.name);
        const indexB = categoryOrder.indexOf(b.name);

        // If both categories are in the order list, sort by their position
        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }

        // If only one is in the order list, prioritize it
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;

        // If neither is in the order list, sort alphabetically
        return a.name.localeCompare(b.name);
      });

      categoriesCache.data = sortedCategories;
      categoriesCache.expiresAt = Date.now() + CATEGORIES_CACHE_TTL_MS;
      return sortedCategories;
    } catch (error) {
      console.error('❌ Error fetching categories:', error);
      console.error('Error stack:', error.stack);
      console.error('Error name:', error.name);
      console.error('Error code:', error.code);
      // Check if it's a database connection error
      if (error.name === 'SequelizeConnectionError' || error.name === 'SequelizeConnectionRefusedError' || error.code === 'ECONNREFUSED') {
        const err = new Error('Database connection failed');
        err.statusCode = 503;
        err.payload = {
          error: 'Database connection failed',
          message: 'Unable to connect to database. Please try again in a moment.'
        };
        throw err;
      } else {
        const err = new Error('Failed to fetch categories');
        err.statusCode = 500;
        err.payload = {
          error: 'Failed to fetch categories',
          message: error.message || 'Database query failed. Please try again in a moment.',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        };
        throw err;
      }
    }
  })();

  try {
    const data = await categoriesCache.inFlight;
    res.json(data);
  } catch (err) {
    categoriesCache.data = null;
    categoriesCache.expiresAt = 0;
    res.set('Cache-Control', 'no-store');
    res.status(err.statusCode || 500).json(err.payload || { error: 'Failed to fetch categories' });
  } finally {
    categoriesCache.inFlight = null;
  }
});

// Create new category
router.post('/', async (req, res) => {
  try {
    const { name, description, isActive } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const normalizedName = String(name).trim();

    const existingCategory = await db.Category.findOne({
      where: { name: normalizedName }
    });

    if (existingCategory) {
      return res.status(400).json({ error: 'Category with this name already exists' });
    }

    const category = await db.Category.create({
      name: normalizedName,
      description: description || null,
      isActive: isActive !== undefined ? isActive : true
    });

    invalidateCategoriesCache();

    return res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    return res.status(500).json({ error: 'Failed to create category' });
  }
});

// Invalidate categories cache whenever categories are mutated.
const invalidateCategoriesCache = () => {
  categoriesCache.data = null;
  categoriesCache.expiresAt = 0;
};

// Add new categories (admin endpoint)
router.post('/add-all', async (req, res) => {
  try {
    const categories = [
      'Whisky',
      'Vodka', 
      'Wine',
      'Champagne',
      'Vapes',
      'Brandy',
      'Cognac',
      'Beer',
      'Tequila',
      'Rum',
      'Gin',
      'Liqueur',
      'Soft Drinks',
      'Smokes'
    ];

    const addedCategories = [];
    const existingCategories = [];

    for (const categoryName of categories) {
      // Check if category already exists
      const existing = await db.Category.findOne({
        where: { name: categoryName }
      });

      if (!existing) {
        // Insert new category
        const newCategory = await db.Category.create({
          name: categoryName
        });
        addedCategories.push(newCategory);
        console.log(`✅ Added category: ${categoryName}`);
      } else {
        existingCategories.push(existing);
        console.log(`⏭️  Category already exists: ${categoryName}`);
      }
    }

    invalidateCategoriesCache();
    
    res.json({ 
      message: 'Categories processed successfully',
      added: addedCategories,
      existing: existingCategories
    });
  } catch (error) {
    console.error('Error adding categories:', error);
    res.status(500).json({ error: 'Failed to add categories' });
  }
});

// Delete a category by ID (admin endpoint)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the category
    const category = await db.Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check for associated drinks
    const drinksCount = await db.Drink.count({ where: { categoryId: id } });
    if (drinksCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete category. It has ${drinksCount} associated drinks. Please remove the drinks first.` 
      });
    }

    // Check for associated subcategories
    const subcategoriesCount = await db.SubCategory.count({ where: { categoryId: id } });
    if (subcategoriesCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete category. It has ${subcategoriesCount} associated subcategories. Please remove the subcategories first.` 
      });
    }

    // Delete the category
    await category.destroy();
    invalidateCategoriesCache();
    
    res.json({ 
      message: `Category "${category.name}" deleted successfully`,
      deletedCategory: category
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;