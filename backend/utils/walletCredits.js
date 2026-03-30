const db = require('../models');
const { Op } = require('sequelize');
const { getOrderFinancialBreakdown } = require('./orderFinancials');
const pushNotifications = require('../services/pushNotifications');
const { getOrCreateHoldDriver } = require('./holdDriver');
const { calculateDeliveryAccounting } = require('./deliveryAccounting');

// In-memory lock to prevent concurrent execution for the same order
// This prevents race conditions where multiple calls create duplicate transactions
const processingOrders = new Set();

/**
 * Apply 50% of territory delivery fee to driver savings and adjust cash-at-hand (PAY_NOW vs PAY_ON_DELIVERY).
 * Creates savings_credit when amount is positive, stop deductions, and PAY_NOW cash_settlement rows as needed.
 * Skips creating a duplicate savings_credit if one already exists for this order (idempotent create).
 */
async function applyTerritorySavingsAndCashAtHand({
  order,
  orderId,
  accounting,
  paymentTransaction,
  paymentTypeForAccounting,
  dbTransaction
}) {
  if (!order.driverId) return null;

  const savingsChangeRaw = Number(accounting.savingsChange);
  const cashAtHandChangeRaw = Number(accounting.cashAtHandChange);
  if (!Number.isFinite(savingsChangeRaw) || !Number.isFinite(cashAtHandChangeRaw)) {
    console.error(`❌ Order #${orderId}: invalid delivery accounting (non-finite savings/cash-at-hand change)`);
    return null;
  }

  let driverWallet = await db.DriverWallet.findOne({
    where: { driverId: order.driverId },
    transaction: dbTransaction
  });

  if (!driverWallet) {
    driverWallet = await db.DriverWallet.create(
      {
        driverId: order.driverId,
        balance: 0,
        totalTipsReceived: 0,
        totalTipsCount: 0,
        totalDeliveryPay: 0,
        totalDeliveryPayCount: 0,
        savings: 0
      },
      { transaction: dbTransaction }
    );
  }

  await driverWallet.reload({ transaction: dbTransaction });
  const currentSavings = parseFloat(driverWallet.savings || 0);

  // If savings_credit already exists for this order, do not add 50% again (idempotent retry / re-entry).
  const existingSavingsCredit = await db.Transaction.findOne({
    where: {
      orderId: orderId,
      transactionType: 'savings_credit',
      driverId: order.driverId,
      status: { [Op.ne]: 'cancelled' }
    },
    transaction: dbTransaction,
    lock: dbTransaction.LOCK.UPDATE
  });

  const savingsIncrement = existingSavingsCredit ? 0 : savingsChangeRaw;
  let newSavings = currentSavings + savingsIncrement;

  if (!existingSavingsCredit && savingsChangeRaw > 0.009) {
    await db.Transaction.create(
      {
        orderId: orderId,
        transactionType: 'savings_credit',
        paymentMethod: paymentTransaction?.paymentMethod || order.paymentMethod || 'mobile_money',
        paymentProvider: paymentTransaction?.paymentProvider || 'mpesa',
        amount: savingsChangeRaw,
        status: 'completed',
        paymentStatus: 'paid',
        receiptNumber: paymentTransaction?.receiptNumber || null,
        checkoutRequestID: paymentTransaction?.checkoutRequestID || null,
        merchantRequestID: paymentTransaction?.merchantRequestID || null,
        phoneNumber: paymentTransaction?.phoneNumber || null,
        transactionDate: paymentTransaction?.transactionDate || new Date(),
        driverId: order.driverId,
        driverWalletId: driverWallet.id,
        notes: `50% delivery fee order ${orderId}`
      },
      { transaction: dbTransaction }
    );

    console.log(`✅ Savings credit transaction created for Order #${orderId}: KES ${savingsChangeRaw.toFixed(2)}`);
  } else if (existingSavingsCredit) {
    console.log(
      `ℹ️  Savings credit already exists for Order #${orderId} (#${existingSavingsCredit.id}) — wallet balance not double-counted`
    );
  }

  console.log(`🔍 Checking stop deduction for Order #${orderId}: isStop=${order.isStop}, stopDeductionAmount=${order.stopDeductionAmount}`);
  if (order.isStop && order.stopDeductionAmount && parseFloat(order.stopDeductionAmount) > 0) {
    const existingStopDeduction = await db.Transaction.findOne({
      where: {
        orderId: orderId,
        transactionType: 'delivery_fee_debit',
        paymentProvider: 'stop_deduction',
        driverId: order.driverId,
        status: { [Op.ne]: 'cancelled' }
      },
      transaction: dbTransaction
    });

    if (existingStopDeduction) {
      console.log(`ℹ️  Stop deduction already exists for Order #${orderId} (transaction #${existingStopDeduction.id}) — not deducting savings again`);
    } else {
      const stopDeductionAmount = parseFloat(order.stopDeductionAmount);
      const savingsBeforeStop = newSavings;
      newSavings = newSavings - stopDeductionAmount;

      console.log(`🛑 Stop deduction applied for Order #${orderId}:`);
      console.log(`   Deduction amount: KES ${stopDeductionAmount.toFixed(2)}`);
      console.log(`   Driver savings before stop: KES ${savingsBeforeStop.toFixed(2)}`);
      console.log(`   Driver savings after stop: KES ${newSavings.toFixed(2)}`);

      await db.Transaction.create(
        {
          orderId: orderId,
          transactionType: 'delivery_fee_debit',
          paymentMethod: paymentTransaction?.paymentMethod || order.paymentMethod || 'cash',
          paymentProvider: 'stop_deduction',
          amount: -stopDeductionAmount,
          status: 'completed',
          paymentStatus: 'paid',
          driverId: order.driverId,
          driverWalletId: driverWallet.id,
          notes: `Stop deduction for Order #${orderId} - KES ${stopDeductionAmount.toFixed(2)} deducted from driver savings`
        },
        { transaction: dbTransaction }
      );

      console.log(`✅ Stop deduction transaction created for Order #${orderId}`);
    }
  }

  const savingsPersist = Number(newSavings.toFixed(2));
  await driverWallet.update(
    {
      savings: savingsPersist
    },
    { transaction: dbTransaction }
  );

  console.log(`💰 Updated driver savings for Order #${orderId}:`);
  console.log(
    `   Savings: KES ${currentSavings.toFixed(2)} → KES ${savingsPersist.toFixed(2)} (change: ${savingsIncrement >= 0 ? '+' : ''}${savingsIncrement.toFixed(2)}${order.isStop && order.stopDeductionAmount ? `, stop deduction: -${parseFloat(order.stopDeductionAmount).toFixed(2)}` : ''})`
  );

  const cashAtHandIncrement = existingSavingsCredit ? 0 : cashAtHandChangeRaw;

  const driver = await db.Driver.findByPk(order.driverId, { transaction: dbTransaction }).catch(() => null);
  if (driver) {
    const currentCashAtHand = parseFloat(driver.cashAtHand || 0);
    const newCashAtHand = Number((currentCashAtHand + cashAtHandIncrement).toFixed(2));

    await driver.update(
      {
        cashAtHand: newCashAtHand
      },
      { transaction: dbTransaction }
    );

    if (paymentTypeForAccounting === 'PAY_NOW' && Math.abs(cashAtHandIncrement) > 0.009) {
      const cashAtHandDelta = cashAtHandIncrement;
      const settlementAmount = Math.abs(cashAtHandDelta);
      const isReduction = cashAtHandDelta < -0.009;
      const existingCashAtHandSettlement = await db.Transaction.findOne({
        where: {
          orderId: orderId,
          driverId: order.driverId,
          transactionType: 'cash_settlement',
          [Op.or]: [
            { notes: { [Op.like]: '%Cash at hand − 50% delivery fee%' } },
            { notes: { [Op.like]: '%Pay Now: 50% delivery fee - cash at hand%' } }
          ]
        },
        transaction: dbTransaction
      });
      if (!existingCashAtHandSettlement) {
        await db.Transaction.create(
          {
            orderId: orderId,
            driverId: order.driverId,
            driverWalletId: driverWallet.id,
            transactionType: 'cash_settlement',
            paymentMethod: paymentTransaction?.paymentMethod || order.paymentMethod || 'mobile_money',
            paymentProvider: paymentTransaction?.paymentProvider || 'mpesa',
            amount: settlementAmount,
            status: 'completed',
            paymentStatus: 'paid',
            receiptNumber: paymentTransaction?.receiptNumber || null,
            transactionDate: paymentTransaction?.transactionDate || new Date(),
            notes: `Cash at hand − 50% delivery fee for Order #${orderId} (driver did not receive cash)`
          },
          { transaction: dbTransaction }
        );
        console.log(
          `   Cash at hand ${isReduction ? 'reduction' : 'credit'} logged for Order #${orderId}: ${isReduction ? '-' : '+'}KES ${settlementAmount.toFixed(2)}`
        );
      }
    } else if (paymentTypeForAccounting === 'PAY_ON_DELIVERY' && Math.abs(cashAtHandIncrement) > 0.009) {
      // COD: net cash retained after 50% territory fee → savings. Driver app lists cash-at-hand from
      // cash_settlement rows; without this, only reconstructed order rows appeared (easy to miss).
      const existingCodLedger = await db.Transaction.findOne({
        where: {
          orderId,
          driverId: order.driverId,
          transactionType: 'cash_settlement',
          paymentProvider: 'order_completion'
        },
        transaction: dbTransaction,
        lock: dbTransaction.LOCK.UPDATE
      });
      if (!existingCodLedger) {
        await db.Transaction.create(
          {
            orderId,
            driverId: order.driverId,
            driverWalletId: driverWallet.id,
            transactionType: 'cash_settlement',
            paymentMethod: order.paymentMethod || 'cash',
            paymentProvider: 'order_completion',
            amount: cashAtHandIncrement,
            status: 'completed',
            paymentStatus: 'paid',
            transactionDate: new Date(),
            notes: `Cash at hand — Order #${orderId} completed (net after 50% territory fee to savings)`
          },
          { transaction: dbTransaction }
        );
        console.log(
          `   Cash at hand ledger (COD) for Order #${orderId}: +KES ${cashAtHandIncrement.toFixed(2)}`
        );
      }
    }

    console.log(`💵 Updated driver cash at hand for Order #${orderId}:`);
    console.log(
      `   Cash at Hand: KES ${currentCashAtHand.toFixed(2)} → KES ${newCashAtHand.toFixed(2)} (change: ${cashAtHandIncrement >= 0 ? '+' : ''}${cashAtHandIncrement.toFixed(2)})`
    );

    const creditLimit = parseFloat(driver.creditLimit || 0);
    if (creditLimit > 0 && newCashAtHand > creditLimit) {
      if (driver.pushToken) {
        try {
          const pushNotifications = require('../services/pushNotifications');
          const message = {
            sound: 'default',
            title: '⚠️ Cash At Hand Limit Exceeded',
            body: `Your cash at hand (KES ${newCashAtHand.toFixed(2)}) exceeds your limit (KES ${creditLimit.toFixed(2)}). Please submit cash at hand to continue with deliveries.`,
            data: {
              type: 'cash_at_hand_limit_exceeded',
              driverId: String(driver.id),
              cashAtHand: String(newCashAtHand),
              creditLimit: String(creditLimit),
              channelId: 'cash-at-hand'
            },
            priority: 'high',
            badge: 1,
            channelId: 'cash-at-hand'
          };
          await pushNotifications.sendFCMNotification(driver.pushToken, message);
          console.log(`📤 Push notification sent to driver ${driver.name} (ID: ${driver.id}) about cash at hand limit exceeded`);
        } catch (pushError) {
          console.error(`❌ Error sending push notification to driver ${driver.id}:`, pushError);
        }
      }
    }
  }

  await driverWallet.reload({ transaction: dbTransaction });

  const finalSavings = parseFloat(driverWallet.savings || 0);
  const drvReloaded = await db.Driver.findByPk(order.driverId, {
    attributes: ['cashAtHand'],
    transaction: dbTransaction
  });
  const finalCashAtHand = drvReloaded ? parseFloat(drvReloaded.cashAtHand || 0) : null;

  return {
    savings: finalSavings,
    cashAtHand: finalCashAtHand,
    savingsIncrement,
    cashAtHandIncrement
  };
}

