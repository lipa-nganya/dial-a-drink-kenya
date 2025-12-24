const express = require('express');
const router = express.Router();
const db = require('../models');
const crypto = require('crypto');
const emailService = require('../services/email');

/**
 * Developers Portal API Routes
 * Public endpoints for sandbox signup and production access requests
 */

// Test endpoint to check if route is accessible
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Developers route is working',
    hasValkyriePartner: !!db.ValkyriePartner
  });
});

/**
 * POST /api/developers/sandbox/signup
 * Create a sandbox partner account
 */
router.post('/sandbox/signup', async (req, res) => {
  try {
    // Debug: Check model availability
    if (!db.ValkyriePartner) {
      return res.status(503).json({
        success: false,
        message: 'ValkyriePartner model not available'
      });
    }

    // Test if model methods are accessible
    if (typeof db.ValkyriePartner.create !== 'function') {
      return res.status(503).json({
        success: false,
        message: 'ValkyriePartner.create is not a function',
        modelType: typeof db.ValkyriePartner
      });
    }

    const { email, companyName, useCase } = req.body;

    // Validate required fields
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Check if partner already exists with this email (skip check if models not loaded)
    // For now, we'll skip the duplicate check since ValkyriePartnerUser model is not available
    // This can be added back when the model is properly configured

    // Check if ValkyriePartner model is available
    if (!db.ValkyriePartner) {
      return res.status(503).json({
        success: false,
        message: 'Valkyrie models not loaded. Please ensure ENABLE_VALKYRIE is set and models are properly configured.'
      });
    }

    // Generate API key
    const apiKey = `sk_test_${crypto.randomBytes(32).toString('hex')}`;

    // Create ValkyriePartner for sandbox
    // Using Sequelize.create() directly - test script confirmed this works
    let partner;
    try {
      // Create partner exactly as test script does
      partner = await db.ValkyriePartner.create({
        name: companyName || `Sandbox Partner (${normalizedEmail})`,
        status: 'active',
        environment: 'sandbox',
        productionEnabled: false,
        billingPlan: 'sandbox',
        apiRateLimit: 100,
        apiKey: apiKey,
        zeusManaged: false
      });
    } catch (createError) {
      // Log full error details for debugging
      console.error('❌ Sandbox partner creation error:');
      console.error('   Message:', createError.message);
      console.error('   Name:', createError.name);
      console.error('   Original:', createError.original?.message || 'N/A');
      console.error('   SQL:', createError.sql || 'N/A');
      
      // If it's a unique constraint error on apiKey, try with a new key
      if (createError.name === 'SequelizeUniqueConstraintError') {
        const newApiKey = `sk_test_${crypto.randomBytes(32).toString('hex')}`;
        try {
          partner = await db.ValkyriePartner.create({
            name: companyName || `Sandbox Partner (${normalizedEmail})`,
            status: 'active',
            environment: 'sandbox',
            productionEnabled: false,
            billingPlan: 'sandbox',
            apiRateLimit: 100,
            apiKey: newApiKey,
            zeusManaged: false
          });
          // Update the apiKey variable for response
          apiKey = newApiKey;
        } catch (retryError) {
          throw new Error(`Failed to create partner after retry: ${retryError.message}`);
        }
      } else {
        throw new Error(`Failed to create partner: ${createError.message}`);
      }
    }

    // Create a default sandbox geofence for this partner (Nairobi area)
    const defaultGeometry = {
      type: 'Polygon',
      coordinates: [[
        [36.7, -1.4],
        [36.9, -1.4],
        [36.9, -1.2],
        [36.7, -1.2],
        [36.7, -1.4]
      ]]
    };

    // Create geofence (skip if model not loaded) - temporarily disabled to debug
    // try {
    //   if (db.PartnerGeofence) {
    //     await db.PartnerGeofence.create({
    //       partnerId: partner.id,
    //       name: 'Sandbox Default',
    //       geometry: defaultGeometry,
    //       source: 'partner',
    //       active: true
    //     });
    //   }
    // } catch (geofenceError) {
    //   console.warn('Could not create geofence:', geofenceError.message);
    // }

    // Create partner user with invitation token
    let partnerUser = null;
    let inviteToken = null;
    try {
      if (db.ValkyriePartnerUser) {
        // Generate invitation token
        inviteToken = emailService.generateEmailToken();
        const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        
        partnerUser = await db.ValkyriePartnerUser.create({
          partnerId: partner.id,
          email: normalizedEmail,
          role: 'admin',
          status: 'active',
          inviteToken: inviteToken,
          inviteTokenExpiry: inviteTokenExpiry
        });
        
        // Send invitation email
        const emailResult = await emailService.sendPartnerInvite(
          normalizedEmail,
          inviteToken,
          partner.name,
          apiKey
        );
        
        if (!emailResult.success) {
          console.error('❌ Failed to send invitation email to', normalizedEmail, ':', emailResult.error);
          console.error('   Email error details:', JSON.stringify(emailResult, null, 2));
          // Continue - partner is created, email can be resent later
        } else {
          console.log('✅ Invitation email sent to', normalizedEmail);
          console.log('   Email message ID:', emailResult.messageId);
        }
      }
    } catch (userError) {
      console.warn('Could not create partner user:', userError.message);
      // Continue - partner is created, user can be added later
    }

    // Set expiration date (90 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    // Determine API base URL based on environment
    const hostname = req.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const apiBaseUrl = isLocal
      ? 'http://localhost:5001/api/valkyrie/v1'
      : process.env.SANDBOX_API_BASE_URL || 'https://dialadrink-backend-910510650031.us-central1.run.app/api/valkyrie/v1';

    res.json({
      success: true,
      message: 'Sandbox account created successfully',
      sandboxPartner: {
        id: partner.id,
        email: normalizedEmail,
        apiKey: apiKey,
        expiresAt: expiresAt.toISOString()
      },
      apiBaseUrl: apiBaseUrl
    });
  } catch (error) {
    console.error('Sandbox signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create sandbox account',
      error: error.message
    });
  }
});

module.exports = router;

