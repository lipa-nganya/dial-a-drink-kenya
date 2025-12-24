const express = require('express');
const router = express.Router();
const db = require('../models');
const { syncSubcategories } = require('../scripts/sync-subcategories-from-website');

// Get all subcategories
router.get('/', async (req, res) => {
  try {
    const { categoryId } = req.query;
    let whereClause = { isActive: true };
    
    if (categoryId) {
      whereClause.categoryId = categoryId;
    }
    
    const subcategories = await db.SubCategory.findAll({
      where: whereClause,
      include: [
        {
          model: db.Category,
          as: 'category'
        },
        {
          model: db.Drink,
          as: 'drinks',
          required: false,
          attributes: ['id']
        }
      ]
    });
    
    // Sort by drinks count (descending), then by name (ascending)
    // Subcategories with 0 items will be at the end
    const sortedSubcategories = subcategories.sort((a, b) => {
      const aCount = a.drinks ? a.drinks.length : 0;
      const bCount = b.drinks ? b.drinks.length : 0;
      
      // First sort by count (descending)
      if (bCount !== aCount) {
        return bCount - aCount;
      }
      
      // If counts are equal, sort by name (ascending)
      return a.name.localeCompare(b.name);
    });
    
    res.json(sortedSubcategories);
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get subcategories by category
router.get('/category/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    const subcategories = await db.SubCategory.findAll({
      where: { 
        categoryId: categoryId,
        isActive: true 
      },
      include: [
        {
          model: db.Category,
          as: 'category'
        },
        {
          model: db.Drink,
          as: 'drinks',
          required: false,
          attributes: ['id']
        }
      ]
    });
    
    // Sort by drinks count (descending), then by name (ascending)
    // Subcategories with 0 items will be at the end
    const sortedSubcategories = subcategories.sort((a, b) => {
      const aCount = a.drinks ? a.drinks.length : 0;
      const bCount = b.drinks ? b.drinks.length : 0;
      
      // First sort by count (descending)
      if (bCount !== aCount) {
        return bCount - aCount;
      }
      
      // If counts are equal, sort by name (ascending)
      return a.name.localeCompare(b.name);
    });
    
    res.json(sortedSubcategories);
  } catch (error) {
    console.error('Error fetching subcategories by category:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create subcategory
router.post('/', async (req, res) => {
  try {
    const { name, categoryId } = req.body;
    
    if (!name || !categoryId) {
      return res.status(400).json({ error: 'Name and categoryId are required' });
    }
    
    const subcategory = await db.SubCategory.create({
      name,
      categoryId
    });
    
    res.status(201).json(subcategory);
  } catch (error) {
    console.error('Error creating subcategory:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update subcategory
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, isActive } = req.body;
    
    const subcategory = await db.SubCategory.findByPk(id);
    if (!subcategory) {
      return res.status(404).json({ error: 'SubCategory not found' });
    }
    
    if (name !== undefined) subcategory.name = name;
    if (isActive !== undefined) subcategory.isActive = isActive;
    
    await subcategory.save();
    res.json(subcategory);
  } catch (error) {
    console.error('Error updating subcategory:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete subcategory
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const subcategory = await db.SubCategory.findByPk(id);
    if (!subcategory) {
      return res.status(404).json({ error: 'SubCategory not found' });
    }
    
    await subcategory.destroy();
    res.json({ message: 'SubCategory deleted successfully' });
  } catch (error) {
    console.error('Error deleting subcategory:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync subcategories from website
router.post('/sync', async (req, res) => {
  try {
    console.log('🔄 Starting subcategory sync from website...');
    await syncSubcategories();
    res.json({ 
      success: true, 
      message: 'Subcategories synced successfully' 
    });
  } catch (error) {
    console.error('Error syncing subcategories:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
