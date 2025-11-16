const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');

// Get all branches
router.get('/', async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const where = {};
    
    if (activeOnly === 'true') {
      where.isActive = true;
    }
    
    const branches = await db.Branch.findAll({
      where,
      order: [['name', 'ASC']]
    });
    
    res.json(branches);
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get branch by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const branch = await db.Branch.findByPk(id);
    
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }
    
    res.json(branch);
  } catch (error) {
    console.error('Error fetching branch:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new branch
router.post('/', async (req, res) => {
  try {
    const { name, address } = req.body;
    
    if (!name || !address) {
      return res.status(400).json({ error: 'Name and address are required' });
    }
    
    const branch = await db.Branch.create({
      name: name.trim(),
      address: address.trim(),
      isActive: true
    });
    
    res.status(201).json(branch);
  } catch (error) {
    console.error('Error creating branch:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update branch
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, isActive } = req.body;
    
    const branch = await db.Branch.findByPk(id);
    
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }
    
    if (name !== undefined) {
      branch.name = name.trim();
    }
    if (address !== undefined) {
      branch.address = address.trim();
    }
    if (isActive !== undefined) {
      branch.isActive = Boolean(isActive);
    }
    
    await branch.save();
    
    res.json(branch);
  } catch (error) {
    console.error('Error updating branch:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete branch (soft delete by setting isActive to false)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const branch = await db.Branch.findByPk(id);
    
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }
    
    // Check if branch has active orders
    const activeOrdersCount = await db.Order.count({
      where: {
        branchId: id,
        status: {
          [Op.notIn]: ['completed', 'cancelled']
        }
      }
    });
    
    if (activeOrdersCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete branch with ${activeOrdersCount} active order(s). Please complete or cancel orders first.` 
      });
    }
    
    // Soft delete by setting isActive to false
    branch.isActive = false;
    await branch.save();
    
    res.json({ message: 'Branch deactivated successfully', branch });
  } catch (error) {
    console.error('Error deleting branch:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

