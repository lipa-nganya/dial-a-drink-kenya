const express = require('express');
const router = express.Router();
const { updateCognacSubcategories } = require('../scripts/update-cognac-subcategories');

// Update cognac subcategories
router.post('/', async (req, res) => {
  try {
    console.log('🥃 Starting cognac subcategory update via API...');
    await updateCognacSubcategories();
    res.json({ 
      success: true, 
      message: 'Cognac subcategories updated successfully' 
    });
  } catch (error) {
    console.error('Error updating cognac subcategories:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

