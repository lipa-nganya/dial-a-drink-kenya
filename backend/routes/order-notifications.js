const express = require('express');
const router = express.Router();
const db = require('../models');

// Get all order notifications
router.get('/', async (req, res) => {
  try {
    const notifications = await db.OrderNotification.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching order notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get active order notifications
router.get('/active', async (req, res) => {
  try {
    const notifications = await db.OrderNotification.findAll({
      where: { isActive: true },
      order: [['createdAt', 'DESC']]
    });
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching active notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single notification by ID
router.get('/:id', async (req, res) => {
  try {
    const notification = await db.OrderNotification.findByPk(req.params.id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json(notification);
  } catch (error) {
    console.error('Error fetching notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new notification
router.post('/', async (req, res) => {
  try {
    const { name, phoneNumber, isActive, notes } = req.body;

    if (!name || !phoneNumber) {
      return res.status(400).json({ error: 'Name and phone number are required' });
    }

    const notification = await db.OrderNotification.create({
      name: name.trim(),
      phoneNumber: phoneNumber.trim(),
      isActive: isActive !== undefined ? isActive : true,
      notes: notes || null
    });

    res.status(201).json(notification);
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update notification
router.put('/:id', async (req, res) => {
  try {
    const { name, phoneNumber, isActive, notes } = req.body;
    const notification = await db.OrderNotification.findByPk(req.params.id);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (!name || !phoneNumber) {
      return res.status(400).json({ error: 'Name and phone number are required' });
    }

    await notification.update({
      name: name.trim(),
      phoneNumber: phoneNumber.trim(),
      isActive: isActive !== undefined ? isActive : notification.isActive,
      notes: notes !== undefined ? notes : notification.notes
    });

    res.json(notification);
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete notification
router.delete('/:id', async (req, res) => {
  try {
    const notification = await db.OrderNotification.findByPk(req.params.id);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await notification.destroy();
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

























