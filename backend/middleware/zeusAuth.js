const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../models');

/**
 * Zeus Authentication Middleware
 * For Super Admin Control Plane access
 */

/**
 * Authenticate Zeus admin via JWT token
 */
async function authenticate(req, res, next) {
  try {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'JWT token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'zeus-secret-key-change-in-production');
    
    const zeusAdmin = await db.ZeusAdmin.findOne({
      where: {
        id: decoded.adminId || decoded.userId
      }
    });

    if (!zeusAdmin) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }

    // Attach admin to request
    req.zeusAdmin = zeusAdmin;
    req.zeusAdminId = zeusAdmin.id;
    req.zeusAdminRole = zeusAdmin.role;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }
    
    console.error('Zeus authentication error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed'
    });
  }
}

/**
 * Role-based access control for Zeus
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.zeusAdminRole) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Role information not available'
      });
    }

    if (!allowedRoles.includes(req.zeusAdminRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This action requires one of these roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
}

module.exports = {
  authenticate,
  requireRole
};

