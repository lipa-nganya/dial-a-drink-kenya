const db = require('../models');
const { Op } = require('sequelize');
const axios = require('axios');
const crypto = require('crypto');

/**
 * Valkyrie Business Logic Service
 * Handles partner scoping, driver assignment rules, and webhook delivery
 */

/**
 * Get available drivers for a partner based on their rules
 */
async function getAvailableDriversForPartner(partnerId, options = {}) {
  const partner = await db.ValkyriePartner.findByPk(partnerId);
  
  if (!partner || partner.status !== 'active') {
    throw new Error('Partner not found or inactive');
  }

  const { city, vehicleType } = options;
  
  // Build driver query
  const driverWhere = {
    status: {
      [Op.in]: ['active', 'on_delivery']
    },
    valkyrieEligible: true // Only DeliveryOS drivers marked as eligible
  };

  // Get partner-owned drivers
  const partnerDrivers = await db.ValkyriePartnerDriver.findAll({
    where: {
      partnerId: partnerId,
      active: true
    },
    include: [{
      model: db.Driver,
      as: 'driver',
      where: driverWhere
    }]
  });

  // Get DeliveryOS eligible drivers (if partner allows them)
  let deliveryosDrivers = [];
  
  // Check if partner has city/vehicle restrictions
  const hasCityRestriction = partner.allowedCities && partner.allowedCities.length > 0;
  const hasVehicleRestriction = partner.allowedVehicleTypes && partner.allowedVehicleTypes.length > 0;
  
  // For now, we'll return all eligible drivers
  // In production, you'd filter by city/vehicle type based on order location
  if (!hasCityRestriction && !hasVehicleRestriction) {
    deliveryosDrivers = await db.Driver.findAll({
      where: driverWhere,
      limit: 50 // Limit to prevent huge queries
    });
  }

  // Combine and format results
  const drivers = [];
  
  // Add partner-owned drivers
  partnerDrivers.forEach(pd => {
    if (pd.driver) {
      drivers.push({
        id: pd.driver.id,
        name: pd.driver.name,
        phoneNumber: pd.driver.phoneNumber,
        status: pd.driver.status,
        ownershipType: 'partner_owned',
        partnerDriverId: pd.id
      });
    }
  });

  // Add DeliveryOS drivers (limited info)
  deliveryosDrivers.forEach(driver => {
    // Check if already added as partner driver
    const alreadyAdded = drivers.some(d => d.id === driver.id);
    if (!alreadyAdded) {
      drivers.push({
        id: driver.id,
        name: driver.name,
        phoneNumber: driver.phoneNumber, // Limited exposure
        status: driver.status,
        ownershipType: 'deliveryos_owned'
      });
    }
  });

  return drivers;
}

/**
 * Assign driver to partner order
 */
async function assignDriverToPartnerOrder(partnerId, orderId, driverId, fulfillmentType) {
  // Verify partner owns this order
  const partnerOrder = await db.ValkyriePartnerOrder.findOne({
    where: {
      partnerId: partnerId,
      orderId: orderId
    }
  });

  if (!partnerOrder) {
    throw new Error('Order not found or not owned by partner');
  }

  // Verify driver is available for this partner
  const partner = await db.ValkyriePartner.findByPk(partnerId);
  if (!partner || partner.status !== 'active') {
    throw new Error('Partner not found or inactive');
  }

  // Check if driver is partner-owned or DeliveryOS eligible
  let driverValid = false;
  
  if (fulfillmentType === 'partner_driver') {
    const partnerDriver = await db.ValkyriePartnerDriver.findOne({
      where: {
        partnerId: partnerId,
        driverId: driverId,
        active: true
      }
    });
    driverValid = !!partnerDriver;
  } else if (fulfillmentType === 'deliveryos_driver') {
    const driver = await db.Driver.findOne({
      where: {
        id: driverId,
        valkyrieEligible: true,
        status: {
          [Op.in]: ['active', 'on_delivery']
        }
      }
    });
    driverValid = !!driver;
  }

  if (!driverValid) {
    throw new Error('Driver not available for this partner');
  }

  // Update partner order
  await partnerOrder.update({
    assignedDriverId: driverId,
    fulfillmentType: fulfillmentType
  });

  // Update core order
  const order = await db.Order.findByPk(orderId);
  if (order) {
    await order.update({
      driverId: driverId
    });
  }

  // Send webhook notification
  await sendWebhook(partnerId, 'driver.assigned', {
    orderId: orderId,
    partnerOrderId: partnerOrder.id,
    driverId: driverId,
    fulfillmentType: fulfillmentType
  });

  return partnerOrder;
}

/**
 * Create partner order from core order
 */
