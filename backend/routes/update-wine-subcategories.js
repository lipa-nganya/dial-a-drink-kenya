const express = require('express');
const router = express.Router();
const { updateWineSubcategories } = require('../scripts/update-wine-subcategories');

// Update wine subcategories
router.post('/', async (req, res) => {
  try {
    console.log('🍷 Starting wine subcategory update via API...');
    await updateWineSubcategories();
    res.json({ 
      success: true, 
      message: 'Wine subcategories updated successfully' 
    });
  } catch (error) {
    console.error('Error updating wine subcategories:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

