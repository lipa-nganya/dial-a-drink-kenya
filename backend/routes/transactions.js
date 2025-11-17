const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');

// Get all transactions (admin only - will be protected)
router.get('/', async (req, res) => {
  try {
    // Build order includes conditionally
    const orderIncludes = [{
      model: db.OrderItem,
      as: 'items',
      required: false,
      include: [{
        model: db.Drink,
        as: 'drink',
        required: false
      }]
    }];
    
    // Only include Branch if the model exists and association is set up
    // Skip Branch include to avoid database column errors
    // TODO: Re-enable when branchId column is confirmed to exist in production
    // if (db.Branch && db.Order && db.Order.associations && db.Order.associations.branch) {
    //   orderIncludes.push({
    //     model: db.Branch,
    //     as: 'branch',
    //     required: false,
    //     attributes: ['id', 'name', 'address']
    //   });
    // }
    
    const transactions = await db.Transaction.findAll({
      include: [{
        model: db.Order,
        as: 'order',
        required: false,
        include: orderIncludes
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get transactions for a specific order
router.get('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    // Build order includes conditionally
    const orderIncludes = [];
    
    // Only include Branch if the model exists and association is set up
    // Skip Branch include to avoid database column errors
    // TODO: Re-enable when branchId column is confirmed to exist in production
    // if (db.Branch && db.Order && db.Order.associations && db.Order.associations.branch) {
    //   orderIncludes.push({
    //     model: db.Branch,
    //     as: 'branch',
    //     required: false,
    //     attributes: ['id', 'name', 'address']
    //   });
    // }

    const transactions = await db.Transaction.findAll({
      where: { orderId },
      include: [{
        model: db.Order,
        as: 'order',
        required: false,
        include: orderIncludes
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching order transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get transaction by ID
router.get('/:id', async (req, res) => {
  try {
    // Build order includes conditionally
    const orderIncludes = [{
      model: db.OrderItem,
      as: 'items',
      required: false,
      include: [{
        model: db.Drink,
        as: 'drink',
        required: false
      }]
    }];
    
    // Only include Branch if the model exists and association is set up
    // Skip Branch include to avoid database column errors
    // TODO: Re-enable when branchId column is confirmed to exist in production
    // if (db.Branch && db.Order && db.Order.associations && db.Order.associations.branch) {
    //   orderIncludes.push({
    //     model: db.Branch,
    //     as: 'branch',
    //     required: false,
    //     attributes: ['id', 'name', 'address']
    //   });
    // }
    
    const transaction = await db.Transaction.findByPk(req.params.id, {
      include: [{
        model: db.Order,
        as: 'order',
        required: false,
        include: orderIncludes
      }]
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update transaction status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'completed', 'failed', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const transaction = await db.Transaction.findByPk(req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    transaction.status = status;
    await transaction.save();

    res.json(transaction);
  } catch (error) {
    console.error('Error updating transaction status:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

















