const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const valkyrieAuth = require('../middleware/valkyrieAuth');
const valkyrieService = require('../services/valkyrie');
const geofenceService = require('../services/geofence');

/**
 * Valkyrie Partner API v1
 * All routes are under /api/valkyrie/v1
 */

// ==================== AUTHENTICATION ====================

/**
 * POST /api/valkyrie/v1/auth/token
 * Authenticate partner user and get JWT token
 */
router.post('/auth/token', async (req, res) => {
  try {
    const { email, password, apiKey } = req.body;

    // Log the request for debugging (remove in production)
    console.log('Valkyrie auth request:', {
      hasEmail: !!email,
      hasPassword: !!password,
      hasApiKey: !!apiKey,
      emailLength: email?.length
    });

    // API key authentication (for programmatic access)
    if (apiKey) {
      const partner = await db.ValkyriePartner.findOne({
        where: {
          apiKey: apiKey,
          status: 'active'
        }
      });

      if (!partner) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid API key'
        });
      }

      return res.json({
        success: true,
        token: jwt.sign(
          { partnerId: partner.id, type: 'api_key' },
          process.env.JWT_SECRET || 'valkyrie-secret-key-change-in-production',
          { expiresIn: '30d' }
        ),
        partner: {
          id: partner.id,
          name: partner.name
        },
        authType: 'api_key'
      });
    }

    // Email/password authentication (for console access)
    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password required, or provide API key'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log('Looking for user with email:', normalizedEmail);
    
    // First try to find user without partner constraint to see if user exists
    const userCheck = await db.ValkyriePartnerUser.findOne({
      where: {
        email: normalizedEmail
      }
    });
    
    console.log('User check result:', {
      found: !!userCheck,
      status: userCheck?.status,
      hasPassword: !!userCheck?.password,
      partnerId: userCheck?.partnerId
    });
    
    const partnerUser = await db.ValkyriePartnerUser.findOne({
      where: {
        email: normalizedEmail,
        status: 'active'
      },
      include: [{
        model: db.ValkyriePartner,
        as: 'partner',
        where: {
          status: 'active'
        },
        required: true // INNER JOIN
      }]
    });

    console.log('Partner user query result:', {
      found: !!partnerUser,
      partnerFound: !!partnerUser?.partner,
      partnerStatus: partnerUser?.partner?.status
    });

    if (!partnerUser || !partnerUser.partner) {
      console.log('Valkyrie auth failed: User not found or partner inactive', {
        email: normalizedEmail,
        userFound: !!userCheck,
        userStatus: userCheck?.status,
        userActive: userCheck?.status === 'active',
        partnerId: userCheck?.partnerId,
        partnerUserFound: !!partnerUser,
        partnerFound: !!partnerUser?.partner,
        partnerStatus: partnerUser?.partner?.status
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      });
    }

    if (!partnerUser.password) {
      // Check if there's a valid invitation token
      if (partnerUser.inviteToken && partnerUser.inviteTokenExpiry && new Date() < new Date(partnerUser.inviteTokenExpiry)) {
        console.log('Valkyrie auth failed: Password not set, but valid invite token exists', {
          email: normalizedEmail,
          hasInviteToken: !!partnerUser.inviteToken
        });
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Password not set. Please use the invitation link from your email to set your password.',
          requiresPasswordSetup: true,
          inviteToken: partnerUser.inviteToken
        });
      }
      console.log('Valkyrie auth failed: No password set', {
        email: normalizedEmail,
        userId: partnerUser.id
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Password not set. Please contact administrator.'
      });
    }

    console.log('Comparing password for:', normalizedEmail);
    console.log('Password received length:', password?.length);
    console.log('Stored password hash length:', partnerUser.password?.length);
    
    const isValidPassword = await bcrypt.compare(password, partnerUser.password);
    
    console.log('Password comparison result:', isValidPassword ? '✅ MATCH' : '❌ NO MATCH');

    if (!isValidPassword) {
      console.log('Valkyrie auth failed: Invalid password', {
        email: normalizedEmail,
        userId: partnerUser.id,
        passwordLength: password?.length
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      });
    }

    const token = jwt.sign(
      {
        userId: partnerUser.id,
        partnerId: partnerUser.partnerId,
        role: partnerUser.role
      },
      process.env.JWT_SECRET || 'valkyrie-secret-key-change-in-production',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token: token,
      user: {
        id: partnerUser.id,
        email: partnerUser.email,
        role: partnerUser.role
      },
      partner: {
        id: partnerUser.partner.id,
        name: partnerUser.partner.name
      },
      authType: 'jwt'
    });
  } catch (error) {
    console.error('Valkyrie auth error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed'
    });
  }
});

