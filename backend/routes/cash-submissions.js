const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const pushNotifications = require('../services/pushNotifications');
const { verifyAdmin } = require('./admin');
const { getOrderFinancialBreakdown } = require('../utils/orderFinancials');

// Admin routes - must be defined BEFORE driver routes to avoid route conflicts
// Admin routes - require admin authentication
router.use('/admin', verifyAdmin);

const requireSuperAdmin = (req, res, next) => {
  const role = req.admin?.role || req.admin?.user?.role || null;
  if (role !== 'super_admin') {
    return sendError(res, 'Forbidden: super admin only', 403);
  }
  return next();
};

async function applyPurchaseInventoryAndAccountSideEffects({
  submission,
  adminId,
  submissionAmount
}) {
  // Use persisted details (from DB) so we update based on what was stored
  const persistedDetails = submission.get ? submission.get('details') : submission.details;
  const detailsForUpdates = persistedDetails || {};

  // For purchases with an associated asset account, update stock and asset account balance
  if (detailsForUpdates && detailsForUpdates.assetAccountId) {
    try {
      const assetAccountId = parseInt(detailsForUpdates.assetAccountId, 10);
      const account = await db.AssetAccount.findByPk(assetAccountId);

      if (account) {
        const itemsArray = Array.isArray(detailsForUpdates.items) && detailsForUpdates.items.length > 0
          ? detailsForUpdates.items
          : (detailsForUpdates.item && detailsForUpdates.price
            ? [{ item: detailsForUpdates.item, price: detailsForUpdates.price, quantity: detailsForUpdates.quantity || 1, productId: detailsForUpdates.productId }]
            : []);

        let totalFromItems = 0;

        for (const item of itemsArray) {
          const qty = Number(item.quantity || 1);
          const unitPrice = Number(item.price || 0);
          if (qty > 0 && unitPrice > 0) {
            totalFromItems += qty * unitPrice;
          }

          if (item.productId) {
            const drink = await db.Drink.findByPk(item.productId);
            if (drink) {
              const qtyToAdd = qty;
              const capacity = item.capacity != null && String(item.capacity).trim() !== '' ? String(item.capacity).trim() : null;
              if (capacity) {
                const byCap = drink.stockByCapacity && typeof drink.stockByCapacity === 'object' ? { ...drink.stockByCapacity } : {};
                const current = parseInt(byCap[capacity], 10) || 0;
                byCap[capacity] = current + qtyToAdd;
                await drink.update({ stockByCapacity: byCap });
                console.log(`   Updated stock for Drink #${drink.id} capacity "${capacity}": ${current} → ${byCap[capacity]}`);
              } else {
                const currentStock = parseFloat(drink.stock || 0);
                const newStock = currentStock + qtyToAdd;
                await drink.update({ stock: newStock });
                console.log(`   Updated stock for Drink #${drink.id}: ${currentStock} → ${newStock}`);
              }
            }
          }
        }

        const totalAmount = totalFromItems > 0 ? totalFromItems : Number(submissionAmount || 0);
        const today = new Date().toISOString().slice(0, 10);

        await db.AssetAccountTransaction.create({
          assetAccountId: account.id,
          amount: totalAmount,
          reference: detailsForUpdates.reference || `Purchase submission #${submission.id}`,
          description: detailsForUpdates.supplier ? `Purchase from ${detailsForUpdates.supplier}` : 'Purchase',
          transactionDate: today,
          transactionType: 'credit',
          debitAmount: 0,
          creditAmount: totalAmount,
          postedById: adminId,
          status: 'approved'
        });

        // Credit entries reduce the asset account balance
        await account.increment('balance', { by: -totalAmount });
        console.log(`   Asset account "${account.name}" balance reduced by ${totalAmount.toFixed(2)}`);
      } else {
        console.warn(`⚠️ Asset account not found for assetAccountId=${detailsForUpdates.assetAccountId}`);
      }
    } catch (purchaseError) {
      console.error('❌ Error updating stock/account for purchase submission:', purchaseError);
    }
  }

  // For all purchases with line items:
  // - Always update each product's purchase price in inventory
  // - Always update stock (per-capacity when available), regardless of whether the purchase is already paid or unpaid
  if (detailsForUpdates) {
    const itemsArray = Array.isArray(detailsForUpdates.items) && detailsForUpdates.items.length > 0
      ? detailsForUpdates.items
      : (detailsForUpdates.item && detailsForUpdates.price != null
        ? [{ item: detailsForUpdates.item, price: detailsForUpdates.price, quantity: detailsForUpdates.quantity || 1, productId: detailsForUpdates.productId, capacity: detailsForUpdates.capacity }]
        : []);

    console.log(`   Purchase inventory update: processing ${itemsArray.length} item(s) from submission #${submission.id}`);

    for (const item of itemsArray) {
      const unitPrice = Number(item.price ?? item.purchasePrice ?? 0);
      const productId = item.productId != null ? parseInt(item.productId, 10) : NaN;
      const itemName = item.item || item.name || 'Unknown';
      const qty = Number(item.quantity || 1);

      if (Number.isNaN(productId) || productId <= 0) {
        console.warn(`   ⚠️ Skipping inventory update for "${itemName}": invalid or missing productId (got: ${item.productId})`);
        continue;
      }

      try {
        const drink = await db.Drink.findByPk(productId);
        if (!drink) {
          console.warn(`   ⚠️ Drink not found for productId ${productId} ("${itemName}")`);
          continue;
        }

        // 1) Update purchase price when we have a positive unit price
        if (unitPrice > 0) {
          try {
            await db.sequelize.query(
              'UPDATE drinks SET "purchasePrice" = :unitPrice, "updatedAt" = CURRENT_TIMESTAMP WHERE id = :productId',
              { replacements: { unitPrice, productId } }
            );
            console.log(`   Set purchase price for Drink #${drink.id} (${drink.name}): ${unitPrice}`);
          } catch (priceErr) {
            console.error(`   Failed to update purchase price for product ${productId} ("${itemName}"):`, priceErr.message);
          }
        } else {
          console.warn(`   ⚠️ Skipping purchase price update for productId ${productId} ("${itemName}"): unit price <= 0 (got: ${unitPrice})`);
        }

        // 2) Update stock (supports per-capacity stock when capacity is provided)
        if (qty > 0) {
          const capacity = item.capacity != null && String(item.capacity).trim() !== ''
            ? String(item.capacity).trim()
            : null;

          if (capacity) {
            const byCap = drink.stockByCapacity && typeof drink.stockByCapacity === 'object'
              ? { ...drink.stockByCapacity }
              : {};
            const current = parseInt(byCap[capacity], 10) || 0;
            byCap[capacity] = current + qty;

            // Keep overall stock in sync with per-capacity totals
            const totalStock = Object.values(byCap).reduce((sum, value) => {
              const n = typeof value === 'number' ? value : parseInt(value, 10);
              return sum + (Number.isNaN(n) ? 0 : n);
            }, 0);

            await drink.update({ stockByCapacity: byCap, stock: totalStock });
            console.log(`   Updated per-capacity stock for Drink #${drink.id} capacity "${capacity}": ${current} → ${byCap[capacity]} (total: ${totalStock})`);
          } else {
            const currentStock = parseFloat(drink.stock || 0);
            const newStock = currentStock + qty;
            await drink.update({ stock: newStock });
            console.log(`   Updated stock for Drink #${drink.id}: ${currentStock} → ${newStock}`);
          }
        }
      } catch (invErr) {
        console.error(`   Failed to update inventory for product ${productId} ("${itemName}") from purchase submission #${submission.id}:`, invErr.message);
      }
    }
  }
}

