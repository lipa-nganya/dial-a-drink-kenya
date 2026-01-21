const express = require('express');
const router = express.Router();
const db = require('../models');
const { verifyAdmin } = require('./admin');
const pushNotifications = require('../services/pushNotifications');

/**
 * Create and send notification to all drivers
 * POST /api/admin/notifications
 */
router.post('/', verifyAdmin, async (req, res) => {
  console.log(`🔔 [POST /notifications] Request received from admin ${req.admin.id}`);
  try {
    const { title, preview, message } = req.body;
    const adminId = req.admin.id;
    console.log(`🔔 [POST /notifications] Creating notification:`, { title, preview, message: message.substring(0, 50) + '...' });

    if (!title || !preview || !message) {
      return res.status(400).json({ error: 'Title, preview, and message are required' });
    }

    // Create notification
    const notification = await db.Notification.create({
      title,
      preview,
      message,
      sentBy: adminId,
      sentAt: new Date()
    });

    // Get all active drivers with push tokens
    const drivers = await db.Driver.findAll({
      where: {
        pushToken: { [db.Sequelize.Op.ne]: null }
      }
    });

    // Send push notifications to all drivers
    const pushResults = [];
    for (const driver of drivers) {
      try {
        const pushMessage = {
          sound: 'default',
          title: title,
          body: preview,
          data: {
            type: 'custom-notification',
            notificationId: notification.id,
            title: title,
            preview: preview
          },
          priority: 'high',
          badge: 1,
          channelId: 'notifications'
        };

        const result = await pushNotifications.sendFCMNotification(driver.pushToken, pushMessage);
        pushResults.push({
          driverId: driver.id,
          driverName: driver.name,
          success: result.success,
          error: result.error
        });
      } catch (error) {
        console.error(`Error sending push to driver ${driver.id}:`, error);
        pushResults.push({
          driverId: driver.id,
          driverName: driver.name,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      notification,
      pushResults,
      sentTo: drivers.length,
      successful: pushResults.filter(r => r.success).length,
      failed: pushResults.filter(r => !r.success).length
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification', details: error.message });
  }
});

/**
 * Get all notifications
 * GET /api/admin/notifications
 */
router.get('/', verifyAdmin, async (req, res) => {
  console.log(`🔔 [GET /notifications] Request received from admin ${req.admin.id}`);
  try {
    const notifications = await db.Notification.findAll({
      include: [
        {
          model: db.Admin,
          as: 'sender',
          attributes: ['id', 'username', 'name', 'email']
        },
        {
          model: db.NotificationRead,
          as: 'reads',
          include: [
            {
              model: db.Driver,
              as: 'driver',
              attributes: ['id', 'name', 'phoneNumber']
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Get all drivers count
    const totalDrivers = await db.Driver.count();

    // Calculate stats for each notification
    const notificationsWithStats = notifications.map(notification => {
      const reads = notification.reads || [];
      const readCount = reads.length;
      const unreadCount = totalDrivers - readCount;
      const readDrivers = reads.map(r => r.driver);
      const unreadDrivers = []; // We'll need to calculate this separately

      return {
        ...notification.toJSON(),
        stats: {
          totalDrivers,
          readCount,
          unreadCount,
          readDrivers,
          readPercentage: totalDrivers > 0 ? ((readCount / totalDrivers) * 100).toFixed(1) : 0
        }
      };
    });

    res.json(notificationsWithStats);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications', details: error.message });
  }
});

/**
 * Get notification details with read/unread stats
 * GET /api/admin/notifications/:id
 */
router.get('/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await db.Notification.findByPk(id, {
      include: [
        {
          model: db.Admin,
          as: 'sender',
          attributes: ['id', 'username', 'name', 'email']
        },
        {
          model: db.NotificationRead,
          as: 'reads',
          include: [
            {
              model: db.Driver,
              as: 'driver',
              attributes: ['id', 'name', 'phoneNumber']
            }
          ]
        }
      ]
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Get all drivers
    const allDrivers = await db.Driver.findAll({
      attributes: ['id', 'name', 'phoneNumber']
    });

    // Get read driver IDs
    const readDriverIds = (notification.reads || []).map(r => r.driverId);
    const readDrivers = (notification.reads || []).map(r => r.driver);
    const unreadDrivers = allDrivers.filter(d => !readDriverIds.includes(d.id));

    res.json({
      ...notification.toJSON(),
      stats: {
        totalDrivers: allDrivers.length,
        readCount: readDrivers.length,
        unreadCount: unreadDrivers.length,
        readDrivers,
        unreadDrivers,
        readPercentage: allDrivers.length > 0 ? ((readDrivers.length / allDrivers.length) * 100).toFixed(1) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching notification details:', error);
    res.status(500).json({ error: 'Failed to fetch notification details', details: error.message });
  }
});

module.exports = router;