// ==================== ORDERS ====================

/**
 * POST /api/valkyrie/v1/orders
 * Create a delivery order
 */
router.post('/orders', valkyrieAuth.authenticate, valkyrieAuth.enforcePartnerScope, async (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      items,
      totalAmount,
      tipAmount,
      notes,
      paymentType,
      paymentMethod,
      externalOrderId
    } = req.body;

    // Validate required fields
    if (!customerName || !customerPhone || !deliveryAddress || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'customerName, customerPhone, deliveryAddress, and items are required'
      });
    }

    // Geofence validation (if enabled)
    if (process.env.ENABLE_ZEUS === 'true' || process.env.ENABLE_ZEUS === '1') {
      try {
        // Try to extract coordinates from address or use provided coordinates
        const { latitude, longitude } = req.body;
        const coords = latitude && longitude 
          ? { latitude, longitude }
          : geofenceService.parseAddressCoordinates(deliveryAddress);

        if (coords) {
          const geofenceCheck = await geofenceService.validateDeliveryLocation(
            req.partnerId,
            coords.latitude,
            coords.longitude
          );

          if (!geofenceCheck.valid) {
            return res.status(403).json({
              error: 'Forbidden',
              message: `Order creation failed: ${geofenceCheck.message}`
            });
          }
        } else {
          // If coordinates can't be extracted, warn but allow (in production, require coordinates)
          console.warn(`Could not extract coordinates from address for partner ${req.partnerId}`);
        }
      } catch (geofenceError) {
        console.error('Geofence validation error:', geofenceError);
        // Don't block order creation if geofence check fails (fail open for now)
        // In production, you may want to fail closed
      }
    }

    // Calculate total if not provided
    let calculatedTotal = totalAmount || 0;
    if (!totalAmount && items.length > 0) {
      calculatedTotal = items.reduce((sum, item) => {
        return sum + (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 0);
      }, 0);
    }

    // Create core order
    const order = await db.Order.create({
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      totalAmount: calculatedTotal,
      tipAmount: tipAmount || 0,
      notes: notes || null,
      paymentType: paymentType || 'pay_on_delivery',
      paymentMethod: paymentMethod || null,
      status: 'pending'
    });

    // Create order items
    for (const item of items) {
      await db.OrderItem.create({
        orderId: order.id,
        drinkId: item.drinkId,
        quantity: item.quantity,
        price: item.price
      });
    }

    // Create partner order
    const partnerOrder = await valkyrieService.createPartnerOrder(
      req.partnerId,
      order.id,
      externalOrderId
    );

    // Fetch complete order with items
    const completeOrder = await db.Order.findByPk(order.id, {
      include: [{
        model: db.OrderItem,
        as: 'items',
        include: [{
          model: db.Drink,
          as: 'drink'
        }]
      }]
    });

    res.status(201).json({
      success: true,
      order: {
        id: order.id,
        partnerOrderId: partnerOrder.id,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        deliveryAddress: order.deliveryAddress,
        totalAmount: order.totalAmount,
        status: order.status,
        paymentStatus: order.paymentStatus,
        items: completeOrder.items,
        createdAt: order.createdAt
      }
    });
  } catch (error) {
    console.error('Valkyrie create order error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create order'
    });
  }
});

