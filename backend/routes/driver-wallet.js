const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const mpesaService = require('../services/mpesa');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { getOrderFinancialBreakdown } = require('../utils/orderFinancials');
const { pickCashAtHandLogDate } = require('../utils/cashAtHandDates');

// Helper function to format description using first 2 words of delivery address
const formatDescriptionFromAddress = (deliveryAddress) => {
  if (!deliveryAddress) return 'submission';
  const words = deliveryAddress.trim().split(/\s+/);
  const firstTwoWords = words.slice(0, 2).join(' ');
  return firstTwoWords ? `${firstTwoWords} submission` : 'submission';
};

// Same but without " submission" suffix (for logs display)
const formatDescriptionFromAddressNoSuffix = (deliveryAddress) => {
  if (!deliveryAddress) return '';
  const words = deliveryAddress.trim().split(/\s+/);
  return words.slice(0, 2).join(' ') || '';
};

/**
 * Get cash at hand data for driver
 * GET /api/driver-wallet/:driverId/cash-at-hand
 * IMPORTANT: This route must be defined BEFORE /:driverId to avoid route conflicts
 * 
 * No wallet. Cash at hand = (Pay on Delivery cash: 50% delivery fee + order total per order)
 *               - (Pay Now: 50% delivery fee per order) - approved submissions - settlements.
 */
