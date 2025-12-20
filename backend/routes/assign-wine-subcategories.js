const express = require('express');
const router = express.Router();
const { assignWineSubcategories } = require('../scripts/assign-wine-subcategories');

// Assign wines to subcategories
router.post('/', async (req, res) => {
  try {
    console.log('🍷 Starting wine subcategory assignment via API...');
    await assignWineSubcategories();
    res.json({ 
      success: true, 
      message: 'Wine subcategories assigned successfully' 
    });
  } catch (error) {
    console.error('Error assigning wine subcategories:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

