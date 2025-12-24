const express = require('express');
const router = express.Router();
const { updateSoftDrinksSubcategories } = require('../scripts/update-soft-drinks-subcategories');

// Update soft drinks subcategories
router.post('/', async (req, res) => {
  try {
    console.log('🥤 Starting soft drinks subcategory update via API...');
    await updateSoftDrinksSubcategories();
    res.json({ 
      success: true, 
      message: 'Soft drinks subcategories updated successfully' 
    });
  } catch (error) {
    console.error('Error updating soft drinks subcategories:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

