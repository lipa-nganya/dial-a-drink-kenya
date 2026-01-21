const express = require('express');
const router = express.Router();
const db = require('../models');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// Debug middleware - log ALL requests to this router
router.use((req, res, next) => {
  console.log(`🔍 [DRIVER-NOTIFICATIONS ROUTER] ${req.method} ${req.path} - OriginalUrl: ${req.originalUrl}`);
  next();
});

/**
 * Get notifications for a driver
 * GET /api/drivers/:driverId/notifications
 * PUBLIC ROUTE - No authentication required
 */
router.get('/:driverId/notifications', async (req, res) => {
  console.log(`\n📬 ========== NOTIFICATIONS ROUTE HIT ==========`);
  console.log(`📬 [NOTIFICATIONS] GET /api/drivers/:driverId/notifications`);
  console.log(`📬 [NOTIFICATIONS] Request path: ${req.path}`);
  console.log(`📬 [NOTIFICATIONS] Request originalUrl: ${req.originalUrl}`);
  console.log(`📬 [NOTIFICATIONS] Request params:`, JSON.stringify(req.params));
  console.log(`📬 [NOTIFICATIONS] Request method: ${req.method}`);
  console.log(`📬 [NOTIFICATIONS] Request headers authorization:`, req.headers.authorization ? 'PRESENT' : 'MISSING');
  console.log(`📬 ===========================================\n`);
  try {
    const { driverId } = req.params;
    const driver = await db.Driver.findByPk(driverId);
    
    if (!driver) {
      return sendError(res, 'Driver not found', 404);
    }

    const notifications = await db.Notification.findAll({
      include: [
        {
          model: db.NotificationRead,
          as: 'reads',
          where: { driverId: parseInt(driverId) },
          required: false
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Format notifications with read status
    const formattedNotifications = notifications.map(notification => {
      const isRead = notification.reads && notification.reads.length > 0;
      return {
        id: notification.id,
        title: notification.title,
        preview: notification.preview,
        message: notification.message,
        sentAt: notification.sentAt || notification.createdAt,
        isRead,
        readAt: isRead ? notification.reads[0].readAt : null
      };
    });

    sendSuccess(res, formattedNotifications);
  } catch (error) {
    console.error('Error fetching driver notifications:', error);
    sendError(res, 'Failed to fetch notifications', 500);
  }
});

/**
 * Mark notification as read
 * POST /api/drivers/:driverId/notifications/:notificationId/read
 * PUBLIC ROUTE - No authentication required
 */
router.post('/:driverId/notifications/:notificationId/read', async (req, res) => {
  try {
    console.log(`📬 [NOTIFICATIONS] POST /api/drivers/:driverId/notifications/:notificationId/read - driverId: ${req.params.driverId}, notificationId: ${req.params.notificationId}`);
    const { driverId, notificationId } = req.params;
    
    const driver = await db.Driver.findByPk(driverId);
    if (!driver) {
      return sendError(res, 'Driver not found', 404);
    }

    const notification = await db.Notification.findByPk(notificationId);
    if (!notification) {
      return sendError(res, 'Notification not found', 404);
    }

    // Check if already read
    const existingRead = await db.NotificationRead.findOne({
      where: {
        notificationId: parseInt(notificationId),
        driverId: parseInt(driverId)
      }
    });

    if (existingRead) {
      return sendSuccess(res, { message: 'Notification already marked as read' });
    }

    // Mark as read
    await db.NotificationRead.create({
      notificationId: parseInt(notificationId),
      driverId: parseInt(driverId),
      readAt: new Date()
    });

    sendSuccess(res, { message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    sendError(res, 'Failed to mark notification as read', 500);
  }
});

module.exports = router;
