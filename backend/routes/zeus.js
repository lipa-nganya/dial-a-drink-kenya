const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticate: authenticateZeus, requireRole: requireZeusRole } = require('../middleware/zeusAuth');
const geofenceService = require('../services/geofence');
const usageTrackingService = require('../services/usageTracking');

/**
 * Zeus Super Admin API v1
 * All routes are under /api/zeus/v1
 */

// ==================== AUTHENTICATION ====================

/**
 * POST /api/zeus/v1/auth/token
 * Authenticate Zeus admin and get JWT token
 */
router.post('/auth/token', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password are required'
      });
    }

    const zeusAdmin = await db.ZeusAdmin.findOne({
      where: {
        email: email.toLowerCase().trim(),
        status: 'active'
      }
    });

    if (!zeusAdmin) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      });
    }

    if (!zeusAdmin.password) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Password not set. Please contact administrator.'
      });
    }

    const isValidPassword = await bcrypt.compare(password, zeusAdmin.password);

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      });
    }

    const token = jwt.sign(
      {
        adminId: zeusAdmin.id,
        email: zeusAdmin.email,
        role: zeusAdmin.role
      },
      process.env.JWT_SECRET || 'zeus-secret-key-change-in-production',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token: token,
      admin: {
        id: zeusAdmin.id,
        email: zeusAdmin.email,
        role: zeusAdmin.role
      }
    });
  } catch (error) {
    console.error('Zeus auth error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed'
    });
  }
});

// ==================== PARTNER MANAGEMENT ====================

/**
 * GET /api/zeus/v1/partners
 * List all Valkyrie partners
 */
router.get('/partners', authenticateZeus, requireZeusRole('super_admin', 'ops', 'finance'), async (req, res) => {
  try {
    const { status, search, environment } = req.query;
    const where = {};

    if (status) {
      where.status = status;
    }

    if (environment) {
      where.environment = environment; // Filter by 'sandbox' or 'production'
    }

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { apiKey: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const partners = await db.ValkyriePartner.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: db.PartnerGeofence,
          as: 'geofences',
          required: false
        },
        {
          model: db.ValkyriePartnerUser,
          as: 'users',
          required: false,
          attributes: ['email'],
          limit: 1 // Just get the first user's email
        }
      ]
    });

    res.json({
      success: true,
      partners: partners.map(p => ({
        id: p.id,
        name: p.name,
        status: p.status,
        environment: p.environment || 'sandbox', // Include environment
        email: p.users && p.users.length > 0 ? p.users[0].email : null, // Get email from first user
        apiRateLimit: p.apiRateLimit,
        allowedCities: p.allowedCities,
        allowedVehicleTypes: p.allowedVehicleTypes,
        billingPlan: p.billingPlan,
        productionEnabled: p.productionEnabled || false,
        geofenceCount: p.geofences?.length || 0,
        createdAt: p.createdAt
      })),
      count: partners.length
    });
  } catch (error) {
    console.error('Zeus list partners error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to list partners'
    });
  }
});

/**
 * GET /api/zeus/v1/partners/:id
 * Get partner details
 */
router.get('/partners/:id', authenticateZeus, requireZeusRole('super_admin', 'ops', 'finance'), async (req, res) => {
  try {
    const { id } = req.params;

    const partner = await db.ValkyriePartner.findByPk(id, {
      include: [
        {
          model: db.PartnerGeofence,
          as: 'geofences'
        },
        {
          model: db.ValkyriePartnerUser,
          as: 'users'
        }
      ]
    });

    if (!partner) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Partner not found'
      });
    }

    res.json({
      success: true,
      partner: {
        id: partner.id,
        name: partner.name,
        status: partner.status,
        apiRateLimit: partner.apiRateLimit,
        allowedCities: partner.allowedCities,
        allowedVehicleTypes: partner.allowedVehicleTypes,
        billingPlan: partner.billingPlan,
        geofences: partner.geofences || [],
        users: partner.users || [],
        createdAt: partner.createdAt
      }
    });
  } catch (error) {
    console.error('Zeus get partner error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get partner'
    });
  }
});

