const express = require('express');
const router = express.Router();
const { moveVapesToSmokes } = require('../scripts/move-vapes-to-smokes');

// Move all vapes from Vapes category to Smokes category's Vapes subcategory
router.post('/', async (req, res) => {
  try {
    console.log('🚬 Starting vapes migration to Smokes category via API...');
    await moveVapesToSmokes();
    res.json({ 
      success: true, 
      message: 'Vapes moved to Smokes category successfully' 
    });
  } catch (error) {
    console.error('Error moving vapes to smokes:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

