const express = require('express');
const router = express.Router();
const { updateChampagneSubcategories } = require('../scripts/update-champagne-subcategories');

// Update champagne subcategories
router.post('/', async (req, res) => {
  try {
    console.log('🍾 Starting champagne subcategory update via API...');
    await updateChampagneSubcategories();
    res.json({ 
      success: true, 
      message: 'Champagne subcategories updated successfully' 
    });
  } catch (error) {
    console.error('Error updating champagne subcategories:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