/**
 * GET /api/valkyrie/v1/orders
 * List partner orders
 */
router.get('/orders', valkyrieAuth.authenticate, valkyrieAuth.enforcePartnerScope, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    const filters = {
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    const partnerOrders = await valkyrieService.getPartnerOrders(req.partnerId, filters);

    // Filter by status if provided
    let filteredOrders = partnerOrders;
    if (status) {
      filteredOrders = partnerOrders.filter(po => po.order && po.order.status === status);
    }

    res.json({
      success: true,
      orders: filteredOrders.map(po => ({
        id: po.order.id,
        partnerOrderId: po.id,
        externalOrderId: po.externalOrderId,
        customerName: po.order.customerName,
        customerPhone: po.order.customerPhone,
        deliveryAddress: po.order.deliveryAddress,
        totalAmount: po.order.totalAmount,
        status: po.order.status,
        paymentStatus: po.order.paymentStatus,
        assignedDriver: po.assignedDriverId ? {
          id: po.order.driver?.id,
          name: po.order.driver?.name,
          phoneNumber: po.order.driver?.phoneNumber
        } : null,
        fulfillmentType: po.fulfillmentType,
        createdAt: po.order.createdAt,
        updatedAt: po.order.updatedAt
      })),
      count: filteredOrders.length
    });
  } catch (error) {
    console.error('Valkyrie list orders error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to list orders'
    });
  }
});

/**
 * GET /api/valkyrie/v1/orders/:id
 * Get order details
 */
router.get('/orders/:id', valkyrieAuth.authenticate, valkyrieAuth.enforcePartnerScope, async (req, res) => {
  try {
    const { id } = req.params;

    const partnerOrder = await db.ValkyriePartnerOrder.findOne({
      where: {
        partnerId: req.partnerId,
        orderId: id
      },
      include: [{
        model: db.Order,
        as: 'order',
        include: [{
          model: db.OrderItem,
          as: 'items',
          include: [{
            model: db.Drink,
            as: 'drink'
          }]
        }, {
          model: db.Driver,
          as: 'driver',
          attributes: ['id', 'name', 'phoneNumber', 'status']
        }]
      }]
    });

    if (!partnerOrder) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      order: {
        id: partnerOrder.order.id,
        partnerOrderId: partnerOrder.id,
        externalOrderId: partnerOrder.externalOrderId,
        customerName: partnerOrder.order.customerName,
        customerPhone: partnerOrder.order.customerPhone,
        customerEmail: partnerOrder.order.customerEmail,
        deliveryAddress: partnerOrder.order.deliveryAddress,
        totalAmount: partnerOrder.order.totalAmount,
        tipAmount: partnerOrder.order.tipAmount,
        status: partnerOrder.order.status,
        paymentStatus: partnerOrder.order.paymentStatus,
        paymentType: partnerOrder.order.paymentType,
        paymentMethod: partnerOrder.order.paymentMethod,
        notes: partnerOrder.order.notes,
        items: partnerOrder.order.items,
        assignedDriver: partnerOrder.assignedDriverId ? {
          id: partnerOrder.order.driver?.id,
          name: partnerOrder.order.driver?.name,
          phoneNumber: partnerOrder.order.driver?.phoneNumber,
          status: partnerOrder.order.driver?.status
        } : null,
        fulfillmentType: partnerOrder.fulfillmentType,
        createdAt: partnerOrder.order.createdAt,
        updatedAt: partnerOrder.order.updatedAt
      }
    });
  } catch (error) {
    console.error('Valkyrie get order error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get order'
    });
  }
});

/**
 * POST /api/valkyrie/v1/orders/:id/request-driver
 * Request driver assignment via Valkyrie rules engine
 */
