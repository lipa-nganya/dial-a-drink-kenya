const express = require('express');
const router = express.Router();
const db = require('../models');

// Get all categories
router.get('/', async (req, res) => {
  try {
    const categories = await db.Category.findAll({
      order: [['name', 'ASC']]
    });

    // Get counts and first image for each category
    const categoriesWithData = await Promise.all(
      categories.map(async (category) => {
        const drinksCount = await db.Drink.count({
          where: { categoryId: category.id }
        });

        // Get the first drink's image if available
        // Prioritize backend images (/images/) over Cloudinary URLs for reliability
        let firstDrink = await db.Drink.findOne({
          where: { 
            categoryId: category.id,
            [db.Sequelize.Op.and]: [
              { image: { [db.Sequelize.Op.ne]: null } },
              { image: { [db.Sequelize.Op.ne]: '' } },
              { image: { [db.Sequelize.Op.like]: '/images/%' } } // Prefer backend images
            ]
          },
          attributes: ['image'],
          order: [['id', 'ASC']]
        });
        
        // Fallback to any drink with an image (including Cloudinary URLs)
        if (!firstDrink) {
          firstDrink = await db.Drink.findOne({
            where: { 
              categoryId: category.id,
              [db.Sequelize.Op.and]: [
                { image: { [db.Sequelize.Op.ne]: null } },
                { image: { [db.Sequelize.Op.ne]: '' } }
              ]
            },
            attributes: ['image'],
            order: [['id', 'ASC']]
          });
        }
        
        // Final fallback to any drink if no drink with image found
        if (!firstDrink) {
          firstDrink = await db.Drink.findOne({
            where: { categoryId: category.id },
            attributes: ['image'],
            order: [['id', 'ASC']]
          });
        }

        return {
          id: category.id,
          name: category.name,
          description: category.description,
          isActive: category.isActive,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
          image: firstDrink?.image || null,
          drinksCount: drinksCount
        };
      })
    );

    res.json(categoriesWithData);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

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