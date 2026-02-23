const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const SHOP_AGENT_TOKEN_TTL = process.env.SHOP_AGENT_TOKEN_TTL || '24h';

/**
 * Normalize phone number to handle different formats
 * Converts: +254712674333, 254712674333, 0712674333, 712674333 -> 254712674333
 */
const normalizePhoneNumber = (phone) => {
  if (!phone) return null;
  
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Handle different formats
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    // Format: 0712674333 -> 254712674333
    cleaned = '254' + cleaned.substring(1);
  } else if (cleaned.startsWith('254') && cleaned.length === 12) {
    // Format: 254712674333 (already correct)
    cleaned = cleaned;
  } else if (!cleaned.startsWith('254') && cleaned.length === 9) {
    // Format: 712674333 -> 254712674333
    cleaned = '254' + cleaned;
  }
  
  return cleaned;
};

/**
 * Set PIN for shop agent using phone number and OTP verification
 * POST /api/shop-agents/set-pin
 */
router.post('/set-pin', async (req, res) => {
  try {
    const { mobileNumber, pin, otpCode } = req.body;

    if (!mobileNumber || !pin) {
      return res.status(400).json({
        success: false,
        error: 'Mobile number and PIN are required'
      });
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        error: 'PIN must be exactly 4 digits'
      });
    }

    // Normalize phone number
    const normalizedMobile = normalizePhoneNumber(mobileNumber);
    
    if (!normalizedMobile) {
      return res.status(400).json({
        success: false,
        error: 'Invalid mobile number format'
      });
    }

    // Find shop agent by mobile number (try normalized and original format)
    const shopAgent = await db.Admin.findOne({
      where: {
        role: 'shop_agent',
        mobileNumber: {
          [Op.in]: [normalizedMobile, mobileNumber.trim(), normalizedMobile.replace(/^254/, '0')]
        }
      }
    });

    if (!shopAgent) {
      return res.status(404).json({
        success: false,
        error: 'Shop agent not found'
      });
    }

    // If OTP code provided, verify it
    if (otpCode) {
      const Otp = db.Otp;
      
      // Normalize phone number and try multiple formats to find OTP
      // OTP is stored with cleaned phone (digits only), but format may vary
      const cleanedPhone = normalizedMobile.replace(/\D/g, '');
      const phoneVariations = [
        cleanedPhone,                    // 254712674333
        cleanedPhone.replace(/^254/, '0'), // 0712674333
        cleanedPhone.replace(/^254/, ''),  // 712674333
        mobileNumber.trim().replace(/\D/g, ''), // Original format cleaned
        normalizedMobile.replace(/\D/g, '')     // Normalized format cleaned
      ];
      
      // Remove duplicates
      const uniqueVariations = [...new Set(phoneVariations)];
      
      console.log(`🔍 Verifying OTP for phone: ${mobileNumber} (trying variations: ${uniqueVariations.join(', ')})`);
      
      // Try to find OTP with any of the phone number variations
      let otp = null;
      for (const phoneVariant of uniqueVariations) {
        otp = await Otp.findOne({
          where: {
            phoneNumber: phoneVariant,
            otpCode: otpCode,
            isUsed: false,
            expiresAt: {
              [Op.gt]: new Date()
            }
          },
          order: [['createdAt', 'DESC']]
        });
        
        if (otp) {
          console.log(`✅ OTP found with phone variant: ${phoneVariant}`);
          break;
        }
      }

      if (!otp) {
        console.log(`❌ OTP not found for code: ${otpCode}, phone variations tried: ${uniqueVariations.join(', ')}`);
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired OTP code'
        });
      }

      // Mark OTP as used
      await otp.update({ isUsed: true });
      console.log(`✅ OTP verified and marked as used`);
    }

    // Hash the PIN
    const pinHash = await bcrypt.hash(pin, 10);

    // Update shop agent with PIN
    await shopAgent.update({
      pinHash,
      hasSetPin: true,
      inviteToken: null, // Clear invite token if exists
      inviteTokenExpiry: null
    });

    // Generate JWT token
    const tokenPayload = {
      id: shopAgent.id,
      role: 'shop_agent',
      mobileNumber: shopAgent.mobileNumber
    };

    const authToken = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: SHOP_AGENT_TOKEN_TTL
    });

    return res.json({
      success: true,
      message: 'PIN set successfully',
      token: authToken,
      user: {
        id: shopAgent.id,
        name: shopAgent.name,
        mobileNumber: shopAgent.mobileNumber,
        role: shopAgent.role
      }
    });
  } catch (error) {
    console.error('Error setting PIN:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to set PIN. Please try again.'
    });
  }
});

/**
 * Setup PIN for shop agent using invitation token
 * POST /api/shop-agents/setup-pin
 */