router.post('/orders/:id/request-driver', valkyrieAuth.authenticate, valkyrieAuth.enforcePartnerScope, async (req, res) => {
  try {
    const { id } = req.params;
    const { driverId, fulfillmentType } = req.body;

    // Get available drivers
    const availableDrivers = await valkyrieService.getAvailableDriversForPartner(req.partnerId);

    if (availableDrivers.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No drivers available for this partner'
      });
    }

    // If driverId is provided, use it; otherwise, select first available
    const selectedDriverId = driverId || availableDrivers[0].id;
    const selectedDriver = availableDrivers.find(d => d.id === selectedDriverId);

    if (!selectedDriver) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Driver not available for this partner'
      });
    }

    // Determine fulfillment type
    const determinedFulfillmentType = fulfillmentType || selectedDriver.ownershipType === 'partner_owned' 
      ? 'partner_driver' 
      : 'deliveryos_driver';

    // Assign driver
    const partnerOrder = await valkyrieService.assignDriverToPartnerOrder(
      req.partnerId,
      parseInt(id),
      selectedDriverId,
      determinedFulfillmentType
    );

    res.json({
      success: true,
      message: 'Driver assigned successfully',
      driver: {
        id: selectedDriver.id,
        name: selectedDriver.name,
        phoneNumber: selectedDriver.phoneNumber,
        ownershipType: selectedDriver.ownershipType
      },
      fulfillmentType: determinedFulfillmentType,
      partnerOrderId: partnerOrder.id
    });
  } catch (error) {
    console.error('Valkyrie request driver error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to assign driver'
    });
  }
});

/**
 * GET /api/valkyrie/v1/orders/:id/driver
 * Get assigned driver details (limited fields)
 */
router.get('/orders/:id/driver', valkyrieAuth.authenticate, valkyrieAuth.enforcePartnerScope, async (req, res) => {
  try {
    const { id } = req.params;

    const partnerOrder = await db.ValkyriePartnerOrder.findOne({
      where: {
        partnerId: req.partnerId,
        orderId: id
      },
      include: [{
        model: db.Driver,
        as: 'assignedDriver',
        attributes: ['id', 'name', 'phoneNumber', 'status']
      }]
    });

    if (!partnerOrder) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Order not found'
      });
    }

    if (!partnerOrder.assignedDriverId) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No driver assigned to this order'
      });
    }

    res.json({
      success: true,
      driver: {
        id: partnerOrder.assignedDriver.id,
        name: partnerOrder.assignedDriver.name,
        phoneNumber: partnerOrder.assignedDriver.phoneNumber,
        status: partnerOrder.assignedDriver.status
      },
      fulfillmentType: partnerOrder.fulfillmentType
    });
  } catch (error) {
    console.error('Valkyrie get driver error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get driver'
    });
  }
});

// ==================== DRIVERS ====================

/**
 * POST /api/valkyrie/v1/drivers
 * Add a partner-owned driver
 */
router.post('/drivers', valkyrieAuth.authenticate, valkyrieAuth.enforcePartnerScope, valkyrieAuth.requireRole('admin', 'ops'), async (req, res) => {
  try {
    const { driverId } = req.body;

    if (!driverId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'driverId is required'
      });
    }

    // Check if driver exists
    const driver = await db.Driver.findByPk(driverId);
    if (!driver) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Driver not found'
      });
    }

    // Check if already added
    const existing = await db.ValkyriePartnerDriver.findOne({
      where: {
        partnerId: req.partnerId,
        driverId: driverId
      }
    });

    if (existing) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Driver already added to this partner'
      });
    }

    // Add driver to partner
    const partnerDriver = await db.ValkyriePartnerDriver.create({
      partnerId: req.partnerId,
      driverId: driverId,
      ownershipType: 'partner_owned',
      active: true
    });

    res.status(201).json({
      success: true,
      driver: {
        id: driver.id,
        name: driver.name,
        phoneNumber: driver.phoneNumber,
        status: driver.status,
        partnerDriverId: partnerDriver.id
      }
    });
  } catch (error) {
    console.error('Valkyrie add driver error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to add driver'
    });
  }
});

/**
 * GET /api/valkyrie/v1/drivers
 * List partner drivers
 */