router.get('/:driverId/cash-at-hand', async (req, res) => {
  try {
    const { driverId } = req.params;
    const limitRaw = req.query.limit;
    const offsetRaw = req.query.offset;
    const hasPagination = limitRaw !== undefined || offsetRaw !== undefined;
    const pageLimit = Math.min(200, Math.max(1, parseInt(limitRaw, 10) || 50));
    const pageOffset = Math.max(0, parseInt(offsetRaw, 10) || 0);

    const driver = await db.Driver.findByPk(driverId);
    if (!driver) {
      return sendError(res, 'Driver not found', 404);
    }

    // Use stored cashAtHand as primary source of truth so that admin overrides
    // made from the dashboard are respected. We'll calculate a derived value
    // below, but we only sync the stored value in very specific cases.
    let storedCashAtHand = parseFloat(driver.cashAtHand || 0);
    let totalCashAtHand = storedCashAtHand;

    // Pay on Delivery (cash): cash at hand += 50% delivery fee + order total per order
    const cashOrders = await db.Order.findAll({
      where: {
        driverId: driverId,
        paymentType: 'pay_on_delivery',
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        status: { [Op.in]: ['delivered', 'completed'] }
      },
      attributes: ['id', 'customerName', 'totalAmount', 'createdAt', 'updatedAt', 'driverPayCreditedAt', 'status', 'deliveryAddress', 'territoryDeliveryFee'],
      order: [['updatedAt', 'DESC']]
    });

    let cashCollected = 0;
    for (const order of cashOrders) {
      try {
        const breakdown = await getOrderFinancialBreakdown(order.id);
        const convenienceFee = (breakdown.deliveryFee || 0);
        const territoryFee = parseFloat(order.territoryDeliveryFee ?? convenienceFee) || 0;
        const orderValue = (breakdown.itemsTotal || 0) + convenienceFee;
        cashCollected += orderValue - territoryFee * 0.5;
      } catch (e) {
        console.warn(`Cash at hand: could not get breakdown for order ${order.id}:`, e.message);
      }
    }

    // Get negative cash_settlement transactions (cash remitted; includes Pay Now "cash at hand − 50% delivery fee" when stored as negative)
    const cashSettlementsNegative = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'cash_settlement',
        status: { [Op.in]: ['completed', 'pending'] }, // Include pending for savings withdrawals
        amount: { [Op.lt]: 0 }
      },
      attributes: ['id', 'orderId', 'amount', 'createdAt', 'notes', 'receiptNumber', 'paymentProvider', 'transactionDate'],
      include: [
        { model: db.Order, as: 'order', attributes: ['id', 'deliveryAddress', 'territoryDeliveryFee', 'paymentType', 'paymentMethod', 'paymentStatus'], required: false }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    // Get positive cash_settlement transactions (cash added, e.g., from loan recovery)
    const cashSettlementsPositive = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'cash_settlement',
        status: { [Op.in]: ['completed', 'pending'] },
        amount: { [Op.gt]: 0 }
      },
      attributes: ['id', 'orderId', 'amount', 'createdAt', 'notes', 'receiptNumber', 'paymentProvider', 'transactionDate'],
      include: [
        { model: db.Order, as: 'order', attributes: ['id', 'deliveryAddress', 'territoryDeliveryFee', 'paymentType', 'paymentMethod', 'paymentStatus'], required: false }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    const orderIdsWithSettlementFromTx = new Set((cashSettlementsNegative || []).map(tx => tx.orderId).filter(Boolean));

    // Ledger rows created on order completion (COD net cash-at-hand) — avoid duplicating the same order in the synthetic loop below
    const completionLedgerRows = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'cash_settlement',
        paymentProvider: 'order_completion',
        status: { [Op.in]: ['completed', 'pending'] }
      },
      attributes: ['orderId']
    });
    const orderIdsWithCompletionLedger = new Set(
      (completionLedgerRows || []).map((t) => t.orderId).filter(Boolean)
    );

    const approvedCashSubmissions = await db.CashSubmission.findAll({
      where: { driverId: driverId, status: 'approved' },
      attributes: ['id', 'amount', 'createdAt', 'submissionType', 'details'],
      include: [
        {
          model: db.Order,
          as: 'orders',
          attributes: ['id', 'deliveryAddress'],
          required: false,
          through: { attributes: [] }
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const pendingCashSubmissions = await db.CashSubmission.findAll({
      where: { driverId: driverId, status: 'pending' },
      attributes: ['id', 'amount']
    });
    const pendingSubmissionsTotal = pendingCashSubmissions.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
    
    // Always calculate pending cash at hand if there are any pending submissions
    const hasPendingSubmissions = pendingCashSubmissions.length > 0;

    // IMPORTANT:
    // - Admin edits to cashAtHand and event-based updates (orders, submissions, repairs)
    //   already maintain driver.cashAtHand.
    // - This endpoint should only *report* that stored value and show a log of entries.
    // - Do NOT try to reconstruct theoretical balances here.
    totalCashAtHand = storedCashAtHand;

    // Format entries for response
    const entries = [];

    // Add cash order entries (Pay on Delivery cash).
    // Description must be location-only: first 2 words, nothing else.
    for (const order of cashOrders) {
      if (orderIdsWithCompletionLedger.has(order.id)) {
        continue;
      }
      let orderValue = 0;
      let withheldAmount = 0;
      let netChange = 0;
      try {
        const breakdown = await getOrderFinancialBreakdown(order.id);
        const itemsTotal = parseFloat(breakdown.itemsTotal || 0) || 0;
        const convenienceFee = parseFloat(breakdown.deliveryFee || 0) || 0;
        const territoryFee = parseFloat(order.territoryDeliveryFee ?? convenienceFee) || 0;
        orderValue = itemsTotal + convenienceFee;
        withheldAmount = territoryFee * 0.5;
        netChange = orderValue - withheldAmount;
      } catch (e) {}
      entries.push({
        type: 'cash_received',
        logType: 'Order Completed',
        orderId: order.id,
        entryKey: `cod_order:${order.id}`,
        deliveryFee: withheldAmount * 2, // full (100%) territory delivery fee
        orderValue: orderValue,
        // Cash at hand log columns: DBT = 50% territory withheld, CRT = full order value collected (net = CRT - DBT)
        debitAmount: withheldAmount,
        creditAmount: orderValue,
        customerName: order.customerName,
        amount: netChange,
        // Use completion/accounting timestamp instead of placement time.
        date: pickCashAtHandLogDate(order.driverPayCreditedAt, order.updatedAt, order.createdAt),
        description: formatDescriptionFromAddressNoSuffix(order.deliveryAddress) || ''
      });
    }

    // Add cash settlement entries (remittances to business and savings withdrawals)
    const allCashSettlements = [...cashSettlementsNegative, ...cashSettlementsPositive].sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    const isPayNowDeliveryFeeSettlement = (tx) => {
      const n = (tx.notes || '');
      return n.includes('Cash at hand − 50% delivery fee') || n.includes('Pay Now: 50% delivery fee - cash at hand');
    };

    for (const tx of allCashSettlements) {
      const isSavingsWithdrawal = tx.paymentProvider === 'savings_withdrawal_record' ||
        (tx.paymentProvider === 'mpesa' && tx.notes && (tx.notes.includes('Savings withdrawal') || tx.notes.includes('savings withdrawal'))) ||
        (tx.notes && (tx.notes.includes('Savings withdrawal') || tx.notes.includes('savings withdrawal')));
      const isOrderCompletionLedger = tx.paymentProvider === 'order_completion';

      let description;
      if (isSavingsWithdrawal) {
        description = `Savings withdrawal`;
      } else if (isOrderCompletionLedger) {
        description = formatDescriptionFromAddressNoSuffix(tx.order?.deliveryAddress) || '';
      } else if (isPayNowDeliveryFeeSettlement(tx)) {
        description = formatDescriptionFromAddressNoSuffix(tx.order?.deliveryAddress) || '';
      } else if (tx.order && tx.order.deliveryAddress) {
        description = formatDescriptionFromAddressNoSuffix(tx.order.deliveryAddress) || '';
      } else {
        description = tx.notes || `Cash remitted to business`;
      }

      const txAmount = parseFloat(tx.amount) || 0;
      // Cash at hand − 50% delivery fee should always be displayed as cash_sent (a debit),
      // even though its stored amount is positive.
      const entryType = txAmount < 0 || isPayNowDeliveryFeeSettlement(tx) ? 'cash_sent' : 'cash_received';
      // Driver app and admin both expect COD completion rows to appear as "Order Completed" with DBT/CRT,
      // even when persisted as a cash_settlement ledger row.
      const logType = isOrderCompletionLedger ? 'Order Completed' : entryType === 'cash_received' ? 'Payment Received' : '—';

      // Some legacy cash-at-hand rows (settlements/remittances) are order-linked but don't carry orderValue.
      // Compute orderValue from persisted order totals + items so admin debit/credit columns match business rules:
      // - COD order_completion: CRT = items + convenience, DBT = 50% territory fee (driver collected cash).
      // - Pay Now 50% fee row: DBT = 50% territory fee, CRT = — (driver did not collect order cash).
      let orderValue = null;
      let creditAmount = null;
      let debitAmount = null;
      let looksLikePayNowTerritoryFeeRow = false;
      if (tx.orderId) {
        try {
          const breakdown = await getOrderFinancialBreakdown(tx.orderId);
          const itemsTotal = parseFloat(breakdown.itemsTotal || 0) || 0;
          const convenienceFee = parseFloat(breakdown.deliveryFee || 0) || 0;
          const territoryFee = parseFloat(tx.order?.territoryDeliveryFee ?? convenienceFee) || 0;
          const halfTerritory = territoryFee * 0.5;
          orderValue = itemsTotal + convenienceFee;

          if (tx.paymentProvider === 'order_completion') {
            debitAmount = halfTerritory;
            creditAmount = orderValue;
          } else {
            const orderPaymentTypeNorm = (tx.order?.paymentType || 'pay_on_delivery').toString().toLowerCase();
            const method = (tx.order?.paymentMethod || '').toString();
            const isNonCashSystemPayment = tx.order?.paymentStatus === 'paid' && (method === 'mobile_money' || method === 'card');
            const isPayNowOrder = orderPaymentTypeNorm === 'pay_now' || isNonCashSystemPayment;
            const absAmt = Math.abs(txAmount);
            looksLikePayNowTerritoryFeeRow =
              isPayNowOrder &&
              Number.isFinite(halfTerritory) &&
              halfTerritory > 0.009 &&
              Math.abs(absAmt - halfTerritory) <= 0.01;
          }

          if (isPayNowDeliveryFeeSettlement(tx) || looksLikePayNowTerritoryFeeRow) {
            debitAmount = halfTerritory;
            creditAmount = null;
          } else {
            creditAmount = orderValue;
          }
        } catch (e) {
          orderValue = null;
          creditAmount = null;
          debitAmount = null;
          looksLikePayNowTerritoryFeeRow = false;
        }
      }

      // CRT/DBT columns are computed from live order breakdown; stored tx.amount can lag after admin edits.
      // Running-balance UI uses entry.amount — keep it aligned with credit − debit for COD completion rows.
      let resolvedAmount = Math.abs(txAmount);
      if (
        tx.paymentProvider === 'order_completion' &&
        debitAmount != null &&
        creditAmount != null &&
        Number.isFinite(parseFloat(debitAmount)) &&
        Number.isFinite(parseFloat(creditAmount))
      ) {
        resolvedAmount = Number((parseFloat(creditAmount) - parseFloat(debitAmount)).toFixed(2));
      }

      entries.push({
        type: looksLikePayNowTerritoryFeeRow ? 'cash_sent' : entryType,
        logType,
        transactionId: tx.id,
        // Represent COD completion ledger rows using the same entryKey as synthetic COD rows so
        // statement display (DBT/CRT) and admin overrides behave consistently.
        entryKey: isOrderCompletionLedger && tx.orderId ? `cod_order:${tx.orderId}` : `settlement_tx:${tx.id}`,
        orderId: tx.orderId || null,
        deliveryFee: tx.orderId ? (parseFloat(tx.order?.territoryDeliveryFee || 0) || null) : null,
        orderValue,
        debitAmount,
        creditAmount,
        amount: resolvedAmount,
        date: pickCashAtHandLogDate(tx.transactionDate, tx.createdAt),
        description: description,
        receiptNumber: tx.receiptNumber
      });
    }

    // Add approved cash submission entries (these reduce cash at hand)
    // Skip order_payment when already shown as cash_sent from cash_settlement (negative amount)
    const orderPaymentOrderIdsShown = new Set();
    approvedCashSubmissions.forEach(submission => {
      if (submission.submissionType === 'order_payment' && submission.details?.orderId != null && orderIdsWithSettlementFromTx.has(submission.details.orderId)) return;
      const submissionType = submission.submissionType;
      let description = 'Cash submission';
      
      // Check if submission has linked orders with delivery address
      const orderWithAddress = submission.orders && submission.orders.length > 0 
        ? submission.orders.find(o => o.deliveryAddress) || submission.orders[0]
        : null;
      
      if (orderWithAddress && orderWithAddress.deliveryAddress) {
        description = formatDescriptionFromAddressNoSuffix(orderWithAddress.deliveryAddress) || 'Cash submission';
      } else if (submissionType === 'purchases' && submission.details?.deliveryLocation) {
        description = formatDescriptionFromAddressNoSuffix(submission.details.deliveryLocation) || submission.details.deliveryLocation;
      } else if (submissionType === 'purchases' && submission.details?.supplier) {
        // Support both old format (single item) and new format (multiple items)
        if (submission.details?.items && Array.isArray(submission.details.items) && submission.details.items.length > 0) {
          const itemsList = submission.details.items.map((item) => item.item).join(', ');
          description = `Purchase: ${itemsList} from ${submission.details.supplier}`;
        } else if (submission.details?.item) {
          description = `Purchase: ${submission.details.item} from ${submission.details.supplier}`;
        }
      } else if (submissionType === 'cash') {
        const d = submission.details || {};
        if (d.recipientName) {
          description = `Cash to: ${d.recipientName}`;
        } else if (d.recipient) {
          description = `Cash to: ${d.recipient}`;
        } else if (d.source) {
          description = `Cash source: ${d.source}`;
        } else if (Array.isArray(d.items) && d.items.length > 0) {
          const firstItem = d.items[0].item || d.items[0].name || 'Unknown';
          description = `Cash for: ${firstItem}`;
        } else {
          description = 'Cash expense';
        }
      } else if (submissionType === 'general_expense') {
        const d = submission.details || {};
        if (d.nature) {
          description = `Expense: ${d.nature}`;
        } else if (d.description) {
          description = `Expense: ${d.description}`;
        } else if (Array.isArray(d.items) && d.items.length > 0) {
          const firstItem = d.items[0].item || d.items[0].description || 'Unknown';
          description = `Expense: ${firstItem}`;
        } else {
          description = 'General expense';
        }
      } else if (submissionType === 'payment_to_office') {
        const d = submission.details || {};
        const parts = [];
        
        // Recipient/sender info
        if (d.recipientName) {
          parts.push(`to: ${d.recipientName}`);
        } else if (d.recipient) {
          parts.push(`to: ${d.recipient}`);
        } else if (d.sender) {
          parts.push(`from: ${d.sender}`);
        }
        
        // Account info
        if (d.assetAccountName) {
          parts.push(`via: ${d.assetAccountName}`);
        } else if (d.accountReference) {
          parts.push(`ref: ${d.accountReference}`);
        } else if (d.accountType) {
          parts.push(d.accountType);
        }
        
        // Transaction code if available
        if (d.transactionCode) {
          parts.push(`code: ${d.transactionCode}`);
        }
        
        if (parts.length > 0) {
          description = `Payment: ${parts.slice(0, 3).join(', ')}`;
        } else {
          description = 'Payment to office';
        }
      } else if (submissionType === 'order_payment' && (submission.details?.orderId != null)) {
        description = `Order payment #${submission.details.orderId}`;
      }

      const orderIdForSubmission = submission.details?.orderId ?? (submission.orders && submission.orders.length > 0 ? submission.orders[0].id : null);
      // Only show one approved order_payment submission per orderId (newest wins; submissions are sorted by createdAt desc).
      if (submission.submissionType === 'order_payment' && orderIdForSubmission != null) {
        if (orderPaymentOrderIdsShown.has(orderIdForSubmission)) return;
        orderPaymentOrderIdsShown.add(orderIdForSubmission);
      }

      entries.push({
        type: 'cash_submission',
        logType: 'Submission',
        submissionType: submissionType || null,
        transactionId: submission.id,
        entryKey: `submission:${submission.id}`,
        orderId: orderIdForSubmission,
        amount: parseFloat(submission.amount || 0),
        date: pickCashAtHandLogDate(submission.createdAt),
        description: description
      });
    });

    // Sort entries newest first, then stable tie-breakers so running-balance UI stays consistent
    entries.sort((a, b) => {
      const ta = new Date(a.date).getTime();
      const tb = new Date(b.date).getTime();
      const safeA = Number.isNaN(ta) ? 0 : ta;
      const safeB = Number.isNaN(tb) ? 0 : tb;
      const tdiff = safeB - safeA;
      if (tdiff !== 0) return tdiff;
      const ob = (b.orderId || 0) - (a.orderId || 0);
      if (ob !== 0) return ob;
      return (b.transactionId || 0) - (a.transactionId || 0);
    });

    // Super-super-admin overrides: Debit/Credit adjust stored cash at hand via PUT /admin/drivers/.../cash-at-hand-log-display.
    try {
      const numericDriverId = parseInt(driverId, 10);
      const overrides = await db.CashAtHandLogOverride.findAll({ where: { driverId: numericDriverId } });
      const byKey = new Map(overrides.map((o) => [o.entryKey, o]));
      for (const e of entries) {
        const o = byKey.get(e.entryKey);
        if (!o) continue;
        if (o.debitAmount != null) e.debitAmount = parseFloat(o.debitAmount);
        if (o.creditAmount != null) e.creditAmount = parseFloat(o.creditAmount);
        if (o.balanceAfter != null) e.balanceAfterDisplay = parseFloat(o.balanceAfter);
        if (e.type === 'cash_received' && (o.debitAmount != null || o.creditAmount != null)) {
          const d = parseFloat(e.debitAmount != null ? e.debitAmount : 0);
          const c = parseFloat(e.creditAmount != null ? e.creditAmount : 0);
          e.amount = c - d;
        } else if (o.debitAmount != null && e.type !== 'cash_received') {
          e.amount = Math.abs(parseFloat(o.debitAmount));
        }
      }
    } catch (mergeErr) {
      console.warn('Cash at hand: could not merge log display overrides:', mergeErr.message);
    }

    // CRITICAL: Return the synced database value to ensure consistency
    // This value matches what's stored in drivers.cashAtHand and what admin panel shows
    // Actual cash at hand = totalCashAtHand (value before pending submissions are approved)
    // Pending cash at hand = totalCashAtHand - sum(pending submission amounts) — value after all pending submissions are approved
    const openingRaw = driver.cashAtHandOpeningBalance;
    const cashAtHandOpeningBalance =
      openingRaw != null && openingRaw !== '' ? parseFloat(openingRaw) : null;

    const totalEntries = entries.length;
    const pagedEntries = hasPagination
      ? entries.slice(pageOffset, pageOffset + pageLimit)
      : entries;
    const payload = {
      totalCashAtHand: totalCashAtHand, // Synced database value from drivers.cashAtHand (Actual cash at hand)
      cashAtHand: totalCashAtHand, // Alias for consistency (some clients might use this field)
      cashAtHandOpeningBalance:
        cashAtHandOpeningBalance != null && Number.isFinite(cashAtHandOpeningBalance)
          ? cashAtHandOpeningBalance
          : null,
      entries: pagedEntries,
      totalEntries,
      limit: hasPagination ? pageLimit : totalEntries,
      offset: hasPagination ? pageOffset : 0,
      hasMore: hasPagination ? (pageOffset + pagedEntries.length < totalEntries) : false
    };
    // Always include pending cash at hand if there are any pending submissions (even if result is negative)
    if (hasPendingSubmissions) {
      payload.pendingSubmissionsTotal = pendingSubmissionsTotal;
      payload.pendingCashAtHand = totalCashAtHand - pendingSubmissionsTotal;
    }
    sendSuccess(res, payload);
  } catch (error) {
    console.error('Error fetching cash at hand:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Initiate M-Pesa STK push for Pay on Delivery order payment (driver submits order cost + 50% savings via M-Pesa)
 * POST /api/driver-wallet/:driverId/order-payment-stk-push
 * Body: { orderId, phoneNumber } - phoneNumber optional (defaults to driver's phone), can be edited by driver
 */
router.post('/:driverId/order-payment-stk-push', async (req, res) => {
  try {
    const { driverId } = req.params;
    const { orderId: bodyOrderId, orderIds: bodyOrderIds, phoneNumber: bodyPhone } = req.body;
    const derivedOrderIdsRaw = Array.isArray(bodyOrderIds) ? bodyOrderIds : null;
    let orderIds = [];
    if (derivedOrderIdsRaw && derivedOrderIdsRaw.length > 0) {
      orderIds = derivedOrderIdsRaw
        .map(v => parseInt(v, 10))
        .filter(v => Number.isFinite(v) && v > 0);
    } else {
      const orderId = bodyOrderId != null ? parseInt(bodyOrderId, 10) : null;
      if (orderId && orderId > 0) {
        orderIds = [orderId];
      }
    }

    if (!orderIds || orderIds.length === 0) {
      return sendError(res, 'orderId or orderIds is required', 400);
    }

    const driver = await db.Driver.findByPk(driverId);
    if (!driver) {
      return sendError(res, 'Driver not found', 404);
    }

    // Validate each order is eligible and compute total amount
    let submitAmount = 0;
    for (const orderId of orderIds) {
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
      const convenienceFee = parseFloat(breakdown.deliveryFee) || 0;
      const territoryFee = parseFloat(order.territoryDeliveryFee ?? convenienceFee) || 0;
      const savings = territoryFee * 0.5;
      submitAmount += (itemsTotal + savings);
    }

    if (submitAmount < 0.01) {
      return sendError(res, 'Order amount is too small', 400);
    }

    let phoneNumber = (bodyPhone && String(bodyPhone).trim()) || driver.phoneNumber;
    if (!phoneNumber) {
      return sendError(res, 'Phone number is required', 400);
    }
    const cleanedPhone = String(phoneNumber).replace(/\D/g, '');
    let formattedPhone = cleanedPhone;
    if (cleanedPhone.startsWith('0')) {
      formattedPhone = '254' + cleanedPhone.substring(1);
    } else if (!cleanedPhone.startsWith('254')) {
      formattedPhone = '254' + cleanedPhone;
    }

    let wallet = await db.DriverWallet.findOne({ where: { driverId } });
    if (!wallet) {
      wallet = await db.DriverWallet.create({
        driverId,
        balance: 0,
        totalTipsReceived: 0,
        totalTipsCount: 0,
        totalDeliveryPay: 0,
        totalDeliveryPayCount: 0,
        savings: 0
      });
    }

    const firstOrderId = orderIds[0];
    const accountReference = orderIds.length === 1 ? `ORDER-PAY-${firstOrderId}` : `ORDER-PAY-MULTI-${firstOrderId}`;
    const transactionDesc = orderIds.length === 1
      ? `Order payment #${firstOrderId} - KES ${submitAmount.toFixed(2)}`
      : `Order payment (${orderIds.length} orders) - KES ${submitAmount.toFixed(2)}`;

    let stkResponse;
    try {
      stkResponse = await mpesaService.initiateSTKPush(
        formattedPhone,
        submitAmount,
        accountReference,
        transactionDesc
      );
    } catch (mpesaError) {
      console.error('Error initiating M-Pesa STK Push for order payment:', mpesaError);
      return sendError(res, `Failed to initiate M-Pesa payment: ${mpesaError.message}`, 500);
    }

    const isSuccess = stkResponse.success !== undefined ? stkResponse.success : (stkResponse.ResponseCode === '0' || stkResponse.ResponseCode === 0);
    const checkoutRequestID = stkResponse.checkoutRequestID || stkResponse.CheckoutRequestID;

    if (!isSuccess && !checkoutRequestID) {
      const errMsg = stkResponse.errorMessage || stkResponse.CustomerMessage || stkResponse.error || 'STK push failed';
      return sendError(res, errMsg, 400);
    }

    const pendingTransaction = await db.Transaction.create({
      orderId: firstOrderId,
      driverId: parseInt(driverId, 10),
      driverWalletId: wallet.id,
      transactionType: 'cash_settlement',
      paymentMethod: 'mobile_money',
      paymentProvider: 'mpesa',
      amount: submitAmount,
      status: 'pending',
      paymentStatus: 'pending',
      phoneNumber: formattedPhone,
      checkoutRequestID: checkoutRequestID || null,
      merchantRequestID: stkResponse.merchantRequestID || stkResponse.MerchantRequestID || null,
      notes: `order_payment_submission|orderIds=${orderIds.join(',')}|driverId=${driverId}|amount=${submitAmount.toFixed(2)}`
    });

    console.log(`✅ Order payment STK push initiated for Order(s) [${orderIds.join(',')}], CheckoutRequestID: ${checkoutRequestID}`);

    sendSuccess(res, {
      checkoutRequestID: checkoutRequestID,
      orderId: firstOrderId,
      orderIds,
      amount: submitAmount,
      message: 'Enter your M-Pesa PIN on your phone to complete the payment.'
    }, 'M-Pesa prompt sent');
  } catch (error) {
    console.error('Error initiating order payment STK push:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Submit cash at hand (remit cash to business via M-Pesa)
 * POST /api/driver-wallet/:driverId/cash-at-hand/submit
 * IMPORTANT: This route must be defined BEFORE /:driverId/withdraw to avoid route conflicts
 * 
 * This initiates an M-Pesa STK Push to the driver's phone. The driver enters their PIN
 * to send money to the business. The payment is confirmed via M-Pesa callback.
 */
router.post('/:driverId/cash-at-hand/submit', async (req, res) => {
  try {
    const { driverId } = req.params;
    const { amount } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return sendError(res, 'Invalid amount. Amount must be greater than 0', 400);
    }

    const submitAmount = parseFloat(amount);

    // Get driver info to get phone number
    const driver = await db.Driver.findByPk(driverId);
    if (!driver) {
      return sendError(res, 'Driver not found', 404);
    }

    if (!driver.phoneNumber) {
      return sendError(res, 'Driver phone number is required', 400);
    }

    // Calculate current cash at hand (using same logic as GET endpoint)
    const cashOrders = await db.Order.findAll({
      where: {
        driverId: driverId,
        paymentType: 'pay_on_delivery',
        paymentMethod: 'cash', // Only orders where customer paid cash
        paymentStatus: 'paid',
        status: {
          [Op.in]: ['delivered', 'completed']
        }
      },
      attributes: ['id', 'totalAmount', 'driverPayAmount']
    });

    // Get negative cash_settlement transactions (cash remitted)
    const cashSettlementsNegative = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'cash_settlement',
        status: 'completed',
        amount: {
          [Op.lt]: 0
        }
      },
      attributes: ['amount']
    });
    
    // Get positive cash_settlement transactions (cash added, e.g., from loan recovery)
    const cashSettlementsPositive = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'cash_settlement',
        status: 'completed',
        amount: {
          [Op.gt]: 0
        }
      },
      attributes: ['amount']
    });

    // For each order: totalAmount - driverPayAmount (delivery fee portion that belongs to driver)
    const cashCollected = cashOrders.reduce((sum, order) => {
      const totalAmount = parseFloat(order.totalAmount) || 0;
      const driverPayAmount = parseFloat(order.driverPayAmount) || 0;
      // Cash at hand = cash received minus the delivery fee portion that belongs to driver
      return sum + (totalAmount - driverPayAmount);
    }, 0);

    const cashRemitted = Math.abs(cashSettlementsNegative.reduce((sum, tx) => {
      return sum + (parseFloat(tx.amount) || 0);
    }, 0));
    
    const cashAdded = cashSettlementsPositive.reduce((sum, tx) => {
      return sum + (parseFloat(tx.amount) || 0);
    }, 0);

    // Allow negative cash at hand - drivers can go into negative balance (credit)
    const currentCashAtHand = cashCollected - cashRemitted + cashAdded;

    // Allow drivers to submit more than they have - they can go into negative balance
    // Removed validation that prevented submitting more than current cash at hand

    // Get or create wallet
    let wallet = await db.DriverWallet.findOne({ where: { driverId: driverId } });
    if (!wallet) {
      wallet = await db.DriverWallet.create({
        driverId: driverId,
        balance: 0,
        totalTipsReceived: 0,
        totalTipsCount: 0,
        totalDeliveryPay: 0,
        totalDeliveryPayCount: 0
      });
    }

    // Format phone number for M-Pesa
    const cleanedPhone = String(driver.phoneNumber ?? '').replace(/\D/g, '');
    let formattedPhone = cleanedPhone;
    if (cleanedPhone.startsWith('0')) {
      formattedPhone = '254' + cleanedPhone.substring(1);
    } else if (!cleanedPhone.startsWith('254')) {
      formattedPhone = '254' + cleanedPhone;
    }

    // Create cash settlement transaction with pending status (will be updated when M-Pesa callback confirms payment)
    const settlementTransaction = await db.Transaction.create({
      orderId: null, // No specific order associated
      driverId: driverId,
      driverWalletId: wallet.id,
      transactionType: 'cash_settlement',
      paymentMethod: 'mobile_money', // Changed from 'cash' to 'mobile_money'
      paymentProvider: 'mpesa',
      amount: -submitAmount, // Negative amount = cash remitted
      status: 'pending', // Will be updated to 'completed' when M-Pesa callback confirms
      paymentStatus: 'pending', // Will be updated to 'paid' when M-Pesa callback confirms
      phoneNumber: formattedPhone,
      notes: `Cash remittance to business: KES ${submitAmount.toFixed(2)} - Awaiting M-Pesa confirmation`
    });

    // Initiate M-Pesa STK Push to driver's phone
    // Driver will receive a prompt to enter their PIN and send money to the business
    const accountReference = `CASH-SETTLEMENT-${settlementTransaction.id}`;
    const transactionDesc = `Cash remittance to business - KES ${submitAmount.toFixed(2)}`;

    let stkResponse;
    try {
      stkResponse = await mpesaService.initiateSTKPush(
        formattedPhone,
        submitAmount,
        accountReference,
        transactionDesc
      );
    } catch (mpesaError) {
      console.error('Error initiating M-Pesa STK Push for cash settlement:', mpesaError);
      // Update transaction to failed status
      await settlementTransaction.update({
        status: 'failed',
        paymentStatus: 'failed',
        notes: `Failed to initiate M-Pesa payment: ${mpesaError.message}`
      });
      return sendError(res, `Failed to initiate M-Pesa payment: ${mpesaError.message}`, 500);
    }

    // Check if STK push was successful
    if (stkResponse.ResponseCode === '0') {
      // STK Push initiated successfully
      // Update transaction with checkout request IDs
      await settlementTransaction.update({
        checkoutRequestID: stkResponse.CheckoutRequestID,
        merchantRequestID: stkResponse.MerchantRequestID,
        notes: `Cash remittance to business: KES ${submitAmount.toFixed(2)} - M-Pesa STK Push initiated. Awaiting driver PIN confirmation.`
      });

      console.log(`✅ M-Pesa STK Push initiated for cash settlement #${settlementTransaction.id}`);
      console.log(`   Driver: ${driver.name} (${formattedPhone})`);
      console.log(`   Amount: KES ${submitAmount.toFixed(2)}`);
      console.log(`   CheckoutRequestID: ${stkResponse.CheckoutRequestID}`);

      sendSuccess(res, {
        transaction: {
          id: settlementTransaction.id,
          amount: submitAmount,
          status: 'pending',
          checkoutRequestID: stkResponse.CheckoutRequestID
        },
        message: 'M-Pesa payment prompt sent to your phone. Please enter your PIN to complete the payment.'
      }, 'M-Pesa payment prompt sent');
    } else {
      // STK Push failed
      await settlementTransaction.update({
        status: 'failed',
        paymentStatus: 'failed',
        notes: `M-Pesa STK Push failed: ${stkResponse.CustomerMessage || 'Unknown error'}`
      });

      console.error(`❌ M-Pesa STK Push failed for cash settlement #${settlementTransaction.id}:`, stkResponse.CustomerMessage);
      return sendError(res, `Failed to send payment prompt: ${stkResponse.CustomerMessage || 'Unknown error'}`, 400);
    }
  } catch (error) {
    console.error('Error submitting cash at hand:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Get driver wallet balance and tips
 * GET /api/driver-wallet/:driverId
 */
router.get('/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params;

    // Get or create wallet
    let wallet = await db.DriverWallet.findOne({ 
      where: { driverId: driverId },
      include: [{
        model: db.Driver,
        as: 'driver',
        attributes: ['id', 'name', 'phoneNumber']
      }]
    });

    if (!wallet) {
      // Create wallet if it doesn't exist
      wallet = await db.DriverWallet.create({
        driverId: driverId,
        balance: 0,
        totalTipsReceived: 0,
              totalTipsCount: 0,
              totalDeliveryPay: 0,
              totalDeliveryPayCount: 0
      });
    }

    // Get driver savings_credit transactions (50% of delivery fee credited to savings).
    // Do not cap rows: backfills often set createdAt to historical order completion, so a low limit
    // (e.g. 50 newest by createdAt) would hide older credits even though they are valid rows.
    const savingsCreditTransactions = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'savings_credit',
        driverWalletId: {
          [Op.not]: null
        },
        status: 'completed'
      },
      include: [{
        model: db.Order,
        as: 'order',
        attributes: ['id', 'customerName', 'deliveryAddress', 'createdAt', 'status']
      }],
      order: [['createdAt', 'DESC'], ['id', 'DESC']]
    });

    // Get stop deduction transactions (delivery_fee_debit with paymentProvider = 'stop_deduction')
    // These should appear in savings, not cash at hand
    const stopDeductionTransactions = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'delivery_fee_debit',
        paymentProvider: 'stop_deduction',
        status: 'completed',
        paymentStatus: 'paid'
      },
      include: [{
        model: db.Order,
        as: 'order',
        attributes: ['id', 'customerName', 'deliveryAddress', 'createdAt', 'status', 'isStop', 'stopDeductionAmount']
      }],
      order: [['createdAt', 'DESC'], ['id', 'DESC']]
    });

    // Get cash settlement debits (driver remits collected cash)
    const cashSettlementTransactions = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'cash_settlement',
        status: 'completed'
      },
      include: [{
        model: db.Order,
        as: 'order',
        attributes: ['id', 'customerName', 'createdAt', 'status']
      }],
      order: [['createdAt', 'DESC']],
      limit: 50 // Last 50 settlements
    });

    // No wallet: balance and withdrawals are not used. Only savings.
    const totalBalance = 0;
    const availableBalance = 0;

    // Get savings amount from wallet
    const savings = parseFloat(wallet.savings || 0);
    const openingRaw = wallet.savingsOpeningBalance;
    const savingsOpeningBalance =
      openingRaw != null && openingRaw !== '' ? parseFloat(openingRaw) : null;
    
    // Calculate today's savings withdrawal total (for daily limit check)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todaySavingsWithdrawals = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'savings_withdrawal',
        status: {
          [Op.in]: ['pending', 'completed']
        },
        createdAt: {
          [Op.gte]: today,
          [Op.lt]: tomorrow
        }
      },
      attributes: ['amount']
    });
    
    const todayWithdrawn = todaySavingsWithdrawals.reduce((sum, tx) => {
      return sum + (parseFloat(tx.amount) || 0);
    }, 0);
    
    const dailyLimit = 1000; // 1000 KES per day
    const remainingDailyLimit = Math.max(0, dailyLimit - todayWithdrawn);
    const canWithdraw = savings > 0 && remainingDailyLimit > 0;

    // Savings display overrides (super-super-admin). Debit/Credit adjustments can also update stored wallet savings via admin PUT.
    const savingsOverridesByKey = new Map();
    try {
      const numericDriverId = parseInt(driverId, 10);
      if (Number.isFinite(numericDriverId)) {
        const overrides = await db.DriverSavingsLogOverride.findAll({ where: { driverId: numericDriverId } });
        overrides.forEach((o) => savingsOverridesByKey.set(o.entryKey, o));
      }
    } catch (e) {
      console.warn('Savings: could not load log overrides:', e.message);
    }

    const applySavingsOverrides = (row) => {
      if (!row || !row.entryKey) return row;
      const o = savingsOverridesByKey.get(row.entryKey);
      if (!o) return row;
      const out = { ...row };
      if (o.debitAmount != null) out.debitAmount = parseFloat(o.debitAmount);
      if (o.creditAmount != null) out.creditAmount = parseFloat(o.creditAmount);
      if (o.balanceAfter != null) out.balanceAfterDisplay = parseFloat(o.balanceAfter);
      if (o.debitAmount != null || o.creditAmount != null) {
        const d = parseFloat(out.debitAmount != null ? out.debitAmount : 0) || 0;
        const c = parseFloat(out.creditAmount != null ? out.creditAmount : 0) || 0;
        out.amount = c - d;
      }
      return out;
    };

    sendSuccess(res, {
      wallet: {
        id: wallet.id,
        driverId: wallet.driverId,
        balance: totalBalance,
        availableBalance: availableBalance,
        savings: savings,
        savingsOpeningBalance:
          savingsOpeningBalance != null && Number.isFinite(savingsOpeningBalance) ? savingsOpeningBalance : null
      },
      savingsWithdrawal: {
        dailyLimit: dailyLimit,
        todayWithdrawn: todayWithdrawn,
        remainingDailyLimit: remainingDailyLimit,
        canWithdraw: canWithdraw
      },
      recentDeliveryPayments: [], // No wallet
      recentSavingsCredits: [
        // Savings credits (positive amounts)
        ...savingsCreditTransactions.map(tx => {
          // Format description using delivery address (first 2 words) + "submission"
          let description = 'submission';
          if (tx.order && tx.order.deliveryAddress) {
            description = formatDescriptionFromAddress(tx.order.deliveryAddress);
          } else {
            description = tx.notes || `Savings credit from Order #${tx.orderId || 'N/A'}`;
          }
          const base = {
            id: tx.id,
            amount: Math.abs(parseFloat(tx.amount)),
            transactionType: 'savings_credit',
            orderId: tx.orderId,
            orderNumber: tx.order?.id,
            orderLocation: tx.order?.deliveryAddress || null,
            customerName: tx.order?.customerName,
            status: tx.order?.status,
            date: tx.createdAt,
            notes: description, // Use formatted description
            entryKey: `savings_tx:${tx.id}`,
            debitAmount: null,
            creditAmount: Math.abs(parseFloat(tx.amount))
          };
          return applySavingsOverrides(base);
        }),
        // Stop deductions (negative amounts - debits from savings)
        ...stopDeductionTransactions.map(tx => {
          const amount = Math.abs(parseFloat(tx.amount || 0));
          const base = {
            id: tx.id,
            amount: -amount, // Negative amount to show as debit
            transactionType: 'delivery_fee_debit',
            paymentProvider: 'stop_deduction', // This field is used by Android app to identify stop deductions
            orderId: tx.orderId,
            orderNumber: tx.order?.id,
            orderLocation: tx.order?.deliveryAddress || null,
            customerName: tx.order?.customerName,
            status: tx.order?.status,
            date: tx.createdAt,
            notes: tx.notes || `Stop deduction for Order #${tx.orderId || 'N/A'} - KES ${amount.toFixed(2)}`,
            entryKey: `savings_tx:${tx.id}`,
            debitAmount: amount,
            creditAmount: null
          };
          return applySavingsOverrides(base);
        })
      ].sort((a, b) => new Date(b.date) - new Date(a.date)), // Sort by date, newest first
      cashSettlements: cashSettlementTransactions.map(tx => ({
        id: tx.id,
        amount: Math.abs(parseFloat(tx.amount)),
        transactionType: tx.transactionType,
        orderId: tx.orderId,
        orderNumber: tx.order?.id,
        customerName: tx.order?.customerName,
        status: tx.order?.status,
        date: tx.createdAt,
        notes: tx.notes
      })),
      recentTips: [],
      recentWithdrawals: (await db.Transaction.findAll({
        where: {
          driverId: driverId,
          transactionType: 'savings_withdrawal',
          status: { [Op.in]: ['pending', 'completed'] }
        },
        order: [['createdAt', 'DESC']],
        limit: 50
      })).map(tx => ({
        id: tx.id,
        amount: parseFloat(tx.amount || 0),
        phoneNumber: tx.phoneNumber,
        status: tx.status,
        paymentStatus: tx.paymentStatus,
        receiptNumber: tx.receiptNumber,
        date: pickCashAtHandLogDate(tx.transactionDate, tx.createdAt),
        notes: tx.notes || `Savings withdrawal${tx.phoneNumber ? ` to ${tx.phoneNumber}` : ''}`,
        paymentProvider: tx.paymentProvider, // Include paymentProvider to identify loan/penalty transactions
        entryKey: `savings_withdrawal_tx:${tx.id}`
      }))
    });
  } catch (error) {
    console.error('Error fetching driver wallet:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Withdraw savings: amount only. Recorded as savings withdrawal + cash at hand credit (reduction).
 * When phoneNumber is provided, can optionally initiate M-Pesa B2C; when omitted, record-only.
 * POST /api/driver-wallet/:driverId/withdraw-savings
 * Daily limit: 1000 KES per day
 */
router.post('/:driverId/withdraw-savings', async (req, res) => {
  try {
    const { driverId } = req.params;
    const amount = req.body?.amount;
    const phoneNumber = req.body?.phoneNumber; // Optional. When missing/null/empty, record-only (no M-Pesa).

    if (!amount || parseFloat(amount) <= 0) {
      return sendError(res, 'Invalid withdrawal amount', 400);
    }

    const withdrawalAmount = parseFloat(amount);
    const dailyLimit = 1000;

    let wallet = await db.DriverWallet.findOne({ where: { driverId: driverId } });
    if (!wallet) {
      wallet = await db.DriverWallet.create({
        driverId: driverId,
        balance: 0,
        totalTipsReceived: 0,
        totalTipsCount: 0,
        totalDeliveryPay: 0,
        totalDeliveryPayCount: 0,
        savings: 0
      });
    }

    const currentSavings = parseFloat(wallet.savings || 0);
    if (withdrawalAmount > currentSavings) {
      return sendError(res, `Insufficient savings. Available: KES ${currentSavings.toFixed(2)}`, 400);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayWithdrawals = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'savings_withdrawal',
        status: { [Op.in]: ['pending', 'completed'] },
        createdAt: { [Op.gte]: today, [Op.lt]: tomorrow }
      },
      attributes: ['amount']
    });
    const todayWithdrawn = todayWithdrawals.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
    const remainingLimit = dailyLimit - todayWithdrawn;
    if (withdrawalAmount > remainingLimit) {
      return sendError(res, `Daily withdrawal limit exceeded. You can withdraw up to KES ${remainingLimit.toFixed(2)} today (limit: KES ${dailyLimit.toFixed(2)}/day)`, 400);
    }

    const doRecordOnly = !phoneNumber || String(phoneNumber).trim() === '';
    const formattedPhone = doRecordOnly ? null : (() => {
      const cleaned = String(phoneNumber).replace(/\D/g, '');
      if (cleaned.startsWith('0')) return '254' + cleaned.substring(1);
      if (!cleaned.startsWith('254')) return '254' + cleaned;
      return cleaned;
    })();

    const withdrawalTransaction = await db.Transaction.create({
      orderId: null,
      driverId: driverId,
      driverWalletId: wallet.id,
      transactionType: 'savings_withdrawal',
      paymentMethod: doRecordOnly ? 'cash' : 'mobile_money',
      paymentProvider: doRecordOnly ? 'savings_withdrawal_record' : 'mpesa',
      amount: withdrawalAmount,
      status: doRecordOnly ? 'completed' : 'pending',
      paymentStatus: doRecordOnly ? 'paid' : 'pending',
      phoneNumber: formattedPhone,
      notes: doRecordOnly
        ? `Savings withdrawal - KES ${withdrawalAmount.toFixed(2)}`
        : `Savings withdrawal to ${formattedPhone}`
    });

    await wallet.update({ savings: currentSavings - withdrawalAmount });

    const driver = await db.Driver.findByPk(driverId);
    if (driver) {
      const currentCashAtHand = parseFloat(driver.cashAtHand || 0);
      const newCashAtHand = currentCashAtHand - withdrawalAmount;
      await driver.update({ cashAtHand: newCashAtHand });
      console.log(`   Driver ${driverId} cash at hand: KES ${currentCashAtHand.toFixed(2)} → KES ${newCashAtHand.toFixed(2)} (savings withdrawal -${withdrawalAmount.toFixed(2)})`);
      
      // Create cash at hand transaction log entry for savings withdrawal
      await db.Transaction.create({
        orderId: null,
        driverId: driverId,
        driverWalletId: wallet.id,
        transactionType: 'cash_settlement', // Using cash_settlement type to show in cash at hand log
        paymentMethod: doRecordOnly ? 'cash' : 'mobile_money',
        paymentProvider: doRecordOnly ? 'savings_withdrawal_record' : 'mpesa',
        amount: -withdrawalAmount, // Negative amount to show as credit (money going out)
        status: withdrawalTransaction.status,
        paymentStatus: withdrawalTransaction.paymentStatus,
        phoneNumber: formattedPhone,
        transactionDate: withdrawalTransaction.createdAt || new Date(),
        notes: `Savings withdrawal - KES ${withdrawalAmount.toFixed(2)}`
      });
      console.log(`✅ Created cash_settlement transaction for savings withdrawal: ${withdrawalAmount.toFixed(2)}, notes: "Savings withdrawal - KES ${withdrawalAmount.toFixed(2)}"`);
    }

    if (!doRecordOnly && formattedPhone) {
      try {
        const b2cResult = await mpesaService.initiateB2C(
          formattedPhone,
          withdrawalAmount,
          `Savings withdrawal for driver #${driverId} - Transaction #${withdrawalTransaction.id}`,
          'Savings Withdrawal'
        );
        if (b2cResult.success) {
          await withdrawalTransaction.update({
            checkoutRequestID: b2cResult.conversationID,
            merchantRequestID: b2cResult.originatorConversationID,
            notes: (withdrawalTransaction.notes || '') + '\nB2C initiated: ' + (b2cResult.responseDescription || '')
          });
          console.log(`✅ B2C payment initiated for savings withdrawal transaction #${withdrawalTransaction.id}`);
        } else {
          await wallet.update({ savings: currentSavings });
          if (driver) await driver.update({ cashAtHand: parseFloat(driver.cashAtHand || 0) + withdrawalAmount });
          await withdrawalTransaction.update({ status: 'failed', paymentStatus: 'failed' });
          throw new Error(b2cResult.responseDescription || 'Failed to initiate B2C payment');
        }
      } catch (b2cError) {
        console.error('B2C initiation error:', b2cError);
        await wallet.update({ savings: currentSavings });
        if (driver) await driver.update({ cashAtHand: parseFloat(driver.cashAtHand || 0) + withdrawalAmount });
        await withdrawalTransaction.update({ status: 'failed', paymentStatus: 'failed' });
        throw b2cError;
      }
    }

    await wallet.reload();
    sendSuccess(res, {
      transaction: {
        id: withdrawalTransaction.id,
        amount: withdrawalAmount,
        phoneNumber: formattedPhone,
        status: withdrawalTransaction.status,
        conversationID: withdrawalTransaction.checkoutRequestID
      },
      newSavings: parseFloat(wallet.savings),
      remainingDailyLimit: Math.max(0, remainingLimit - withdrawalAmount),
      note: doRecordOnly
        ? `Savings withdrawal of KES ${withdrawalAmount.toFixed(2)}. Your cash at hand has been reduced by this amount.`
        : 'The withdrawal will be completed when M-Pesa processes the payment.'
    }, doRecordOnly ? 'Savings withdrawal completed.' : 'Savings withdrawal initiated. Payment will be processed shortly.');
  } catch (error) {
    console.error('Error processing savings withdrawal:', error);
    sendError(res, error.message, 500);
  }
});