/**
 * Credit all wallets when an order is completed (delivery completed)
 * This function handles:
 * 1. Order payment (itemsTotal) -> Merchant wallet
 * 2. Delivery Fee payment (merchant share) -> Merchant wallet
 * 3. Delivery Fee payment (driver share) -> Driver wallet (if enabled)
 * 4. Tip -> Driver wallet (if applicable)
 * 
 * @param {number} orderId - The order ID
 * @param {object} req - Express request object (for Socket.IO)
 * @returns {Promise<object>} Result object with credited amounts
 */
const creditWalletsOnDeliveryCompletion = async (orderId, req = null) => {
  console.log(`🚀 creditWalletsOnDeliveryCompletion CALLED for Order #${orderId}`);
  
  // CRITICAL: Prevent concurrent execution for the same order
  // This prevents race conditions where multiple calls create duplicate transactions
  if (processingOrders.has(orderId)) {
    console.log(`⚠️  Order #${orderId} is already being processed - skipping duplicate call`);
    return {
      orderId,
      skipped: true,
      reason: 'already_processing'
    };
  }

  processingOrders.add(orderId);
  console.log(`🔒 Lock acquired for Order #${orderId}`);
  
  const dbTransaction = await db.sequelize.transaction();
  
  try {
    // CRITICAL: Load order with lock FIRST, then load driver separately
    // PostgreSQL doesn't allow FOR UPDATE on nullable side of outer join
    // So we must lock the order first, then load the driver association separately
    const order = await db.Order.findByPk(orderId, {
      lock: dbTransaction.LOCK.UPDATE,
      transaction: dbTransaction
    });
    
    if (!order) {
      await dbTransaction.rollback();
      processingOrders.delete(orderId);
      throw new Error(`Order ${orderId} not found`);
    }
    
    // Load driver separately if driverId exists
    if (order.driverId) {
      const driver = await db.Driver.findByPk(order.driverId, {
        transaction: dbTransaction
      });
      if (driver) {
        order.driver = driver;
      }
    }
    
    console.log(`📦 Order #${orderId} loaded:`);
    console.log(`   status: ${order.status}`);
    console.log(`   paymentStatus: ${order.paymentStatus}`);
    console.log(`   driverId: ${order.driverId}`);
    console.log(`   tipAmount field: "${order.tipAmount}" (type: ${typeof order.tipAmount})`);
    console.log(`   isStop: ${order.isStop}`);
    console.log(`   stopDeductionAmount: ${order.stopDeductionAmount}`);

    // Check if wallets have already been credited for this order
    // We check by looking at transactions - if they're already linked to wallets, they've been credited
    // CRITICAL: Check for ANY driver delivery transaction (not just completed ones) to prevent duplicates
    const existingDriverDeliveryTxn = order.driverId ? await db.Transaction.findOne({
      where: {
        orderId: orderId,
        transactionType: 'delivery_pay',
        driverId: order.driverId,
        status: { [Op.ne]: 'cancelled' } // Check for any non-cancelled transaction
      },
      transaction: dbTransaction,
      lock: dbTransaction.LOCK.UPDATE
    }) : null;

    const existingTipTxn = await db.Transaction.findOne({
      where: {
        orderId: orderId,
        transactionType: 'tip',
        status: { [Op.ne]: 'cancelled' } // Check for any non-cancelled transaction
      },
      transaction: dbTransaction,
      lock: dbTransaction.LOCK.UPDATE
    });

    // For ANY completed/paid order with a driver and a territory delivery fee,
    // savings (50% territory fee) must be credited.
    // If delivery_pay exists but savings_credit does not, do not skip - run full flow to create it.
    let existingSavingsCreditForOrder = null;
    if (order.driverId) {
      existingSavingsCreditForOrder = await db.Transaction.findOne({
        where: {
          orderId: orderId,
          transactionType: 'savings_credit',
          driverId: order.driverId,
          status: { [Op.ne]: 'cancelled' }
        },
        transaction: dbTransaction,
        lock: dbTransaction.LOCK.UPDATE
      });
    }

    // Check if wallets were already fully credited (both transaction completed AND linked to wallet)
    // If so, we can skip. But if transaction exists but isn't completed, we should update it.
    const driverTxnFullyCredited = order.driverId && existingDriverDeliveryTxn && 
                                     existingDriverDeliveryTxn.status === 'completed' && 
                                     existingDriverDeliveryTxn.driverWalletId &&
                                     existingDriverDeliveryTxn.paymentStatus === 'paid';
    
    const tipTxnFullyCredited = existingTipTxn && 
                                 existingTipTxn.status === 'completed' && 
                                 existingTipTxn.driverWalletId &&
                                 existingTipTxn.paymentStatus === 'paid';
    
    // Only skip if BOTH driver and tip transactions are fully credited (if applicable)
    // AND for orders with a driver + territory fee, savings_credit exists.
    // If savings_credit is missing, fall through so we create it (breakdown/accounting run later).
    const orderTipAmount = parseFloat(order.tipAmount || '0') || 0;
    const hasTip = orderTipAmount > 0.009;
    // Align with accounting below: territoryDeliveryFee ?? convenienceFee ?? breakdown delivery fee
    let territoryFeeForSkip = parseFloat(order.territoryDeliveryFee ?? order.convenienceFee ?? 0) || 0;
    if (territoryFeeForSkip < 0.009 && order.driverId) {
      try {
        const breakdownEarly = await getOrderFinancialBreakdown(orderId);
        const fromBreakdown = parseFloat(breakdownEarly.deliveryFee) || 0;
        territoryFeeForSkip = parseFloat(order.territoryDeliveryFee ?? fromBreakdown) || 0;
      } catch (e) {
        console.warn(`Order #${orderId}: could not load breakdown for territory fee skip check:`, e.message);
      }
    }
    const needsSavingsCheck = order.driverId && territoryFeeForSkip > 0.009;
    const savingsAlreadyDone = !needsSavingsCheck || (existingSavingsCreditForOrder && existingSavingsCreditForOrder.status !== 'cancelled');
    
    if (driverTxnFullyCredited && (!hasTip || tipTxnFullyCredited) && savingsAlreadyDone) {
      console.log(`ℹ️  Wallets already fully credited for Order #${orderId} (driver transaction #${existingDriverDeliveryTxn.id} is completed and linked to wallet)`);
      if (hasTip && tipTxnFullyCredited) {
        console.log(`   Tip transaction #${existingTipTxn.id} is also completed and linked to wallet`);
      }
      if (needsSavingsCheck) {
        console.log(`   Savings credit already exists for Order #${orderId}`);
      }
      // Pay Now: ensure cash-at-hand adjustment was applied (50% delivery fee). It may be missing if this path ran before that logic existed.
      let cashAtHandRepaired = false;
      if (needsSavingsCheck && order.driverId) {
        const existingCashAtHandEntry = await db.Transaction.findOne({
          where: {
            orderId: orderId,
            driverId: order.driverId,
            transactionType: { [Op.in]: ['cash_settlement', 'delivery_fee_debit'] }, // include legacy type
            [Op.or]: [
              { notes: { [Op.like]: '%Cash at hand − 50% delivery fee%' } },
              { notes: { [Op.like]: '%Pay Now: 50% delivery fee - cash at hand%' } }
            ]
          },
          transaction: dbTransaction
        });
        if (!existingCashAtHandEntry) {
          await dbTransaction.rollback();
          try {
            const repairResult = await repairPayNowCashAtHandOnly(orderId);
            cashAtHandRepaired = repairResult.repaired;
            if (cashAtHandRepaired) {
              console.log(`   Cash at hand adjustment applied for Order #${orderId} (was missing)`);
            }
          } catch (repairErr) {
            console.error(`   Failed to repair cash at hand for Order #${orderId}:`, repairErr.message);
          }
          return {
            alreadyCredited: true,
            orderId,
            cashAtHandRepaired: cashAtHandRepaired || false
          };
        }
      }
      await dbTransaction.rollback();
      return {
        alreadyCredited: true,
        orderId
      };
    }
    if (needsSavingsCheck && !savingsAlreadyDone) {
      console.log(`⚠️  Order #${orderId}: delivery/tip may be credited but savings_credit missing - will run full flow to create it`);
    }
    
    // If existing transaction found but not completed, we'll update it below
    if (existingDriverDeliveryTxn && existingDriverDeliveryTxn.status !== 'completed') {
      console.log(`⚠️  Found existing pending driver delivery transaction #${existingDriverDeliveryTxn.id} for Order #${orderId}. Will update it to completed.`);
    }
    
    // If tip transaction exists but isn't completed, we'll update it below
    if (existingTipTxn && existingTipTxn.status !== 'completed' && hasTip) {
      console.log(`⚠️  Found existing pending tip transaction #${existingTipTxn.id} for Order #${orderId}. Will update it to completed.`);
    }

    // Ensure order is completed and payment is paid
    if (order.status !== 'completed' || order.paymentStatus !== 'paid') {
      await dbTransaction.rollback();
      throw new Error(`Order ${orderId} must be completed and paid before crediting wallets. Current status: ${order.status}, paymentStatus: ${order.paymentStatus}`);
    }

    // CRITICAL: Check if this is a POS order - POS orders don't have delivery fees
    const isPOSOrder = order.deliveryAddress === 'In-Store Purchase';
    if (isPOSOrder) {
      console.log(`ℹ️  Order #${orderId} is a POS order - skipping delivery fee transactions and driver wallet credits`);
      
      // Cancel any existing delivery fee transactions for POS orders
      const existingDeliveryTransactions = await db.Transaction.findAll({
        where: {
          orderId: orderId,
          transactionType: 'delivery_pay'
        },
        transaction: dbTransaction
      });
      
      for (const existingTxn of existingDeliveryTransactions) {
        if (existingTxn.status !== 'cancelled') {
          await existingTxn.update({
            status: 'cancelled',
            paymentStatus: 'cancelled',
            amount: 0,
            notes: `${existingTxn.notes || ''}\nCancelled - POS orders do not have delivery fees.`.trim()
          }, { transaction: dbTransaction });
          console.log(`✅ Cancelled delivery fee transaction #${existingTxn.id} for POS Order #${orderId}`);
        }
      }
      
      // For POS orders, only credit merchant wallet with order total (no delivery fee)
      const breakdown = await getOrderFinancialBreakdown(orderId);
      const itemsTotal = parseFloat(breakdown.itemsTotal) || 0;
      const tipAmount = parseFloat(breakdown.tipAmount) || 0;
      
      // Credit merchant wallet with order total only
      try {
        let adminWallet = await db.AdminWallet.findOne({ where: { id: 1 } }, { transaction: dbTransaction });
        if (!adminWallet) {
          adminWallet = await db.AdminWallet.create({
            id: 1,
            balance: 0,
            totalRevenue: 0,
            totalOrders: 0,
            cashAtHand: 0
          }, { transaction: dbTransaction });
        }

        const oldBalance = parseFloat(adminWallet.balance) || 0;
        const oldTotalRevenue = parseFloat(adminWallet.totalRevenue) || 0;
        const oldTotalOrders = adminWallet.totalOrders || 0;

        await adminWallet.update({
          balance: oldBalance + itemsTotal,
          totalRevenue: oldTotalRevenue + itemsTotal,
          totalOrders: oldTotalOrders + 1
        }, { transaction: dbTransaction });

        await adminWallet.reload({ transaction: dbTransaction });
        console.log(`✅ Credited merchant wallet for POS Order #${orderId}: KES ${itemsTotal.toFixed(2)}`);
      } catch (walletError) {
        console.error(`❌ Error crediting merchant wallet for POS Order #${orderId}:`, walletError);
        throw walletError;
      }

      // POS + Cash: Increase admin cash at hand by order value (wallet engine rule)
      const paymentTxn = await db.Transaction.findOne({
        where: {
          orderId: orderId,
          transactionType: 'payment',
          status: 'completed',
          paymentStatus: 'paid'
        },
        order: [['transactionDate', 'DESC'], ['createdAt', 'DESC']],
        transaction: dbTransaction
      });
      const isPOSCash = paymentTxn &&
        (paymentTxn.paymentMethod === 'cash' ||
         String(paymentTxn.paymentProvider || '').toLowerCase() === 'cash' ||
         String(paymentTxn.paymentProvider || '').toLowerCase() === 'admin_cash_at_hand');
      if (isPOSCash && itemsTotal > 0.009) {
        let adminWallet = await db.AdminWallet.findOne({ where: { id: 1 } }, { transaction: dbTransaction });
        if (!adminWallet) {
          adminWallet = await db.AdminWallet.create({
            id: 1,
            balance: 0,
            totalRevenue: 0,
            totalOrders: 0,
            cashAtHand: 0
          }, { transaction: dbTransaction });
        }
        const currentCashAtHand = parseFloat(adminWallet.cashAtHand || 0);
        const newCashAtHand = currentCashAtHand + itemsTotal;
        await adminWallet.update({ cashAtHand: newCashAtHand }, { transaction: dbTransaction });
        console.log(`✅ POS cash: Admin cash at hand +KES ${itemsTotal.toFixed(2)} for Order #${orderId} (${currentCashAtHand.toFixed(2)} → ${newCashAtHand.toFixed(2)})`);
      }
      
      await dbTransaction.commit();
      processingOrders.delete(orderId);
      console.log(`✅ POS Order #${orderId} wallet crediting completed (no delivery fees)`);
      
      return {
        orderId,
        itemsTotal,
        deliveryFee: 0,
        merchantDeliveryAmount: 0,
        driverPayAmount: 0,
        tipAmount,
        merchantTotal: itemsTotal,
        isPOSOrder: true
      };
    }

    // Get financial breakdown
    const breakdown = await getOrderFinancialBreakdown(orderId);
    const itemsTotal = parseFloat(breakdown.itemsTotal) || 0;
    const convenienceFee = parseFloat(breakdown.deliveryFee) || 0;
    const territoryDeliveryFee = parseFloat(order.territoryDeliveryFee ?? convenienceFee) || 0;
    // Delivery fee for driver pay + result payload = territory fee (internal accounting), not raw convenience fee alone
    const deliveryFee = territoryDeliveryFee;
    const orderValue = itemsTotal + convenienceFee;
    
    // CRITICAL: Reload order to ensure we have the latest tipAmount value
    await order.reload({ transaction: dbTransaction });
    
    // CRITICAL: Get tip amount from MULTIPLE sources to ensure we never miss tips
    // Handle both string and number types for tipAmount
    const tipAmountFromBreakdown = parseFloat(breakdown.tipAmount) || 0;
    const orderTipRaw = order.tipAmount;
    const tipAmountFromOrder = orderTipRaw != null ? (typeof orderTipRaw === 'string' ? parseFloat(orderTipRaw) : parseFloat(orderTipRaw)) || 0 : 0;
    
    // Recalculate orderTipAmount AFTER reload to ensure we have the latest value
    const orderTipAmountAfterReload = tipAmountFromOrder;
    
    // Use the MAXIMUM of all sources - this ensures we never miss a tip
    const tipAmount = Math.max(tipAmountFromBreakdown, tipAmountFromOrder);
    
    // Get payment transaction early so we can use PAY_NOW accounting when customer paid via system (whether pay_now or pay_on_delivery)
    const paymentTransactionForAccounting = await db.Transaction.findOne({
      where: {
        orderId: orderId,
        transactionType: 'payment',
        status: 'completed',
        paymentStatus: 'paid'
      },
      order: [['transactionDate', 'DESC'], ['createdAt', 'DESC']],
      transaction: dbTransaction
    });
    const paymentMethodFromTxnOrOrder =
      (paymentTransactionForAccounting && paymentTransactionForAccounting.paymentMethod) ||
      order.paymentMethod ||
      null;
    const providerLower = String(paymentTransactionForAccounting?.paymentProvider || '').toLowerCase();
    const isNonCashSystemPayment =
      // Even if the payment transaction row is missing/late, a paid order with paymentMethod=mobile_money/card
      // MUST be treated as system-paid (driver did not collect cash).
      (order.paymentStatus === 'paid' && (paymentMethodFromTxnOrOrder === 'mobile_money' || paymentMethodFromTxnOrOrder === 'card')) &&
      // If we do have a provider, it must be a known system provider (or blank/legacy).
      (!paymentTransactionForAccounting || providerLower === '' || providerLower === 'mpesa' || providerLower === 'pesapal');

    const orderPaymentTypeNorm = (order.paymentType || 'pay_on_delivery').toString().toLowerCase();
    // Use PAY_NOW accounting (50% savings, 50% reduce cash at hand) when order is pay_now
    // OR when customer paid via system (pay_on_delivery + M-Pesa/Pesapal/card).
    const paymentTypeForAccounting = (orderPaymentTypeNorm === 'pay_now' || isNonCashSystemPayment) ? 'PAY_NOW' : 'PAY_ON_DELIVERY';
    
    // Delivery accounting uses order value (items + convenience) and territory delivery fee.
    const accounting = calculateDeliveryAccounting(orderValue, territoryDeliveryFee, paymentTypeForAccounting);
    console.log(`📊 Delivery Accounting for Order #${orderId}:`);
    console.log(`   Payment Type: ${paymentTypeForAccounting}`);
    console.log(`   Alcohol Cost: KES ${itemsTotal.toFixed(2)}`);
    console.log(`   Convenience Fee: KES ${convenienceFee.toFixed(2)}`);
    console.log(`   Territory Delivery Fee: KES ${territoryDeliveryFee.toFixed(2)}`);
    console.log(`   Withheld Amount: KES ${accounting.withheldAmount.toFixed(2)}`);
    console.log(`   Immediate Driver Earnings: KES ${accounting.immediateDriverEarnings.toFixed(2)}`);
    console.log(`   Cash at Hand Change: KES ${accounting.cashAtHandChange.toFixed(2)}`);
    console.log(`   Savings Change: KES ${accounting.savingsChange.toFixed(2)}`);
    
    // ALWAYS log tip detection for debugging
    console.log(`💰 Tip detection for Order #${orderId}:`);
    console.log(`   Breakdown tipAmount: KES ${tipAmountFromBreakdown.toFixed(2)}`);
    console.log(`   Order.tipAmount (after reload): KES ${tipAmountFromOrder.toFixed(2)}`);
    console.log(`   Order.tipAmount raw value: "${order.tipAmount}" (type: ${typeof order.tipAmount})`);
    console.log(`   Final tipAmount: KES ${tipAmount.toFixed(2)}`);
    console.log(`   orderTipAmount (early): KES ${orderTipAmount.toFixed(2)}`);
    console.log(`   orderTipAmountAfterReload: KES ${orderTipAmountAfterReload.toFixed(2)}`);

    // Get driver pay settings
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
    
    // Calculate driver pay amount
    let driverPayAmount = 0;
    if (order.driverId) {
      const deliveryFeeAmount = parseFloat(deliveryFee) || 0;

      if (paymentTypeForAccounting === 'PAY_NOW') {
        // For PAY_NOW orders:
        // - Customer pays the business
        // - Business holds 100% of the delivery fee
        // - Business must then credit 50% of the delivery fee to the driver's wallet
        //   and withhold 50% to savings (already handled by deliveryAccounting)
        //
        // So for wallet crediting, we ALWAYS use exactly 50% of the delivery fee
        // as the driver's delivery pay amount, regardless of admin settings.
        driverPayAmount = deliveryFeeAmount * 0.5;
      } else if (driverPaySettingEnabled) {
        // For PAY_ON_DELIVERY orders, respect the admin-configured driver pay
        if (isPercentageMode) {
          // Percentage mode: calculate driver pay as percentage of delivery fee
          driverPayAmount = deliveryFeeAmount * (configuredDriverPayPercentage / 100);
          driverPayAmount = Math.min(driverPayAmount, deliveryFeeAmount);
        } else {
          // Amount mode: use fixed amount
          driverPayAmount = parseFloat(order.driverPayAmount || '0');
          
          if ((!driverPayAmount || driverPayAmount < 0.009) && configuredDriverPayAmount > 0) {
            driverPayAmount = Math.min(deliveryFeeAmount, configuredDriverPayAmount);
          }
          
          if (driverPayAmount > deliveryFeeAmount) {
            driverPayAmount = deliveryFeeAmount;
          }
        }
      }
    }
    
    // Merchant no longer gets any delivery fee - all delivery fee goes to driver
    const merchantDeliveryAmount = 0;

    // Get payment transaction to get receipt number and payment details
    let paymentTransaction = await db.Transaction.findOne({
      where: {
        orderId: orderId,
        transactionType: 'payment',
        status: 'completed',
        paymentStatus: 'paid'
      },
      order: [['transactionDate', 'DESC'], ['createdAt', 'DESC']],
      transaction: dbTransaction
    });

    // Cash on delivery: customer pays the driver in cash — there is often no `payment` row in the DB.
    // Without a row, the whole completion flow used to throw and driver cash-at-hand / savings never updated.
    if (!paymentTransaction) {
      const pt = (order.paymentType || 'pay_on_delivery').toString().toLowerCase();
      const pm = (order.paymentMethod || '').toString().toLowerCase();
      if (order.paymentStatus === 'paid' && pt === 'pay_on_delivery' && pm === 'cash') {
        const fallbackDate = order.updatedAt || order.createdAt || new Date();
        paymentTransaction = {
          receiptNumber: null,
          transactionDate: fallbackDate,
          createdAt: fallbackDate,
          paymentMethod: 'cash',
          paymentProvider: 'cash',
          checkoutRequestID: null,
          merchantRequestID: null,
          phoneNumber: null
        };
        console.log(`ℹ️  Order #${orderId}: no payment transaction row — using synthetic COD cash record for completion`);
      } else {
        await dbTransaction.rollback();
        processingOrders.delete(orderId);
        throw new Error(`Payment transaction not found for Order #${orderId}`);
      }
    }

    const receiptNumber = paymentTransaction.receiptNumber;
    const transactionDate = paymentTransaction.transactionDate || paymentTransaction.createdAt || new Date();

    const result = {
      orderId,
      itemsTotal,
      deliveryFee,
      merchantDeliveryAmount,
      driverPayAmount,
      tipAmount,
      merchantTotal: itemsTotal + merchantDeliveryAmount
    };

    // 1. Merchant no longer gets delivery fee - skip merchant delivery fee transaction
    const paymentMethod = paymentTransaction.paymentMethod || order.paymentMethod || 'mobile_money';
    const paymentProvider = paymentTransaction.paymentProvider || 'mpesa';

    // 2. Credit Merchant Wallet: Order payment (itemsTotal) + Delivery Fee (merchant share)
    try {
      let adminWallet = await db.AdminWallet.findOne({ where: { id: 1 } });
      if (!adminWallet) {
        adminWallet = await db.AdminWallet.create({
          id: 1,
          balance: 0,
          totalRevenue: 0,
          totalOrders: 0
        }, { transaction: dbTransaction });
      }

      const merchantCreditAmount = itemsTotal; // Order total only; no delivery fee to merchant
      const oldBalance = parseFloat(adminWallet.balance) || 0;
      const oldTotalRevenue = parseFloat(adminWallet.totalRevenue) || 0;
      const oldTotalOrders = adminWallet.totalOrders || 0;

      await adminWallet.update({
        balance: oldBalance + merchantCreditAmount,
        totalRevenue: oldTotalRevenue + merchantCreditAmount,
        totalOrders: oldTotalOrders + 1
      }, { transaction: dbTransaction });

      await adminWallet.reload({ transaction: dbTransaction });

      console.log(`✅ Credited merchant wallet for Order #${orderId}:`);
      console.log(`   Order payment: KES ${itemsTotal.toFixed(2)}`);
      console.log(`   Total: KES ${merchantCreditAmount.toFixed(2)}`);
      console.log(`   Wallet balance: ${oldBalance.toFixed(2)} → ${parseFloat(adminWallet.balance).toFixed(2)}`);
      console.log(`   Total revenue: ${oldTotalRevenue.toFixed(2)} → ${parseFloat(adminWallet.totalRevenue).toFixed(2)}`);
      console.log(`   Total orders: ${oldTotalOrders} → ${adminWallet.totalOrders}`);

      result.merchantCredited = true;
      result.merchantCreditAmount = merchantCreditAmount;
    } catch (merchantError) {
      console.error(`❌ Error crediting merchant wallet for Order #${orderId}:`, merchantError);
      result.merchantError = merchantError.message;
    }

    // 3. Credit Driver Wallet: Delivery Fee (driver share) + Tip
    // CRITICAL: For cash/mobile money payments, DO NOT credit driver delivery fee or tip to driver wallet
    // because the driver already received both in cash/mobile money. Crediting them would mean they get them twice.
    const isCashPayment = paymentMethod === 'cash' || 
                          paymentProvider === 'cash_in_hand' || 
                          paymentProvider === 'driver_mpesa_manual';
    
    // CRITICAL: Use the maximum of tipAmount and orderTipAmountAfterReload to ensure tips are ALWAYS credited
    // Use the reloaded value, not the early value, to ensure we have the latest tip amount
    // BUT: Skip tip crediting if payment is cash/mobile money (driver already received tip in cash)
    const effectiveTipAmount = isCashPayment ? 0 : Math.max(tipAmount, orderTipAmountAfterReload);
    
    // CRITICAL: For cash payments, also skip driver delivery fee crediting (driver already has it in cash)
    // Only credit driver delivery fee for M-Pesa payments where payment goes through the system
    const effectiveDriverPayAmount = isCashPayment ? 0 : driverPayAmount;
    
    console.log(`💳 Driver wallet crediting check for Order #${orderId}:`);
    console.log(`   driverId: ${order.driverId}`);
    console.log(`   paymentMethod: ${paymentMethod}`);
    console.log(`   paymentProvider: ${paymentProvider}`);
    console.log(`   isCashPayment: ${isCashPayment}`);
    console.log(`   driverPayAmount: KES ${driverPayAmount.toFixed(2)} ${isCashPayment ? '(skipped - cash payment)' : ''}`);
    console.log(`   effectiveDriverPayAmount: KES ${effectiveDriverPayAmount.toFixed(2)}`);
    console.log(`   tipAmount: KES ${tipAmount.toFixed(2)}`);
    console.log(`   orderTipAmount: KES ${orderTipAmount.toFixed(2)}`);
    console.log(`   effectiveTipAmount: KES ${effectiveTipAmount.toFixed(2)} ${isCashPayment ? '(skipped - cash payment)' : ''}`);
    console.log(`   Will credit driver: ${order.driverId && (effectiveDriverPayAmount > 0.009 || effectiveTipAmount > 0.009)}`);
    
    let driverWalletForCompletionLog = null;
    if (order.driverId && (effectiveDriverPayAmount > 0.009 || effectiveTipAmount > 0.009)) {
      try {
        let driverWallet = await db.DriverWallet.findOne({ 
          where: { driverId: order.driverId },
          transaction: dbTransaction
        });
        
        if (!driverWallet) {
          driverWallet = await db.DriverWallet.create({
            driverId: order.driverId,
            balance: 0,
            totalTipsReceived: 0,
            totalTipsCount: 0,
            totalDeliveryPay: 0,
            totalDeliveryPayCount: 0,
            savings: 0
          }, { transaction: dbTransaction });
        }

        // Credit delivery fee (driver share)
        // CRITICAL: Only create/update driver delivery transaction if effectiveDriverPayAmount > 0
        // If effectiveDriverPayAmount is 0 (e.g., cash payment), we should NOT create a driver delivery transaction
        // Only tip transactions should be created when there's no driver pay
        // CRITICAL: For cash payments, skip driver delivery fee crediting (driver already has it in cash)
        if (effectiveDriverPayAmount > 0.009) {
          console.log(`💵 Creating/updating driver delivery transaction for Order #${orderId} with amount KES ${effectiveDriverPayAmount.toFixed(2)}`);
          console.log(`   CRITICAL: This is for DRIVER DELIVERY FEE, NOT tip. Tip will be handled separately.`);
          
          // CRITICAL: Use the transaction found in the initial check above (existingDriverDeliveryTxn)
          // This prevents duplicates - we already checked for it with a lock at the beginning
          // BUT: Only use it if it's actually a delivery_pay transaction with the correct driverId
          // CRITICAL: NEVER convert merchant transactions (driverId: null) to driver transactions!
          // Merchant transactions must remain merchant transactions
          let driverDeliveryTransaction = existingDriverDeliveryTxn && 
                                         existingDriverDeliveryTxn.transactionType === 'delivery_pay' &&
                                         existingDriverDeliveryTxn.driverId === order.driverId
            ? existingDriverDeliveryTxn 
            : null;
          
          // CRITICAL: Double-check with lock to prevent race conditions
          // Only look for transactions that already have the driverId set - NEVER convert merchant transactions
          if (!driverDeliveryTransaction) {
            driverDeliveryTransaction = await db.Transaction.findOne({
              where: {
                orderId: orderId,
                transactionType: 'delivery_pay',
                driverId: order.driverId, // CRITICAL: Must have driverId - don't match merchant transactions
                status: { [Op.ne]: 'cancelled' }
              },
              transaction: dbTransaction,
              lock: dbTransaction.LOCK.UPDATE
            });
          }

          const paymentMethod = paymentTransaction.paymentMethod || order.paymentMethod || 'mobile_money';
          const paymentProvider = paymentTransaction.paymentProvider || 'mpesa';

          const driverDeliveryPayload = {
            orderId: orderId,
            transactionType: 'delivery_pay',
            paymentMethod,
            paymentProvider,
            amount: effectiveDriverPayAmount,
            status: 'completed',
            paymentStatus: 'paid',
            receiptNumber: receiptNumber,
            checkoutRequestID: paymentTransaction?.checkoutRequestID ?? null,
            merchantRequestID: paymentTransaction?.merchantRequestID ?? null,
            phoneNumber: paymentTransaction?.phoneNumber ?? null,
            transactionDate: transactionDate,
            driverId: order.driverId,
            driverWalletId: driverWallet.id,
            notes: `Driver delivery fee payment for Order #${orderId} - credited to driver wallet on delivery completion.`
          };

          if (driverDeliveryTransaction) {
            // Update existing transaction (found in initial check or double-check above)
            await driverDeliveryTransaction.update(driverDeliveryPayload, { transaction: dbTransaction });
            await driverDeliveryTransaction.reload({ transaction: dbTransaction });
            console.log(`✅ Updated driver delivery transaction #${driverDeliveryTransaction.id} for Order #${orderId}`);
          } else {
            // CRITICAL: Final check before creating - prevent duplicates even at this late stage
            // This handles edge cases where a transaction was created between our checks
            const finalCheck = await db.Transaction.findOne({
              where: {
                orderId: orderId,
                transactionType: 'delivery_pay',
                driverId: order.driverId,
                status: { [Op.ne]: 'cancelled' }
              },
              transaction: dbTransaction,
              lock: dbTransaction.LOCK.UPDATE
            });
            
            if (finalCheck) {
              // Found one! Update it instead of creating duplicate
              await finalCheck.update(driverDeliveryPayload, { transaction: dbTransaction });
              await finalCheck.reload({ transaction: dbTransaction });
              driverDeliveryTransaction = finalCheck;
              console.log(`✅ Updated driver delivery transaction #${driverDeliveryTransaction.id} for Order #${orderId} (found in final check)`);
            } else {
              // Truly no transaction exists - safe to create
              driverDeliveryTransaction = await db.Transaction.create(driverDeliveryPayload, { transaction: dbTransaction });
              console.log(`✅ Created driver delivery transaction #${driverDeliveryTransaction.id} for Order #${orderId}`);
            }
          }

          // No wallet balance credit; 50% territory → savings / cash-at-hand runs in applyTerritorySavingsAndCashAtHand.
          console.log(`✅ Driver delivery_pay transaction for Order #${orderId} (50% to savings, no wallet): KES ${effectiveDriverPayAmount.toFixed(2)}`);
        } else {
          const skipReason = isCashPayment 
            ? 'cash payment (driver already has delivery fee in cash)' 
            : `driverPayAmount is ${driverPayAmount.toFixed(2)} (too small)`;
          console.log(`ℹ️  Skipping driver delivery transaction creation for Order #${orderId} - ${skipReason}`);
          console.log(`   Tip will be credited separately if effectiveTipAmount > 0`);
        }

        // Credit tip
        // CRITICAL: Use effectiveTipAmount to ensure tips are credited even if breakdown is wrong
        // BUT: Skip tip crediting if payment is cash/mobile money (driver already received tip in cash)
        console.log(`💵 Tip crediting check for Order #${orderId}:`);
        console.log(`   effectiveTipAmount: KES ${effectiveTipAmount.toFixed(2)}`);
        console.log(`   isCashPayment: ${isCashPayment}`);
        console.log(`   Will credit tip: ${effectiveTipAmount > 0.009 && !isCashPayment}`);
        
        if (effectiveTipAmount > 0.009 && !isCashPayment) {
          console.log(`✅ STARTING tip crediting for Order #${orderId} with amount KES ${effectiveTipAmount.toFixed(2)}`);
          // CRITICAL: Use the transaction found in the initial check above (existingTipTxn)
          // This prevents duplicates - we already checked for it with a lock at the beginning
          let tipTransaction = existingTipTxn;
          
          // If not found in initial check, do a final check with lock to prevent race conditions
          if (!tipTransaction) {
            tipTransaction = await db.Transaction.findOne({
              where: {
                orderId: orderId,
                transactionType: 'tip',
                status: { [Op.ne]: 'cancelled' }
              },
              transaction: dbTransaction,
              lock: dbTransaction.LOCK.UPDATE
            });
          }

          const paymentMethod = paymentTransaction.paymentMethod || order.paymentMethod || 'mobile_money';
          const paymentProvider = paymentTransaction.paymentProvider || 'mpesa';

          // CRITICAL: Ensure tip transaction is created with transactionType='tip', NOT 'delivery_pay'
          const tipPayload = {
            orderId: orderId,
            transactionType: 'tip', // MUST be 'tip', never 'delivery_pay'
            paymentMethod,
            paymentProvider,
            amount: effectiveTipAmount,
            status: 'completed',
            paymentStatus: 'paid',
            receiptNumber: receiptNumber,
            checkoutRequestID: paymentTransaction?.checkoutRequestID ?? null,
            merchantRequestID: paymentTransaction?.merchantRequestID ?? null,
            phoneNumber: paymentTransaction?.phoneNumber ?? null,
            transactionDate: transactionDate,
            driverId: order.driverId,
            driverWalletId: driverWallet.id,
            notes: `Tip for Order #${orderId} - credited to driver wallet on delivery completion.`
          };
          
          // Double-check payload before creating
          if (tipPayload.transactionType !== 'tip') {
            console.error(`❌ CRITICAL ERROR: tipPayload.transactionType is "${tipPayload.transactionType}" but should be "tip"!`);
            throw new Error(`Tip transaction must have transactionType='tip', got '${tipPayload.transactionType}'`);
          }

          if (tipTransaction) {
            // Update existing transaction (found in initial check or final check above)
            await tipTransaction.update(tipPayload, { transaction: dbTransaction });
            await tipTransaction.reload({ transaction: dbTransaction });
            console.log(`✅ Updated tip transaction #${tipTransaction.id} for Order #${orderId}`);
          } else {
            // CRITICAL: Final check before creating - prevent duplicates even at this late stage
            // This handles edge cases where a transaction was created between our checks
            const finalTipCheck = await db.Transaction.findOne({
              where: {
                orderId: orderId,
                transactionType: 'tip',
                status: { [Op.ne]: 'cancelled' }
              },
              transaction: dbTransaction,
              lock: dbTransaction.LOCK.UPDATE
            });
            
            if (finalTipCheck) {
              // Found one! Update it instead of creating duplicate
              await finalTipCheck.update(tipPayload, { transaction: dbTransaction });
              await finalTipCheck.reload({ transaction: dbTransaction });
              tipTransaction = finalTipCheck;
              console.log(`✅ Updated tip transaction #${tipTransaction.id} for Order #${orderId} (found in final check)`);
            } else {
              // Truly no transaction exists - safe to create
              tipTransaction = await db.Transaction.create(tipPayload, { transaction: dbTransaction });
              console.log(`✅ Created tip transaction #${tipTransaction.id} for Order #${orderId}`);
            }
          }

          // No wallet: tip transaction may exist for audit but do not credit wallet balance
          console.log(`✅ Tip transaction for Order #${orderId}: KES ${effectiveTipAmount.toFixed(2)} (no wallet crediting)`);
        } else {
          console.log(`⚠️  SKIPPING tip crediting for Order #${orderId} - effectiveTipAmount (${effectiveTipAmount.toFixed(2)}) is too small`);
        }

        driverWalletForCompletionLog = driverWallet;
      } catch (driverError) {
        console.error(`❌ Error crediting driver wallet for Order #${orderId}:`, driverError);
        console.error(`   Error stack:`, driverError.stack);
        result.driverError = driverError.message;
        // Don't throw - allow function to complete even if driver wallet crediting fails
      }
    } else {
      const skipReason = !order.driverId 
        ? 'No driverId' 
        : isCashPayment 
        ? 'Cash payment - driver already has delivery fee and tip in cash'
        : 'No driverPayAmount and no tip';
      console.log(`⚠️  SKIPPING driver wallet crediting for Order #${orderId}:`);
      console.log(`   Reason: ${skipReason}`);
      console.log(`   driverId: ${order.driverId}`);
      console.log(`   isCashPayment: ${isCashPayment}`);
      console.log(`   driverPayAmount: ${driverPayAmount.toFixed(2)}`);
      console.log(`   effectiveDriverPayAmount: ${effectiveDriverPayAmount.toFixed(2)}`);
      console.log(`   effectiveTipAmount: ${effectiveTipAmount.toFixed(2)}`);
      console.log(`   tipAmount: ${tipAmount.toFixed(2)}`);
      console.log(`   orderTipAmount: ${orderTipAmount.toFixed(2)}`);
    }

    // 50% territory fee → driver savings + cash-at-hand (all non-POS delivery completions with a driver)
    if (!isPOSOrder && order.driverId) {
      try {
        const territoryAccounting = await applyTerritorySavingsAndCashAtHand({
          order,
          orderId,
          accounting,
          paymentTransaction,
          paymentTypeForAccounting,
          dbTransaction
        });
        if (territoryAccounting) {
          result.territoryAccounting = territoryAccounting;
          await order.update(
            { driverPayCreditedAt: new Date() },
            { transaction: dbTransaction }
          );
          const io = req?.app?.get('io');
          if (io) {
            io.to(`driver-${order.driverId}`).emit('driver-balances-updated', {
              orderId,
              savings: territoryAccounting.savings,
              cashAtHand: territoryAccounting.cashAtHand
            });
          }
        }
      } catch (accountingError) {
        console.error(`❌ Error applying territory savings/cash-at-hand for Order #${orderId}:`, accountingError);
      }
    }

    if (driverWalletForCompletionLog && order.driverId) {
      try {
        const driverWallet = driverWalletForCompletionLog;
        await driverWallet.reload({ transaction: dbTransaction });

        console.log(`✅ Credited driver wallet for Order #${orderId}:`);
        console.log(`   Delivery fee: KES ${effectiveDriverPayAmount.toFixed(2)} ${isCashPayment ? '(skipped - cash payment)' : ''}`);
        console.log(`   Tip: KES ${effectiveTipAmount.toFixed(2)} ${isCashPayment ? '(skipped - cash payment)' : ''}`);
        console.log(`   Total: KES ${(effectiveDriverPayAmount + effectiveTipAmount).toFixed(2)}`);
        console.log(`   Final wallet balance: ${parseFloat(driverWallet.balance).toFixed(2)}`);
        console.log(`   Total delivery pay: ${parseFloat(driverWallet.totalDeliveryPay).toFixed(2)}`);
        console.log(`   Total tips received: ${parseFloat(driverWallet.totalTipsReceived).toFixed(2)}`);
        console.log(`   Savings: ${parseFloat(driverWallet.savings || 0).toFixed(2)}`);

        const io = req?.app?.get('io');
        if (io) {
          const drvEmit = await db.Driver.findByPk(order.driverId, {
            attributes: ['cashAtHand'],
            transaction: dbTransaction
          });
          io.to(`driver-${order.driverId}`).emit('delivery-completed', {
            orderId: orderId,
            deliveryPayAmount: effectiveDriverPayAmount,
            tipAmount: effectiveTipAmount,
            totalCredited: effectiveDriverPayAmount + effectiveTipAmount,
            walletBalance: parseFloat(driverWallet.balance),
            savings: parseFloat(driverWallet.savings || 0),
            cashAtHand: drvEmit ? parseFloat(drvEmit.cashAtHand || 0) : null
          });
        }

        const driver = await db.Driver.findByPk(order.driverId, { transaction: dbTransaction }).catch(() => null);
        if (driver?.pushToken && effectiveTipAmount > 0.009 && effectiveDriverPayAmount <= 0.009) {
          const notificationTitle = 'Tip Credited';
          const notificationBody = `KES ${effectiveTipAmount.toFixed(2)} tip credited for Order #${orderId}`;

          pushNotifications.sendPushNotification(driver.pushToken, {
            title: notificationTitle,
            body: notificationBody,
            data: {
              type: 'tip_credited',
              orderId: orderId,
              tipAmount: effectiveTipAmount
            }
          }).catch((pushError) => {
            console.error('❌ Error sending tip push notification:', pushError);
          });
        }

        result.driverCredited = true;
        result.driverCreditAmount = effectiveDriverPayAmount + effectiveTipAmount;
      } catch (completionLogError) {
        console.error(`❌ Error in delivery completion logging for Order #${orderId}:`, completionLogError);
      }
    }

    // Note: We don't mark order with a flag since Order model doesn't have walletsCredited field
    // The fact that transactions are linked to wallets serves as the indicator

    // Commit transaction
    await dbTransaction.commit();
    console.log(`✅ All wallets credited successfully for Order #${orderId}`);

    return result;
  } catch (error) {
    await dbTransaction.rollback();
    console.error(`❌ Error crediting wallets for Order #${orderId}:`, error);
    throw error;
  } finally {
    // Always remove from processing set, even if there was an error
    processingOrders.delete(orderId);
  }
};

