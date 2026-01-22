const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const pushNotifications = require('../services/pushNotifications');
const { verifyAdmin } = require('./admin');

// Admin routes - must be defined BEFORE driver routes to avoid route conflicts
// Admin routes - require admin authentication
router.use('/admin', verifyAdmin);

/**
 * Create cash submission (admin)
 * POST /api/driver-wallet/admin/cash-submissions
 */
router.post('/admin/cash-submissions', async (req, res) => {
  try {
    console.log('📝 Admin cash submission request received');
    console.log('   Admin ID:', req.admin.id);
    console.log('   Body:', JSON.stringify(req.body, null, 2));
    
    const adminId = req.admin.id;
    const { submissionType, amount, details, orderIds } = req.body;

    // Validate required fields
    if (!submissionType || !['purchases', 'cash', 'general_expense', 'payment_to_office', 'walk_in_sale'].includes(submissionType)) {
      console.log('❌ Invalid submission type:', submissionType);
      return sendError(res, 'Invalid submission type. Must be one of: purchases, cash, general_expense, payment_to_office, walk_in_sale', 400);
    }

    if (!amount || parseFloat(amount) <= 0) {
      console.log('❌ Invalid amount:', amount);
      return sendError(res, 'Amount must be greater than 0', 400);
    }

    // Validate details based on submission type
    console.log('   Details:', JSON.stringify(details, null, 2));
    
    // All submission types now support items array (multiple items with prices)
    const hasItems = details?.items && Array.isArray(details.items) && details.items.length > 0;
    
    // Validate items array if provided (for all types)
    if (hasItems) {
      for (let i = 0; i < details.items.length; i++) {
        const item = details.items[i];
        if (!item.item || item.price === undefined || item.price === null || item.price <= 0) {
          return sendError(res, `Item ${i + 1} is invalid. Each item must have a name and a valid price > 0`, 400);
        }
      }
    }
    
    if (submissionType === 'purchases') {
      // Support both old format (single item) and new format (multiple items)
      const hasSingleItem = details?.item && details?.price !== undefined && details?.price !== null;
      
      if (!details || !details.supplier || (!hasItems && !hasSingleItem) || !details.deliveryLocation) {
        console.log('❌ Missing required purchase fields:', {
          supplier: details?.supplier,
          items: details?.items,
          item: details?.item,
          price: details?.price,
          deliveryLocation: details?.deliveryLocation
        });
        return sendError(res, 'For purchases, supplier, items (array) or item+price, and deliveryLocation are required', 400);
      }
    } else if (submissionType === 'cash') {
      // Cash submissions can have items array OR single recipientName (backward compatibility)
      if (!hasItems && (!details || !details.recipientName)) {
        console.log('❌ Missing recipientName or items for cash submission');
        return sendError(res, 'For cash submissions, either items array or recipientName is required', 400);
      }
    } else if (submissionType === 'general_expense') {
      // General expense can have items array OR single nature (backward compatibility)
      if (!hasItems && (!details || !details.nature)) {
        console.log('❌ Missing nature or items for general expense');
        return sendError(res, 'For general expenses, either items array or nature is required', 400);
      }
    } else if (submissionType === 'payment_to_office') {
      // Payment to office requires accountType, and can have items array
      if (!details || !details.accountType || !['mpesa', 'till', 'bank', 'paybill', 'pdq'].includes(details.accountType)) {
        console.log('❌ Missing or invalid accountType for payment to office:', details?.accountType);
        return sendError(res, 'For payment to office, accountType must be one of: mpesa, till, bank, paybill, pdq', 400);
      }
      // Items array is optional for payment_to_office
    } else if (submissionType === 'walk_in_sale') {
      // Walk-in sale doesn't require specific details, but can optionally include customer name or items
      // No validation needed as details are optional
    }

    // Get admin info
    const admin = await db.Admin.findByPk(adminId);
    if (!admin) {
      return sendError(res, 'Admin not found', 404);
    }

    const submissionAmount = parseFloat(amount);

    // Validate orderIds if provided
    if (orderIds && Array.isArray(orderIds) && orderIds.length > 0) {
      // Verify all orders exist
      const orders = await db.Order.findAll({
        where: { id: orderIds },
        attributes: ['id']
      });
      
      if (orders.length !== orderIds.length) {
        const foundIds = orders.map(o => o.id);
        const missingIds = orderIds.filter(id => !foundIds.includes(id));
        console.log('❌ Some orders not found:', missingIds);
        return sendError(res, `Some orders not found: ${missingIds.join(', ')}`, 400);
      }

      // Check if any orders are already associated with approved cash submissions
      const approvedSubmissionsWithOrders = await db.CashSubmission.findAll({
        where: {
          status: 'approved'
        },
        include: [{
          model: db.Order,
          as: 'orders',
          where: {
            id: { [Op.in]: orderIds }
          },
          attributes: ['id'],
          required: true
        }],
        attributes: ['id']
      });

      if (approvedSubmissionsWithOrders.length > 0) {
        // Extract order IDs from the approved submissions
        const usedOrderIds = new Set();
        for (const submission of approvedSubmissionsWithOrders) {
          // Reload submission with orders to get the actual order IDs
          const submissionWithOrders = await db.CashSubmission.findByPk(submission.id, {
            include: [{
              model: db.Order,
              as: 'orders',
              attributes: ['id']
            }]
          });
          if (submissionWithOrders && submissionWithOrders.orders) {
            submissionWithOrders.orders.forEach(order => {
              // Only add if this order ID is in the requested orderIds
              if (orderIds.includes(order.id)) {
                usedOrderIds.add(order.id);
              }
            });
          }
        }
        
        if (usedOrderIds.size > 0) {
          const usedIdsArray = Array.from(usedOrderIds);
          console.log('❌ Some orders are already associated with approved cash submissions:', usedIdsArray);
          return sendError(res, `The following orders are already associated with approved cash submissions and cannot be reused: ${usedIdsArray.join(', ')}`, 400);
        }
      }
    }

    // Create submission
    const submission = await db.CashSubmission.create({
      adminId: parseInt(adminId),
      driverId: null, // Admin submissions don't have a driver
      submissionType,
      amount: submissionAmount,
      details: details || {},
      status: 'pending'
    });

    // Associate orders if provided
    if (orderIds && Array.isArray(orderIds) && orderIds.length > 0) {
      await submission.setOrders(orderIds);
      console.log(`📦 Associated ${orderIds.length} order(s) with cash submission ${submission.id}`);
    }

    // Reload with associations
    await submission.reload({
      include: [
        { model: db.Admin, as: 'admin', attributes: ['id', 'username', 'name'] },
        { model: db.Order, as: 'orders', attributes: ['id', 'customerName', 'totalAmount', 'status', 'createdAt'] }
      ]
    });

    console.log(`✅ Admin cash submission created: ID ${submission.id}, Admin ${admin.username || admin.name}, Type: ${submissionType}, Amount: ${submissionAmount}, Orders: ${orderIds?.length || 0}`);

    sendSuccess(res, submission, 'Cash submission created successfully');
  } catch (error) {
    console.error('❌ Error creating admin cash submission:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Request body:', JSON.stringify(req.body, null, 2));
    
    sendError(res, error.message, 500);
  }
});

