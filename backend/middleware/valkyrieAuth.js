const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../models');
const { Op } = require('sequelize');

/**
 * Valkyrie Authentication Middleware
 * Supports both API key and JWT token authentication
 */

/**
 * Authenticate partner via API key (for programmatic access)
 */
async function authenticateApiKey(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'] || (req.headers['authorization'] && !req.headers['authorization'].includes('.') ? req.headers['authorization'].replace('Bearer ', '').trim() : null);
    
    if (!apiKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'API key required. Provide X-API-Key header.'
      });
    }

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

    // Attach partner to request
    req.partner = partner;
    req.partnerId = partner.id;
    req.authType = 'api_key';
    
    next();
  } catch (error) {
    console.error('Valkyrie API key authentication error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed'
    });
  }
}

/**
 * Authenticate partner user via JWT token (for console access)
 */
async function authenticateJWT(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'JWT token required. Provide Bearer token in Authorization header.'
      });
    }
    
    const token = authHeader.replace('Bearer ', '').trim();
    
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'JWT token required'
      });
    }
    
    console.log('Valkyrie JWT auth attempt:', {
      tokenLength: token.length,
      tokenPrefix: token.substring(0, 20) + '...',
      hasDots: token.includes('.')
    });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'valkyrie-secret-key-change-in-production');
      console.log('JWT decoded successfully:', {
        userId: decoded.userId,
        partnerId: decoded.partnerId,
        role: decoded.role
      });
    } catch (jwtError) {
      console.log('JWT verification failed:', {
        error: jwtError.name,
        message: jwtError.message
      });
      if (jwtError.name === 'JsonWebTokenError' || jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid or expired token'
        });
      }
      throw jwtError;
    }
    
    const partnerUser = await db.ValkyriePartnerUser.findOne({
      where: {
        id: decoded.userId,
        status: 'active'
      },
      include: [{
        model: db.ValkyriePartner,
        as: 'partner',
        where: {
          status: 'active'
        }
      }]
    });

    if (!partnerUser || !partnerUser.partner) {
      console.log('JWT auth failed: User not found or partner inactive', {
        userId: decoded.userId,
        userFound: !!partnerUser,
        partnerFound: !!partnerUser?.partner
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }
    
    console.log('JWT auth successful:', {
      userId: partnerUser.id,
      email: partnerUser.email,
      partnerId: partnerUser.partner.id,
      partnerName: partnerUser.partner.name
    });

    // Attach partner and user to request
    req.partner = partnerUser.partner;
    req.partnerId = partnerUser.partner.id;
    req.partnerUser = partnerUser;
    req.userRole = partnerUser.role;
    req.authType = 'jwt';
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }
    
    console.error('Valkyrie JWT authentication error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed'
    });
  }
}

/**
 * Flexible authentication - tries API key first, then JWT
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const apiKeyHeader = req.headers['x-api-key'];
  
  // If X-API-Key header is present, use API key authentication
  if (apiKeyHeader) {
    return authenticateApiKey(req, res, next);
  }
  
  // If Authorization header is present, check if it's a JWT or API key
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '').trim();
    
    // JWT tokens have a specific structure: header.payload.signature (3 parts separated by dots)
    // API keys are typically alphanumeric strings without dots
    const isJWT = token.includes('.') && token.split('.').length === 3;
    
    if (isJWT) {
      // It's a JWT token
      return authenticateJWT(req, res, next);
    } else {
      // Treat as API key
      return authenticateApiKey(req, res, next);
    }
  }
  
  // No authentication provided
  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Authentication required. Provide X-API-Key header or Bearer token.'
  });
}

/**
 * Role-based access control middleware
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (req.authType === 'api_key') {
      // API keys have full access (admin equivalent)
      return next();
    }

    if (!req.userRole) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Role information not available'
      });
    }

    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This action requires one of these roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
}

/**
 * Ensure partner scoping - validates that partner_id matches request
 */
function enforcePartnerScope(req, res, next) {
  // Partner ID is already set by authentication middleware
  // This middleware ensures it's used in queries
  if (!req.partnerId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Partner authentication required'
    });
  }
  
  next();
}

module.exports = {
  authenticate,
  authenticateApiKey,
  authenticateJWT,
  requireRole,
  enforcePartnerScope
};

