const express = require('express');
const router = express.Router();
const { updateSmokesSubcategories } = require('../scripts/update-smokes-subcategories');

// Update smokes subcategories
router.post('/', async (req, res) => {
  try {
    console.log('🚬 Starting smokes subcategory update via API...');
    await updateSmokesSubcategories();
    res.json({ 
      success: true, 
      message: 'Smokes subcategories updated successfully' 
    });
  } catch (error) {
    console.error('Error updating smokes subcategories:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