/**
 * Withdraw to M-Pesa (B2C) - Wallet balance withdrawal
 * POST /api/driver-wallet/:driverId/withdraw
 */
router.post('/:driverId/withdraw', async (req, res) => {
  try {
    const { driverId } = req.params;
    const { amount, phoneNumber } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return sendError(res, 'Invalid withdrawal amount');
    }

    if (!phoneNumber) {
      return sendError(res, 'Phone number is required');
    }

    // Get wallet
    let wallet = await db.DriverWallet.findOne({ where: { driverId: driverId } });
    if (!wallet) {
      wallet = await db.DriverWallet.create({
        driverId: driverId,
        balance: 0,
        totalTipsReceived: 0,
              totalTipsCount: 0,
              totalDeliveryPay: 0,
              totalDeliveryPayCount: 0
      });
    }

    const withdrawalAmount = parseFloat(amount);
    const totalBalance = parseFloat(wallet.balance) || 0;

    // Calculate available balance (exclude amount on hold)
    const tipTransactions = await db.Transaction.findAll({
      where: {
        driverId: driverId,
        transactionType: 'tip',
        status: 'completed'
      },
      include: [{
        model: db.Order,
        as: 'order',
        attributes: ['id', 'status']
      }]
    });

    let amountOnHold = 0;
    tipTransactions.forEach(tx => {
      if (tx.order && tx.order.status !== 'completed') {
        amountOnHold += parseFloat(tx.amount) || 0;
      }
    });

    const availableBalance = Math.max(0, totalBalance - amountOnHold);

    if (withdrawalAmount > availableBalance) {
      return res.status(400).json({ 
        error: `Insufficient available balance. Available: KES ${availableBalance.toFixed(2)}, On Hold: KES ${amountOnHold.toFixed(2)}` 
      });
    }

    // Format phone number
    const cleanedPhone = String(phoneNumber ?? '').replace(/\D/g, '');
    let formattedPhone = cleanedPhone;
    if (cleanedPhone.startsWith('0')) {
      formattedPhone = '254' + cleanedPhone.substring(1);
    } else if (!cleanedPhone.startsWith('254')) {
      formattedPhone = '254' + cleanedPhone;
    }

    // Initiate B2C payment via M-Pesa
    // Note: You'll need to implement B2C in mpesaService
    // For now, we'll create the withdrawal transaction and update wallet
    // The actual M-Pesa B2C call should be implemented in mpesaService.initiateB2C()

    // Create withdrawal transaction
    const withdrawalTransaction = await db.Transaction.create({
      orderId: null, // Withdrawals don't have order IDs
      driverId: driverId,
      driverWalletId: wallet.id,
      transactionType: 'withdrawal',
      paymentMethod: 'mobile_money',
      paymentProvider: 'mpesa',
      amount: withdrawalAmount,
      status: 'pending',
      paymentStatus: 'pending',
      phoneNumber: formattedPhone,
      notes: `Withdrawal to ${formattedPhone}`
    });

    // Update wallet balance (reserve the amount)
    await wallet.update({
      balance: totalBalance - withdrawalAmount
    });

    // Withdrawing from wallet reduces driver's cash at hand by the amount withdrawn (may go negative)
    const driver = await db.Driver.findByPk(driverId);
    if (driver) {
      const currentCashAtHand = parseFloat(driver.cashAtHand || 0);
      const newCashAtHand = currentCashAtHand - withdrawalAmount;
      await driver.update({ cashAtHand: newCashAtHand });
      console.log(`   Driver ${driverId} cash at hand: KES ${currentCashAtHand.toFixed(2)} → KES ${newCashAtHand.toFixed(2)} (withdrawal -${withdrawalAmount.toFixed(2)})`);
    }

    // Initiate M-Pesa B2C payment
    try {
      const b2cResult = await mpesaService.initiateB2C(
        formattedPhone, 
        withdrawalAmount, 
        `Driver withdrawal for transaction #${withdrawalTransaction.id}`,
        'Driver Wallet Withdrawal'
      );

      if (b2cResult.success) {
        // Update transaction with B2C details
        await withdrawalTransaction.update({
          checkoutRequestID: b2cResult.conversationID,
          merchantRequestID: b2cResult.originatorConversationID,
          notes: withdrawalTransaction.notes ? 
            `${withdrawalTransaction.notes}\nB2C initiated: ${b2cResult.responseDescription}` : 
            `B2C initiated: ${b2cResult.responseDescription}`
        });

        // Transaction will be updated to 'completed' when B2C callback confirms payment
        // For now, keep it as 'pending' until callback arrives
        console.log(`✅ B2C payment initiated for withdrawal transaction #${withdrawalTransaction.id}`);
      } else {
        // B2C initiation failed - refund the wallet balance
        await wallet.update({
          balance: totalBalance // Restore balance
        });
        
        await withdrawalTransaction.update({
          status: 'failed',
          paymentStatus: 'failed',
          notes: withdrawalTransaction.notes ? 
            `${withdrawalTransaction.notes}\nB2C failed: ${b2cResult.responseDescription}` : 
            `B2C failed: ${b2cResult.responseDescription}`
        });

        throw new Error(b2cResult.responseDescription || 'Failed to initiate B2C payment');
      }
    } catch (b2cError) {
      console.error('B2C initiation error:', b2cError);
      
      // Refund wallet balance on error
      await wallet.update({
        balance: totalBalance
      });
      
      await withdrawalTransaction.update({
        status: 'failed',
        paymentStatus: 'failed',
        notes: withdrawalTransaction.notes ? 
          `${withdrawalTransaction.notes}\nB2C error: ${b2cError.message}` : 
          `B2C error: ${b2cError.message}`
      });
      
      throw b2cError;
    }

    // Reload wallet to get updated balance
    await wallet.reload();

    sendSuccess(res, {
      transaction: {
        id: withdrawalTransaction.id,
        amount: withdrawalAmount,
        phoneNumber: formattedPhone,
        status: withdrawalTransaction.status,
        conversationID: withdrawalTransaction.checkoutRequestID
      },
      newBalance: parseFloat(wallet.balance),
      note: 'The withdrawal will be completed when M-Pesa processes the payment. You will be notified when it\'s completed.'
    }, 'Withdrawal initiated successfully. Payment will be processed shortly.');
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    sendError(res, error.message, 500);
  }
});

module.exports = router;

