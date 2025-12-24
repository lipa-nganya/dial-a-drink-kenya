const express = require('express');
const router = express.Router();
const { updateGinSubcategories } = require('../scripts/update-gin-subcategories');

// Update gin subcategories
router.post('/', async (req, res) => {
  try {
    console.log('🍸 Starting gin subcategory update via API...');
    await updateGinSubcategories();
    res.json({ 
      success: true, 
      message: 'Gin subcategories updated successfully' 
    });
  } catch (error) {
    console.error('Error updating gin subcategories:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