router.post('/setup-pin', async (req, res) => {
  try {
    const { token, pin } = req.body;

    if (!token || !pin) {
      return res.status(400).json({
        success: false,
        error: 'Token and PIN are required'
      });
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        error: 'PIN must be exactly 4 digits'
      });
    }

    // Find shop agent by invite token
    const shopAgent = await db.Admin.findOne({
      where: {
        role: 'shop_agent',
        inviteToken: token,
        inviteTokenExpiry: {
          [Op.gt]: new Date() // Token not expired
        }
      }
    });

    if (!shopAgent) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired invitation token'
      });
    }

    // Check if PIN already set
    if (shopAgent.hasSetPin) {
      return res.status(400).json({
        success: false,
        error: 'PIN has already been set for this account'
      });
    }

    // Hash the PIN
    const pinHash = await bcrypt.hash(pin, 10);

    // Update shop agent with PIN
    await shopAgent.update({
      pinHash,
      hasSetPin: true,
      inviteToken: null, // Clear invite token after PIN is set
      inviteTokenExpiry: null
    });

    // Generate JWT token
    const tokenPayload = {
      id: shopAgent.id,
      role: 'shop_agent',
      mobileNumber: shopAgent.mobileNumber
    };

    const authToken = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: SHOP_AGENT_TOKEN_TTL
    });

    return res.json({
      success: true,
      message: 'PIN set successfully',
      token: authToken,
      user: {
        id: shopAgent.id,
        name: shopAgent.name,
        mobileNumber: shopAgent.mobileNumber,
        role: shopAgent.role
      }
    });
  } catch (error) {
    console.error('Error setting up PIN:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to set PIN. Please try again.'
    });
  }
});

/**
 * Login for shop agent using mobile number and PIN
 * POST /api/shop-agents/login
 */
router.post('/login', async (req, res) => {
  try {
    const { mobileNumber, pin } = req.body;

    if (!mobileNumber || !pin) {
      return res.status(400).json({
        success: false,
        error: 'Mobile number and PIN are required'
      });
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        error: 'PIN must be exactly 4 digits'
      });
    }

    // Normalize phone number
    const normalizedMobile = normalizePhoneNumber(mobileNumber);
    
    if (!normalizedMobile) {
      return res.status(400).json({
        success: false,
        error: 'Invalid mobile number format'
      });
    }

    // Find shop agent by mobile number (try normalized and original format)
    // Use try-catch to handle potential database column issues
    let shopAgent;
    try {
      shopAgent = await db.Admin.findOne({
        where: {
          role: 'shop_agent',
          mobileNumber: {
            [Op.in]: [normalizedMobile, mobileNumber.trim(), normalizedMobile.replace(/^254/, '0')]
          }
        },
        attributes: ['id', 'name', 'mobileNumber', 'role', 'pinHash', 'hasSetPin', 'pushToken']
      });
    } catch (dbError) {
      // If pushToken column doesn't exist, try without it
      if (dbError.message && dbError.message.includes('pushToken')) {
        console.warn('pushToken column not found, querying without it');
        shopAgent = await db.Admin.findOne({
          where: {
            role: 'shop_agent',
            mobileNumber: {
              [Op.in]: [normalizedMobile, mobileNumber.trim(), normalizedMobile.replace(/^254/, '0')]
            }
          },
          attributes: ['id', 'name', 'mobileNumber', 'role', 'pinHash', 'hasSetPin']
        });
      } else {
        throw dbError; // Re-throw if it's a different error
      }
    }

    if (!shopAgent) {
      return res.status(401).json({
        success: false,
        error: 'Invalid mobile number or PIN'
      });
    }

    // Check if PIN is set
    if (!shopAgent.hasSetPin || !shopAgent.pinHash) {
      return res.status(401).json({
        success: false,
        error: 'PIN not set. Please use the invitation link to set your PIN first.'
      });
    }

    // Verify PIN
    const isPinValid = await bcrypt.compare(pin, shopAgent.pinHash);

    if (!isPinValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid mobile number or PIN'
      });
    }

    // Generate JWT token
    const tokenPayload = {
      id: shopAgent.id,
      role: 'shop_agent',
      mobileNumber: shopAgent.mobileNumber
    };

    const authToken = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: SHOP_AGENT_TOKEN_TTL
    });

    return res.json({
      success: true,
      message: 'Login successful',
      token: authToken,
      user: {
        id: shopAgent.id,
        name: shopAgent.name,
        mobileNumber: shopAgent.mobileNumber,
        role: shopAgent.role
      }
    });
  } catch (error) {
    console.error('Shop agent login error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to login. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Check shop agent by phone number and return PIN status
 * GET /api/shop-agents/phone/:phoneNumber
 */
router.get('/phone/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    if (!phoneNumber) {
      return res.status(400).json({
        error: 'Phone number is required'
      });
    }

    // Normalize the phone number to handle different formats
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    
    if (!normalizedPhone) {
      return res.status(400).json({
        error: 'Invalid phone number format'
      });
    }

    console.log(`🔍 Checking shop agent for phone: ${phoneNumber} (normalized: ${normalizedPhone})`);

    // Try to find shop agent with normalized phone number
    // Also try common variations in case the stored format differs
    const phoneVariations = [
      normalizedPhone,                    // 254712674333
      normalizedPhone.replace(/^254/, '0'), // 0712674333
      normalizedPhone.replace(/^254/, ''),  // 712674333
      `+${normalizedPhone}`,              // +254712674333
      phoneNumber.trim()                   // Original format
    ];

    // Remove duplicates
    const uniqueVariations = [...new Set(phoneVariations)];

    const shopAgent = await db.Admin.findOne({
      where: {
        role: 'shop_agent',
        mobileNumber: {
          [Op.in]: uniqueVariations
        }
      },
      attributes: ['id', 'name', 'mobileNumber', 'hasSetPin', 'role']
    });

    if (!shopAgent) {
      console.log(`❌ Shop agent not found for phone: ${phoneNumber} (tried variations: ${uniqueVariations.join(', ')})`);
      return res.status(404).json({
        error: 'Shop agent not found'
      });
    }

    console.log(`✅ Shop agent found: ${shopAgent.name} (${shopAgent.mobileNumber}), hasPin: ${shopAgent.hasSetPin}`);

    return res.json({
      id: shopAgent.id,
      name: shopAgent.name,
      mobileNumber: shopAgent.mobileNumber,
      role: shopAgent.role,
      hasPin: shopAgent.hasSetPin || false
    });
  } catch (error) {
    console.error('Error checking shop agent:', error);
    return res.status(500).json({
      error: 'Failed to check shop agent'
    });
  }
});

