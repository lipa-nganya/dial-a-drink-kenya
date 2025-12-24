const express = require('express');
const router = express.Router();
const db = require('../models');

// Get all territories
router.get('/', async (req, res) => {
  try {
    const territories = await db.Territory.findAll({
      order: [['name', 'ASC']]
    });
    
    res.json(territories);
  } catch (error) {
    console.error('Error fetching territories:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get territory by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const territory = await db.Territory.findByPk(id);
    
    if (!territory) {
      return res.status(404).json({ error: 'Territory not found' });
    }
    
    res.json(territory);
  } catch (error) {
    console.error('Error fetching territory:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new territory
router.post('/', async (req, res) => {
  try {
    const { name, deliveryFromCBD, deliveryFromRuaka } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Territory name is required' });
    }
    
    const territory = await db.Territory.create({
      name: name.trim(),
      deliveryFromCBD: deliveryFromCBD ? parseFloat(deliveryFromCBD) : 0,
      deliveryFromRuaka: deliveryFromRuaka ? parseFloat(deliveryFromRuaka) : 0
    });
    
    res.status(201).json(territory);
  } catch (error) {
    console.error('Error creating territory:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update territory
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, deliveryFromCBD, deliveryFromRuaka } = req.body;
    
    const territory = await db.Territory.findByPk(id);
    
    if (!territory) {
      return res.status(404).json({ error: 'Territory not found' });
    }
    
    if (name !== undefined) {
      territory.name = name.trim();
    }
    if (deliveryFromCBD !== undefined) {
      territory.deliveryFromCBD = parseFloat(deliveryFromCBD);
    }
    if (deliveryFromRuaka !== undefined) {
      territory.deliveryFromRuaka = parseFloat(deliveryFromRuaka);
    }
    
    await territory.save();
    
    res.json(territory);
  } catch (error) {
    console.error('Error updating territory:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete territory
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const territory = await db.Territory.findByPk(id);
    
    if (!territory) {
      return res.status(404).json({ error: 'Territory not found' });
    }
    
    await territory.destroy();
    
    res.json({ message: 'Territory deleted successfully' });
  } catch (error) {
    console.error('Error deleting territory:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