/**
 * POST /api/zeus/v1/partners
 * Create a new Valkyrie partner
 */
router.post('/partners', authenticateZeus, requireZeusRole('super_admin'), async (req, res) => {
  try {
    const { name, status, apiRateLimit, allowedCities, allowedVehicleTypes, billingPlan } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Partner name is required'
      });
    }

    // Generate API key
    const crypto = require('crypto');
    const apiKey = crypto.randomBytes(32).toString('hex');
    const apiSecret = crypto.randomBytes(32).toString('hex');

    const partner = await db.ValkyriePartner.create({
      name,
      status: status || 'active',
      apiRateLimit: apiRateLimit || 100,
      allowedCities: allowedCities || [],
      allowedVehicleTypes: allowedVehicleTypes || [],
      billingPlan: billingPlan || 'standard',
      apiKey,
      apiSecret,
      zeusManaged: true
    });

    res.status(201).json({
      success: true,
      partner: {
        id: partner.id,
        name: partner.name,
        status: partner.status,
        apiKey: apiKey,
        apiRateLimit: partner.apiRateLimit
      }
    });
  } catch (error) {
    console.error('Zeus create partner error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create partner'
    });
  }
});

/**
 * PATCH /api/zeus/v1/partners/:id
 * Update partner (status, limits, etc.)
 */
router.patch('/partners/:id', authenticateZeus, requireZeusRole('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, apiRateLimit, allowedCities, allowedVehicleTypes, billingPlan } = req.body;

    const partner = await db.ValkyriePartner.findByPk(id);

    if (!partner) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Partner not found'
      });
    }

    const updates = {};
    if (status !== undefined) updates.status = status;
    if (apiRateLimit !== undefined) updates.apiRateLimit = apiRateLimit;
    if (allowedCities !== undefined) updates.allowedCities = allowedCities;
    if (allowedVehicleTypes !== undefined) updates.allowedVehicleTypes = allowedVehicleTypes;
    if (billingPlan !== undefined) updates.billingPlan = billingPlan;

    await partner.update(updates);

    res.json({
      success: true,
      partner: {
        id: partner.id,
        name: partner.name,
        status: partner.status,
        apiRateLimit: partner.apiRateLimit
      }
    });
  } catch (error) {
    console.error('Zeus update partner error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update partner'
    });
  }
});

/**
 * DELETE /api/zeus/v1/partners/:id
 * Delete a partner (only super_admin)
 * This will cascade delete related data (users, geofences, orders, etc.)
 */
router.delete('/partners/:id', authenticateZeus, requireZeusRole('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const partner = await db.ValkyriePartner.findByPk(id, {
      include: [
        {
          model: db.ValkyriePartnerUser,
          as: 'users',
          required: false
        },
        {
          model: db.PartnerGeofence,
          as: 'geofences',
          required: false
        },
        {
          model: db.ValkyriePartnerOrder,
          as: 'partnerOrders',
          required: false
        }
      ]
    });

    if (!partner) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Partner not found'
      });
    }

    // Get counts for response
    const usersCount = partner.users?.length || 0;
    const geofencesCount = partner.geofences?.length || 0;
    const ordersCount = partner.partnerOrders?.length || 0;

    // Delete related data first (cascade delete)
    if (db.ValkyriePartnerUser) {
      await db.ValkyriePartnerUser.destroy({
        where: { partnerId: id }
      });
    }

    if (db.PartnerGeofence) {
      await db.PartnerGeofence.destroy({
        where: { partnerId: id }
      });
    }

    if (db.ValkyriePartnerOrder) {
      await db.ValkyriePartnerOrder.destroy({
        where: { partnerId: id }
      });
    }

    // Delete partner usage records
    if (db.PartnerUsage) {
      await db.PartnerUsage.destroy({
        where: { partnerId: id }
      });
    }

    // Delete partner invoices
    if (db.PartnerInvoice) {
      await db.PartnerInvoice.destroy({
        where: { partnerId: id }
      });
    }

    // Finally, delete the partner
    await partner.destroy();

    res.json({
      success: true,
      message: 'Partner deleted successfully',
      deleted: {
        partner: {
          id: partner.id,
          name: partner.name
        },
        relatedData: {
          users: usersCount,
          geofences: geofencesCount,
          orders: ordersCount
        }
      }
    });
  } catch (error) {
    console.error('Zeus delete partner error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete partner'
    });
  }
});