/**
 * Repair missing Pay Now cash-at-hand adjustment only (50% delivery fee adjustment and log).
 * Use when savings/delivery_pay were credited but cash-at-hand adjustment was never recorded/applied.
 * Safe to call multiple times (idempotent if already applied).
 */
const repairPayNowCashAtHandOnly = async (orderId) => {
  const order = await db.Order.findByPk(orderId);
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }
  if (order.status !== 'completed' || order.paymentStatus !== 'paid') {
    throw new Error(`Order ${orderId} must be completed and paid. Current: status=${order.status}, paymentStatus=${order.paymentStatus}`);
  }
  if (!order.driverId) {
    throw new Error(`Order ${orderId} has no driver`);
  }
  const paymentType = (order.paymentType || 'pay_on_delivery').toLowerCase();
  const paymentTxn = await db.Transaction.findOne({
    where: { orderId, transactionType: 'payment', status: 'completed', paymentStatus: 'paid' },
    order: [['createdAt', 'DESC']]
  });
  const isMpesa = paymentTxn &&
    (paymentTxn.paymentMethod === 'mobile_money' || paymentTxn.paymentMethod === 'card') &&
    (String(paymentTxn.paymentProvider || '').toLowerCase() === 'mpesa' || String(paymentTxn.paymentProvider || '').toLowerCase() === 'pesapal');
  if (paymentType !== 'pay_now' && !isMpesa) {
    return { orderId, skipped: true, reason: 'not_mpesa', message: 'Cash at hand reduction only applies to Pay Now / M-Pesa orders (where driver did not receive cash).' };
  }

  const breakdown = await getOrderFinancialBreakdown(orderId);
  const deliveryFee = parseFloat(breakdown.deliveryFee) || 0;
  const itemsTotal = parseFloat(breakdown.itemsTotal) || 0;
  const accounting = calculateDeliveryAccounting(itemsTotal, deliveryFee, 'PAY_NOW');
  if (Math.abs(accounting.cashAtHandChange) < 0.009) {
    return { orderId, skipped: true, reason: 'no_adjustment', cashAtHandChange: accounting.cashAtHandChange };
  }

  const existingEntry = await db.Transaction.findOne({
    where: {
      orderId,
      driverId: order.driverId,
      transactionType: { [Op.in]: ['cash_settlement', 'delivery_fee_debit'] }, // include legacy type
      [Op.or]: [
        { notes: { [Op.like]: '%Cash at hand − 50% delivery fee%' } },
        { notes: { [Op.like]: '%Pay Now: 50% delivery fee - cash at hand%' } }
      ]
    }
  });
  if (existingEntry) {
    return { orderId, skipped: true, reason: 'already_applied', transactionId: existingEntry.id };
  }

  let driverWallet = await db.DriverWallet.findOne({ where: { driverId: order.driverId } });
  if (!driverWallet) {
    driverWallet = await db.DriverWallet.create({
      driverId: order.driverId,
      balance: 0,
      totalTipsReceived: 0,
      totalTipsCount: 0,
      totalDeliveryPay: 0,
      totalDeliveryPayCount: 0,
      savings: 0
    });
  }

  const driver = await db.Driver.findByPk(order.driverId);
  if (!driver) {
    throw new Error(`Driver ${order.driverId} not found`);
  }
  const currentCashAtHand = parseFloat(driver.cashAtHand || 0);
  const newCashAtHand = currentCashAtHand + accounting.cashAtHandChange; // cashAtHandChange is negative
  await driver.update({ cashAtHand: newCashAtHand });

  await db.Transaction.create({
    orderId,
    driverId: order.driverId,
    driverWalletId: driverWallet.id,
    transactionType: 'cash_settlement',
    paymentMethod: paymentTxn?.paymentMethod || order.paymentMethod || 'mobile_money',
    paymentProvider: paymentTxn?.paymentProvider || 'mpesa',
    amount: Math.abs(accounting.cashAtHandChange), // Positive amount; reduces cash at hand by rule
    status: 'completed',
    paymentStatus: 'paid',
    receiptNumber: paymentTxn?.receiptNumber || null,
    transactionDate: paymentTxn?.transactionDate || new Date(),
    notes: `Cash at hand − 50% delivery fee for Order #${orderId} (driver did not receive cash)`
  });

  console.log(`✅ Repair Pay Now cash at hand adjustment for Order #${orderId}: driver ${order.driverId} cash at hand ${currentCashAtHand.toFixed(2)} → ${newCashAtHand.toFixed(2)} (${accounting.cashAtHandChange.toFixed(2)})`);
  return {
    orderId,
    repaired: true,
    cashAtHandChange: accounting.cashAtHandChange,
    driverId: order.driverId,
    previousCashAtHand: currentCashAtHand,
    newCashAtHand
  };
};