router.get('/drivers', valkyrieAuth.authenticate, valkyrieAuth.enforcePartnerScope, async (req, res) => {
  try {
    const { active } = req.query;

    const filters = {};
    if (active !== undefined) {
      filters.active = active === 'true';
    }

    const partnerDrivers = await valkyrieService.getPartnerDrivers(req.partnerId, filters);

    res.json({
      success: true,
      drivers: partnerDrivers.map(pd => ({
        id: pd.driver.id,
        name: pd.driver.name,
        phoneNumber: pd.driver.phoneNumber,
        status: pd.driver.status,
        lastActivity: pd.driver.lastActivity,
        ownershipType: pd.ownershipType,
        active: pd.active,
        partnerDriverId: pd.id
      })),
      count: partnerDrivers.length
    });
  } catch (error) {
    console.error('Valkyrie list drivers error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to list drivers'
    });
  }
});

/**
 * PATCH /api/valkyrie/v1/drivers/:id/status
 * Activate / deactivate driver
 */
router.patch('/drivers/:id/status', valkyrieAuth.authenticate, valkyrieAuth.enforcePartnerScope, valkyrieAuth.requireRole('admin', 'ops'), async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    if (typeof active !== 'boolean') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'active (boolean) is required'
      });
    }

    const partnerDriver = await db.ValkyriePartnerDriver.findOne({
      where: {
        partnerId: req.partnerId,
        driverId: id
      }
    });

    if (!partnerDriver) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Driver not found for this partner'
      });
    }

    await partnerDriver.update({ active: active });

    res.json({
      success: true,
      message: `Driver ${active ? 'activated' : 'deactivated'} successfully`,
      driver: {
        id: partnerDriver.driverId,
        active: partnerDriver.active
      }
    });
  } catch (error) {
    console.error('Valkyrie update driver status error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update driver status'
    });
  }
});

// ==================== WEBHOOKS ====================

/**
 * GET /api/valkyrie/v1/webhooks
 * Get webhook configuration (read-only)
 */
router.get('/webhooks', valkyrieAuth.authenticate, valkyrieAuth.enforcePartnerScope, async (req, res) => {
  try {
    const partner = await db.ValkyriePartner.findByPk(req.partnerId);

    res.json({
      success: true,
      webhook: {
        url: partner.webhookUrl || null,
        configured: !!partner.webhookUrl
      }
    });
  } catch (error) {
    console.error('Valkyrie get webhook error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get webhook configuration'
    });
  }
});

// ==================== DELIVERY ZONES (GEOFENCES) ====================

/**
 * GET /api/valkyrie/v1/zones
 * List partner's delivery zones (geofences)
 */
router.get('/zones', valkyrieAuth.authenticate, valkyrieAuth.enforcePartnerScope, async (req, res) => {
  try {
    // Use Zeus API endpoint if available, otherwise query directly
    const geofences = await db.PartnerGeofence.findAll({
      where: {
        partnerId: req.partnerId
      },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      zones: geofences.map(g => ({
        id: g.id,
        name: g.name,
        geometry: g.geometry,
        source: g.source,
        active: g.active,
        createdAt: g.createdAt
      })),
      count: geofences.length
    });
  } catch (error) {
    console.error('Valkyrie list zones error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to list delivery zones'
    });
  }
});

/**
 * POST /api/valkyrie/v1/zones
 * Create partner delivery zone (validated against Zeus boundaries)
 */