// ==================== GEOFENCE MANAGEMENT ====================

/**
 * GET /api/zeus/v1/geofences
 * List all geofences (with optional partner filter)
 */
router.get('/geofences', authenticateZeus, requireZeusRole('super_admin', 'ops'), async (req, res) => {
  try {
    const { partnerId, source } = req.query;
    const where = {};

    if (partnerId) {
      where.partnerId = partnerId;
    }

    if (source) {
      where.source = source;
    }

    const geofences = await db.PartnerGeofence.findAll({
      where,
      include: [{
        model: db.ValkyriePartner,
        as: 'partner',
        attributes: ['id', 'name']
      }, {
        model: db.ZeusAdmin,
        as: 'creator',
        attributes: ['id', 'email'],
        required: false
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      geofences: geofences.map(g => ({
        id: g.id,
        partnerId: g.partnerId,
        partnerName: g.partner?.name,
        name: g.name,
        geometry: g.geometry,
        source: g.source,
        active: g.active,
        createdBy: g.createdBy,
        creatorEmail: g.creator?.email,
        createdAt: g.createdAt
      })),
      count: geofences.length
    });
  } catch (error) {
    console.error('Zeus list geofences error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to list geofences'
    });
  }
});

/**
 * POST /api/zeus/v1/geofences
 * Create a Zeus-managed geofence
 */
router.post('/geofences', authenticateZeus, requireZeusRole('super_admin', 'ops'), async (req, res) => {
  try {
    const { partnerId, name, geometry, active = true } = req.body;

    if (!partnerId || !name || !geometry) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'partnerId, name, and geometry are required'
      });
    }

      // Validate GeoJSON
      try {
        geofenceService.validateGeoJSON(geometry);
    } catch (validationError) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Invalid GeoJSON: ${validationError.message}`
      });
    }

    // Verify partner exists
    const partner = await db.ValkyriePartner.findByPk(partnerId);
    if (!partner) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Partner not found'
      });
    }

    const geofence = await db.PartnerGeofence.create({
      partnerId,
      name,
      geometry,
      source: 'zeus',
      active,
      createdBy: req.zeusAdmin.id
    });

    res.status(201).json({
      success: true,
      geofence: {
        id: geofence.id,
        partnerId: geofence.partnerId,
        name: geofence.name,
        source: geofence.source,
        active: geofence.active
      }
    });
  } catch (error) {
    console.error('Zeus create geofence error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create geofence'
    });
  }
});

/**
 * PATCH /api/zeus/v1/geofences/:id
 * Update geofence
 */
router.patch('/geofences/:id', authenticateZeus, requireZeusRole('super_admin', 'ops'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, geometry, active } = req.body;

    const geofence = await db.PartnerGeofence.findByPk(id);

    if (!geofence) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Geofence not found'
      });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (geometry !== undefined) {
      // Validate GeoJSON if provided
      try {
        geofenceService.validateGeoJSON(geometry);
        updates.geometry = geometry;
      } catch (validationError) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Invalid GeoJSON: ${validationError.message}`
        });
      }
    }
    if (active !== undefined) updates.active = active;

    await geofence.update(updates);

    res.json({
      success: true,
      geofence: {
        id: geofence.id,
        name: geofence.name,
        active: geofence.active
      }
    });
  } catch (error) {
    console.error('Zeus update geofence error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update geofence'
    });
  }
});

