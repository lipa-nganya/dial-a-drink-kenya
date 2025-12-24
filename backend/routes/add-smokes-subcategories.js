const express = require('express');
const router = express.Router();
const db = require('../models');

// Add missing subcategories for Smokes
router.post('/add-smokes-subcategories', async (req, res) => {
  try {
    const smokesCategory = await db.Category.findOne({ where: { name: 'Smokes' } });
    if (!smokesCategory) {
      return res.status(404).json({ success: false, message: 'Smokes category not found.' });
    }

    const subcategoriesToAdd = [
      'Cigarettes',
      'Cigars', 
      'Rolling Papers',
      'Nicotine Pouches',
      'Vapes',
      'Other'
    ];

    let totalCreated = 0;
    const createdSubcategories = [];

    for (const subcategoryName of subcategoriesToAdd) {
      const [subcategory, created] = await db.SubCategory.findOrCreate({
        where: { name: subcategoryName, categoryId: smokesCategory.id },
        defaults: { name: subcategoryName, categoryId: smokesCategory.id, isActive: true }
      });
      if (created) {
        totalCreated++;
        createdSubcategories.push(subcategory);
        console.log(`Created subcategory: ${subcategoryName}`);
      } else {
        console.log(`Subcategory already exists: ${subcategoryName}`);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Smokes subcategories added successfully',
      totalCreated: totalCreated,
      subcategories: createdSubcategories
    });

  } catch (error) {
    console.error('Error adding smokes subcategories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
































