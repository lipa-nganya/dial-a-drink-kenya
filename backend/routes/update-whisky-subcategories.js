const express = require('express');
const router = express.Router();
const { updateWhiskySubcategories } = require('../scripts/update-whisky-subcategories');

// Update whisky subcategories
router.post('/', async (req, res) => {
  try {
    console.log('🥃 Starting whisky subcategory update via API...');
    await updateWhiskySubcategories();
    res.json({ 
      success: true, 
      message: 'Whisky subcategories updated successfully' 
    });
  } catch (error) {
    console.error('Error updating whisky subcategories:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

