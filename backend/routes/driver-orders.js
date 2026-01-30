const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const mpesaService = require('../services/mpesa');
const { getOrderFinancialBreakdown } = require('../utils/orderFinancials');
const { ensureDeliveryFeeSplit } = require('../utils/deliveryFeeTransactions');
const { creditWalletsOnDeliveryCompletion } = require('../utils/walletCredits');
const pushNotifications = require('../services/pushNotifications');
const { checkDriverCreditLimit } = require('../utils/creditLimit');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// Debug middleware - log all requests to this router
router.use((req, res, next) => {
  console.log(`🔍 [DRIVER-ORDERS ROUTER] ${req.method} ${req.path} - OriginalUrl: ${req.originalUrl}`);
  console.log(`🔍 [DRIVER-ORDERS ROUTER] Route stack:`, router.stack.map(r => r.route ? `${r.route.stack[0].method.toUpperCase()} ${r.route.path}` : 'middleware').join(', '));
  next();
});

/**
 * Accept or reject order assignment
 * POST /api/driver-orders/:orderId/respond
 * IMPORTANT: This route must be defined BEFORE /:driverId to avoid route conflicts
 */
router.post('/:orderId/respond', async (req, res) => {
  console.log(`📥 [DRIVER RESPOND] POST /api/driver-orders/:orderId/respond`);
  console.log(`   OrderId: ${req.params.orderId}`);
  console.log(`   Body:`, JSON.stringify(req.body, null, 2));
  console.log(`   Method: ${req.method}, Path: ${req.path}, OriginalUrl: ${req.originalUrl}`);
  try {
    const { orderId } = req.params;
    const { driverId, accepted } = req.body;

    // Validate orderId
    const parsedOrderId = parseInt(orderId);
    if (isNaN(parsedOrderId)) {
      console.log(`❌ Invalid orderId: ${orderId}`);
      return sendError(res, `Invalid order ID: ${orderId}`, 400);
    }

    if (typeof accepted !== 'boolean') {
      return sendError(res, 'accepted must be a boolean', 400);
    }

    if (!driverId) {
      return sendError(res, 'driverId is required', 400);
    }

    const order = await db.Order.findByPk(parsedOrderId, {
      include: [
        {
          model: db.OrderItem,
          as: 'orderItems',
          include: [{
            model: db.Drink,
            as: 'drink'
          }]
        }
      ]
    });

    if (!order) {
      console.log(`❌ Order not found: ${parsedOrderId}`);
      return sendError(res, `Order not found: ${parsedOrderId}`, 404);
    }

    console.log(`✅ Order found: #${order.id}, driverId: ${order.driverId}, requested driverId: ${driverId}`);

    // Verify driver is assigned to this order
    if (order.driverId !== parseInt(driverId)) {
      console.log(`❌ Driver mismatch: order.driverId=${order.driverId}, requested driverId=${driverId}`);
      return sendError(res, `Not authorized to respond to this order. Order is assigned to driver ${order.driverId}, but you are driver ${driverId}`, 403);
    }

    const oldStatus = order.status;
    const oldDriverId = order.driverId;

    // Check if driver has a pending cancellation request on any order
    if (accepted === true) {
      // Check if cancellationRequested column exists in database
      let hasCancellationColumns = false;
      try {
        const [columns] = await db.sequelize.query(
          "SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'cancellationRequested'"
        );
        hasCancellationColumns = columns.length > 0;
      } catch (schemaError) {
        // If schema query fails, assume columns don't exist - skip cancellation check
        hasCancellationColumns = false;
      }

      // Only check for pending cancellation if columns exist
      if (hasCancellationColumns) {
        // Check if driver has a cancelled order pending admin approval
        const pendingCancellation = await db.Order.findOne({
          where: {
            driverId: parseInt(driverId),
            status: 'cancelled',
            cancellationRequested: true,
            cancellationApproved: null // Pending approval
          }
        });

        if (pendingCancellation) {
          return sendError(res, `Cannot accept new orders. You have a cancelled order (Order #${pendingCancellation.id}) pending admin approval. Please wait for admin approval before accepting new orders.`, 400);
        }
      }

      // If accepted, update driverAccepted and set status to 'confirmed' if it's still 'pending'
      // This ensures the order moves from pending to active state and appears in active orders
      // IMPORTANT: Explicitly preserve driverId to ensure it persists after acceptance
      const newStatus = order.status === 'pending' ? 'confirmed' : order.status;
      await order.update({ 
        driverAccepted: accepted,
        driverId: parseInt(driverId), // Explicitly preserve driverId
        // When driver accepts, set status to 'confirmed' if it's still 'pending'
        // This ensures the order moves from pending to active state
        status: newStatus
      });
      
      // Reload order to ensure instance has latest data
      await order.reload();
      
      console.log(`✅ Order #${order.id} accepted by driver ${driverId} - driverAccepted=${order.driverAccepted}, driverId=${order.driverId}, status=${order.status} (was ${oldStatus}, oldDriverId=${oldDriverId})`);
      
      // Update driver's lastActivity when accepting/rejecting orders
      const driver = await db.Driver.findByPk(driverId);
      if (driver) {
        await driver.update({ 
          lastActivity: new Date()
        });
        console.log(`✅ Updated lastActivity for driver ${driverId} (order accept)`);
      }
    } else {
      // If rejected, remove driver assignment (set driverId to null)
      await order.update({ 
        driverAccepted: accepted,
        driverId: null // Remove driver assignment - order becomes unassigned
      });
      console.log(`⚠️ Order #${order.id} rejected by driver ${driverId} - driver assignment removed (order is now unassigned)`);
      
      // Update driver's lastActivity when rejecting orders
      const driver = await db.Driver.findByPk(driverId);
      if (driver) {
        await driver.update({ 
          lastActivity: new Date()
        });
        console.log(`✅ Updated lastActivity for driver ${driverId} (order reject)`);
      }
    }

    // Reload order with minimal data for response (to avoid large payloads)
    const updatedOrder = await db.Order.findByPk(order.id, {
      include: [
        {
          model: db.Driver,
          as: 'driver',
          required: false,
          attributes: ['id', 'name']
        }
      ],
      attributes: ['id', 'status', 'driverId', 'driverAccepted', 'customerName', 'deliveryAddress', 'totalAmount']
    });

    // Emit Socket.IO events (async, don't wait)
    const io = req.app.get('io');
    if (io) {
      // Reload full order for socket events (async, don't block response)
      db.Order.findByPk(order.id, {
        include: [
          {
            model: db.OrderItem,
            as: 'items',
            include: [{
              model: db.Drink,
              as: 'drink'
            }]
          },
          {
            model: db.Driver,
            as: 'driver',
            required: false
          }
        ]
      }).then(fullOrder => {
        // Notify admin about driver response FIRST (this is the primary event)
        io.to('admin').emit('driver-order-response', {
          orderId: order.id,
          driverId: driverId,
          accepted: accepted,
          order: fullOrder,
          driverName: fullOrder?.driver?.name || null,
          message: accepted 
            ? `Driver ${accepted ? 'accepted' : 'rejected'} order #${order.id}`
            : `⚠️ ALERT: Driver rejected order #${order.id}. Order is now unassigned and needs to be reassigned.`,
          isDriverResponse: true // Flag to distinguish from status updates
        });
        
        // If rejected, send a specific alert to admin
        if (!accepted) {
          io.to('admin').emit('order-rejected-by-driver', {
            orderId: order.id,
            driverId: driverId,
            order: fullOrder,
            message: `⚠️ Driver rejected order #${order.id}. Please reassign the order.`,
            requiresAction: true
          });
        }
        
        // Emit to driver's room for real-time updates (when order is accepted, it should appear in active orders)
        if (accepted && driverId) {
          const socketEventData = {
            orderId: order.id,
            status: fullOrder.status,
            paymentStatus: fullOrder.paymentStatus,
            driverId: fullOrder.driverId || parseInt(driverId), // Explicitly include driverId
            driverAccepted: true, // Explicitly set to true for accepted orders
            order: fullOrder,
            triggeredByDriverResponse: true
          };
          io.to(`driver-${driverId}`).emit('order-status-updated', socketEventData);
          console.log(`📡 [SOCKET] Emitted order-status-updated to driver-${driverId} for accepted order #${order.id}`);
          console.log(`📡 [SOCKET] Event data: orderId=${socketEventData.orderId}, status=${socketEventData.status}, driverId=${socketEventData.driverId}, driverAccepted=${socketEventData.driverAccepted}, triggeredByDriverResponse=${socketEventData.triggeredByDriverResponse}`);
        }
        
        // Emit order-status-updated event for real-time updates (secondary event)
        io.to(`order-${order.id}`).emit('order-status-updated', {
          orderId: order.id,
          status: fullOrder.status,
          oldStatus: oldStatus,
          paymentStatus: fullOrder.paymentStatus,
          order: fullOrder,
          triggeredByDriverResponse: true
        });
        
        // Emit to admin room
        io.to('admin').emit('order-status-updated', {
          orderId: order.id,
          status: fullOrder.status,
          oldStatus: oldStatus,
          paymentStatus: fullOrder.paymentStatus,
          order: fullOrder,
          triggeredByDriverResponse: true
        });
        
        // Also emit to driver room if order still has a driver (for accepted orders)
        if (fullOrder.driverId) {
          io.to(`driver-${fullOrder.driverId}`).emit('order-status-updated', {
            orderId: order.id,
            status: fullOrder.status,
            oldStatus: oldStatus,
            paymentStatus: fullOrder.paymentStatus,
            order: fullOrder
          });
        }
        
        // If driver was changed (rejected), also notify old driver
        if (oldDriverId && oldDriverId !== fullOrder.driverId) {
          io.to(`driver-${oldDriverId}`).emit('driver-removed', {
            orderId: order.id
          });
        }
      }).catch(err => {
        console.error('Error loading full order for socket events:', err);
      });
    }

    // Send response immediately with minimal data
    console.log(`📤 [RESPONSE] Sending response for order #${order.id}: driverId=${updatedOrder.driverId}, driverAccepted=${updatedOrder.driverAccepted}, status=${updatedOrder.status}`);
    sendSuccess(res, updatedOrder, `Order ${accepted ? 'accepted' : 'rejected'} successfully`);
  } catch (error) {
    console.error('Error responding to order:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Request cancellation of an order
 * POST /api/driver-orders/:orderId/request-cancellation
 */
router.post('/:orderId/request-cancellation', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { driverId, reason } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return sendError(res, 'Cancellation reason is required', 400);
    }

    if (reason.trim().length > 500) {
      return sendError(res, 'Cancellation reason must be 500 characters or fewer', 400);
    }

    // Check if cancellationRequested column exists in database
    let hasCancellationColumns = false;
    try {
      const [columns] = await db.sequelize.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'cancellationRequested'"
      );
      hasCancellationColumns = columns.length > 0;
    } catch (schemaError) {
      // If schema query fails, assume columns don't exist
      console.warn('⚠️ Could not check for cancellationRequested column, assuming it does not exist:', schemaError.message);
    }

    // Build attributes list - exclude cancellation columns if they don't exist
    let orderAttributes = null; // null means select all attributes
    if (!hasCancellationColumns) {
      // Get all standard order attributes except cancellation fields
      const allOrderAttrs = Object.keys(db.Order.rawAttributes);
      orderAttributes = allOrderAttrs.filter(attr => 
        !attr.includes('cancellation')
      );
    }

    const order = await db.Order.findByPk(orderId, {
      attributes: orderAttributes
    });

    if (!order) {
      return sendError(res, 'Order not found', 404);
    }

    // Verify driver is assigned to this order
    if (order.driverId !== parseInt(driverId)) {
      return sendError(res, 'Not authorized to cancel this order', 403);
    }

    // Check if order can be cancelled (not already cancelled or completed)
    if (order.status === 'cancelled' || order.status === 'completed' || order.status === 'delivered') {
      return sendError(res, 'Order cannot be cancelled at this stage', 400);
    }

    // Check if cancellation already requested (only if column exists)
    if (hasCancellationColumns && order.cancellationRequested) {
      return sendError(res, 'Cancellation already requested for this order', 400);
    }

    // Request cancellation (only if columns exist)
    if (hasCancellationColumns) {
      await order.update({
        cancellationRequested: true,
        cancellationReason: reason.trim(),
        cancellationRequestedAt: new Date(),
        status: 'cancelled' // Move order to cancelled status immediately
      });
    } else {
      return sendError(res, 'Cancellation feature is not available in this database version', 501);
    }

    // Add note to order
    const cancellationNote = `[${new Date().toISOString()}] Cancellation requested by driver. Reason: ${reason.trim()}`;
    order.notes = order.notes ? `${order.notes}\n${cancellationNote}` : cancellationNote;
    await order.save();

    console.log(`📋 Order #${order.id} cancellation requested by driver ${driverId}`);

    // Reload order for response with full details
    const updatedOrder = await db.Order.findByPk(order.id, {
      include: [
        {
          model: db.Driver,
          as: 'driver',
          attributes: ['id', 'name', 'phoneNumber']
        },
        {
          model: db.OrderItem,
          as: 'items',
          include: [{ model: db.Drink, as: 'drink' }]
        }
      ]
    });

    // Emit socket event to notify admin and driver
    const io = req.app.get('io');
    if (io) {
      const orderData = updatedOrder.toJSON();
      if (orderData.items) {
        orderData.orderItems = orderData.items;
      }
      
      // Notify admin of cancellation request
      io.to('admin').emit('order-cancellation-requested', {
        orderId: order.id,
        order: orderData,
        driverId: driverId,
        reason: reason.trim(),
        timestamp: new Date()
      });
      
      // Notify driver of status change (order is now cancelled)
      const driverRoom = `driver-${driverId}`;
      io.to(driverRoom).emit('order-status-updated', {
        orderId: order.id,
        status: 'cancelled',
        paymentStatus: orderData.paymentStatus,
        order: orderData
      });
      
      console.log(`📢 Socket event emitted: order-cancellation-requested for Order #${order.id}`);
      console.log(`📡 Socket event emitted: order-status-updated to ${driverRoom} for Order #${order.id} (status: cancelled)`);
    }

    sendSuccess(res, updatedOrder, 'Cancellation request submitted. Waiting for admin approval.');
  } catch (error) {
    console.error('Error requesting cancellation:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Get pending orders for a driver (assigned but not yet accepted/rejected)
 * GET /api/driver-orders/:driverId/pending
 */
router.get('/:driverId/pending', async (req, res) => {
  const queryStartTime = Date.now();
  try {
    const { driverId } = req.params;
    const { summary } = req.query;

    // Get orders assigned to this driver where driverAccepted is null or false
    // Also exclude cancelled and completed orders from pending list
    const whereClause = { 
      driverId: parseInt(driverId),
      status: {
        [Op.notIn]: ['cancelled', 'completed']
      },
      [Op.or]: [
        { driverAccepted: null },
        { driverAccepted: false }
      ]
    };
    
    console.log(`🔍 [PENDING ORDERS] Query for driver ${driverId}:`, JSON.stringify(whereClause, null, 2));

    // Build includes - for summary mode, exclude all nested objects to shrink payload
    const includes = [];
    
    if (summary !== 'true') {
      // Full mode: include items and drinks (for detail view)
      includes.push(
        {
          model: db.OrderItem,
          as: 'items',
          include: [
            {
              model: db.Drink,
              as: 'drink'
            }
          ]
        },
        {
          model: db.Branch,
          as: 'branch',
          required: false
        }
      );
    }

    const dbQueryStartTime = Date.now();
    const orders = await db.Order.findAll({
      where: whereClause,
      include: includes,
      order: [['createdAt', 'DESC']]
    });
    const dbQueryTime = Date.now() - dbQueryStartTime;
    
    console.log(`🔍 [PENDING ORDERS] Found ${orders.length} pending orders for driver ${driverId}`);
    if (orders.length > 0) {
      console.log(`📋 [PENDING ORDERS] Order IDs: ${orders.map(o => `#${o.id} (status: ${o.status}, driverAccepted: ${o.driverAccepted})`).join(', ')}`);
    } else {
      // Debug: Check if there are any orders assigned to this driver at all
      const allDriverOrders = await db.Order.findAll({
        where: { driverId: parseInt(driverId) },
        attributes: ['id', 'status', 'driverAccepted', 'driverId'],
        limit: 10
      });
      console.log(`🔍 [PENDING ORDERS DEBUG] Total orders for driver ${driverId}: ${allDriverOrders.length}`);
      if (allDriverOrders.length > 0) {
        console.log(`📋 [PENDING ORDERS DEBUG] Sample orders:`, JSON.stringify(allDriverOrders.map(o => ({
          id: o.id,
          status: o.status,
          driverAccepted: o.driverAccepted,
          driverId: o.driverId
        })), null, 2));
      }
    }
    
    // Map items to orderItems for compatibility and add credit limit status
    const mappingStartTime = Date.now();
    const { checkDriverCreditLimit } = require('../utils/creditLimit');
    
    let ordersWithMappedItems;
    
    if (summary === 'true') {
      // Summary mode: Return only essential fields (no nested objects)
      ordersWithMappedItems = await Promise.all(orders.map(async (order) => {
        const orderData = order.toJSON();
        const result = {
          id: orderData.id,
          customerName: orderData.customerName,
          deliveryAddress: orderData.deliveryAddress,
          status: orderData.status,
          paymentStatus: orderData.paymentStatus,
          totalAmount: orderData.totalAmount,
          driverId: orderData.driverId,
          driverAccepted: orderData.driverAccepted,
          createdAt: orderData.createdAt
          // Exclude: items, drinks, transactions, branch, etc.
        };
        
        // Add credit limit status for driver app to determine if update button should be disabled
        const creditCheck = await checkDriverCreditLimit(parseInt(driverId), true);
        result.creditStatus = {
          canUpdateOrders: creditCheck.canUpdateOrders,
          exceeded: creditCheck.exceeded,
          cashAtHand: creditCheck.cashAtHand,
          creditLimit: creditCheck.creditLimit,
          pendingSubmissionsAmount: creditCheck.pendingSubmissionsAmount
        };
        
        return result;
      }));
    } else {
      // Full mode: Include all nested objects
      ordersWithMappedItems = await Promise.all(orders.map(async (order) => {
        const orderData = order.toJSON();
        if (orderData.items) {
          orderData.orderItems = orderData.items;
        }
        
        // Add credit limit status for driver app to determine if update button should be disabled
        const creditCheck = await checkDriverCreditLimit(parseInt(driverId), true);
        orderData.creditStatus = {
          canUpdateOrders: creditCheck.canUpdateOrders,
          exceeded: creditCheck.exceeded,
          cashAtHand: creditCheck.cashAtHand,
          creditLimit: creditCheck.creditLimit,
          pendingSubmissionsAmount: creditCheck.pendingSubmissionsAmount
        };
        
        return orderData;
      }));
    }
    
    const mappingTime = Date.now() - mappingStartTime;
    const totalTime = Date.now() - queryStartTime;
    const payloadSize = JSON.stringify(ordersWithMappedItems).length;
    console.log(`📊 GET /api/driver-orders/${driverId}/pending - Query: ${dbQueryTime}ms, Mapping: ${mappingTime}ms, Total: ${totalTime}ms, Orders: ${orders.length}, Payload: ${(payloadSize / 1024).toFixed(2)} KB`);

    sendSuccess(res, ordersWithMappedItems);
  } catch (error) {
    const totalTime = Date.now() - queryStartTime;
    console.error(`❌ Error fetching pending orders (${totalTime}ms):`, error);
    sendError(res, error.message, 500);
  }
});

/**
 * Get orders assigned to a driver
 * GET /api/driver-orders/:driverId
 */
router.get('/:driverId', async (req, res) => {
  const queryStartTime = Date.now();
  console.log(`🔍 [ACTIVE ORDERS] Request received: GET /api/driver-orders/${req.params.driverId}`);
  console.log(`🔍 [ACTIVE ORDERS] Query params:`, req.query);
  try {
    const { driverId } = req.params;
    const { status, startDate, endDate, includeTransactions, summary } = req.query;

    // Build where clause
    const whereClause = { driverId: parseInt(driverId) };
    
    // Filter by status if provided (can be multiple statuses)
    if (status) {
      // Handle comma-separated string or array
      let statuses;
      if (Array.isArray(status)) {
        statuses = status;
      } else if (typeof status === 'string' && status.includes(',')) {
        statuses = status.split(',').map(s => s.trim());
      } else {
        statuses = [status];
      }
      
      // For active orders (when status filter includes active statuses), also require driverAccepted = true
      // This ensures only accepted orders show in active list, regardless of status
      const activeStatuses = ['pending', 'confirmed', 'out_for_delivery'];
      const isActiveQuery = statuses.some(s => activeStatuses.includes(s));
      
      console.log(`🔍 [ACTIVE ORDERS] Status filter: ${status}, isActiveQuery: ${isActiveQuery}, statuses:`, statuses);
      
      if (isActiveQuery) {
        // Active orders: require driverAccepted = true and exclude cancelled/completed
        whereClause.driverAccepted = true;
        // Filter out cancelled/completed from the statuses array before using Op.in
        const filteredStatuses = statuses.filter(s => !['cancelled', 'completed'].includes(s));
        whereClause.status = { [Op.in]: filteredStatuses };
        console.log(`🔍 [ACTIVE ORDERS] Filtered statuses:`, filteredStatuses);
        console.log(`🔍 [ACTIVE ORDERS] Where clause:`, JSON.stringify(whereClause, null, 2));
      } else {
        // Non-active orders: just filter by status
        whereClause.status = { [Op.in]: statuses };
      }
    }

    // Filter by date range if provided (for completed orders)
    let dateFilter = {};
    if (startDate) {
      dateFilter.createdAt = { [Op.gte]: new Date(startDate) };
    }
    if (endDate) {
      dateFilter.createdAt = { 
        ...dateFilter.createdAt,
        [Op.lte]: new Date(endDate + 'T23:59:59')
      };
    }

    // Build includes - for summary mode, exclude all nested objects to shrink payload
    const includes = [];
    
    if (summary !== 'true') {
      // Full mode: include items and drinks (for detail view)
      includes.push(
        {
          model: db.OrderItem,
          as: 'items',
          include: [
            {
              model: db.Drink,
              as: 'drink'
            }
          ]
        },
        {
          model: db.Branch,
          as: 'branch',
          required: false
        }
      );

      // Only include transactions if explicitly requested (for completed orders detail view)
      if (includeTransactions === 'true') {
        includes.push({
          model: db.Transaction,
          as: 'transactions',
          required: false,
          order: [['createdAt', 'DESC']],
          limit: 10 // Limit transactions to most recent 10 for performance
        });
      }
    }

    const dbQueryStartTime = Date.now();
    const finalWhereClause = {...whereClause, ...dateFilter};
    console.log(`🔍 [ACTIVE ORDERS] Executing query with whereClause:`, JSON.stringify(finalWhereClause, null, 2));
    const orders = await db.Order.findAll({
      where: finalWhereClause,
      include: includes,
      order: [['createdAt', 'DESC']]
    });
    const dbQueryTime = Date.now() - dbQueryStartTime;
    console.log(`🔍 [ACTIVE ORDERS] Query completed in ${dbQueryTime}ms, found ${orders.length} orders`);
    
    // Map items to orderItems for compatibility and add credit limit status
    const mappingStartTime = Date.now();
    const { checkDriverCreditLimit } = require('../utils/creditLimit');
    
    let ordersWithMappedItems;
    
    if (summary === 'true') {
      // Summary mode: Return only essential fields (no nested objects)
      // For completed orders, also include payment transaction data
      ordersWithMappedItems = await Promise.all(orders.map(async (order) => {
        const orderData = order.toJSON();
        const result = {
          id: orderData.id,
          customerName: orderData.customerName,
          deliveryAddress: orderData.deliveryAddress,
          status: orderData.status,
          paymentStatus: orderData.paymentStatus,
          paymentMethod: orderData.paymentMethod,
          totalAmount: orderData.totalAmount,
          driverId: orderData.driverId,
          driverAccepted: orderData.driverAccepted,
          createdAt: orderData.createdAt
        };
        
        // Add credit limit status for driver app to determine if update button should be disabled
        const creditCheck = await checkDriverCreditLimit(parseInt(driverId), true);
        result.creditStatus = {
          canUpdateOrders: creditCheck.canUpdateOrders,
          exceeded: creditCheck.exceeded,
          cashAtHand: creditCheck.cashAtHand,
          creditLimit: creditCheck.creditLimit,
          pendingSubmissionsAmount: creditCheck.pendingSubmissionsAmount
        };
        
        // For completed orders, include payment transaction data
        if (orderData.status === 'completed' && orderData.paymentStatus === 'paid') {
          try {
            const paymentTransaction = await db.Transaction.findOne({
              where: {
                orderId: orderData.id,
                transactionType: 'payment',
                paymentStatus: 'paid'
              },
              order: [['createdAt', 'DESC']],
              attributes: ['receiptNumber', 'transactionDate']
            });
            
            if (paymentTransaction) {
              const txData = paymentTransaction.toJSON();
              result.transactionCode = txData.receiptNumber;
              result.transactionDate = txData.transactionDate;
            }
          } catch (txError) {
            // If transaction lookup fails, continue without transaction data
            console.warn(`Could not fetch transaction for order ${orderData.id}:`, txError.message);
          }
        }
        
        return result;
      }));
    } else {
      // Full mode: Include all nested objects
      ordersWithMappedItems = await Promise.all(orders.map(async (order) => {
        const orderData = order.toJSON();
        if (orderData.items) {
          orderData.orderItems = orderData.items;
        }
        
        // Add credit limit status for driver app to determine if update button should be disabled
        const creditCheck = await checkDriverCreditLimit(parseInt(driverId), true);
        orderData.creditStatus = {
          canUpdateOrders: creditCheck.canUpdateOrders,
          exceeded: creditCheck.exceeded,
          cashAtHand: creditCheck.cashAtHand,
          creditLimit: creditCheck.creditLimit,
          pendingSubmissionsAmount: creditCheck.pendingSubmissionsAmount
        };
        
        return orderData;
      }));
    }
    
    const mappingTime = Date.now() - mappingStartTime;
    const totalTime = Date.now() - queryStartTime;
    const payloadSize = JSON.stringify(ordersWithMappedItems).length;
    console.log(`📊 GET /api/driver-orders/${driverId} - Query: ${dbQueryTime}ms, Mapping: ${mappingTime}ms, Total: ${totalTime}ms, Orders: ${orders.length}, Payload: ${(payloadSize / 1024).toFixed(2)} KB`);

    // Return standardized response format (wrapped in ApiResponse)
    // All endpoints should use sendSuccess/sendError for consistency
    sendSuccess(res, ordersWithMappedItems);
  } catch (error) {
    const totalTime = Date.now() - queryStartTime;
    console.error(`❌ Error fetching driver orders (${totalTime}ms):`, error);
    sendError(res, error.message, 500);
  }
});

/**
 * Update order status (driver actions)
 * PATCH /api/driver-orders/:orderId/status
 */
router.patch('/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, driverId, oldStatus } = req.body;


    if (!status || !['out_for_delivery', 'delivered', 'completed'].includes(status)) {
      return sendError(res, 'Invalid status', 400);
    }

    const order = await db.Order.findByPk(orderId, {
      include: [{ model: db.OrderItem, as: 'orderItems' }]
    });

    if (!order) {
      return sendError(res, 'Order not found', 404);
    }

    // Verify driver is assigned to this order
    if (order.driverId !== parseInt(driverId)) {
      return sendError(res, 'Not authorized to update this order', 403);
    }

    // Check if driver has a pending cancellation request on any order (prevent updating other orders)
    let hasCancellationColumns = false;
    try {
      const [columns] = await db.sequelize.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'cancellationRequested'"
      );
      hasCancellationColumns = columns.length > 0;
    } catch (schemaError) {
      hasCancellationColumns = false;
    }

    if (hasCancellationColumns) {
      // Check if driver has a cancelled order pending admin approval
      const pendingCancellation = await db.Order.findOne({
        where: {
          driverId: parseInt(driverId),
          status: 'cancelled',
          cancellationRequested: true,
          cancellationApproved: null, // Pending approval
          id: { [Op.ne]: parseInt(orderId) } // Different order
        }
      });

      if (pendingCancellation) {
        return sendError(res, `Cannot update order: You have a cancelled order (Order #${pendingCancellation.id}) pending admin approval. Please wait for admin approval before updating other orders.`, 400);
      }
    }

    // Check credit limit - driver can update orders if:
    // 1. Cash at hand is within limit, OR
    // 2. Cash at hand exceeds limit BUT has pending cash submissions (which will reduce cash at hand when approved)
    const creditCheck = await checkDriverCreditLimit(parseInt(driverId), true);
    console.log(`🔍 [Credit Limit Check] Order #${orderId}, Driver ${driverId}:`, {
      cashAtHand: creditCheck.cashAtHand,
      creditLimit: creditCheck.creditLimit,
      exceeded: creditCheck.exceeded,
      effectiveCashAtHand: creditCheck.effectiveCashAtHand,
      pendingSubmissionsAmount: creditCheck.pendingSubmissionsAmount,
      canUpdateOrders: creditCheck.canUpdateOrders
    });
    
    if (!creditCheck.canUpdateOrders) {
      console.log(`❌ [Credit Limit Blocked] Order #${orderId} update blocked for driver ${driverId}: Cash at hand (KES ${creditCheck.cashAtHand.toFixed(2)}) exceeds limit (KES ${creditCheck.creditLimit.toFixed(2)})`);
      return sendError(res, `Cannot update order: Credit limit exceeded. Your cash at hand (KES ${creditCheck.cashAtHand.toFixed(2)}) exceeds your credit limit of KES ${creditCheck.creditLimit.toFixed(2)}. Please make cash submissions and wait for approval before updating orders.`, 403);
    }
    
    console.log(`✅ [Credit Limit Passed] Order #${orderId} update allowed for driver ${driverId}`);

    // Strict step-by-step validation: Cannot skip statuses
    const statusFlow = ['pending', 'confirmed', 'out_for_delivery', 'delivered', 'completed'];
    const currentStatusIndex = statusFlow.indexOf(order.status);
    const newStatusIndex = statusFlow.indexOf(status);

    if (currentStatusIndex === -1 || newStatusIndex === -1) {
      return sendError(res, 'Invalid status transition', 400);
    }

    // Must be exactly one step forward (unless auto-completing from delivered)
    if (status === 'completed') {
      // Allow completion only from delivered status
      if (order.status !== 'delivered') {
        return sendError(res, 'Can only complete orders that are delivered', 400);
      }
    } else if (newStatusIndex !== currentStatusIndex + 1) {
      return sendError(res, `Cannot update to ${status}. Order must be in ${statusFlow[currentStatusIndex]} status first.`, 400);
    }

    let finalStatus = status;

    // If delivered and payment is paid, auto-update to completed
    if (status === 'delivered') {
      if (order.paymentType === 'pay_on_delivery' && order.paymentStatus !== 'paid') {
        return sendError(res, 'Cannot mark order as delivered until payment is confirmed as paid.', 400);
      }
    }

    if (status === 'delivered' && order.paymentStatus === 'paid') {
      await order.update({ status: 'completed' });
      finalStatus = 'completed';
    } else {
      // Update order status
      await order.update({ status });
    }

    // Update driver's lastActivity whenever they update an order status
    const driver = await db.Driver.findByPk(driverId);
    if (driver) {
      await driver.update({ 
        lastActivity: new Date()
      });
      console.log(`✅ Updated lastActivity for driver ${driverId} (order status update)`);
    }

    // Trigger Valkyrie webhooks if enabled
    if (process.env.ENABLE_VALKYRIE === 'true' || process.env.ENABLE_VALKYRIE === '1') {
      try {
        const valkyrieService = require('../services/valkyrie');
        await valkyrieService.triggerOrderStatusWebhook(order.id, finalStatus);
      } catch (valkyrieError) {
        console.error('Valkyrie webhook error (non-blocking):', valkyrieError.message);
        // Don't fail the order update if webhook fails
      }
    }

    // If delivered or completed, check if driver has more active orders
    // Only set driver status to 'active' if they have no more active orders
    if (finalStatus === 'delivered' || finalStatus === 'completed') {
      const { updateDriverStatusIfNoActiveOrders } = require('../utils/driverAssignment');
      await updateDriverStatusIfNoActiveOrders(driverId);

      // Credit all wallets when order is completed (delivery completed)
      if (finalStatus === 'completed') {
        try {
          await creditWalletsOnDeliveryCompletion(order.id, req);
          console.log(`✅ Wallets credited for Order #${order.id} on delivery completion`);
        } catch (walletError) {
          console.error(`❌ Error crediting wallets for Order #${order.id}:`, walletError);
          // Don't fail the status update if wallet crediting fails
        }
        
        // Decrease inventory stock for completed orders
        try {
          const { decreaseInventoryForOrder } = require('../utils/inventory');
          await decreaseInventoryForOrder(order.id);
          console.log(`📦 Inventory decreased for Order #${order.id} (driver status update)`);
        } catch (inventoryError) {
          console.error(`❌ Error decreasing inventory for Order #${order.id}:`, inventoryError);
          // Don't fail the status update if inventory update fails
        }
      }

      // Note: All wallet credits (merchant, driver delivery fee, tip) are now handled by creditWalletsOnDeliveryCompletion
      // which is called above when order status is 'completed'

      // Note: Tip crediting is now handled by creditWalletsOnDeliveryCompletion when order is completed
      // CRITICAL: Don't call ensureDeliveryFeeSplit when order is completed - creditWalletsOnDeliveryCompletion handles everything
      // Only call ensureDeliveryFeeSplit for non-completed orders to sync delivery fee transactions
      if (order.paymentStatus === 'paid' && finalStatus !== 'completed') {
        try {
          await ensureDeliveryFeeSplit(order, { context: 'driver-status-update' });
        } catch (syncError) {
          console.error('❌ Error syncing delivery fee transactions (driver status update):', syncError);
        }
      }
    } else if (finalStatus === 'out_for_delivery') {
      // Update driver status to on_delivery
      // Note: lastActivity is already updated above for all status updates
      const driverForStatus = await db.Driver.findByPk(driverId);
      if (driverForStatus) {
        await driverForStatus.update({ 
          status: 'on_delivery'
        });
      }
    }

    // Reload order to get updated status with all related data
    await order.reload({
      include: [
        {
          model: db.OrderItem,
          as: 'orderItems',
          include: [{ model: db.Drink, as: 'drink' }]
        }
      ]
    });

    // Get fresh order data to ensure we have the latest status
    const freshOrder = await db.Order.findByPk(order.id, {
      include: [
        {
          model: db.OrderItem,
          as: 'orderItems',
          include: [{ model: db.Drink, as: 'drink' }]
        }
      ]
    });

    // Emit Socket.IO event for real-time updates
    const io = req.app.get('io');
    if (io) {
      // Prepare order data for socket event (convert to plain object)
      const orderData = freshOrder.toJSON ? freshOrder.toJSON() : freshOrder;
      
      const statusUpdateData = {
        orderId: freshOrder.id,
        status: freshOrder.status,
        oldStatus: oldStatus,
        paymentStatus: freshOrder.paymentStatus,
        order: orderData // Send full order object with all latest data
      };
      
      console.log(`📡 Emitting order-status-updated for Order #${freshOrder.id}`);
      console.log(`   Status: ${oldStatus} → ${freshOrder.status}`);
      console.log(`   PaymentStatus: ${freshOrder.paymentStatus}`);
      
      // Emit to order room
      io.to(`order-${freshOrder.id}`).emit('order-status-updated', statusUpdateData);
      
      // Emit to admin room
      io.to('admin').emit('order-status-updated', statusUpdateData);
      
      // Also emit to driver room if order has driverId
      if (freshOrder.driverId) {
        io.to(`driver-${freshOrder.driverId}`).emit('order-status-updated', statusUpdateData);
        console.log(`📡 Also emitted to driver-${freshOrder.driverId} room`);
      }
      
      console.log(`📡 Emitted order-status-updated to admin room for Order #${freshOrder.id}: ${oldStatus} → ${freshOrder.status}`);
    }

    sendSuccess(res, freshOrder);
  } catch (error) {
    console.error('Error updating order status:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Initiate M-Pesa payment for customer (pay on delivery)
 * POST /api/driver-orders/:orderId/initiate-payment
 */
router.post('/:orderId/initiate-payment', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { driverId, customerPhone } = req.body;

    const order = await db.Order.findByPk(orderId);

    if (!order) {
      return sendError(res, 'Order not found', 404);
    }

    // Verify driver is assigned to this order
    if (order.driverId !== parseInt(driverId)) {
      return sendError(res, 'Not authorized', 403);
    }

    // Check if order is pay on delivery
    if (order.paymentType !== 'pay_on_delivery') {
      return sendError(res, 'Order is not pay on delivery', 400);
    }

    // Check if already paid
    if (order.paymentStatus === 'paid') {
      return sendError(res, 'Order is already paid', 400);
    }

    if (!['out_for_delivery'].includes(order.status)) {
      return sendError(res, 'Order must be marked as On the Way before sending a payment prompt.', 400);
    }

    // Format phone number
    const cleanedPhone = customerPhone.replace(/\D/g, '');
    let formattedPhone = cleanedPhone;
    
    if (cleanedPhone.startsWith('0')) {
      formattedPhone = '254' + cleanedPhone.substring(1);
    } else if (!cleanedPhone.startsWith('254')) {
      formattedPhone = '254' + cleanedPhone;
    }

    // Initiate STK push
    // Customer pays full amount including tip (order.totalAmount includes tip)
    // The payment will be split into 2 transactions: order payment (minus tip) and tip transaction
    const amount = parseFloat(order.totalAmount); // Full amount including tip
    console.log(`🚀 Driver initiating STK Push for Order #${orderId}:`, {
      phone: formattedPhone,
      amount: amount,
      orderId: order.id,
      driverId: driverId
    });
    
    const stkResult = await mpesaService.initiateSTKPush(
      formattedPhone,
      amount,
      order.id,
      `Payment for order #${order.id}`
    );

    console.log(`📋 STK Push result for Order #${orderId}:`, {
      success: stkResult.success,
      responseCode: stkResult.responseCode,
      checkoutRequestID: stkResult.checkoutRequestID,
      error: stkResult.error
    });

    // Check if STK push was initiated successfully
    // M-Pesa returns success even if the request is accepted, but payment hasn't completed yet
    // We should return success immediately and wait for callback to determine final status
    if (stkResult.success || stkResult.checkoutRequestID || stkResult.CheckoutRequestID) {
      const checkoutRequestID = stkResult.checkoutRequestID || stkResult.CheckoutRequestID;
      const merchantRequestID = stkResult.merchantRequestID || stkResult.MerchantRequestID;
      
      // Store checkout request ID in order notes (for callback to find order)
      const checkoutNote = `M-Pesa CheckoutRequestID: ${checkoutRequestID}`;
      await order.update({
        paymentMethod: 'mobile_money',
        notes: order.notes ? 
          `${order.notes}\n${checkoutNote}` : 
          checkoutNote
      });
      
      // Create transaction records for STK push initiation (same as when customer initiates)
      // The tip will be created as a separate transaction when payment callback confirms
      try {
        const {
          itemsTotal,
          deliveryFee,
          tipAmount
        } = await getOrderFinancialBreakdown(order.id);

        const [driverPayEnabledSetting, driverPayAmountSetting] = await Promise.all([
          db.Settings.findOne({ where: { key: 'driverPayPerDeliveryEnabled' } }).catch(() => null),
          db.Settings.findOne({ where: { key: 'driverPayPerDeliveryAmount' } }).catch(() => null)
        ]);

        const driverPaySettingEnabled = driverPayEnabledSetting?.value === 'true';
        const configuredDriverPayAmount = parseFloat(driverPayAmountSetting?.value || '0');
        const driverPayAmount = driverPaySettingEnabled && order.driverId && configuredDriverPayAmount > 0
          ? Math.min(deliveryFee, configuredDriverPayAmount)
          : 0;
        const merchantDeliveryAmount = Math.max(deliveryFee - driverPayAmount, 0);

        const baseTransactionPayload = {
          orderId: order.id,
          paymentMethod: 'mobile_money',
          paymentProvider: 'mpesa',
          status: 'pending',
          paymentStatus: 'pending',
          checkoutRequestID: checkoutRequestID,
          merchantRequestID: merchantRequestID,
          phoneNumber: formattedPhone
        };

        const paymentNote = `STK Push initiated by driver. Customer pays KES ${amount.toFixed(2)}. Item portion: KES ${itemsTotal.toFixed(2)}.${tipAmount > 0 ? ` Tip (KES ${tipAmount.toFixed(2)}) will be recorded separately.` : ''}`;

        let paymentTransaction = await db.Transaction.findOne({
          where: {
            orderId: order.id,
            transactionType: 'payment',
            status: { [Op.ne]: 'completed' }
          },
          order: [['createdAt', 'DESC']]
        });

        if (paymentTransaction) {
          await paymentTransaction.update({
            ...baseTransactionPayload,
            amount: itemsTotal,
            notes: paymentNote
          });
          console.log(`✅ Payment transaction updated for driver-initiated payment on Order #${order.id} (transaction #${paymentTransaction.id})`);
        } else {
          paymentTransaction = await db.Transaction.create({
            ...baseTransactionPayload,
            transactionType: 'payment',
            amount: itemsTotal,
            notes: paymentNote
          });
          console.log(`✅ Payment transaction created for driver-initiated payment on Order #${order.id} (transaction #${paymentTransaction.id})`);
        }

        const deliveryNote = driverPayAmount > 0
          ? `Delivery fee portion for Order #${orderId}. Merchant share: KES ${merchantDeliveryAmount.toFixed(2)}. Driver payout KES ${driverPayAmount.toFixed(2)} pending.`
          : `Delivery fee portion for Order #${orderId}. Amount: KES ${deliveryFee.toFixed(2)}. Included in same M-Pesa payment.`;

        let deliveryTransaction = await db.Transaction.findOne({
          where: {
            orderId: order.id,
            transactionType: 'delivery_pay',
            status: { [Op.ne]: 'completed' }
          },
          order: [['createdAt', 'DESC']]
        });

        if (deliveryTransaction) {
          await deliveryTransaction.update({
            ...baseTransactionPayload,
            transactionType: 'delivery_pay',
            amount: merchantDeliveryAmount,
            notes: deliveryNote
          });
          console.log(`✅ Delivery fee transaction updated for Order #${orderId} (transaction #${deliveryTransaction.id})`);
        } else {
          deliveryTransaction = await db.Transaction.create({
            ...baseTransactionPayload,
            transactionType: 'delivery_pay',
            amount: merchantDeliveryAmount,
            notes: deliveryNote
          });
          console.log(`✅ Delivery fee transaction created for Order #${orderId} (transaction #${deliveryTransaction.id})`);
        }

        // CRITICAL: DO NOT create driver delivery transactions here!
        // Driver delivery transactions should ONLY be created by creditWalletsOnDeliveryCompletion
        // when delivery is completed. Creating them here causes duplicates.
        // 
        // We only create merchant delivery fee transactions here. Driver delivery transactions
        // will be created when the order is marked as completed.
        if (driverPayAmount > 0 && order.driverId) {
          console.log(`ℹ️  Skipping driver delivery transaction creation for Order #${orderId} - will be created by creditWalletsOnDeliveryCompletion on delivery completion`);
        } else {
          const existingDriverDeliveryTransaction = await db.Transaction.findOne({
            where: {
              orderId: order.id,
              transactionType: 'delivery_pay',
              driverId: order.driverId || null
            },
            order: [['createdAt', 'DESC']]
          });

          if (existingDriverDeliveryTransaction) {
            await existingDriverDeliveryTransaction.update({
              status: 'cancelled',
              paymentStatus: 'cancelled',
              amount: 0,
              notes: `${existingDriverDeliveryTransaction.notes || ''}\nDriver delivery fee payment disabled or no driver assigned.`.trim()
            });
          }
        }
      } catch (transactionError) {
        console.error('❌ Error preparing driver-initiated transactions:', transactionError);
        // Don't fail the STK push if transaction creation fails - log it but continue
        console.log('⚠️  Continuing with STK push despite transaction preparation error');
      }
      
      console.log(`✅ STK Push initiated for Order #${orderId}. CheckoutRequestID: ${checkoutRequestID}`);
      
      // STK push was initiated - return success immediately
      // Don't wait for callback - that will come separately
      // The callback will handle payment status updates and notify driver via socket
      
      sendSuccess(res, {
        checkoutRequestID: checkoutRequestID,
        merchantRequestID: merchantRequestID,
        status: 'pending' // Payment is pending until callback confirms
      }, 'Payment request sent to customer. Waiting for payment confirmation...');
    } else {
      // Only fail if STK push couldn't be initiated at all (network error, invalid credentials, etc.)
      // Not if it's just waiting for user to enter PIN
      sendError(res, stkResult.error || 'Failed to initiate payment request', 500);
    }
  } catch (error) {
    console.error('Error initiating payment:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Manually confirm payment received by driver (cash, card, or direct M-Pesa)
 * POST /api/driver-orders/:orderId/confirm-cash-payment
 */
router.post('/:orderId/confirm-cash-payment', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { driverId, method = 'cash', receiptNumber: providedReceipt, cardLast4, cardType, authorizationCode } = req.body || {};

    const order = await db.Order.findByPk(orderId, {
      include: [
        {
          model: db.OrderItem,
          as: 'orderItems'
        }
      ]
    });

    if (!order) {
      return sendError(res, 'Order not found', 404);
    }

    if (order.driverId !== parseInt(driverId)) {
      return sendError(res, 'Not authorized', 403);
    }

    if (order.paymentType !== 'pay_on_delivery') {
      return sendError(res, 'Order is not pay on delivery', 400);
    }

    if (order.paymentStatus === 'paid') {
      return sendError(res, 'Order payment is already marked as paid', 400);
    }

    const now = new Date();
    let methodLabel, paymentMethod, paymentProvider;
    
    if (method === 'mpesa_manual') {
      methodLabel = 'driver M-Pesa';
      paymentMethod = 'mobile_money';
      paymentProvider = 'driver_mpesa_manual';
    } else if (method === 'card') {
      methodLabel = 'card payment';
      paymentMethod = 'card';
      // Check if this is a PDQ payment (has card details) or PesaPal web payment
      paymentProvider = (cardLast4 || cardType || authorizationCode) ? 'pdq' : 'pesapal';
    } else {
      methodLabel = 'cash in hand';
      paymentMethod = 'cash';
      paymentProvider = 'cash_in_hand';
    }
    
    const normalizedReceipt = providedReceipt && typeof providedReceipt === 'string'
      ? providedReceipt.trim().slice(0, 64)
      : (method === 'card' ? 'CARD' : 'CASH');

    // Build payment note with card details if available
    let paymentNote = `Payment confirmed (${methodLabel}) by driver #${driverId}.`;
    if (method === 'card' && (cardLast4 || cardType || authorizationCode)) {
      paymentNote += ` Card: ${cardType || 'N/A'} ending in ${cardLast4 || 'N/A'}`;
      if (authorizationCode) {
        paymentNote += `, Auth Code: ${authorizationCode}`;
      }
    }

    let driverWalletInstance = null;
    const ensureDriverWallet = async () => {
      if (!order.driverId) {
        return null;
      }
      if (driverWalletInstance) {
        return driverWalletInstance;
      }
      driverWalletInstance = await db.DriverWallet.findOne({ where: { driverId: order.driverId } });
      if (!driverWalletInstance) {
        driverWalletInstance = await db.DriverWallet.create({
          driverId: order.driverId,
          balance: 0,
          totalTipsReceived: 0,
          totalTipsCount: 0,
          totalDeliveryPay: 0,
          totalDeliveryPayCount: 0
        });
      }
      return driverWalletInstance;
    };

    let paymentTransaction = await db.Transaction.findOne({
      where: {
        orderId: order.id,
        transactionType: 'payment'
      },
      order: [['createdAt', 'DESC']]
    });

    // Build payment note with card details if available
    let paymentDetails = '';
    if (method === 'card' && (cardLast4 || cardType || authorizationCode)) {
      paymentDetails = `. Card: ${cardType || 'N/A'} ending in ${cardLast4 || 'N/A'}`;
      if (authorizationCode) {
        paymentDetails += `, Auth Code: ${authorizationCode}`;
      }
    }
    
    const manualNote = `Manual payment confirmation by driver #${driverId} (${methodLabel})${paymentDetails}.`;
    const manualConfirmationNote = `Payment confirmed (${methodLabel}) by driver #${driverId}${paymentDetails}.`;

    if (paymentTransaction) {
      await paymentTransaction.update({
        paymentMethod,
        paymentProvider,
        status: 'completed',
        paymentStatus: 'paid',
        receiptNumber: normalizedReceipt,
        transactionDate: now,
        notes: paymentTransaction.notes ? `${paymentTransaction.notes}\n${manualNote}` : manualNote
      });
    } else {
      const { itemsTotal, deliveryFee, tipAmount } = await getOrderFinancialBreakdown(order.id);
      paymentTransaction = await db.Transaction.create({
        orderId: order.id,
        transactionType: 'payment',
        paymentMethod,
        paymentProvider,
        amount: itemsTotal,
        status: 'completed',
        paymentStatus: 'paid',
        receiptNumber: normalizedReceipt,
        transactionDate: now,
        notes: manualNote
      });
    }

    const { itemsTotal, deliveryFee, tipAmount } = await getOrderFinancialBreakdown(order.id);
    const totalAmount = parseFloat(order.totalAmount) || 0;

    const [driverPayEnabledSetting, driverPayModeSetting, driverPayAmountSetting, driverPayPercentageSetting] = await Promise.all([
      db.Settings.findOne({ where: { key: 'driverPayPerDeliveryEnabled' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'driverPayPerDeliveryMode' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'driverPayPerDeliveryAmount' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'driverPayPerDeliveryPercentage' } }).catch(() => null)
    ]);

    const driverPaySettingEnabled = driverPayEnabledSetting?.value === 'true';
    const driverPayMode = driverPayModeSetting?.value || 'amount';
    const isPercentageMode = driverPayMode === 'percentage';
    const configuredDriverPayAmount = parseFloat(driverPayAmountSetting?.value || '0');
    const configuredDriverPayPercentage = parseFloat(driverPayPercentageSetting?.value || '30');
    
    let driverPayAmount = 0;
    if (driverPaySettingEnabled && order.driverId) {
      if (isPercentageMode) {
        // Percentage mode: calculate driver pay as percentage of delivery fee
        const deliveryFeeAmount = parseFloat(deliveryFee) || 0;
        driverPayAmount = deliveryFeeAmount * (configuredDriverPayPercentage / 100);
        driverPayAmount = Math.min(driverPayAmount, deliveryFeeAmount);
      } else {
        // Amount mode: use fixed amount
        driverPayAmount = configuredDriverPayAmount > 0
          ? Math.min(parseFloat(deliveryFee) || 0, configuredDriverPayAmount)
          : 0;
      }
    }
    const merchantDeliveryAmount = Math.max((parseFloat(deliveryFee) || 0) - driverPayAmount, 0);

    if (merchantDeliveryAmount > 0.01) {
      let deliveryTransaction = await db.Transaction.findOne({
        where: {
          orderId: order.id,
          transactionType: 'delivery_pay'
        },
        order: [['createdAt', 'DESC']]
      });

      const deliveryNote = driverPayAmount > 0
        ? `Delivery fee marked as paid via ${methodLabel} confirmation by driver #${driverId}. Driver payout KES ${driverPayAmount.toFixed(2)} deducted.`
        : `Delivery fee marked as paid via ${methodLabel} confirmation by driver #${driverId}.`;

      if (deliveryTransaction) {
        await deliveryTransaction.update({
          paymentMethod,
          paymentProvider,
          status: 'completed',
          paymentStatus: 'paid',
          receiptNumber: deliveryTransaction.receiptNumber || normalizedReceipt,
          transactionDate: now,
          driverId: null,
          driverWalletId: null,
          notes: deliveryTransaction.notes ? `${deliveryTransaction.notes}\n${deliveryNote}` : deliveryNote,
          amount: merchantDeliveryAmount
        });
      } else {
        await db.Transaction.create({
          orderId: order.id,
          transactionType: 'delivery_pay',
          paymentMethod,
          paymentProvider,
          amount: merchantDeliveryAmount,
          status: 'completed',
          paymentStatus: 'paid',
          receiptNumber: normalizedReceipt,
          transactionDate: now,
          driverId: null,
          driverWalletId: null,
          notes: deliveryNote
        });
      }
    }

    if (driverPayAmount > 0.01 && order.driverId) {
      let driverDeliveryTransaction = await db.Transaction.findOne({
        where: {
          orderId: order.id,
          transactionType: 'delivery_pay',
          driverId: order.driverId
        },
        order: [['createdAt', 'DESC']]
      });

      const driverDeliveryNote = `Driver delivery fee payment confirmed via ${methodLabel} by driver #${driverId}.`;

      // CRITICAL: DO NOT create driver delivery transactions or credit driver wallet here!
      // Driver delivery transactions and wallet credits should ONLY be created by creditWalletsOnDeliveryCompletion
      // when delivery is completed. Creating them here causes duplicates and credits drivers before delivery.
      // 
      // We only update order.driverPayAmount here for tracking purposes.
      // The actual transaction creation and wallet crediting will happen when the order is marked as completed.
      console.log(`ℹ️  Skipping driver delivery transaction creation and wallet credit for Order #${order.id} on cash confirmation - will be created by creditWalletsOnDeliveryCompletion on delivery completion`);
      
      // Only update order.driverPayAmount for tracking - don't create transactions or credit wallet
      await order.update({
        driverPayAmount: driverPayAmount
      });
    }

    // CRITICAL: Tip and admin wallet crediting are now handled by creditWalletsOnDeliveryCompletion
    // when the order is marked as completed. This ensures consistent transaction creation.
    // We only create tip transaction here if order is not yet completed, otherwise creditWalletsOnDeliveryCompletion handles it.
    // For admin wallet, creditWalletsOnDeliveryCompletion handles it when order is completed.
    console.log(`ℹ️  Skipping tip and admin wallet crediting for Order #${order.id} - will be handled by creditWalletsOnDeliveryCompletion when order is completed`);

    const cashSettlementAmount = Math.max(totalAmount - (parseFloat(tipAmount) || 0) - driverPayAmount, 0);

    if (cashSettlementAmount > 0.01 && order.driverId) {
      try {
        const driverWallet = await ensureDriverWallet();
        if (driverWallet) {
          await driverWallet.update({
            balance: parseFloat(driverWallet.balance) - cashSettlementAmount
          });

          await db.Transaction.create({
            orderId: order.id,
            transactionType: 'cash_settlement',
            paymentMethod,
            paymentProvider,
            amount: cashSettlementAmount,
            status: 'completed',
            paymentStatus: 'paid',
            receiptNumber: normalizedReceipt,
            transactionDate: now,
            driverId: order.driverId,
            driverWalletId: driverWallet.id,
            notes: `Cash received (${methodLabel}) for Order #${order.id} debited from driver wallet.`
          });
        }
      } catch (cashDebitError) {
        console.error('❌ Error recording cash settlement debit:', cashDebitError);
      }
    }

    await order.update({
      paymentStatus: 'paid',
      paymentMethod: paymentMethod, // Save payment method (cash or mobile_money)
      paymentConfirmedAt: now,
      notes: order.notes ? `${order.notes}\n${manualConfirmationNote}` : manualConfirmationNote,
      driverPayAmount: driverPayAmount > 0 ? driverPayAmount : order.driverPayAmount
    });

    // Determine final order status based on current status
    // If order was "out_for_delivery" or "delivered", mark as completed (delivered + paid = completed)
    // Same logic as M-Pesa callback handler
    const currentOrderStatus = order.status;
    let finalStatus = currentOrderStatus;
    
    if (currentOrderStatus === 'out_for_delivery' || currentOrderStatus === 'delivered') {
      // If order was out for delivery or delivered when payment is confirmed, mark as completed
      // (delivered + paid = completed)
      await order.update({ status: 'completed' });
      finalStatus = 'completed';
      console.log(`📝 Order #${order.id} was "${currentOrderStatus}", updating to "completed" after cash payment confirmation`);
    } else if (currentOrderStatus === 'pending' || currentOrderStatus === 'cancelled') {
      // For newly paid orders, move them into confirmed
      await order.update({ status: 'confirmed' });
      finalStatus = 'confirmed';
      console.log(`📝 Order #${order.id} was "${currentOrderStatus}", updating to "confirmed" after cash payment confirmation`);
    }

    // CRITICAL: Wallet crediting is now handled by creditWalletsOnDeliveryCompletion
    // when the order is marked as completed, not when payment is confirmed.
    // This ensures delivery fee and tip transactions are created correctly.
    // Same logic as pay_now and pay_on_delivery M-Pesa flows.
    if (finalStatus === 'completed' && order.driverId) {
      try {
        await creditWalletsOnDeliveryCompletion(order.id, req);
        
        // Decrease inventory stock for completed orders
        try {
          const { decreaseInventoryForOrder } = require('../utils/inventory');
          await decreaseInventoryForOrder(order.id);
          console.log(`📦 Inventory decreased for Order #${order.id} (driver cash confirmation)`);
        } catch (inventoryError) {
          console.error(`❌ Error decreasing inventory for Order #${order.id}:`, inventoryError);
          // Don't fail the order completion if inventory update fails
        }
        console.log(`✅ Wallets credited for Order #${order.id} on cash payment confirmation (order completed)`);
      } catch (walletError) {
        console.error(`❌ Error crediting wallets for Order #${order.id}:`, walletError);
        // Don't fail the cash confirmation if wallet crediting fails - payment is already confirmed
      }
      
      // Update driver status if they have no more active orders
      const { updateDriverStatusIfNoActiveOrders } = require('../utils/driverAssignment');
      await updateDriverStatusIfNoActiveOrders(order.driverId);
    }

    try {
      await ensureDeliveryFeeSplit(order, { context: 'driver-cash-confirmation' });
    } catch (syncError) {
      console.error('❌ Error syncing delivery fee transactions (driver cash confirmation):', syncError);
    }

    await order.reload({
      include: [
        {
          model: db.OrderItem,
          as: 'orderItems',
          include: [{ model: db.Drink, as: 'drink' }]
        }
      ]
    });

    const io = req.app.get('io');
    if (io) {
      const payload = {
        orderId: order.id,
        status: order.status,
        paymentStatus: 'paid',
        receiptNumber: paymentTransaction.receiptNumber,
        transactionId: paymentTransaction.id,
        transactionStatus: 'completed',
        paymentConfirmedAt: now.toISOString(),
        order: order.toJSON ? order.toJSON() : order,
        message: `Payment confirmed manually for Order #${order.id}`
      };

      io.to(`order-${order.id}`).emit('payment-confirmed', payload);

      if (order.driverId) {
        io.to(`driver-${order.driverId}`).emit('payment-confirmed', payload);
      }

      io.to('admin').emit('payment-confirmed', {
        ...payload,
        message: `Driver manually confirmed payment for Order #${order.id}`
      });
    }

    sendSuccess(res, order);
  } catch (error) {
    console.error('Error confirming cash payment:', error);
    sendError(res, error.message, 500);
  }
});

// Catch-all route to debug unmatched requests
router.use((req, res, next) => {
  console.log(`⚠️ [DRIVER-ORDERS] Unmatched request: ${req.method} ${req.path} - OriginalUrl: ${req.originalUrl}`);
  console.log(`⚠️ [DRIVER-ORDERS] Query:`, req.query);
  console.log(`⚠️ [DRIVER-ORDERS] Params:`, req.params);
  next(); // Let Express handle 404
});

module.exports = router;

