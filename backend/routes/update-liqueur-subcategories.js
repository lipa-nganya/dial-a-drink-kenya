const express = require('express');
const router = express.Router();
const { updateLiqueurSubcategories } = require('../scripts/update-liqueur-subcategories');

// Update liqueur subcategories
router.post('/', async (req, res) => {
  try {
    console.log('🍹 Starting liqueur subcategory update via API...');
    await updateLiqueurSubcategories();
    res.json({ 
      success: true, 
      message: 'Liqueur subcategories updated successfully' 
    });
  } catch (error) {
    console.error('Error updating liqueur subcategories:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

