const express = require('express');
const router = express.Router();
const { removeVapesCategory } = require('../scripts/remove-vapes-category');

// Remove the Vapes category
router.post('/', async (req, res) => {
  try {
    console.log('🗑️  Starting Vapes category removal via API...');
    await removeVapesCategory();
    res.json({ 
      success: true, 
      message: 'Vapes category removed successfully' 
    });
  } catch (error) {
    console.error('Error removing Vapes category:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

