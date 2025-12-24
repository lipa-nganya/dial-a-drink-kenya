const express = require('express');
const router = express.Router();
const { assignBeerSubcategories } = require('../scripts/assign-beer-subcategories');

// Assign beers to subcategories
router.post('/', async (req, res) => {
  try {
    console.log('🍺 Starting beer subcategory assignment via API...');
    await assignBeerSubcategories();
    res.json({ 
      success: true, 
      message: 'Beer subcategories assigned successfully' 
    });
  } catch (error) {
    console.error('Error assigning beer subcategories:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

