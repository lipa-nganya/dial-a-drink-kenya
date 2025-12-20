const express = require('express');
const router = express.Router();
const db = require('../models');

// Get all suppliers
router.get('/', async (req, res) => {
  try {
    const { isActive } = req.query;
    let whereClause = {};
    
    if (isActive !== undefined) {
      whereClause.isActive = isActive === 'true';
    }
    
    const suppliers = await db.Supplier.findAll({
      where: whereClause,
      order: [['name', 'ASC']]
    });
    
    res.json(suppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get supplier by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const supplier = await db.Supplier.findByPk(id);
    
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    res.json(supplier);
  } catch (error) {
    console.error('Error fetching supplier:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create supplier
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, openingBalance } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Supplier name is required' });
    }
    
    // Validate opening balance
    const balance = openingBalance ? parseFloat(openingBalance) : 0;
    if (isNaN(balance)) {
      return res.status(400).json({ error: 'Opening balance must be a valid number' });
    }
    
    const supplier = await db.Supplier.create({
      name: name.trim(),
      email: email ? email.trim() : null,
      phone: phone ? phone.trim() : null,
      openingBalance: balance
    });
    
    res.status(201).json(supplier);
  } catch (error) {
    console.error('Error creating supplier:', error);
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update supplier
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, openingBalance, isActive } = req.body;
    
    const supplier = await db.Supplier.findByPk(id);
    
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    if (name !== undefined) supplier.name = name.trim();
    if (email !== undefined) supplier.email = email ? email.trim() : null;
    if (phone !== undefined) supplier.phone = phone ? phone.trim() : null;
    if (openingBalance !== undefined) {
      const balance = parseFloat(openingBalance);
      if (isNaN(balance)) {
        return res.status(400).json({ error: 'Opening balance must be a valid number' });
      }
      supplier.openingBalance = balance;
    }
    if (isActive !== undefined) supplier.isActive = isActive;
    
    await supplier.save();
    res.json(supplier);
  } catch (error) {
    console.error('Error updating supplier:', error);
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete supplier (soft delete by setting isActive to false)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const supplier = await db.Supplier.findByPk(id);
    
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    // Soft delete
    supplier.isActive = false;
    await supplier.save();
    
    res.json({ message: 'Supplier deleted successfully', supplier });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