router.post('/zones', valkyrieAuth.authenticate, valkyrieAuth.enforcePartnerScope, valkyrieAuth.requireRole('admin', 'ops'), async (req, res) => {
  try {
    const { name, geometry, active = true } = req.body;

    if (!name || !geometry) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'name and geometry are required'
      });
    }

    // Extract geometry from Feature if needed for validation
    let geometryForValidation = geometry;
    let geometryToStore = geometry;
    
    if (geometry.type === 'Feature' && geometry.geometry) {
      // For validation, use just the geometry part
      geometryForValidation = geometry.geometry;
      // For storage, keep the full Feature with properties (includes sourceLocations)
      geometryToStore = geometry;
    }

    // Validate GeoJSON
    try {
      geofenceService.validateGeoJSON(geometryForValidation);
    } catch (validationError) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid GeoJSON: ${validationError.message}`
      });
    }

    // Validate against Zeus boundaries
    const validation = await geofenceService.validatePartnerGeofence(req.partnerId, geometryForValidation);
    if (!validation.valid) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Geofence validation failed: ${validation.message}`
      });
    }

    // Create geofence (geometryToStore already set above)
    const geofence = await db.PartnerGeofence.create({
      partnerId: req.partnerId,
      name: name,
      geometry: geometryToStore,
      source: 'partner',
      active: active
    });

    res.status(201).json({
      success: true,
      zone: {
        id: geofence.id,
        name: geofence.name,
        source: geofence.source,
        active: geofence.active
      }
    });
  } catch (error) {
    console.error('Valkyrie create zone error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create delivery zone'
    });
  }
});

/**
 * PATCH /api/valkyrie/v1/zones/:id
 * Update partner delivery zone (only partner-managed zones)
 */
router.patch('/zones/:id', valkyrieAuth.authenticate, valkyrieAuth.enforcePartnerScope, valkyrieAuth.requireRole('admin', 'ops'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, geometry, active } = req.body;

    const geofence = await db.PartnerGeofence.findOne({
      where: {
        id: id,
        partnerId: req.partnerId
      }
    });

    if (!geofence) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Delivery zone not found'
      });
    }

    // Cannot edit Zeus-managed geofences
    if (geofence.source === 'zeus') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot edit Zeus-managed geofences'
      });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (active !== undefined) updates.active = active;
    if (geometry !== undefined) {
      // Extract geometry from Feature if needed
      let geometryForValidation = geometry;
      if (geometry.type === 'Feature' && geometry.geometry) {
        geometryForValidation = geometry.geometry;
      }

      // Validate GeoJSON
      try {
        geofenceService.validateGeoJSON(geometryForValidation);
      } catch (validationError) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Invalid GeoJSON: ${validationError.message}`
        });
      }

      // Validate against Zeus boundaries
      const validation = await geofenceService.validatePartnerGeofence(req.partnerId, geometryForValidation);
      if (!validation.valid) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Geofence validation failed: ${validation.message}`
        });
      }

      // Store the full geometry (Feature with properties) to preserve sourceLocations
      let geometryToStore = geometry;
      if (geometry.type === 'Feature' && geometry.geometry) {
        geometryToStore = geometry;
      } else if (geometry.properties) {
        geometryToStore = geometry;
      }
      updates.geometry = geometryToStore;
    }

    await geofence.update(updates);

    res.json({
      success: true,
      zone: {
        id: geofence.id,
        name: geofence.name,
        active: geofence.active
      }
    });
  } catch (error) {
    console.error('Valkyrie update zone error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update delivery zone'
    });
  }
});

/**
 * DELETE /api/valkyrie/v1/zones/:id
 * Delete partner delivery zone (only partner-managed zones)
 */
router.delete('/zones/:id', valkyrieAuth.authenticate, valkyrieAuth.enforcePartnerScope, valkyrieAuth.requireRole('admin', 'ops'), async (req, res) => {
  try {
    const { id } = req.params;

    const geofence = await db.PartnerGeofence.findOne({
      where: {
        id: id,
        partnerId: req.partnerId
      }
    });

    if (!geofence) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Delivery zone not found'
      });
    }

    // Cannot delete Zeus-managed geofences
    if (geofence.source === 'zeus') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot delete Zeus-managed geofences'
      });
    }

    await geofence.destroy();

    res.json({
      success: true,
      message: 'Delivery zone deleted successfully'
    });
  } catch (error) {
    console.error('Valkyrie delete zone error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete delivery zone'
    });
  }
});

// ==================== PARTNER API KEY MANAGEMENT ====================

