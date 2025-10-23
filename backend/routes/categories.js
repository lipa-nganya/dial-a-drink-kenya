const express = require('express');
const router = express.Router();
const db = require('../models');

// Get all categories
router.get('/', async (req, res) => {
  try {
    const categories = await db.Category.findAll({
      where: { isActive: true },
      include: [{
        model: db.Drink,
        as: 'drinks',
        where: { isAvailable: true },
        required: false
      }],
      order: [['name', 'ASC']]
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get category by ID
router.get('/:id', async (req, res) => {
  try {
    const category = await db.Category.findByPk(req.params.id, {
      include: [{
        model: db.Drink,
        as: 'drinks',
        where: { isAvailable: true },
        required: false
      }]
    });
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
