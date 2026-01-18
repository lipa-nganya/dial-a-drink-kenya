/**
 * Temporary admin endpoint to consolidate branches to ID 4
 * This should be removed after migration is complete
 */

const express = require('express');
const router = express.Router();
const db = require('../models');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

const verifyAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ error: 'Authorization token missing' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    return next();
  } catch (error) {
    console.warn('Admin auth token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Temporarily remove auth for one-time migration - REMOVE AFTER USE
router.post('/consolidate-branches-to-4', async (req, res) => {
  try {
    console.log('🔄 Starting branch consolidation to ID 4...');
    
    // First, check if branch 4 exists
    let branch4 = await db.Branch.findByPk(4);
    
    if (!branch4) {
      console.log('📝 Branch ID 4 does not exist. Creating it...');
      
      // Create branch 4 using raw SQL to set ID explicitly
      const [result] = await db.sequelize.query(`
        INSERT INTO branches (id, name, address, "isActive", "createdAt", "updatedAt")
        VALUES (4, 'Main Branch', 'Nairobi, Kenya', true, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
        RETURNING *;
      `);
      
      if (result && result.length > 0) {
        branch4 = await db.Branch.findByPk(4);
        console.log(`✅ Created branch: ${branch4.name} (ID: 4)`);
      } else {
        branch4 = await db.Branch.findByPk(4);
        if (branch4) {
          console.log(`✅ Found existing branch: ${branch4.name} (ID: 4)`);
        } else {
          return res.status(500).json({ error: 'Failed to create branch ID 4' });
        }
      }
    } else {
      console.log(`✅ Branch already exists: ${branch4.name} (ID: 4)`);
    }
    
    // Get count of orders before update
    const totalOrders = await db.Order.count();
    const ordersWithOtherBranches = await db.Order.count({
      where: {
        [db.Sequelize.Op.or]: [
          { branchId: { [db.Sequelize.Op.ne]: 4 } },
          { branchId: null }
        ]
      }
    });
    
    // Update all orders to branch_id 4
    const [updatedCount] = await db.Order.update(
      { branchId: 4 },
      { 
        where: {
          [db.Sequelize.Op.or]: [
            { branchId: { [db.Sequelize.Op.ne]: 4 } },
            { branchId: null }
          ]
        }
      }
    );
    
    // Get branches to delete
    const branchesToDelete = await db.Branch.findAll({
      where: {
        id: { [db.Sequelize.Op.ne]: 4 }
      }
    });
    
    // Delete all branches except ID 4
    let deletedCount = 0;
    if (branchesToDelete.length > 0) {
      const branchIdsToDelete = branchesToDelete.map(b => b.id);
      deletedCount = await db.Branch.destroy({
        where: {
          id: { [db.Sequelize.Op.in]: branchIdsToDelete }
        }
      });
    }
    
    // Verify final state
    const remainingBranches = await db.Branch.findAll();
    const ordersWithBranch4 = await db.Order.count({ where: { branchId: 4 } });
    
    return res.json({
      success: true,
      message: 'Branch consolidation completed',
      results: {
        branchesDeleted: deletedCount,
        ordersUpdated: updatedCount,
        totalOrders,
        ordersWithBranch4,
        remainingBranches: remainingBranches.map(b => ({ id: b.id, name: b.name }))
      }
    });
  } catch (error) {
    console.error('❌ Error consolidating branches:', error);
    return res.status(500).json({ 
      error: 'Failed to consolidate branches',
      message: error.message 
    });
  }
});

module.exports = router;
