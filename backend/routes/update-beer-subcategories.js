const express = require('express');
const router = express.Router();
const { updateBeerSubcategories } = require('../scripts/update-beer-subcategories');

// Update beer subcategories
router.post('/', async (req, res) => {
  try {
    console.log('🍺 Starting beer subcategory update via API...');
    await updateBeerSubcategories();
    res.json({ 
      success: true, 
      message: 'Beer subcategories updated successfully' 
    });
  } catch (error) {
    console.error('Error updating beer subcategories:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

