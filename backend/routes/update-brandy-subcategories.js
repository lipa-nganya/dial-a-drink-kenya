const express = require('express');
const router = express.Router();
const { updateBrandySubcategories } = require('../scripts/update-brandy-subcategories');

// Update brandy subcategories
router.post('/', async (req, res) => {
  try {
    console.log('🍷 Starting brandy subcategory update via API...');
    await updateBrandySubcategories();
    res.json({ 
      success: true, 
      message: 'Brandy subcategories updated successfully' 
    });
  } catch (error) {
    console.error('Error updating brandy subcategories:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

