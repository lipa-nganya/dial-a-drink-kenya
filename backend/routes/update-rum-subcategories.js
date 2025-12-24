const express = require('express');
const router = express.Router();
const { updateRumSubcategories } = require('../scripts/update-rum-subcategories');

// Update rum subcategories
router.post('/', async (req, res) => {
  try {
    console.log('🥃 Starting rum subcategory update via API...');
    await updateRumSubcategories();
    res.json({ 
      success: true, 
      message: 'Rum subcategories updated successfully' 
    });
  } catch (error) {
    console.error('Error updating rum subcategories:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

