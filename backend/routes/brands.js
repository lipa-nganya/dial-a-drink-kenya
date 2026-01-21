const express = require('express');
const router = express.Router();
const db = require('../models');
const brandScraper = require('../services/brandScraper');

// Get all brands
router.get('/', async (req, res) => {
  try {
    const brands = await db.Brand.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'description', 'isActive', 'createdAt', 'updatedAt'],
      order: [['name', 'ASC']]
    });

    res.json(brands);
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
});

// Get all brands (including inactive) - for admin
router.get('/all', async (req, res) => {
  try {
    // Debug logging
    const brandCount = await db.Brand.count();
    console.log(`[Brands API] Total brands in database: ${brandCount}`);
    
    const brands = await db.Brand.findAll({
      attributes: ['id', 'name', 'description', 'isActive', 'createdAt', 'updatedAt'], // Explicitly select attributes
      order: [['name', 'ASC']]
    });

    console.log(`[Brands API] Found ${brands.length} brands, returning to client`);
    if (!res.headersSent) {
      res.json(brands);
    }
  } catch (error) {
    console.error('Error fetching all brands:', error);
    console.error('Error stack:', error.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to fetch brands' });
    }
  }
});

// Get single brand by ID
router.get('/:id', async (req, res) => {
  try {
    const brand = await db.Brand.findByPk(req.params.id);
    
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    res.json(brand);
  } catch (error) {
    console.error('Error fetching brand:', error);
    res.status(500).json({ error: 'Failed to fetch brand' });
  }
});

// Create new brand
router.post('/', async (req, res) => {
  try {
    const { name, description, isActive } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Brand name is required' });
    }

    // Check if brand already exists
    const existingBrand = await db.Brand.findOne({
      where: { name: name.trim() }
    });

    if (existingBrand) {
      return res.status(400).json({ error: 'Brand with this name already exists' });
    }

    const brand = await db.Brand.create({
      name: name.trim(),
      description: description || null,
      isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json(brand);
  } catch (error) {
    console.error('Error creating brand:', error);
    res.status(500).json({ error: 'Failed to create brand' });
  }
});

// Update brand
router.put('/:id', async (req, res) => {
  try {
    const { name, description, isActive } = req.body;
    const brand = await db.Brand.findByPk(req.params.id);

    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    // Check if name is being changed and if new name already exists
    if (name && name.trim() !== brand.name) {
      const existingBrand = await db.Brand.findOne({
        where: { name: name.trim() }
      });

      if (existingBrand) {
        return res.status(400).json({ error: 'Brand with this name already exists' });
      }
    }

    await brand.update({
      name: name ? name.trim() : brand.name,
      description: description !== undefined ? description : brand.description,
      isActive: isActive !== undefined ? isActive : brand.isActive
    });

    res.json(brand);
  } catch (error) {
    console.error('Error updating brand:', error);
    res.status(500).json({ error: 'Failed to update brand' });
  }
});

// Scrape brands from dialadrinkkenya.com
router.post('/scrape', async (req, res) => {
  try {
    console.log('📥 Brand scraping request received');
    const result = await brandScraper.syncBrandsFromWebsite();
    res.json({
      success: true,
      message: `Brand scraping complete: ${result.created} created, ${result.updated} updated`,
      ...result
    });
  } catch (error) {
    console.error('Error scraping brands:', error);
    res.status(500).json({ 
      error: 'Failed to scrape brands',
      message: error.message 
    });
  }
});

// Delete brand (soft delete by setting isActive to false)
router.delete('/:id', async (req, res) => {
  try {
    const brand = await db.Brand.findByPk(req.params.id);

    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    // Check if brand is used by any drinks
    const drinksCount = await db.Drink.count({
      where: { brandId: brand.id }
    });

    if (drinksCount > 0) {
      // Soft delete - set isActive to false
      await brand.update({ isActive: false });
      res.json({ message: 'Brand deactivated (has associated drinks)', brand });
    } else {
      // Hard delete if no drinks use it
      await brand.destroy();
      res.json({ message: 'Brand deleted successfully' });
    }
  } catch (error) {
    console.error('Error deleting brand:', error);
    res.status(500).json({ error: 'Failed to delete brand' });
  }
});

module.exports = router;