/**
 * Repair missing savings credit and driver wallet/cash-at-hand for a completed order.
 * Use when savings_credit was never created (e.g. Order 347).
 * POST /api/admin/orders/:orderId/repair-savings
 */
const repairSavingsForOrder = async (orderId) => {
  const order = await db.Order.findByPk(orderId);
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }
  if (order.status !== 'completed' || order.paymentStatus !== 'paid') {
    throw new Error(`Order ${orderId} must be completed and paid. Current: status=${order.status}, paymentStatus=${order.paymentStatus}`);
  }
  if (!order.driverId) {
    throw new Error(`Order ${orderId} has no driver`);
  }

  // Only repair savings. NEVER touch cashAtHand here.
  const breakdown = await getOrderFinancialBreakdown(orderId);
  const deliveryFee = parseFloat(breakdown.deliveryFee) || 0;
  const savingsAmount = deliveryFee * 0.5;
  if (savingsAmount < 0.009) {
    return { orderId, skipped: true, reason: 'no_savings', savingsChange: savingsAmount };
  }

  const existingSavingsCredit = await db.Transaction.findOne({
    where: {
      orderId,
      transactionType: 'savings_credit',
      driverId: order.driverId,
      status: { [Op.ne]: 'cancelled' }
    }
  });
  if (existingSavingsCredit) {
    return { orderId, skipped: true, reason: 'already_has_savings_credit', transactionId: existingSavingsCredit.id };
  }

  const paymentTxn = await db.Transaction.findOne({
    where: { orderId, transactionType: 'payment', status: 'completed', paymentStatus: 'paid' },
    order: [['createdAt', 'DESC']]
  });

  const dbTransaction = await db.sequelize.transaction();
  try {
    let driverWallet = await db.DriverWallet.findOne({
      where: { driverId: order.driverId },
      transaction: dbTransaction
    });
    if (!driverWallet) {
      driverWallet = await db.DriverWallet.create({
        driverId: order.driverId,
        balance: 0,
        totalTipsReceived: 0,
        totalTipsCount: 0,
        totalDeliveryPay: 0,
        totalDeliveryPayCount: 0,
        savings: 0
      }, { transaction: dbTransaction });
    }

    const currentSavings = parseFloat(driverWallet.savings || 0);
    let newSavings = currentSavings + savingsAmount;
    if (order.isStop && order.stopDeductionAmount && order.stopDeductionAmount > 0) {
      newSavings = newSavings - parseFloat(order.stopDeductionAmount); // Allow negative savings
    }

    await db.Transaction.create({
      orderId,
      transactionType: 'savings_credit',
      paymentMethod: paymentTxn?.paymentMethod || order.paymentMethod || 'mobile_money',
      paymentProvider: paymentTxn?.paymentProvider || 'mpesa',
      amount: savingsAmount,
      status: 'completed',
      paymentStatus: 'paid',
      receiptNumber: paymentTxn?.receiptNumber || null,
      checkoutRequestID: paymentTxn?.checkoutRequestID || null,
      merchantRequestID: paymentTxn?.merchantRequestID || null,
      phoneNumber: paymentTxn?.phoneNumber || null,
      transactionDate: paymentTxn?.transactionDate || new Date(),
      driverId: order.driverId,
      driverWalletId: driverWallet.id,
      notes: `50% delivery fee order ${orderId}`
    }, { transaction: dbTransaction });

    await driverWallet.update({ savings: newSavings }, { transaction: dbTransaction });

    await dbTransaction.commit();
    console.log(`✅ Repair savings for Order #${orderId}: savings +KES ${savingsAmount.toFixed(2)} (cashAtHand untouched)`);
    return {
      orderId,
      repaired: true,
      savingsCredited: savingsAmount,
      cashAtHandCorrection: 0,
      driverId: order.driverId
    };
  } catch (err) {
    await dbTransaction.rollback();
    throw err;
  }
};

