const express = require('express');
const router = express.Router();
const { updateTequilaSubcategories } = require('../scripts/update-tequila-subcategories');

// Update tequila subcategories
router.post('/', async (req, res) => {
  try {
    console.log('🍹 Starting tequila subcategory update via API...');
    await updateTequilaSubcategories();
    res.json({ 
      success: true, 
      message: 'Tequila subcategories updated successfully' 
    });
  } catch (error) {
    console.error('Error updating tequila subcategories:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