async function createPartnerOrder(partnerId, orderId, externalOrderId = null) {
  // Check if already exists
  const existing = await db.ValkyriePartnerOrder.findOne({
    where: {
      partnerId: partnerId,
      orderId: orderId
    }
  });

  if (existing) {
    return existing;
  }

  // Create new partner order
  const partnerOrder = await db.ValkyriePartnerOrder.create({
    partnerId: partnerId,
    orderId: orderId,
    externalOrderId: externalOrderId
  });

  // Send webhook notification
  await sendWebhook(partnerId, 'order.status.updated', {
    orderId: orderId,
    partnerOrderId: partnerOrder.id,
    status: 'created'
  });

  return partnerOrder;
}

/**
 * Send webhook notification to partner
 */
async function sendWebhook(partnerId, eventType, payload) {
  try {
    const partner = await db.ValkyriePartner.findByPk(partnerId);
    
    if (!partner || !partner.webhookUrl) {
      return; // No webhook configured
    }

    const webhookPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload
    };

    // Generate signature
    const signature = generateWebhookSignature(webhookPayload, partner.webhookSecret);

    // Send webhook
    await axios.post(partner.webhookUrl, webhookPayload, {
      headers: {
        'X-Valkyrie-Signature': signature,
        'X-Valkyrie-Event': eventType,
        'Content-Type': 'application/json'
      },
      timeout: 5000 // 5 second timeout
    });

    console.log(`✅ Valkyrie webhook sent: ${eventType} to partner ${partnerId}`);
  } catch (error) {
    console.error(`❌ Valkyrie webhook failed for partner ${partnerId}:`, error.message);
    // Don't throw - webhook failures shouldn't break the flow
  }
}

/**
 * Generate webhook signature for security
 */
function generateWebhookSignature(payload, secret) {
  if (!secret) {
    return '';
  }
  
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}

/**
 * Verify webhook signature (for incoming webhooks from partners)
 */
function verifyWebhookSignature(payload, signature, secret) {
  if (!secret) {
    return false;
  }
  
  const expectedSignature = generateWebhookSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Get partner-scoped orders
 */
async function getPartnerOrders(partnerId, filters = {}) {
  const where = {
    partnerId: partnerId
  };

  const partnerOrders = await db.ValkyriePartnerOrder.findAll({
    where: where,
    include: [{
      model: db.Order,
      as: 'order',
      include: [{
        model: db.Driver,
        as: 'driver',
        attributes: ['id', 'name', 'phoneNumber', 'status']
      }]
    }],
    order: [['createdAt', 'DESC']],
    limit: filters.limit || 100,
    offset: filters.offset || 0
  });

  return partnerOrders;
}

/**
 * Get partner-scoped drivers
 */
async function getPartnerDrivers(partnerId, filters = {}) {
  const where = {
    partnerId: partnerId
  };

  if (filters.active !== undefined) {
    where.active = filters.active;
  }

  const partnerDrivers = await db.ValkyriePartnerDriver.findAll({
    where: where,
    include: [{
      model: db.Driver,
      as: 'driver',
      attributes: ['id', 'name', 'phoneNumber', 'status', 'lastActivity']
    }],
    order: [['createdAt', 'DESC']]
  });

  return partnerDrivers;
}

/**
 * Trigger webhook for order status change (called from order update routes)
 */
async function triggerOrderStatusWebhook(orderId, newStatus) {
  try {
    // Find all partner orders for this order
    const partnerOrders = await db.ValkyriePartnerOrder.findAll({
      where: {
        orderId: orderId
      },
      include: [{
        model: db.ValkyriePartner,
        as: 'partner'
      }]
    });

    // Send webhook to each partner
    for (const partnerOrder of partnerOrders) {
      await sendWebhook(partnerOrder.partnerId, 'order.status.updated', {
        orderId: orderId,
        partnerOrderId: partnerOrder.id,
        status: newStatus
      });
    }

    // If order is completed/delivered, send delivery.completed webhook
    if (newStatus === 'delivered' || newStatus === 'completed') {
      for (const partnerOrder of partnerOrders) {
        await sendWebhook(partnerOrder.partnerId, 'delivery.completed', {
          orderId: orderId,
          partnerOrderId: partnerOrder.id,
          completedAt: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.error('Error triggering Valkyrie order status webhook:', error);
    // Don't throw - webhook failures shouldn't break order updates
  }
}

module.exports = {
  getAvailableDriversForPartner,
  assignDriverToPartnerOrder,
  createPartnerOrder,
  sendWebhook,
  generateWebhookSignature,
  verifyWebhookSignature,
  getPartnerOrders,
  getPartnerDrivers,
  triggerOrderStatusWebhook
};