/**
 * Purchases (Admin UI)
 * Purchases are stored in cash_submissions for legacy reasons, but they are NOT part of
 * the Admin Cash-at-Hand submissions flow.
 */

/**
 * List purchases (admin + rider purchases)
 * GET /api/driver-wallet/admin/purchases?limit=&offset=
 */
router.get('/admin/purchases', async (req, res) => {
  try {
    const limit = Math.min(2000, Math.max(0, parseInt(req.query.limit, 10) || 1000));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    const purchases = await db.CashSubmission.findAll({
      where: { submissionType: 'purchases' },
      include: [
        { model: db.Driver, as: 'driver', attributes: ['id', 'name', 'phoneNumber'], required: false },
        { model: db.Admin, as: 'admin', attributes: ['id', 'username', 'name'], required: false },
        { model: db.Admin, as: 'approver', attributes: ['id', 'username', 'name'], required: false },
        { model: db.Admin, as: 'rejector', attributes: ['id', 'username', 'name'], required: false }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    return sendSuccess(res, { purchases, total: purchases.length });
  } catch (error) {
    console.error('❌ Error fetching purchases:', error);
    return sendError(res, error.message || 'Failed to fetch purchases', 500);
  }
});

/**
 * Get a single purchase by id
 * GET /api/driver-wallet/admin/purchases/:id
 */
router.get('/admin/purchases/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id) || id < 1) return sendError(res, 'Invalid purchase id', 400);

    const purchase = await db.CashSubmission.findByPk(id, {
      include: [
        { model: db.Driver, as: 'driver', attributes: ['id', 'name', 'phoneNumber'], required: false },
        { model: db.Admin, as: 'admin', attributes: ['id', 'username', 'name'], required: false },
        { model: db.Admin, as: 'approver', attributes: ['id', 'username', 'name'], required: false },
        { model: db.Admin, as: 'rejector', attributes: ['id', 'username', 'name'], required: false }
      ]
    });

    if (!purchase || purchase.submissionType !== 'purchases') {
      return sendError(res, 'Purchase not found', 404);
    }

    return sendSuccess(res, purchase);
  } catch (error) {
    console.error('❌ Error fetching purchase:', error);
    return sendError(res, error.message || 'Failed to fetch purchase', 500);
  }
});

/**
 * Create a purchase (admin)
 * POST /api/driver-wallet/admin/purchases
 * body: { amount, details }
 */
router.post('/admin/purchases', async (req, res) => {
  try {
    const adminId = req.admin.id;
    const { amount, details } = req.body || {};

    const submissionAmount = parseFloat(amount);
    if (!submissionAmount || Number.isNaN(submissionAmount) || submissionAmount <= 0) {
      return sendError(res, 'Amount must be greater than 0', 400);
    }

    const hasItems = details?.items && Array.isArray(details.items) && details.items.length > 0;
    const hasSingleItem = details?.item && details?.price !== undefined && details?.price !== null;
    if (!details || !details.supplier || (!hasItems && !hasSingleItem) || !details.deliveryLocation) {
      return sendError(res, 'For purchases, supplier, items (array) or item+price, and deliveryLocation are required', 400);
    }
    if (hasItems) {
      for (let i = 0; i < details.items.length; i++) {
        const item = details.items[i];
        if (!item.item || item.price === undefined || item.price === null || Number(item.price) <= 0) {
          return sendError(res, `Item ${i + 1} is invalid. Each item must have a name and a valid price > 0`, 400);
        }
      }
    }

    const submission = await db.CashSubmission.create({
      driverId: null,
      adminId,
      amount: submissionAmount,
      submissionType: 'purchases',
      status: 'pending',
      paymentMethod: 'cash',
      details: details || {}
    });

    // Apply inventory side-effects immediately (stock increases even if unpaid/pending)
    await applyPurchaseInventoryAndAccountSideEffects({
      submission,
      adminId,
      submissionAmount
    });

    return sendSuccess(res, submission, 'Purchase submitted');
  } catch (error) {
    console.error('❌ Error creating purchase:', error);
    return sendError(res, error.message || 'Failed to create purchase', 500);
  }
});

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
    // Admin submissions are requests from an admin user to a super admin.
    // Purchases are handled via the payables/purchases flows, not via admin cash submissions.
    if (!submissionType || !['cash', 'general_expense', 'payment_to_office', 'walk_in_sale'].includes(submissionType)) {
      console.log('❌ Invalid submission type:', submissionType);
      return sendError(res, 'Invalid submission type. Must be one of: cash, general_expense, payment_to_office, walk_in_sale', 400);
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

    // Guard: admin cannot submit more than available cash at hand.
    // Per-admin cash at hand is derived ONLY from approved walk_in_sale credits minus approved spend submissions.
    // Pending spend submissions also reserve cash.
    if (submissionType !== 'walk_in_sale') {
      const approved = await db.CashSubmission.findAll({
        where: { adminId: parseInt(adminId, 10), driverId: null, status: 'approved' },
        attributes: ['amount', 'submissionType']
      });
      const walkInCredits = approved
        .filter((s) => s.submissionType === 'walk_in_sale')
        .reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
      const approvedSpends = approved
        .filter((s) => s.submissionType !== 'walk_in_sale')
        .reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
      const actualCashAtHand = Math.max(0, walkInCredits - approvedSpends);

      const pendingSpendSubs = await db.CashSubmission.findAll({
        where: {
          adminId: parseInt(adminId, 10),
          driverId: null,
          status: 'pending',
          submissionType: { [Op.ne]: 'walk_in_sale' }
        },
        attributes: ['amount']
      });
      const pendingReserved = pendingSpendSubs.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
      const available = Math.max(0, actualCashAtHand - pendingReserved);

      if (submissionAmount - available > 0.01) {
        return sendError(res, `Amount exceeds available cash at hand (available: ${available.toFixed(2)})`, 400);
      }
    }

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

    // Use the persisted details (from DB) for stock/account and purchase-price updates so we're in sync with what was stored
    const persistedDetails = submission.get ? submission.get('details') : submission.details;
    const detailsForUpdates = persistedDetails || details || {};

    // For admin purchases with an associated asset account, update stock and asset account balance
    if (submissionType === 'purchases' && detailsForUpdates && detailsForUpdates.assetAccountId) {
      try {
        const assetAccountId = parseInt(detailsForUpdates.assetAccountId, 10);
        const account = await db.AssetAccount.findByPk(assetAccountId);

        if (account) {
          const itemsArray = Array.isArray(detailsForUpdates.items) && detailsForUpdates.items.length > 0
            ? detailsForUpdates.items
            : (detailsForUpdates.item && detailsForUpdates.price
              ? [{ item: detailsForUpdates.item, price: detailsForUpdates.price, quantity: detailsForUpdates.quantity || 1, productId: detailsForUpdates.productId }]
              : []);

          let totalFromItems = 0;

          for (const item of itemsArray) {
            const qty = Number(item.quantity || 1);
            const unitPrice = Number(item.price || 0);
            if (qty > 0 && unitPrice > 0) {
              totalFromItems += qty * unitPrice;
            }

            if (item.productId) {
              const drink = await db.Drink.findByPk(item.productId);
              if (drink) {
                const qtyToAdd = qty;
                const capacity = item.capacity != null && String(item.capacity).trim() !== '' ? String(item.capacity).trim() : null;
                if (capacity) {
                  const byCap = drink.stockByCapacity && typeof drink.stockByCapacity === 'object' ? { ...drink.stockByCapacity } : {};
                  const current = parseInt(byCap[capacity], 10) || 0;
                  byCap[capacity] = current + qtyToAdd;
                  await drink.update({ stockByCapacity: byCap });
                  console.log(`   Updated stock for Drink #${drink.id} capacity "${capacity}": ${current} → ${byCap[capacity]}`);
                } else {
                  const currentStock = parseFloat(drink.stock || 0);
                  const newStock = currentStock + qtyToAdd;
                  await drink.update({ stock: newStock });
                  console.log(`   Updated stock for Drink #${drink.id}: ${currentStock} → ${newStock}`);
                }
              }
            }
          }

          const totalAmount = totalFromItems > 0 ? totalFromItems : submissionAmount;
          const today = new Date().toISOString().slice(0, 10);

          await db.AssetAccountTransaction.create({
            assetAccountId: account.id,
            amount: totalAmount,
            reference: detailsForUpdates.reference || `Purchase submission #${submission.id}`,
            description: detailsForUpdates.supplier ? `Purchase from ${detailsForUpdates.supplier}` : 'Purchase',
            transactionDate: today,
            transactionType: 'credit',
            debitAmount: 0,
            creditAmount: totalAmount,
            postedById: adminId,
            status: 'approved'
          });

          // Credit entries reduce the asset account balance
          await account.increment('balance', { by: -totalAmount });
          console.log(`   Asset account "${account.name}" balance reduced by ${totalAmount.toFixed(2)}`);
        } else {
          console.warn(`⚠️ Asset account not found for assetAccountId=${details.assetAccountId}`);
        }
      } catch (purchaseError) {
        console.error('❌ Error updating stock/account for purchase submission:', purchaseError);
      }
    }

    // For all purchases with line items:
    // - Always update each product's purchase price in inventory
    // - Always update stock (per-capacity when available), regardless of whether the purchase is already paid or unpaid
    if (submissionType === 'purchases' && detailsForUpdates) {
      const itemsArray = Array.isArray(detailsForUpdates.items) && detailsForUpdates.items.length > 0
        ? detailsForUpdates.items
        : (detailsForUpdates.item && detailsForUpdates.price != null
          ? [{ item: detailsForUpdates.item, price: detailsForUpdates.price, quantity: detailsForUpdates.quantity || 1, productId: detailsForUpdates.productId, capacity: detailsForUpdates.capacity }]
          : []);

      console.log(`   Purchase inventory update: processing ${itemsArray.length} item(s) from submission #${submission.id}`);

      for (const item of itemsArray) {
        const unitPrice = Number(item.price ?? item.purchasePrice ?? 0);
        const productId = item.productId != null ? parseInt(item.productId, 10) : NaN;
        const itemName = item.item || item.name || 'Unknown';
        const qty = Number(item.quantity || 1);

        if (Number.isNaN(productId) || productId <= 0) {
          console.warn(`   ⚠️ Skipping inventory update for "${itemName}": invalid or missing productId (got: ${item.productId})`);
          continue;
        }

        try {
          const drink = await db.Drink.findByPk(productId);
          if (!drink) {
            console.warn(`   ⚠️ Drink not found for productId ${productId} ("${itemName}")`);
            continue;
          }

          // 1) Update purchase price when we have a positive unit price
          if (unitPrice > 0) {
            try {
              await db.sequelize.query(
                'UPDATE drinks SET "purchasePrice" = :unitPrice, "updatedAt" = CURRENT_TIMESTAMP WHERE id = :productId',
                { replacements: { unitPrice, productId } }
              );
              console.log(`   Set purchase price for Drink #${drink.id} (${drink.name}): ${unitPrice}`);
            } catch (priceErr) {
              console.error(`   Failed to update purchase price for product ${productId} ("${itemName}"):`, priceErr.message);
            }
          } else {
            console.warn(`   ⚠️ Skipping purchase price update for productId ${productId} ("${itemName}"): unit price <= 0 (got: ${unitPrice})`);
          }

          // 2) Update stock (supports per-capacity stock when capacity is provided)
          if (qty > 0) {
            const capacity = item.capacity != null && String(item.capacity).trim() !== ''
              ? String(item.capacity).trim()
              : null;

            if (capacity) {
              const byCap = drink.stockByCapacity && typeof drink.stockByCapacity === 'object'
                ? { ...drink.stockByCapacity }
                : {};
              const current = parseInt(byCap[capacity], 10) || 0;
              byCap[capacity] = current + qty;

              // Keep overall stock in sync with per-capacity totals
              const totalStock = Object.values(byCap).reduce((sum, value) => {
                const n = typeof value === 'number' ? value : parseInt(value, 10);
                return sum + (Number.isNaN(n) ? 0 : n);
              }, 0);

              await drink.update({ stockByCapacity: byCap, stock: totalStock });
              console.log(`   Updated per-capacity stock for Drink #${drink.id} capacity "${capacity}": ${current} → ${byCap[capacity]} (total: ${totalStock})`);
            } else {
              const currentStock = parseFloat(drink.stock || 0);
              const newStock = currentStock + qty;
              await drink.update({ stock: newStock });
              console.log(`   Updated stock for Drink #${drink.id}: ${currentStock} → ${newStock}`);
            }
          }
        } catch (invErr) {
          console.error(`   Failed to update inventory for product ${productId} ("${itemName}") from purchase submission #${submission.id}:`, invErr.message);
        }
      }
    }

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
 * Get admin cash submissions created by logged-in admin
 * GET /api/driver-wallet/admin/cash-submissions/mine?status=pending|approved|rejected
 */
router.get('/admin/cash-submissions/mine', async (req, res) => {
  try {
    const adminId = req.admin.id;
    const { status } = req.query;

    const where = {
      adminId: parseInt(adminId, 10),
      driverId: null,
      // Backward compatibility: older admin submissions may include purchases.
      // Purchases are not part of the "admin → super admin submission" workflow, so exclude them.
      submissionType: { [Op.ne]: 'purchases' }
    };
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      where.status = status;
    }

    const submissions = await db.CashSubmission.findAll({
      where,
      include: [
        { model: db.Admin, as: 'admin', attributes: ['id', 'username', 'name'], required: false },
        { model: db.Admin, as: 'approver', attributes: ['id', 'username', 'name'], required: false },
        { model: db.Admin, as: 'rejector', attributes: ['id', 'username', 'name'], required: false },
        { model: db.Order, as: 'orders', attributes: ['id', 'customerName', 'totalAmount', 'status', 'createdAt'], required: false }
      ],
      order: [['createdAt', 'DESC']],
      limit: 500
    });

    return sendSuccess(res, { submissions, total: submissions.length });
  } catch (error) {
    console.error('❌ Error fetching admin submissions (mine):', error);
    return sendError(res, error.message || 'Failed to fetch submissions', 500);
  }
});

/**
 * Get all cash submissions (admin) - all statuses
 * GET /api/driver-wallet/admin/cash-submissions/all
 */
router.get('/admin/cash-submissions/all', requireSuperAdmin, async (req, res) => {
  try {
    const limit = Math.min(1000, Math.max(0, parseInt(req.query.limit, 10) || 1000));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const status = (req.query.status || '').toString().trim();

    console.log('📋 Fetching all cash submissions...');

    // For Admin Cash At Hand approvals, super admin should see admin submissions (not driver submissions).
    const where = {
      driverId: null,
      submissionType: { [Op.ne]: 'purchases' }
    };
    if (status) {
      where.status = status;
    }

    // Get admin submissions
    const submissions = await db.CashSubmission.findAll({
      where,
      include: [
        { model: db.Driver, as: 'driver', attributes: ['id', 'name', 'phoneNumber', 'cashAtHand'], required: false },
        { model: db.Admin, as: 'admin', attributes: ['id', 'username', 'name'], required: false },
        { model: db.Admin, as: 'approver', attributes: ['id', 'username', 'name'], required: false },
        { model: db.Admin, as: 'rejector', attributes: ['id', 'username', 'name'], required: false },
        { model: db.Order, as: 'orders', attributes: ['id', 'customerName', 'totalAmount', 'status', 'createdAt'], required: false }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    console.log(`✅ Found ${submissions.length} cash submissions`);

    sendSuccess(res, {
      submissions,
      total: submissions.length
    });
  } catch (error) {
    console.error('❌ Error fetching all cash submissions:', error);
    console.error('❌ Error stack:', error.stack);
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
    const { submissionType, amount, details, orderId: bodyOrderId, orderIds: bodyOrderIds } = req.body;

    // Validate required fields
    if (!submissionType || !['purchases', 'cash', 'general_expense', 'payment_to_office', 'walk_in_sale', 'order_payment'].includes(submissionType)) {
      console.log('❌ Invalid submission type:', submissionType);
      return sendError(res, 'Invalid submission type. Must be one of: purchases, cash, general_expense, payment_to_office, walk_in_sale, order_payment', 400);
    }

    let submissionAmount = amount != null ? parseFloat(amount) : 0;
    let orderIdsToLink = [];

    if (submissionType === 'order_payment') {
      // Support both single orderId and multiple orderIds (array)
      const derivedOrderIdsRaw =
        (Array.isArray(bodyOrderIds) ? bodyOrderIds : null) ||
        (details && Array.isArray(details.orderIds) ? details.orderIds : null) ||
        null;

      if (derivedOrderIdsRaw && derivedOrderIdsRaw.length > 0) {
        orderIdsToLink = derivedOrderIdsRaw
          .map(v => parseInt(v, 10))
          .filter(v => Number.isFinite(v) && v > 0);
      } else {
        const singleOrderId = bodyOrderId != null
          ? parseInt(bodyOrderId, 10)
          : (details && details.orderId != null ? parseInt(details.orderId, 10) : null);
        if (singleOrderId && singleOrderId > 0) {
          orderIdsToLink = [singleOrderId];
        }
      }

      if (!orderIdsToLink || orderIdsToLink.length === 0) {
        return sendError(res, 'For Order Payment, orderId or orderIds is required', 400);
      }

      const paymentMethodLower = String(details?.paymentMethod || '').toLowerCase();

      // Validate each order is eligible and not already submitted, and compute expected amount from breakdowns.
      // For "customer_paid_to_office", we still compute the expected total, but the submission amount recorded is 0.
      let expectedTotal = 0;
      for (const orderId of orderIdsToLink) {
        const order = await db.Order.findOne({
          where: {
            id: orderId,
            driverId: parseInt(driverId, 10),
            status: 'completed',
            paymentStatus: 'paid',
            paymentType: 'pay_on_delivery',
            paymentMethod: 'cash'
          }
        });
        if (!order) {
          return sendError(res, `Order #${orderId} not found or not eligible for order payment submission`, 404);
        }
        const existingLinks = await db.sequelize.query(
          `SELECT cs.id FROM cash_submissions cs
           INNER JOIN cash_submission_orders cso ON cso."cashSubmissionId" = cs.id
           WHERE cs."driverId" = :driverId AND cs."submissionType" = 'order_payment' AND cso."orderId" = :orderId AND cs.status IN ('pending', 'approved')`,
          { type: db.sequelize.QueryTypes.SELECT, replacements: { driverId: parseInt(driverId, 10), orderId } }
        ).catch(() => []);
        if (existingLinks && existingLinks.length > 0) {
          return sendError(res, `Order #${orderId} has already been submitted for order payment`, 400);
        }

        const breakdown = await getOrderFinancialBreakdown(orderId);
        const itemsTotal = parseFloat(breakdown.itemsTotal) || 0;
        const deliveryFee = parseFloat(breakdown.deliveryFee) || 0;
        const savings = deliveryFee * 0.5;
        expectedTotal += (itemsTotal + savings);
      }

      if (paymentMethodLower === 'customer_paid_to_office') {
        // Customer already paid to office: still remove this value from driver's cash-at-hand
        // so orders stop prompting and driver's balance reflects reality.
        submissionAmount = expectedTotal;
      } else {
        // For cash order payment submissions, require a recipient
        const recipientName = details && (details.recipientName || details.recipient);
        if (!recipientName || String(recipientName).trim().length < 2) {
          return sendError(res, 'For Order Payment (cash), recipient is required', 400);
        }
        submissionAmount = expectedTotal;
      }
    } else if (!amount || parseFloat(amount) <= 0) {
      console.log('❌ Invalid amount:', amount);
      return sendError(res, 'Amount must be greater than 0', 400);
    } else {
      submissionAmount = parseFloat(amount);
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
    } else if (submissionType === 'order_payment') {
      // order_payment validation already done above (orderId, amount derived from order)
    }

    // Get driver
    const driver = await db.Driver.findByPk(driverId);
    if (!driver) {
      return sendError(res, 'Driver not found', 404);
    }

    // Allow negative cash at hand - driver can submit more than they have
    const detailsForSubmission = submissionType === 'order_payment'
      ? (details || { orderIds: orderIdsToLink })
      : (details || {});

    // Order payment (cash) submissions require approval.
    // M-Pesa prompt order payments are handled via /order-payment-stk-push + callback, which auto-approves on success.
    const isOrderPayment = submissionType === 'order_payment';
    const submission = await db.CashSubmission.create({
      driverId: parseInt(driverId),
      submissionType,
      amount: submissionAmount,
      details: detailsForSubmission,
      status: isOrderPayment && String(detailsForSubmission?.paymentMethod || '').toLowerCase() === 'customer_paid_to_office' ? 'approved' : 'pending',
      approvedAt: isOrderPayment && String(detailsForSubmission?.paymentMethod || '').toLowerCase() === 'customer_paid_to_office' ? new Date() : null
    });

    if (orderIdsToLink.length > 0) {
      await db.sequelize.query(
        `INSERT INTO cash_submission_orders ("cashSubmissionId", "orderId", "createdAt", "updatedAt") VALUES ${orderIdsToLink.map((_, i) => `(:id, :orderId${i}, NOW(), NOW())`).join(', ')}`,
        {
          replacements: Object.assign({ id: submission.id }, Object.fromEntries(orderIdsToLink.map((id, i) => [`orderId${i}`, id])))
        }
      ).catch(err => {
        console.error('Failed to link order to cash submission:', err);
      });
      console.log(`📦 Linked order(s) ${orderIdsToLink.join(', ')} to cash submission ${submission.id}`);
    }

    // Only reduce driver's cash at hand when submission is approved.
    // For pending submissions, do NOT deduct yet — actual cash at hand stays unchanged until approval.
    if (submission.status === 'approved') {
      const currentCashAtHand = parseFloat(driver.cashAtHand || 0);
      const newCashAtHand = currentCashAtHand - submissionAmount;
      await driver.update({
        cashAtHand: newCashAtHand,
        lastActivity: new Date()
      });
      console.log(`✅ Updated driver cash at hand: ${currentCashAtHand.toFixed(2)} → ${newCashAtHand.toFixed(2)} (submission approved on create)`);
    } else {
      await driver.update({ lastActivity: new Date() });
      console.log(`✅ Submission created (pending). Driver cash at hand unchanged until approval.`);
    }
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
 * Get orders eligible for Order Payment cash submission (completed pay_on_delivery/cash by this driver, not yet submitted)
 * GET /api/driver-wallet/:driverId/orders-for-order-payment
 */
router.get('/:driverId/orders-for-order-payment', async (req, res) => {
  try {
    const driverId = parseInt(req.params.driverId, 10);
    const driver = await db.Driver.findByPk(driverId);
    if (!driver) {
      return sendError(res, 'Driver not found', 404);
    }

    // Orders: completed, paid, pay_on_delivery (or cash), delivered by this driver
    const orders = await db.Order.findAll({
      where: {
        driverId,
        status: 'completed',
        paymentStatus: 'paid',
        paymentType: 'pay_on_delivery',
        paymentMethod: 'cash'
      },
      attributes: ['id', 'customerName', 'totalAmount', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 100
    });

    // Get order IDs that were paid via admin cash at hand (admin received cash directly)
    // These should NOT be eligible for driver cash submission
    const adminCashAtHandTransactions = await db.Transaction.findAll({
      where: {
        transactionType: 'payment',
        paymentProvider: 'admin_cash_at_hand',
        status: 'completed',
        paymentStatus: 'paid'
      },
      attributes: ['orderId'],
      raw: true
    });
    const adminCashAtHandOrderIds = new Set(
      adminCashAtHandTransactions
        .map(tx => tx.orderId)
        .filter(id => id !== null)
    );

    // Order IDs already linked to an approved (or pending) order_payment submission
    const submissionsWithOrders = await db.CashSubmission.findAll({
      where: {
        driverId,
        submissionType: 'order_payment',
        status: { [Op.in]: ['pending', 'approved'] }
      },
      include: [{ model: db.Order, as: 'orders', attributes: ['id'], required: true }]
    });
    const submittedOrderIds = new Set();
    submissionsWithOrders.forEach(s => {
      (s.orders || []).forEach(o => submittedOrderIds.add(o.id));
    });

    const eligible = [];
    for (const order of orders) {
      // Skip if already submitted
      if (submittedOrderIds.has(order.id)) continue;
      // Skip if admin received cash directly (admin cash at hand)
      if (adminCashAtHandOrderIds.has(order.id)) continue;
      try {
        const breakdown = await getOrderFinancialBreakdown(order.id);
        const itemsTotal = parseFloat(breakdown.itemsTotal) || 0;
        const deliveryFee = parseFloat(breakdown.deliveryFee) || 0;
        const savings = deliveryFee * 0.5;
        const totalToSubmit = itemsTotal + savings;
        eligible.push({
          orderId: order.id,
          customerName: order.customerName || 'Customer',
          itemsTotal,
          deliveryFee,
          savings,
          totalToSubmit,
          createdAt: order.createdAt
        });
      } catch (e) {
        console.warn(`orders-for-order-payment: skip order ${order.id}:`, e.message);
      }
    }

    sendSuccess(res, { orders: eligible });
  } catch (error) {
    console.error('Error fetching orders for order payment:', error);
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
    const limit = Math.min(500, Math.max(0, parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const status = req.query.status;

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
        {
          model: db.Order,
          as: 'orders',
          attributes: ['id', 'customerName', 'totalAmount', 'status', 'createdAt', 'deliveryAddress'],
          through: { attributes: [] },
          required: false
        }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset
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

    const serialized = submissions.map((sub) => {
      const s = sub.toJSON ? sub.toJSON() : sub;
      if (s.orders && Array.isArray(s.orders)) {
        s.orders = s.orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber ?? o.id,
          customerName: o.customerName,
          totalAmount: o.totalAmount,
          status: o.status,
          createdAt: o.createdAt,
          deliveryAddress: o.deliveryAddress ?? o.delivery_address ?? null
        }));
      }
      return s;
    });

    // Ensure deliveryAddress is present: fetch from orders table if missing (e.g. join/select issue)
    const orderIdsNeedingAddress = [];
    serialized.forEach((s) => {
      if (s.orders && Array.isArray(s.orders)) {
        s.orders.forEach((o) => {
          if (o.id && (o.deliveryAddress == null || o.deliveryAddress === '')) {
            orderIdsNeedingAddress.push(o.id);
          }
        });
      }
    });
    if (orderIdsNeedingAddress.length > 0) {
      const uniqueIds = [...new Set(orderIdsNeedingAddress)];
      const ordersWithAddress = await db.Order.findAll({
        where: { id: uniqueIds },
        attributes: ['id', 'deliveryAddress']
      });
      const mapById = {};
      ordersWithAddress.forEach((ord) => {
        const j = ord.toJSON ? ord.toJSON() : ord;
        mapById[j.id] = j.deliveryAddress ?? j.delivery_address ?? null;
      });
      serialized.forEach((s) => {
        if (s.orders && Array.isArray(s.orders)) {
          s.orders.forEach((o) => {
            if (o.id && (o.deliveryAddress == null || o.deliveryAddress === '') && mapById[o.id] != null) {
              o.deliveryAddress = mapById[o.id];
            }
          });
        }
      });
    }

    sendSuccess(res, {
      submissions: serialized,
      counts: countMap,
      total: serialized.length
    });
  } catch (error) {
    console.error('Error fetching cash submissions:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Update cash submission details (admin) – e.g. mark payable as paid
 * PATCH /api/driver-wallet/admin/cash-submissions/:id
 * Must be defined BEFORE /:driverId/cash-submissions/:id so "admin" is not parsed as driverId.
 */
function sanitizeDetailsForJsonb(obj) {
  if (obj === null || typeof obj !== 'object') {
    return (typeof obj === 'number' && Number.isNaN(obj)) ? null : obj;
  }
  if (Array.isArray(obj)) return obj.map(sanitizeDetailsForJsonb);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = (typeof k === 'number' && Number.isNaN(k)) ? 'nan_key' : String(k);
    out[key] = v === undefined || (typeof v === 'number' && Number.isNaN(v))
      ? null
      : sanitizeDetailsForJsonb(v);
  }
  return out;
}

router.patch('/admin/cash-submissions/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const submissionId = parseInt(id, 10);
    if (Number.isNaN(submissionId) || submissionId < 1) {
      return sendError(res, 'Invalid submission ID', 400);
    }
    const { details: bodyDetails, amount: bodyAmount } = req.body || {};

    const submission = await db.CashSubmission.findByPk(submissionId, {
      include: [
        { model: db.Driver, as: 'driver', attributes: ['id', 'name', 'phoneNumber'], required: false },
        { model: db.Admin, as: 'admin', attributes: ['id', 'username', 'name'], required: false }
      ]
    });
    if (!submission) {
      return sendError(res, 'Cash submission not found', 404);
    }

    if (bodyDetails === undefined || bodyDetails === null) {
      return sendError(res, 'details object is required', 400);
    }

    const rawDetails = submission.get ? submission.get('details') : submission.details;
    const existingDetails =
      typeof rawDetails === 'object' && rawDetails !== null
        ? JSON.parse(JSON.stringify(rawDetails))
        : {};
    const cleanBody = Object.fromEntries(
      Object.entries(bodyDetails).filter(([, v]) => v !== undefined)
    );
    const merged = { ...existingDetails, ...cleanBody };
    const updatedDetails = sanitizeDetailsForJsonb(merged);

    const updatePayload = { details: updatedDetails };
    if (bodyAmount !== undefined && bodyAmount !== null) {
      const newAmount = parseFloat(bodyAmount);
      if (!Number.isNaN(newAmount) && newAmount > 0) updatePayload.amount = newAmount;
    }
    const dialect = db.sequelize.getDialect();
    if (dialect === 'postgres') {
      const setClauses = ['details = CAST(:details AS jsonb)', '"updatedAt" = CURRENT_TIMESTAMP'];
      const replacements = { details: JSON.stringify(updatedDetails), id: submissionId };
      if (updatePayload.amount != null) {
        setClauses.push('amount = :amount');
        replacements.amount = updatePayload.amount;
      }
      await db.sequelize.query(
        `UPDATE cash_submissions SET ${setClauses.join(', ')} WHERE id = :id`,
        { replacements }
      );
    } else {
      await submission.update(updatePayload);
    }

    const updated = await db.CashSubmission.findByPk(submissionId, {
      include: [
        { model: db.Driver, as: 'driver', attributes: ['id', 'name', 'phoneNumber'], required: false },
        { model: db.Admin, as: 'admin', attributes: ['id', 'username', 'name'], required: false }
      ]
    });
    return sendSuccess(res, updated || submission, 'Cash submission updated successfully');
  } catch (error) {
    console.error('Error updating admin cash submission details:', error);
    return sendError(res, error.message || 'Failed to update cash submission', 500);
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
 * Update purchase approval status for a cash submission (admin-only, purchase-only flag)
 * This does NOT change the cash submission status/balance; it only tags the submission's details.
 *
 * POST /api/driver-wallet/admin/cash-submissions/:id/purchase-status
 * body: { purchaseStatus: 'rejected' | 'approved' | 'pending' }
 */
router.post('/admin/cash-submissions/:id/purchase-status', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { purchaseStatus } = req.body || {};

    if (!purchaseStatus || !['approved', 'rejected', 'pending'].includes(purchaseStatus)) {
      return sendError(res, 'purchaseStatus must be one of: approved, rejected, pending', 400);
    }

    const submission = await db.CashSubmission.findByPk(parseInt(id, 10));
    if (!submission) {
      return sendError(res, 'Cash submission not found', 404);
    }

    if (submission.submissionType !== 'purchases') {
      return sendError(res, 'Purchase status can only be set for purchase submissions', 400);
    }

    // Do NOT change submission.status here – only tag the purchase side
    const existingDetails = submission.details || {};
    const updatedDetails = {
      ...existingDetails,
      purchaseStatus,
      purchaseApproved: purchaseStatus === 'approved',
      purchaseRejected: purchaseStatus === 'rejected'
    };

    await submission.update({ details: updatedDetails });

    return sendSuccess(res, submission);
  } catch (error) {
    console.error('Error updating purchase status on cash submission:', error);
    return sendError(res, error.message || 'Failed to update purchase status', 500);
  }
});

/**
 * Get all pending cash submissions (admin)
 * GET /api/driver-wallet/cash-submissions/pending
 */
router.get('/cash-submissions/pending', async (req, res) => {
  try {
    const limit = Math.min(500, Math.max(0, parseInt(req.query.limit, 10) || 100));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    console.log('📋 Fetching pending cash submissions...');

    // Get all pending submissions (both driver and admin)
    const submissions = await db.CashSubmission.findAll({
      where: { status: 'pending' },
      include: [
        { model: db.Driver, as: 'driver', attributes: ['id', 'name', 'phoneNumber', 'cashAtHand'], required: false },
        { model: db.Admin, as: 'admin', attributes: ['id', 'username', 'name'], required: false },
        { model: db.Admin, as: 'approver', attributes: ['id', 'username', 'name'], required: false },
        { model: db.Admin, as: 'rejector', attributes: ['id', 'username', 'name'], required: false },
        { model: db.Order, as: 'orders', attributes: ['id', 'customerName', 'totalAmount', 'status', 'createdAt', 'deliveryAddress'], required: false }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset
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

/**
 * Get a single cash submission by ID (admin)
 * GET /api/driver-wallet/admin/cash-submissions/:id
 */
router.get('/admin/cash-submissions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const submission = await db.CashSubmission.findOne({
      where: { id: parseInt(id, 10) },
      include: [
        { model: db.Driver, as: 'driver', attributes: ['id', 'name', 'phoneNumber', 'cashAtHand'], required: false },
        { model: db.Admin, as: 'admin', attributes: ['id', 'username', 'name'], required: false },
        { model: db.Admin, as: 'approver', attributes: ['id', 'username', 'name'], required: false },
        { model: db.Admin, as: 'rejector', attributes: ['id', 'username', 'name'], required: false },
        { model: db.Order, as: 'orders', attributes: ['id', 'customerName', 'totalAmount', 'status', 'createdAt', 'deliveryAddress'], required: false }
      ]
    });

    if (!submission) {
      return sendError(res, 'Cash submission not found', 404);
    }

    sendSuccess(res, submission);
  } catch (error) {
    console.error('❌ Error fetching cash submission by id:', error);
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

    // Deduct from driver's cash at hand on approval (pending submissions were not deducted on create)
    if (submission.driverId && submission.driver) {
      const driver = await db.Driver.findByPk(submission.driverId);
      if (driver) {
        const currentCashAtHand = parseFloat(driver.cashAtHand || 0);
        const newCashAtHand = currentCashAtHand - parseFloat(submission.amount || 0);
        await driver.update({ cashAtHand: newCashAtHand });
        console.log(`   Driver cash at hand: ${currentCashAtHand.toFixed(2)} → ${newCashAtHand.toFixed(2)} (deducted on approval)`);
      }
    }

    // Credit merchant wallet (for order_payment, driver savings are handled on order completion)
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
    let merchantCreditAmount = submissionAmount;
    let orderIdForSavings = null;

    const isCustomerPaidToOfficeApproved =
      submission.submissionType === 'order_payment' &&
      String(submission.details?.paymentMethod || '').toLowerCase() === 'customer_paid_to_office';

    if (submission.submissionType === 'order_payment' && submission.driverId && !isCustomerPaidToOfficeApproved) {
      const subWithOrders = await db.CashSubmission.findByPk(submission.id, {
        include: [{ model: db.Order, as: 'orders', attributes: ['id'], required: false }]
      });
      const linkedOrders = subWithOrders?.orders || [];
      const firstOrderId = linkedOrders[0]?.id;
      if (firstOrderId) {
        try {
          // Multi-order submissions: credit merchant for the sum of items totals across all linked orders.
          // Savings are handled on order completion, not on submission approval.
          let itemsTotalSum = 0;
          for (const o of linkedOrders) {
            const breakdown = await getOrderFinancialBreakdown(o.id);
            const itemsTotal = parseFloat(breakdown.itemsTotal) || 0;
            itemsTotalSum += itemsTotal;
          }
          merchantCreditAmount = itemsTotalSum;
          orderIdForSavings = firstOrderId;
          console.log(`   Order payment: merchant gets KES ${merchantCreditAmount.toFixed(2)} (savings handled on order completion)`);
        } catch (e) {
          console.warn('Order payment approval: could not get breakdown, using full amount for merchant:', e.message);
        }
      }
    }

    const oldBalance = parseFloat(adminWallet.balance) || 0;
    if (!isCustomerPaidToOfficeApproved) {
      await adminWallet.update({
        balance: oldBalance + merchantCreditAmount,
        totalRevenue: parseFloat(adminWallet.totalRevenue) + merchantCreditAmount
      });
    } else {
      console.log(`   Order payment: customer paid to office (no merchant wallet credit on approval)`);
    }

    // NOTE: Savings for order_payment submissions are now handled exclusively when the order is completed.

    // Update admin cash at hand based on submission type
    // CRITICAL: Driver cash submissions do NOT go to admin cash at hand
    // Driver cash goes to merchant wallet (order cost) and driver savings (50% delivery fee)
    // Admin cash at hand is only for POS orders where customer paid cash or orders where admin received cash directly
    const currentCashAtHand = parseFloat(adminWallet.cashAtHand || 0);
    let newCashAtHand = currentCashAtHand;
    
    if (submission.driverId && !submission.adminId && !isCustomerPaidToOfficeApproved) {
      // Driver submission approved = cash received from driver
      // This cash goes to merchant wallet (order cost) and driver savings (50% delivery fee)
      // ALSO increase admin cash at hand (admin received the cash from driver)
      newCashAtHand = currentCashAtHand + submissionAmount;
      await adminWallet.update({ cashAtHand: newCashAtHand });
      console.log(`   Driver cash submission: merchant wallet credited with order cost, driver savings credited with 50% delivery fee`);
      console.log(`   Admin cash at hand: ${currentCashAtHand.toFixed(2)} → ${newCashAtHand.toFixed(2)} (added ${submissionAmount.toFixed(2)} from driver submission)`);
    } else if (submission.adminId && !submission.driverId) {
      // Admin submission approved = cash spent by admin, so DECREASE cash at hand
      newCashAtHand = Math.max(0, currentCashAtHand - submissionAmount);
      await adminWallet.update({ cashAtHand: newCashAtHand });
      console.log(`   Admin cash at hand: ${currentCashAtHand.toFixed(2)} → ${newCashAtHand.toFixed(2)} (deducted ${submissionAmount.toFixed(2)} from admin submission)`);
    }

    // Create transaction for cash submission (audit)
    const submitterName = submission.driver 
      ? `Driver: ${submission.driver.name}` 
      : submission.admin 
        ? `Admin: ${submission.admin.username || submission.admin.name}` 
        : 'Unknown';
    
    const transaction = await db.Transaction.create({
      orderId: submission.submissionType === 'order_payment' ? orderIdForSavings : null,
      driverId: submission.driverId,
      driverWalletId: null,
      transactionType: 'cash_submission',
      paymentMethod: 'cash',
      paymentProvider: submission.submissionType === 'order_payment' ? 'order_payment_submission' : null,
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
router.post('/admin/cash-submissions/:id/approve', requireSuperAdmin, async (req, res) => {
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

    // Driver cash at hand was not reduced when submission was created (pending), so do not restore on reject

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
router.post('/admin/cash-submissions/:id/reject', requireSuperAdmin, async (req, res) => {
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