/**
 * Get current shop agent profile
 * GET /api/shop-agents/me
 */
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return res.status(401).json({ error: 'Authorization token missing' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      if (decoded.role !== 'shop_agent') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const shopAgent = await db.Admin.findByPk(decoded.id);

      if (!shopAgent || shopAgent.role !== 'shop_agent') {
        return res.status(404).json({ error: 'Shop agent not found' });
      }

      return res.json({
        id: shopAgent.id,
        name: shopAgent.name,
        mobileNumber: shopAgent.mobileNumber,
        role: shopAgent.role
      });
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    console.error('Error fetching shop agent profile:', error);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * Get all inventory items for shop agent to check
 * GET /api/shop-agents/inventory-items
 */
router.get('/inventory-items', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return res.status(401).json({ error: 'Authorization token missing' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      if (decoded.role !== 'shop_agent') {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get all drinks with their current stock
      const drinks = await db.Drink.findAll({
        attributes: ['id', 'name', 'barcode', 'stock', 'isAvailable'],
        include: [{
          model: db.Category,
          as: 'category',
          attributes: ['id', 'name']
        }],
        order: [['name', 'ASC']]
      });

      return res.json({
        success: true,
        data: {
          success: true,
          items: drinks.map(drink => ({
            id: drink.id,
            name: drink.name,
            barcode: drink.barcode,
            currentStock: drink.stock || 0,
            isAvailable: drink.isAvailable,
            category: drink.category ? {
              id: drink.category.id,
              name: drink.category.name
            } : null
          }))
        }
      });
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    console.error('Error fetching inventory items:', error);
    return res.status(500).json({ error: 'Failed to fetch inventory items' });
  }
});

/**
 * Submit inventory check
 * POST /api/shop-agents/inventory-check
 */
router.post('/inventory-check', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return res.status(401).json({ error: 'Authorization token missing' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      if (decoded.role !== 'shop_agent') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { items } = req.body; // Array of { drinkId, count }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Items array is required and must not be empty'
        });
      }

      const shopAgentId = decoded.id;
      const results = [];
      const errors = [];

      // Process each item
      for (const item of items) {
        try {
          const { drinkId, count } = item;

          if (!drinkId || count === undefined || count === null) {
            errors.push({
              drinkId: drinkId || 'unknown',
              error: 'drinkId and count are required'
            });
            continue;
          }

          // Get current database count
          const drink = await db.Drink.findByPk(drinkId);
          if (!drink) {
            errors.push({
              drinkId,
              error: 'Drink not found'
            });
            continue;
          }

          const databaseCount = drink.stock || 0;
          const agentCount = parseInt(count) || 0;
          const isFlagged = agentCount !== databaseCount;

          // Create inventory check record
          const inventoryCheck = await db.InventoryCheck.create({
            shopAgentId,
            drinkId,
            agentCount,
            databaseCount,
            isFlagged,
            status: 'pending'
          });

          results.push({
            drinkId,
            drinkName: drink.name,
            agentCount,
            databaseCount,
            isFlagged,
            checkId: inventoryCheck.id
          });
        } catch (itemError) {
          console.error(`Error processing item ${item.drinkId}:`, itemError);
          errors.push({
            drinkId: item.drinkId || 'unknown',
            error: itemError.message
          });
        }
      }

      return res.json({
        success: true,
        data: {
          success: true,
          message: `Inventory check submitted for ${results.length} item(s)`,
          results,
          errors: errors.length > 0 ? errors : undefined
        }
      });
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    console.error('Error submitting inventory check:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to submit inventory check'
    });
  }
});

