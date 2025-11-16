const db = require('../models');
const { Op } = require('sequelize');
const { getOrderFinancialBreakdown } = require('./orderFinancials');
const pushNotifications = require('../services/pushNotifications');
const { getOrCreateHoldDriver } = require('./holdDriver');

// In-memory lock to prevent concurrent execution for the same order
// This prevents race conditions where multiple calls create duplicate transactions
const processingOrders = new Set();

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
    // Lock the order row to prevent concurrent crediting
    const order = await db.Order.findByPk(orderId, {
      lock: dbTransaction.LOCK.UPDATE,
      transaction: dbTransaction,
      include: [
        {
          model: db.Driver,
          as: 'driver'
        }
      ]
    });
    
    if (!order) {
      await dbTransaction.rollback();
      processingOrders.delete(orderId);
      throw new Error(`Order ${orderId} not found`);
    }
    
    console.log(`📦 Order #${orderId} loaded:`);
    console.log(`   status: ${order.status}`);
    console.log(`   paymentStatus: ${order.paymentStatus}`);
    console.log(`   driverId: ${order.driverId}`);
    console.log(`   tipAmount field: "${order.tipAmount}" (type: ${typeof order.tipAmount})`);

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
    // If driver transaction exists but isn't completed, we need to update it
    // CRITICAL: Check tip amount from order, not from breakdown, to ensure we handle tips correctly
    const orderTipAmount = parseFloat(order.tipAmount || '0') || 0;
    const hasTip = orderTipAmount > 0.009 || tipAmount > 0.009;
    
    if (driverTxnFullyCredited && (!hasTip || tipTxnFullyCredited)) {
      console.log(`ℹ️  Wallets already fully credited for Order #${orderId} (driver transaction #${existingDriverDeliveryTxn.id} is completed and linked to wallet)`);
      if (hasTip && tipTxnFullyCredited) {
        console.log(`   Tip transaction #${existingTipTxn.id} is also completed and linked to wallet`);
      }
      await dbTransaction.rollback();
      return {
        alreadyCredited: true,
        orderId
      };
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

    // Get financial breakdown
    const breakdown = await getOrderFinancialBreakdown(orderId);
    const itemsTotal = parseFloat(breakdown.itemsTotal) || 0;
    const deliveryFee = parseFloat(breakdown.deliveryFee) || 0;
    
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
    
    // ALWAYS log tip detection for debugging
    console.log(`💰 Tip detection for Order #${orderId}:`);
    console.log(`   Breakdown tipAmount: KES ${tipAmountFromBreakdown.toFixed(2)}`);
    console.log(`   Order.tipAmount (after reload): KES ${tipAmountFromOrder.toFixed(2)}`);
    console.log(`   Order.tipAmount raw value: "${order.tipAmount}" (type: ${typeof order.tipAmount})`);
    console.log(`   Final tipAmount: KES ${tipAmount.toFixed(2)}`);
    console.log(`   orderTipAmount (early): KES ${orderTipAmount.toFixed(2)}`);
    console.log(`   orderTipAmountAfterReload: KES ${orderTipAmountAfterReload.toFixed(2)}`);

    // Get driver pay settings
    const [driverPayEnabledSetting, driverPayAmountSetting] = await Promise.all([
      db.Settings.findOne({ where: { key: 'driverPayPerDeliveryEnabled' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'driverPayPerDeliveryAmount' } }).catch(() => null)
    ]);

    const driverPaySettingEnabled = driverPayEnabledSetting?.value === 'true';
    const configuredDriverPayAmount = parseFloat(driverPayAmountSetting?.value || '0');
    
    // Calculate driver pay amount
    let driverPayAmount = 0;
    if (driverPaySettingEnabled && order.driverId) {
      driverPayAmount = parseFloat(order.driverPayAmount || '0');
      
      if ((!driverPayAmount || driverPayAmount < 0.009) && configuredDriverPayAmount > 0) {
        driverPayAmount = Math.min(deliveryFee, configuredDriverPayAmount);
      }
      
      if (driverPayAmount > deliveryFee) {
        driverPayAmount = deliveryFee;
      }
    }
    
    const merchantDeliveryAmount = Math.max(deliveryFee - driverPayAmount, 0);

    // Get payment transaction to get receipt number and payment details
    const paymentTransaction = await db.Transaction.findOne({
      where: {
        orderId: orderId,
        transactionType: 'payment',
        status: 'completed',
        paymentStatus: 'paid'
      },
      order: [['transactionDate', 'DESC'], ['createdAt', 'DESC']],
      transaction: dbTransaction
    });

    if (!paymentTransaction) {
      await dbTransaction.rollback();
      throw new Error(`Payment transaction not found for Order #${orderId}`);
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

    // 1. Create/Update Merchant Delivery Fee Transaction
    const paymentMethod = paymentTransaction.paymentMethod || order.paymentMethod || 'mobile_money';
    const paymentProvider = paymentTransaction.paymentProvider || 'mpesa';

    let merchantDeliveryTransaction = await db.Transaction.findOne({
      where: {
        orderId: orderId,
        transactionType: 'delivery_pay',
        driverId: null,
        driverWalletId: null
      },
      transaction: dbTransaction,
      lock: dbTransaction.LOCK.UPDATE
    });

    const deliveryNotes = driverPayAmount > 0
      ? `Delivery fee for Order #${orderId} - merchant share KES ${merchantDeliveryAmount.toFixed(2)}, driver payout KES ${driverPayAmount.toFixed(2)}.`
      : `Delivery fee for Order #${orderId}.`;

    const merchantDeliveryPayload = {
      orderId: orderId,
      transactionType: 'delivery_pay',
      paymentMethod,
      paymentProvider,
      amount: merchantDeliveryAmount,
      status: 'completed',
      paymentStatus: 'paid',
      receiptNumber: receiptNumber,
      checkoutRequestID: paymentTransaction.checkoutRequestID,
      merchantRequestID: paymentTransaction.merchantRequestID,
      phoneNumber: paymentTransaction.phoneNumber,
      transactionDate: transactionDate,
      driverId: null,
      driverWalletId: null,
      notes: deliveryNotes
    };

    if (merchantDeliveryTransaction) {
      await merchantDeliveryTransaction.update(merchantDeliveryPayload, { transaction: dbTransaction });
      await merchantDeliveryTransaction.reload({ transaction: dbTransaction });
      console.log(`✅ Updated merchant delivery transaction #${merchantDeliveryTransaction.id} for Order #${orderId}`);
    } else {
      merchantDeliveryTransaction = await db.Transaction.create(merchantDeliveryPayload, { transaction: dbTransaction });
      console.log(`✅ Created merchant delivery transaction #${merchantDeliveryTransaction.id} for Order #${orderId}`);
    }

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

      const merchantCreditAmount = itemsTotal + merchantDeliveryAmount;
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
      console.log(`   Delivery fee (merchant): KES ${merchantDeliveryAmount.toFixed(2)}`);
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
    // CRITICAL: Use the maximum of tipAmount and orderTipAmountAfterReload to ensure tips are ALWAYS credited
    // Use the reloaded value, not the early value, to ensure we have the latest tip amount
    const effectiveTipAmount = Math.max(tipAmount, orderTipAmountAfterReload);
    
    console.log(`💳 Driver wallet crediting check for Order #${orderId}:`);
    console.log(`   driverId: ${order.driverId}`);
    console.log(`   driverPayAmount: KES ${driverPayAmount.toFixed(2)}`);
    console.log(`   tipAmount: KES ${tipAmount.toFixed(2)}`);
    console.log(`   orderTipAmount: KES ${orderTipAmount.toFixed(2)}`);
    console.log(`   effectiveTipAmount: KES ${effectiveTipAmount.toFixed(2)}`);
    console.log(`   Will credit driver: ${order.driverId && (driverPayAmount > 0.009 || effectiveTipAmount > 0.009)}`);
    
    if (order.driverId && (driverPayAmount > 0.009 || effectiveTipAmount > 0.009)) {
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
            totalDeliveryPayCount: 0
          }, { transaction: dbTransaction });
        }

        const oldBalance = parseFloat(driverWallet.balance) || 0;
        const oldTotalDeliveryPay = parseFloat(driverWallet.totalDeliveryPay || 0);
        const oldDeliveryPayCount = driverWallet.totalDeliveryPayCount || 0;
        const oldTotalTipsReceived = parseFloat(driverWallet.totalTipsReceived || 0);
        const oldTipsCount = driverWallet.totalTipsCount || 0;

        // Credit delivery fee (driver share)
        if (driverPayAmount > 0.009) {
          // CRITICAL: Use the transaction found in the initial check above (existingDriverDeliveryTxn)
          // This prevents duplicates - we already checked for it with a lock at the beginning
          let driverDeliveryTransaction = existingDriverDeliveryTxn;
          
          // If not found in initial check, check for pending transaction with null driverId that might be converted
          if (!driverDeliveryTransaction) {
            driverDeliveryTransaction = await db.Transaction.findOne({
              where: {
                orderId: orderId,
                transactionType: 'delivery_pay',
                driverId: null,
                driverWalletId: null,
                status: { [Op.ne]: 'cancelled' }
              },
              transaction: dbTransaction,
              lock: dbTransaction.LOCK.UPDATE
            });
          }
          
          // CRITICAL: Double-check with lock to prevent race conditions
          // Even if we found one above, another process might have created one between checks
          if (!driverDeliveryTransaction) {
            driverDeliveryTransaction = await db.Transaction.findOne({
              where: {
                orderId: orderId,
                transactionType: 'delivery_pay',
                driverId: order.driverId,
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
            amount: driverPayAmount,
            status: 'completed',
            paymentStatus: 'paid',
            receiptNumber: receiptNumber,
            checkoutRequestID: paymentTransaction.checkoutRequestID,
            merchantRequestID: paymentTransaction.merchantRequestID,
            phoneNumber: paymentTransaction.phoneNumber,
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

          // Credit driver wallet
          await driverWallet.update({
            balance: oldBalance + driverPayAmount,
            totalDeliveryPay: oldTotalDeliveryPay + driverPayAmount,
            totalDeliveryPayCount: oldDeliveryPayCount + 1
          }, { transaction: dbTransaction });

          console.log(`✅ Credited driver delivery fee for Order #${orderId}:`);
          console.log(`   Amount: KES ${driverPayAmount.toFixed(2)}`);
          console.log(`   Wallet balance: ${oldBalance.toFixed(2)} → ${(oldBalance + driverPayAmount).toFixed(2)}`);
        }

        // Credit tip
        // CRITICAL: Use effectiveTipAmount to ensure tips are credited even if breakdown is wrong
        console.log(`💵 Tip crediting check for Order #${orderId}:`);
        console.log(`   effectiveTipAmount: KES ${effectiveTipAmount.toFixed(2)}`);
        console.log(`   Will credit tip: ${effectiveTipAmount > 0.009}`);
        
        if (effectiveTipAmount > 0.009) {
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

          const tipPayload = {
            orderId: orderId,
            transactionType: 'tip',
            paymentMethod,
            paymentProvider,
            amount: effectiveTipAmount,
            status: 'completed',
            paymentStatus: 'paid',
            receiptNumber: receiptNumber,
            checkoutRequestID: paymentTransaction.checkoutRequestID,
            merchantRequestID: paymentTransaction.merchantRequestID,
            phoneNumber: paymentTransaction.phoneNumber,
            transactionDate: transactionDate,
            driverId: order.driverId,
            driverWalletId: driverWallet.id,
            notes: `Tip for Order #${orderId} - credited to driver wallet on delivery completion.`
          };

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

          // CRITICAL: Reload wallet to get current balance (after driver delivery fee was credited if applicable)
          // This ensures we use the correct balance when crediting the tip
          await driverWallet.reload({ transaction: dbTransaction });
          const currentBalance = parseFloat(driverWallet.balance) || 0;
          
          // Credit driver wallet with tip
          await driverWallet.update({
            balance: currentBalance + effectiveTipAmount,
            totalTipsReceived: oldTotalTipsReceived + effectiveTipAmount,
            totalTipsCount: oldTipsCount + 1
          }, { transaction: dbTransaction });

          console.log(`✅ COMPLETED tip crediting for Order #${orderId}:`);
          console.log(`   Amount: KES ${effectiveTipAmount.toFixed(2)}`);
          console.log(`   Wallet balance: ${currentBalance.toFixed(2)} → ${(currentBalance + effectiveTipAmount).toFixed(2)}`);
          console.log(`   Total tips received: ${oldTotalTipsReceived.toFixed(2)} → ${(oldTotalTipsReceived + effectiveTipAmount).toFixed(2)}`);
          console.log(`   Total tips count: ${oldTipsCount} → ${oldTipsCount + 1}`);
        } else {
          console.log(`⚠️  SKIPPING tip crediting for Order #${orderId} - effectiveTipAmount (${effectiveTipAmount.toFixed(2)}) is too small`);
        }

        await driverWallet.reload({ transaction: dbTransaction });

        console.log(`✅ Credited driver wallet for Order #${orderId}:`);
        console.log(`   Delivery fee: KES ${driverPayAmount.toFixed(2)}`);
        console.log(`   Tip: KES ${effectiveTipAmount.toFixed(2)}`);
        console.log(`   Total: KES ${(driverPayAmount + effectiveTipAmount).toFixed(2)}`);
        console.log(`   Final wallet balance: ${parseFloat(driverWallet.balance).toFixed(2)}`);
        console.log(`   Total delivery pay: ${parseFloat(driverWallet.totalDeliveryPay).toFixed(2)}`);
        console.log(`   Total tips received: ${parseFloat(driverWallet.totalTipsReceived).toFixed(2)}`);

        // Send notifications
        const driver = await db.Driver.findByPk(order.driverId, { transaction: dbTransaction }).catch(() => null);
        const io = req?.app?.get('io');
        
        if (io) {
          io.to(`driver-${order.driverId}`).emit('delivery-completed', {
            orderId: orderId,
            deliveryPayAmount: driverPayAmount,
            tipAmount: effectiveTipAmount,
            totalCredited: driverPayAmount + effectiveTipAmount,
            walletBalance: parseFloat(driverWallet.balance)
          });
        }

        if (driver?.pushToken) {
          const notificationTitle = driverPayAmount > 0 && effectiveTipAmount > 0 
            ? 'Delivery Completed - Payment Credited'
            : driverPayAmount > 0 
            ? 'Delivery Fee Credited'
            : 'Tip Credited';
          
          const notificationBody = driverPayAmount > 0 && effectiveTipAmount > 0
            ? `KES ${(driverPayAmount + effectiveTipAmount).toFixed(2)} (Delivery: ${driverPayAmount.toFixed(2)}, Tip: ${effectiveTipAmount.toFixed(2)}) credited for Order #${orderId}`
            : driverPayAmount > 0
            ? `KES ${driverPayAmount.toFixed(2)} delivery fee credited for Order #${orderId}`
            : `KES ${effectiveTipAmount.toFixed(2)} tip credited for Order #${orderId}`;

          pushNotifications.sendPushNotification(driver.pushToken, {
            title: notificationTitle,
            body: notificationBody,
            data: {
              type: 'delivery_completed',
              orderId: orderId,
              deliveryPayAmount: driverPayAmount,
              tipAmount: effectiveTipAmount
            }
          }).catch((pushError) => {
            console.error('❌ Error sending delivery completion push notification:', pushError);
          });
        }

        result.driverCredited = true;
        result.driverCreditAmount = driverPayAmount + effectiveTipAmount;
      } catch (driverError) {
        console.error(`❌ Error crediting driver wallet for Order #${orderId}:`, driverError);
        console.error(`   Error stack:`, driverError.stack);
        result.driverError = driverError.message;
        // Don't throw - allow function to complete even if driver wallet crediting fails
      }
    } else {
      console.log(`⚠️  SKIPPING driver wallet crediting for Order #${orderId}:`);
      console.log(`   Reason: ${!order.driverId ? 'No driverId' : 'No driverPayAmount and no tip'}`);
      console.log(`   driverId: ${order.driverId}`);
      console.log(`   driverPayAmount: ${driverPayAmount.toFixed(2)}`);
      console.log(`   effectiveTipAmount: ${effectiveTipAmount.toFixed(2)}`);
      console.log(`   tipAmount: ${tipAmount.toFixed(2)}`);
      console.log(`   orderTipAmount: ${orderTipAmount.toFixed(2)}`);
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

module.exports = {
  creditWalletsOnDeliveryCompletion
};