/**
 * DELETE /api/zeus/v1/geofences/:id
 * Delete geofence (only super_admin)
 */
router.delete('/geofences/:id', authenticateZeus, requireZeusRole('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const geofence = await db.PartnerGeofence.findByPk(id);

    if (!geofence) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Geofence not found'
      });
    }

    await geofence.destroy();

    res.json({
      success: true,
      message: 'Geofence deleted successfully'
    });
  } catch (error) {
    console.error('Zeus delete geofence error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete geofence'
    });
  }
});

// ==================== USAGE & BILLING ====================

/**
 * GET /api/zeus/v1/usage/:partnerId
 * Get usage statistics for a partner
 */
router.get('/usage/:partnerId', authenticateZeus, requireZeusRole('super_admin', 'finance'), async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { period, startDate, endDate } = req.query;

    const usage = await usageTrackingService.getUsage(
      partnerId,
      null, // all metrics
      period || 'daily',
      startDate,
      endDate
    );

    res.json({
      success: true,
      usage: usage,
      count: usage.length
    });
  } catch (error) {
    console.error('Zeus get usage error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get usage statistics'
    });
  }
});

/**
 * GET /api/zeus/v1/invoices
 * List invoices (with optional partner filter)
 */
router.get('/invoices', authenticateZeus, requireZeusRole('super_admin', 'finance'), async (req, res) => {
  try {
    const { partnerId, status } = req.query;
    const where = {};

    if (partnerId) {
      where.partnerId = partnerId;
    }

    if (status) {
      where.status = status;
    }

    const invoices = await db.PartnerInvoice.findAll({
      where,
      include: [{
        model: db.ValkyriePartner,
        as: 'partner',
        attributes: ['id', 'name']
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      invoices: invoices.map(inv => ({
        id: inv.id,
        partnerId: inv.partnerId,
        partnerName: inv.partner?.name,
        periodStart: inv.periodStart,
        periodEnd: inv.periodEnd,
        amount: inv.amount,
        currency: inv.currency,
        status: inv.status,
        invoiceNumber: inv.invoiceNumber,
        createdAt: inv.createdAt
      })),
      count: invoices.length
    });
  } catch (error) {
    console.error('Zeus list invoices error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to list invoices'
    });
  }
});

/**
 * POST /api/zeus/v1/invoices
 * Create invoice
 */
router.post('/invoices', authenticateZeus, requireZeusRole('super_admin', 'finance'), async (req, res) => {
  try {
    const { partnerId, periodStart, periodEnd, amount, currency, details } = req.body;

    if (!partnerId || !periodStart || !periodEnd || !amount) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'partnerId, periodStart, periodEnd, and amount are required'
      });
    }

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${partnerId}`;

    const invoice = await db.PartnerInvoice.create({
      partnerId,
      periodStart,
      periodEnd,
      amount,
      currency: currency || 'KES',
      status: 'draft',
      invoiceNumber,
      details: details || {}
    });

    res.status(201).json({
      success: true,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        partnerId: invoice.partnerId,
        amount: invoice.amount,
        status: invoice.status
      }
    });
  } catch (error) {
    console.error('Zeus create invoice error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create invoice'
    });
  }
});

/**
 * PATCH /api/zeus/v1/invoices/:id
 * Update invoice (e.g., mark as issued, paid, void)
 */
router.patch('/invoices/:id', authenticateZeus, requireZeusRole('super_admin', 'finance'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, amount, details } = req.body;

    const invoice = await db.PartnerInvoice.findByPk(id);

    if (!invoice) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Invoice not found'
      });
    }

    const updates = {};
    if (status !== undefined) updates.status = status;
    if (amount !== undefined) updates.amount = amount;
    if (details !== undefined) updates.details = details;

    await invoice.update(updates);

    res.json({
      success: true,
      invoice: {
        id: invoice.id,
        status: invoice.status,
        amount: invoice.amount
      }
    });
  } catch (error) {
    console.error('Zeus update invoice error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update invoice'
    });
  }
});

module.exports = router;