/**
 * Get inventory check history for shop agent
 * GET /api/shop-agents/inventory-check-history
 */
/**
 * Register or update shop agent push token (native FCM/APNs)
 * POST /api/shop-agents/push-token
 */
router.post('/push-token', async (req, res) => {
  try {
    const { shopAgentId, pushToken, tokenType } = req.body;

    console.log(`📱 Push token registration request received for shop agent #${shopAgentId}`);
    console.log(`📱 Token preview: ${pushToken ? pushToken.substring(0, 20) + '...' : 'null'}`);
    console.log(`📱 Token type: ${tokenType || 'not provided'}`);

    if (!shopAgentId || !pushToken) {
      console.error('❌ Missing required fields: shopAgentId or pushToken');
      return res.status(400).json({
        success: false,
        error: 'shopAgentId and pushToken are required'
      });
    }

    if (!pushToken || pushToken.length < 10) {
      console.error(`❌ Invalid push token format: length=${pushToken?.length || 0}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid push token format'
      });
    }

    const shopAgent = await db.Admin.findOne({
      where: {
        id: shopAgentId,
        role: 'shop_agent'
      }
    });

    if (!shopAgent) {
      console.error(`❌ Shop agent #${shopAgentId} not found`);
      return res.status(404).json({
        success: false,
        error: 'Shop agent not found'
      });
    }

    const detectedTokenType = tokenType || 'FCM/Native';
    
    console.log(`📱 Saving ${detectedTokenType} push token for shop agent #${shopAgentId} (${shopAgent.name || 'Unknown'})...`);
    console.log(`📱 Token length: ${pushToken.length} characters`);
    
    shopAgent.pushToken = pushToken;
    await shopAgent.save();
    
    // Verify it was saved
    const savedShopAgent = await db.Admin.findByPk(shopAgentId);
    if (savedShopAgent && savedShopAgent.pushToken === pushToken) {
      console.log(`✅ Push token successfully saved and verified for shop agent #${shopAgentId}`);
    } else {
      console.error(`❌ Push token verification failed for shop agent #${shopAgentId}`);
    }

    return res.json({
      success: true,
      data: {
        shopAgentId: shopAgent.id,
        pushToken: shopAgent.pushToken,
        tokenType: detectedTokenType
      }
    });
  } catch (error) {
    console.error('❌ Error saving shop agent push token:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      error: 'Failed to save push token',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.get('/inventory-check-history', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return res.status(401).json({ error: 'Authorization token missing' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      if (decoded.role !== 'shop_agent') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const shopAgentId = decoded.id;
      const { status } = req.query; // Optional filter by status

      const whereClause = { shopAgentId };
      if (status) {
        whereClause.status = status;
      }

      const inventoryChecks = await db.InventoryCheck.findAll({
        where: whereClause,
        include: [
          {
            model: db.Drink,
            as: 'drink',
            attributes: ['id', 'name', 'barcode', 'stock'],
            include: [{
              model: db.Category,
              as: 'category',
              attributes: ['id', 'name']
            }]
          },
          {
            model: db.Admin,
            as: 'approver',
            attributes: ['id', 'name', 'username'],
            required: false
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      return res.json({
        success: true,
        data: {
          success: true,
          checks: inventoryChecks.map(check => ({
            id: check.id,
            drink: check.drink ? {
              id: check.drink.id,
              name: check.drink.name,
              barcode: check.drink.barcode,
              currentStock: check.drink.stock || 0,
              category: check.drink.category ? {
                id: check.drink.category.id,
                name: check.drink.category.name
              } : null
            } : null,
            agentCount: check.agentCount,
            databaseCount: check.databaseCount,
            status: check.status,
            isFlagged: check.isFlagged,
            approvedBy: check.approver ? {
              id: check.approver.id,
              name: check.approver.name || check.approver.username
            } : null,
            approvedAt: check.approvedAt,
            notes: check.notes,
            createdAt: check.createdAt,
            updatedAt: check.updatedAt
          }))
        }
      });
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    console.error('Error fetching inventory check history:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch inventory check history'
    });
  }
});

module.exports = router;