/**
 * GET /api/valkyrie/v1/partner
 * Get partner information including masked API key
 */
router.get('/partner', valkyrieAuth.authenticate, valkyrieAuth.enforcePartnerScope, async (req, res) => {
  try {
    const partner = await db.ValkyriePartner.findByPk(req.partnerId, {
      attributes: ['id', 'name', 'status', 'apiKey', 'createdAt', 'updatedAt']
    });

    if (!partner) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Partner not found'
      });
    }

    // Mask API key - show only first 4 characters
    const maskedApiKey = partner.apiKey 
      ? `${partner.apiKey.substring(0, 4)}${'*'.repeat(Math.max(0, partner.apiKey.length - 4))}`
      : null;

    res.json({
      success: true,
      partner: {
        id: partner.id,
        name: partner.name,
        status: partner.status,
        apiKey: maskedApiKey,
        hasApiKey: !!partner.apiKey,
        createdAt: partner.createdAt,
        updatedAt: partner.updatedAt
      }
    });
  } catch (error) {
    console.error('Valkyrie get partner error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get partner information'
    });
  }
});

/**
 * POST /api/valkyrie/v1/partner/api-key
 * Generate or regenerate API key for partner
 * Requires admin or ops role
 */
router.post('/partner/api-key', valkyrieAuth.authenticate, valkyrieAuth.enforcePartnerScope, valkyrieAuth.requireRole('admin', 'ops'), async (req, res) => {
  try {
    const crypto = require('crypto');
    
    // Generate a secure random API key (64 characters)
    const apiKey = crypto.randomBytes(32).toString('hex');

    const partner = await db.ValkyriePartner.findByPk(req.partnerId);

    if (!partner) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Partner not found'
      });
    }

    // Update partner with new API key
    await partner.update({ apiKey });

    // Return the full API key (only shown once)
    res.json({
      success: true,
      message: 'API key generated successfully',
      apiKey: apiKey,
      maskedApiKey: `${apiKey.substring(0, 4)}${'*'.repeat(apiKey.length - 4)}`,
      warning: 'Store this API key securely. It will not be shown again.'
    });
  } catch (error) {
    console.error('Valkyrie generate API key error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate API key'
    });
  }
});

/**
 * POST /api/valkyrie/v1/auth/setup-password
 * Set password for partner user using invitation token
 */
router.post('/auth/setup-password', async (req, res) => {
  try {
    const { token, email, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Token and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Password must be at least 6 characters'
      });
    }

    // Find user by invitation token
    const whereClause = {
      inviteToken: token,
      status: 'active'
    };

    // If email is provided, also verify it matches
    if (email) {
      whereClause.email = email.toLowerCase().trim();
    }

    const partnerUser = await db.ValkyriePartnerUser.findOne({
      where: whereClause,
      include: [{
        model: db.ValkyriePartner,
        as: 'partner',
        where: {
          status: 'active'
        }
      }]
    });

    if (!partnerUser) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Invalid or expired invitation token'
      });
    }

    // Check if token has expired
    if (partnerUser.inviteTokenExpiry && new Date() > new Date(partnerUser.inviteTokenExpiry)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invitation token has expired. Please request a new invitation.'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user with password and clear invitation token
    await partnerUser.update({
      password: hashedPassword,
      inviteToken: null,
      inviteTokenExpiry: null
    });

    // Generate JWT token for immediate login
    const jwtToken = jwt.sign(
      {
        userId: partnerUser.id,
        partnerId: partnerUser.partnerId,
        role: partnerUser.role
      },
      process.env.JWT_SECRET || 'valkyrie-secret-key-change-in-production',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Password set successfully',
      token: jwtToken,
      user: {
        id: partnerUser.id,
        email: partnerUser.email,
        role: partnerUser.role
      },
      partner: {
        id: partnerUser.partner.id,
        name: partnerUser.partner.name
      }
    });
  } catch (error) {
    console.error('Valkyrie setup password error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to set password'
    });
  }
});

module.exports = router;