/**
 * Get all cash submissions (admin) - all statuses
 * GET /api/driver-wallet/admin/cash-submissions/all
 */
router.get('/admin/cash-submissions/all', async (req, res) => {
  try {
    const { limit = 1000, offset = 0 } = req.query;

    console.log('📋 Fetching all cash submissions...');

    // Get all submissions (both driver and admin)
    const submissions = await db.CashSubmission.findAll({
      include: [
        { model: db.Driver, as: 'driver', attributes: ['id', 'name', 'phoneNumber', 'cashAtHand'], required: false },
        { model: db.Admin, as: 'admin', attributes: ['id', 'username', 'name'], required: false },
        { model: db.Admin, as: 'approver', attributes: ['id', 'username', 'name'], required: false },
        { model: db.Admin, as: 'rejector', attributes: ['id', 'username', 'name'], required: false },
        { model: db.Order, as: 'orders', attributes: ['id', 'customerName', 'totalAmount', 'status', 'createdAt'], required: false }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    console.log(`✅ Found ${submissions.length} cash submissions`);

    sendSuccess(res, {
      submissions,
      total: submissions.length
    });
  } catch (error) {
    console.error('❌ Error fetching all cash submissions:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Create cash submission (driver)
 * POST /api/driver-wallet/:driverId/cash-submissions
 */
router.post('/:driverId/cash-submissions', async (req, res) => {
  try {
    console.log('📝 Cash submission request received');
    console.log('   Driver ID:', req.params.driverId);
    console.log('   Body:', JSON.stringify(req.body, null, 2));
    
    const { driverId } = req.params;
    const { submissionType, amount, details } = req.body;

    // Validate required fields
    if (!submissionType || !['purchases', 'cash', 'general_expense', 'payment_to_office', 'walk_in_sale'].includes(submissionType)) {
      console.log('❌ Invalid submission type:', submissionType);
      return sendError(res, 'Invalid submission type. Must be one of: purchases, cash, general_expense, payment_to_office, walk_in_sale', 400);
    }

    if (!amount || parseFloat(amount) <= 0) {
      console.log('❌ Invalid amount:', amount);
      return sendError(res, 'Amount must be greater than 0', 400);
    }

    // Validate details based on submission type
    console.log('   Details:', JSON.stringify(details, null, 2));
    
    // All submission types now support items array (multiple items with prices)
    const hasItems = details?.items && Array.isArray(details.items) && details.items.length > 0;
    
    // Validate items array if provided (for all types)
    if (hasItems) {
      for (let i = 0; i < details.items.length; i++) {
        const item = details.items[i];
        if (!item.item || item.price === undefined || item.price === null || item.price <= 0) {
          return sendError(res, `Item ${i + 1} is invalid. Each item must have a name and a valid price > 0`, 400);
        }
      }
    }
    
    if (submissionType === 'purchases') {
      // Support both old format (single item) and new format (multiple items)
      const hasSingleItem = details?.item && details?.price !== undefined && details?.price !== null;
      
      if (!details || !details.supplier || (!hasItems && !hasSingleItem) || !details.deliveryLocation) {
        console.log('❌ Missing required purchase fields:', {
          supplier: details?.supplier,
          items: details?.items,
          item: details?.item,
          price: details?.price,
          deliveryLocation: details?.deliveryLocation
        });
        return sendError(res, 'For purchases, supplier, items (array) or item+price, and deliveryLocation are required', 400);
      }
    } else if (submissionType === 'cash') {
      // Cash submissions can have items array OR single recipientName (backward compatibility)
      if (!hasItems && (!details || !details.recipientName)) {
        console.log('❌ Missing recipientName or items for cash submission');
        return sendError(res, 'For cash submissions, either items array or recipientName is required', 400);
      }
    } else if (submissionType === 'general_expense') {
      // General expense can have items array OR single nature (backward compatibility)
      if (!hasItems && (!details || !details.nature)) {
        console.log('❌ Missing nature or items for general expense');
        return sendError(res, 'For general expenses, either items array or nature is required', 400);
      }
    } else if (submissionType === 'payment_to_office') {
      // Payment to office requires accountType, and can have items array
      if (!details || !details.accountType || !['mpesa', 'till', 'bank', 'paybill', 'pdq'].includes(details.accountType)) {
        console.log('❌ Missing or invalid accountType for payment to office:', details?.accountType);
        return sendError(res, 'For payment to office, accountType must be one of: mpesa, till, bank, paybill, pdq', 400);
      }
      // Items array is optional for payment_to_office
    } else if (submissionType === 'walk_in_sale') {
      // Walk-in sale doesn't require specific details, but can optionally include customer name or items
      // No validation needed as details are optional
    }

    // Get driver
    const driver = await db.Driver.findByPk(driverId);
    if (!driver) {
      return sendError(res, 'Driver not found', 404);
    }

    // Allow negative cash at hand - driver can submit more than they have
    // This allows drivers to go into negative balance (credit)
    const submissionAmount = parseFloat(amount);

    // Create submission
    const submission = await db.CashSubmission.create({
      driverId: parseInt(driverId),
      submissionType,
      amount: submissionAmount,
      details: details || {},
      status: 'pending'
    });

    // Update driver's lastActivity when creating cash submission
    await driver.update({ 
      lastActivity: new Date()
    });
    console.log(`✅ Updated lastActivity for driver ${driverId} (cash submission created)`);

    // Reload with associations
    await submission.reload({
      include: [
        { model: db.Driver, as: 'driver' }
      ]
    });

    console.log(`✅ Cash submission created: ID ${submission.id}, Driver ${driver.name}, Type: ${submissionType}, Amount: ${submissionAmount}`);

    sendSuccess(res, submission, 'Cash submission created successfully');
  } catch (error) {
    console.error('❌ Error creating cash submission:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Request body:', JSON.stringify(req.body, null, 2));
    console.error('❌ Driver ID:', req.params.driverId);
    
    // Check if it's a table doesn't exist error
    if (error.message && error.message.includes('does not exist')) {
      console.error('❌ CRITICAL: Database table does not exist. Please run the migration:');
      console.error('❌ Run: node migrations/create-cash-submissions-table.js');
      return sendError(res, 'Database table not found. Please contact administrator.', 500);
    }
    
    sendError(res, error.message, 500);
  }
});

/**
 * Get cash submissions for driver
 * GET /api/driver-wallet/:driverId/cash-submissions
 * Query params: status (pending, approved, rejected), limit, offset
 */
router.get('/:driverId/cash-submissions', async (req, res) => {
  try {
    const { driverId } = req.params;
    const { status, limit = 50, offset = 0 } = req.query;

    // Validate driver exists
    const driver = await db.Driver.findByPk(driverId);
    if (!driver) {
      return sendError(res, 'Driver not found', 404);
    }

    // Build where clause
    const where = { driverId: parseInt(driverId) };
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      where.status = status;
    }

    // Get submissions
    const submissions = await db.CashSubmission.findAll({
      where,
      include: [
        { model: db.Driver, as: 'driver', attributes: ['id', 'name', 'phoneNumber'] },
        { model: db.Admin, as: 'approver', attributes: ['id', 'username', 'name'], required: false },
        { model: db.Admin, as: 'rejector', attributes: ['id', 'username', 'name'], required: false },
        { model: db.Order, as: 'orders', attributes: ['id', 'customerName', 'totalAmount', 'status', 'createdAt'], required: false }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Get counts
    const counts = await db.CashSubmission.findAll({
      where: { driverId: parseInt(driverId) },
      attributes: [
        'status',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
      ],
      group: ['status']
    });

    const countMap = {
      pending: 0,
      approved: 0,
      rejected: 0
    };
    counts.forEach(c => {
      countMap[c.status] = parseInt(c.get('count'));
    });

    sendSuccess(res, {
      submissions,
      counts: countMap,
      total: submissions.length
    });
  } catch (error) {
    console.error('Error fetching cash submissions:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Update cash submission (driver can update pending submissions)
 * PATCH /api/driver-wallet/:driverId/cash-submissions/:id
 */
router.patch('/:driverId/cash-submissions/:id', async (req, res) => {
  try {
    const { driverId, id } = req.params;
    const { amount, details } = req.body;

    // Get submission
    const submission = await db.CashSubmission.findOne({
      where: {
        id: parseInt(id),
        driverId: parseInt(driverId)
      },
      include: [{ model: db.Driver, as: 'driver' }]
    });

    if (!submission) {
      return sendError(res, 'Cash submission not found', 404);
    }

    // Only allow updates to pending submissions
    if (submission.status !== 'pending') {
      return sendError(res, 'Only pending submissions can be updated', 400);
    }

    // Update fields
    const updateData = {};
    if (amount !== undefined) {
      const newAmount = parseFloat(amount);
      if (newAmount <= 0) {
        return sendError(res, 'Amount must be greater than 0', 400);
      }
      
      // Allow negative cash at hand - driver can submit more than they have
      // This allows drivers to go into negative balance (credit)
      updateData.amount = newAmount;
    }
    if (details !== undefined) {
      updateData.details = details;
    }

    await submission.update(updateData);
    
    // Update driver's lastActivity when updating cash submission
    const driver = await db.Driver.findByPk(parseInt(driverId));
    if (driver) {
      await driver.update({ 
        lastActivity: new Date()
      });
      console.log(`✅ Updated lastActivity for driver ${driverId} (cash submission updated)`);
    }
    
    await submission.reload({
      include: [
        { model: db.Driver, as: 'driver' },
        { model: db.Admin, as: 'approver', required: false },
        { model: db.Admin, as: 'rejector', required: false }
      ]
    });

    console.log(`✅ Cash submission updated: ID ${submission.id}, Driver ${submission.driver.name}`);

    sendSuccess(res, submission, 'Cash submission updated successfully');
  } catch (error) {
    console.error('Error updating cash submission:', error);
    sendError(res, error.message, 500);
  }
});


/**
 * Get all pending cash submissions (admin)
 * GET /api/driver-wallet/cash-submissions/pending
 */
router.get('/cash-submissions/pending', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    console.log('📋 Fetching pending cash submissions...');

    // Get all pending submissions (both driver and admin)
    const submissions = await db.CashSubmission.findAll({
      where: { status: 'pending' },
      include: [
        { model: db.Driver, as: 'driver', attributes: ['id', 'name', 'phoneNumber', 'cashAtHand'], required: false },
        { model: db.Admin, as: 'admin', attributes: ['id', 'username', 'name'], required: false },
        { model: db.Admin, as: 'approver', attributes: ['id', 'username', 'name'], required: false },
        { model: db.Admin, as: 'rejector', attributes: ['id', 'username', 'name'], required: false },
        { model: db.Order, as: 'orders', attributes: ['id', 'customerName', 'totalAmount', 'status', 'createdAt'], required: false }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    console.log(`✅ Found ${submissions.length} pending cash submissions`);

    sendSuccess(res, {
      submissions,
      total: submissions.length
    });
  } catch (error) {
    console.error('❌ Error fetching pending cash submissions:', error);
    console.error('❌ Error stack:', error.stack);
    sendError(res, error.message, 500);
  }
});

// Shared approval handler function
const handleApproveSubmission = async (req, res, submissionId, driverIdParam = null) => {
  try {
    const id = submissionId || req.params.id;
    const driverId = driverIdParam !== null ? driverIdParam : req.params.driverId;
    
    // Check if admin is authenticated
    if (!req.admin || !req.admin.id) {
      return sendError(res, 'Admin authentication required', 401);
    }
    
    const adminId = req.admin.id;
    const adminRole = req.admin.role;

    // Check if user is admin or super_admin
    if (adminRole !== 'super_admin' && adminRole !== 'admin') {
      return sendError(res, 'Only admins can approve cash submissions', 403);
    }

    // Get submission - handle both driver and admin submissions
    const whereClause = { id: parseInt(id) };
    if (driverId && driverId !== 'admin') {
      whereClause.driverId = parseInt(driverId);
    }

    const submission = await db.CashSubmission.findOne({
      where: whereClause,
      include: [
        { model: db.Driver, as: 'driver', required: false },
        { model: db.Admin, as: 'admin', required: false }
      ]
    });

    if (!submission) {
      return sendError(res, 'Cash submission not found', 404);
    }

    if (submission.status !== 'pending') {
      return sendError(res, `Submission is already ${submission.status}`, 400);
    }

    // Update submission
    console.log(`📝 Updating submission #${id} from status '${submission.status}' to 'approved'`);
    await submission.update({
      status: 'approved',
      approvedBy: adminId,
      approvedAt: new Date()
    });
    
    // Force reload to verify the update
    await submission.reload();
    console.log(`✅ Submission #${submission.id} status after update: ${submission.status}`);
    
    // Verify with a fresh query from database
    const verifySubmission = await db.CashSubmission.findByPk(parseInt(id), {
      raw: false // Get Sequelize instance
    });
    console.log(`🔍 Verification: Submission #${id} status in DB: ${verifySubmission?.status}`);
    
    if (!verifySubmission || verifySubmission.status !== 'approved') {
      console.error(`❌ CRITICAL: Submission #${id} status verification failed! Expected 'approved', got '${verifySubmission?.status}'`);
      // Use the verified submission for the rest of the code
      if (verifySubmission) {
        Object.assign(submission, verifySubmission);
      }
    }

    // Update driver's cash at hand (only if it's a driver submission)
    if (submission.driverId && submission.driver) {
      const driver = await db.Driver.findByPk(submission.driverId);
      if (driver) {
        const currentCashAtHand = parseFloat(driver.cashAtHand || 0);
        const submissionAmount = parseFloat(submission.amount);
        // Allow negative cash at hand - drivers can go into negative balance (credit)
        const newCashAtHand = currentCashAtHand - submissionAmount;
        
        await driver.update({ cashAtHand: newCashAtHand });
        console.log(`   Driver cash at hand: ${currentCashAtHand.toFixed(2)} → ${newCashAtHand.toFixed(2)}`);
      }
    }

    // Credit merchant wallet
    let adminWallet = await db.AdminWallet.findOne({ where: { id: 1 } });
    if (!adminWallet) {
      adminWallet = await db.AdminWallet.create({
        id: 1,
        balance: 0,
        totalRevenue: 0,
        totalOrders: 0,
        cashAtHand: 0
      });
    }

    const submissionAmount = parseFloat(submission.amount);
    const oldBalance = parseFloat(adminWallet.balance) || 0;
    await adminWallet.update({
      balance: oldBalance + submissionAmount,
      totalRevenue: parseFloat(adminWallet.totalRevenue) + submissionAmount
    });

    // Update admin cash at hand based on submission type
    const currentCashAtHand = parseFloat(adminWallet.cashAtHand || 0);
    let newCashAtHand = currentCashAtHand;
    
    if (submission.driverId && !submission.adminId) {
      // Driver submission approved = cash received by admin, so INCREASE cash at hand
      newCashAtHand = currentCashAtHand + submissionAmount;
      await adminWallet.update({ cashAtHand: newCashAtHand });
      console.log(`   Admin cash at hand: ${currentCashAtHand.toFixed(2)} → ${newCashAtHand.toFixed(2)} (added ${submissionAmount.toFixed(2)} from driver)`);
    } else if (submission.adminId && !submission.driverId) {
      // Admin submission approved = cash spent by admin, so DECREASE cash at hand
      newCashAtHand = Math.max(0, currentCashAtHand - submissionAmount);
      await adminWallet.update({ cashAtHand: newCashAtHand });
      console.log(`   Admin cash at hand: ${currentCashAtHand.toFixed(2)} → ${newCashAtHand.toFixed(2)} (deducted ${submissionAmount.toFixed(2)} from admin submission)`);
    }

    // Create transaction for cash submission
    const submitterName = submission.driver 
      ? `Driver: ${submission.driver.name}` 
      : submission.admin 
        ? `Admin: ${submission.admin.username || submission.admin.name}` 
        : 'Unknown';
    
    const transaction = await db.Transaction.create({
      orderId: null,
      driverId: submission.driverId,
      driverWalletId: null,
      transactionType: 'cash_submission',
      paymentMethod: 'cash',
      paymentProvider: null,
      amount: submissionAmount,
      status: 'completed',
      paymentStatus: 'paid',
      phoneNumber: submission.driver?.phoneNumber || submission.admin?.mobileNumber || null,
      notes: `Cash submission approved: ${submission.submissionType} - ${submitterName}`,
      receiptNumber: `CASH-SUB-${submission.id}`
    });

    console.log(`✅ Cash submission approved: ID ${submission.id}`);
    console.log(`   Amount: KES ${submissionAmount.toFixed(2)}`);
    console.log(`   Merchant wallet balance: ${oldBalance.toFixed(2)} → ${parseFloat(adminWallet.balance).toFixed(2)}`);
    console.log(`   Transaction created: #${transaction.id}`);

    // Reload submission with all associations including approver
    await submission.reload({
      include: [
        { model: db.Driver, as: 'driver', required: false },
        { model: db.Admin, as: 'admin', required: false, attributes: ['id', 'username', 'name'] },
        { model: db.Admin, as: 'approver', required: false, attributes: ['id', 'username', 'name'] },
        { model: db.Admin, as: 'rejector', required: false, attributes: ['id', 'username', 'name'] }
      ]
    });

    // Final verification - query directly from database
    const finalVerify = await db.CashSubmission.findOne({
      where: { id: parseInt(id) },
      include: [
        { model: db.Admin, as: 'approver', required: false, attributes: ['id', 'username', 'name'] }
      ]
    });
    
    console.log(`✅ Final verification: Submission #${id} status in DB: ${finalVerify?.status}`);
    console.log(`   Approved by: ${finalVerify?.approver?.name || finalVerify?.approver?.username || 'Unknown'}`);
    
    // Use the verified submission for response if it exists
    let responseSubmission = submission;
    if (finalVerify) {
      responseSubmission = finalVerify;
      // Reload with all associations for response
      await responseSubmission.reload({
        include: [
          { model: db.Driver, as: 'driver', required: false },
          { model: db.Admin, as: 'admin', required: false, attributes: ['id', 'username', 'name'] },
          { model: db.Admin, as: 'approver', required: false, attributes: ['id', 'username', 'name'] },
          { model: db.Admin, as: 'rejector', required: false, attributes: ['id', 'username', 'name'] }
        ]
      });
      console.log(`📤 Using verified submission for response. Status: ${responseSubmission.status}, Approver: ${responseSubmission.approver?.name}`);
    }

    // Send push notification to driver (only if it's a driver submission)
    if (submission.driver && submission.driver.pushToken) {
      try {
        const message = {
          sound: 'default',
          title: '✅ Cash Submission Approved',
          body: `Your cash submission of KES ${submissionAmount.toFixed(2)} has been approved.`,
          data: {
            type: 'cash_submission_approved',
            submissionId: String(submission.id),
            amount: String(submissionAmount),
            channelId: 'cash-submissions'
          },
          priority: 'high',
          badge: 1,
          channelId: 'cash-submissions'
        };
        await pushNotifications.sendFCMNotification(submission.driver.pushToken, message);
        console.log(`📤 Push notification sent to driver ${submission.driver.name} for approved submission`);
      } catch (pushError) {
        console.error(`❌ Error sending push notification:`, pushError);
        // Don't fail the request if push notification fails
      }
    }

    console.log(`📤 Sending response: Submission #${responseSubmission.id} with status '${responseSubmission.status}'`);
    
    const responseData = {
      submission: responseSubmission
    };
    
    // Only include cash at hand info if it's a driver submission
    if (submission.driverId && submission.driver) {
      const driver = await db.Driver.findByPk(submission.driverId);
      if (driver) {
        const currentCashAtHand = parseFloat(driver.cashAtHand || 0);
        const submissionAmount = parseFloat(submission.amount);
        // Allow negative cash at hand - drivers can go into negative balance (credit)
        const newCashAtHand = currentCashAtHand - submissionAmount;
        responseData.newCashAtHand = newCashAtHand;
        responseData.previousCashAtHand = currentCashAtHand;
      }
    }
    
    sendSuccess(res, responseData, 'Cash submission approved successfully');
  } catch (error) {
    console.error('Error approving cash submission:', error);
    sendError(res, error.message, 500);
  }
};

/**
 * Approve admin cash submission (admin or super_admin) - must be before generic route
 * POST /api/driver-wallet/admin/cash-submissions/:id/approve
 */
router.post('/admin/cash-submissions/:id/approve', async (req, res) => {
  return handleApproveSubmission(req, res, req.params.id, 'admin');
});

/**
 * Approve cash submission (admin or super_admin)
 * POST /api/driver-wallet/:driverId/cash-submissions/:id/approve
 */
router.post('/:driverId/cash-submissions/:id/approve', verifyAdmin, async (req, res) => {
  return handleApproveSubmission(req, res);
});

// Shared rejection handler function
const handleRejectSubmission = async (req, res, submissionId, driverIdParam = null) => {
  try {
    const id = submissionId || req.params.id;
    const driverId = driverIdParam !== null ? driverIdParam : req.params.driverId;
    const { rejectionReason } = req.body;
    
    // Check if admin is authenticated
    if (!req.admin || !req.admin.id) {
      return sendError(res, 'Admin authentication required', 401);
    }
    
    const adminId = req.admin.id;
    const adminRole = req.admin.role;

    // Check if user is admin or super_admin
    if (adminRole !== 'super_admin' && adminRole !== 'admin') {
      return sendError(res, 'Only admins can reject cash submissions', 403);
    }

    // Get submission - handle both driver and admin submissions
    const whereClause = { id: parseInt(id) };
    if (driverId && driverId !== 'admin') {
      whereClause.driverId = parseInt(driverId);
    }

    const submission = await db.CashSubmission.findOne({
      where: whereClause,
      include: [
        { model: db.Driver, as: 'driver', required: false },
        { model: db.Admin, as: 'admin', required: false }
      ]
    });

    if (!submission) {
      return sendError(res, 'Cash submission not found', 404);
    }

    if (submission.status !== 'pending') {
      return sendError(res, `Submission is already ${submission.status}`, 400);
    }

    // Update submission
    await submission.update({
      status: 'rejected',
      rejectedBy: adminId,
      rejectedAt: new Date(),
      rejectionReason: rejectionReason || 'No reason provided'
    });

    // Reload submission with all associations including rejector
    await submission.reload({
      include: [
        { model: db.Driver, as: 'driver', required: false },
        { model: db.Admin, as: 'admin', required: false, attributes: ['id', 'username', 'name'] },
        { model: db.Admin, as: 'approver', required: false, attributes: ['id', 'username', 'name'] },
        { model: db.Admin, as: 'rejector', required: false, attributes: ['id', 'username', 'name'] }
      ]
    });

    const submissionAmount = parseFloat(submission.amount);
    const submitterName = submission.driver 
      ? `Driver ${submission.driver.name}` 
      : submission.admin 
        ? `Admin ${submission.admin.username || submission.admin.name}` 
        : 'Unknown';
    console.log(`✅ Cash submission rejected: ID ${submission.id}, ${submitterName}, Amount: ${submissionAmount}`);

    // Send push notification to driver (only if it's a driver submission)
    if (submission.driver && submission.driver.pushToken) {
      try {
        const message = {
          sound: 'default',
          title: '❌ Cash Submission Rejected',
          body: `Your cash submission of KES ${submissionAmount.toFixed(2)} has been rejected. ${rejectionReason ? 'Reason: ' + rejectionReason : ''}`,
          data: {
            type: 'cash_submission_rejected',
            submissionId: String(submission.id),
            amount: String(submissionAmount),
            rejectionReason: rejectionReason || '',
            channelId: 'cash-submissions'
          },
          priority: 'high',
          badge: 1,
          channelId: 'cash-submissions'
        };
        await pushNotifications.sendFCMNotification(submission.driver.pushToken, message);
        console.log(`📤 Push notification sent to driver ${submission.driver.name} for rejected submission`);
      } catch (pushError) {
        console.error(`❌ Error sending push notification:`, pushError);
        // Don't fail the request if push notification fails
      }
    }

    sendSuccess(res, submission, 'Cash submission rejected successfully');
  } catch (error) {
    console.error('Error rejecting cash submission:', error);
    sendError(res, error.message, 500);
  }
};

/**
 * Reject admin cash submission (admin or super_admin) - must be before generic route
 * POST /api/driver-wallet/admin/cash-submissions/:id/reject
 */
router.post('/admin/cash-submissions/:id/reject', async (req, res) => {
  return handleRejectSubmission(req, res, req.params.id, 'admin');
});

/**
 * Reject cash submission (admin or super_admin)
 * POST /api/driver-wallet/:driverId/cash-submissions/:id/reject
 */
router.post('/:driverId/cash-submissions/:id/reject', verifyAdmin, async (req, res) => {
  return handleRejectSubmission(req, res);
});

module.exports = router;
