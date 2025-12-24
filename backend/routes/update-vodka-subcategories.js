const express = require('express');
const router = express.Router();
const { updateVodkaSubcategories } = require('../scripts/update-vodka-subcategories');

// Update vodka subcategories
router.post('/', async (req, res) => {
  try {
    console.log('🍸 Starting vodka subcategory update via API...');
    await updateVodkaSubcategories();
    res.json({ 
      success: true, 
      message: 'Vodka subcategories updated successfully' 
    });
  } catch (error) {
    console.error('Error updating vodka subcategories:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