/**
 * Apply stop deduction to driver savings for an order
 * This can be called retroactively when an order is marked as stop after completion
 * 
 * @param {number} orderId - The order ID
 * @returns {Promise<object>} Result object with deduction details
 */
const applyStopDeduction = async (orderId) => {
  console.log(`🛑 applyStopDeduction CALLED for Order #${orderId}`);
  
  const order = await db.Order.findByPk(orderId);
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }
  
  if (!order.isStop || !order.stopDeductionAmount || parseFloat(order.stopDeductionAmount) <= 0) {
    console.log(`ℹ️  Order #${orderId} is not a stop order or has no stop deduction amount`);
    return {
      orderId,
      applied: false,
      reason: 'not_a_stop_order'
    };
  }
  
  if (!order.driverId) {
    console.log(`⚠️  Order #${orderId} has no driver assigned`);
    return {
      orderId,
      applied: false,
      reason: 'no_driver'
    };
  }
  
  const stopDeductionAmount = parseFloat(order.stopDeductionAmount);
  
  // Check if stop deduction transaction already exists
  const existingStopDeduction = await db.Transaction.findOne({
    where: {
      orderId: orderId,
      transactionType: 'delivery_fee_debit',
      paymentProvider: 'stop_deduction',
      driverId: order.driverId,
      status: { [Op.ne]: 'cancelled' }
    }
  });
  
  if (existingStopDeduction) {
    console.log(`ℹ️  Stop deduction already applied for Order #${orderId} (transaction #${existingStopDeduction.id})`);
    return {
      orderId,
      applied: false,
      reason: 'already_applied',
      transactionId: existingStopDeduction.id
    };
  }
  
  const dbTransaction = await db.sequelize.transaction();
  
  try {
    let driverWallet = await db.DriverWallet.findOne({
      where: { driverId: order.driverId },
      transaction: dbTransaction
    });
    
    if (!driverWallet) {
      driverWallet = await db.DriverWallet.create({
        driverId: order.driverId,
        balance: 0,
        totalTipsReceived: 0,
        totalTipsCount: 0,
        totalDeliveryPay: 0,
        totalDeliveryPayCount: 0,
        savings: 0
      }, { transaction: dbTransaction });
    }
    
    const currentSavings = parseFloat(driverWallet.savings || 0);
    const newSavings = currentSavings - stopDeductionAmount; // Allow negative savings
    
    console.log(`🛑 Applying stop deduction for Order #${orderId}:`);
    console.log(`   Deduction amount: KES ${stopDeductionAmount.toFixed(2)}`);
    console.log(`   Driver savings before stop: KES ${currentSavings.toFixed(2)}`);
    console.log(`   Driver savings after stop: KES ${newSavings.toFixed(2)}`);
    
    // Create transaction record for stop deduction
    const stopDeductionTransaction = await db.Transaction.create({
      orderId: orderId,
      transactionType: 'delivery_fee_debit',
      paymentMethod: order.paymentMethod || 'cash',
      paymentProvider: 'stop_deduction',
      amount: -stopDeductionAmount, // Negative amount for deduction
      status: 'completed',
      paymentStatus: 'paid',
      driverId: order.driverId,
      driverWalletId: driverWallet.id,
      notes: `Stop deduction for Order #${orderId} - KES ${stopDeductionAmount.toFixed(2)} deducted from driver savings`
    }, { transaction: dbTransaction });
    
    // Update driver wallet savings
    await driverWallet.update({
      savings: newSavings
    }, { transaction: dbTransaction });
    
    await dbTransaction.commit();
    
    console.log(`✅ Stop deduction applied successfully for Order #${orderId} (transaction #${stopDeductionTransaction.id})`);
    
    return {
      orderId,
      applied: true,
      stopDeductionAmount,
      savingsBefore: currentSavings,
      savingsAfter: newSavings,
      transactionId: stopDeductionTransaction.id
    };
  } catch (error) {
    await dbTransaction.rollback();
    console.error(`❌ Error applying stop deduction for Order #${orderId}:`, error);
    throw error;
  }
};

module.exports = {
  creditWalletsOnDeliveryCompletion,
  repairSavingsForOrder,
  repairPayNowCashAtHandOnly,
  applyStopDeduction
};

