const db = require('../models');
const { Op } = require('sequelize');
const { getOrderFinancialBreakdown } = require('./orderFinancials');
const pushNotifications = require('../services/pushNotifications');
const { getOrCreateHoldDriver } = require('./holdDriver');

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
      throw new Error(`Order ${orderId} not found`);
    }

    // Check if wallets have already been credited for this order
    // We check by looking at transactions - if they're already linked to wallets, they've been credited
    const existingDriverDeliveryTxn = order.driverId ? await db.Transaction.findOne({
      where: {
        orderId: orderId,
        transactionType: 'delivery_pay',
        driverId: order.driverId,
        driverWalletId: { [Op.not]: null }
      },
      transaction: dbTransaction
    }) : null;

    const existingTipTxn = await db.Transaction.findOne({
      where: {
        orderId: orderId,
        transactionType: 'tip',
        driverWalletId: { [Op.not]: null }
      },
      transaction: dbTransaction
    });

    // Check if merchant wallet was already credited by checking if order was counted
    // This is a simple heuristic - if driver transactions are linked, assume merchant was also credited
    if ((order.driverId && existingDriverDeliveryTxn) || existingTipTxn) {
      console.log(`ℹ️  Wallets appear to already be credited for Order #${orderId}`);
      await dbTransaction.rollback();
      return {
        alreadyCredited: true,
        orderId
      };
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
    const tipAmount = parseFloat(breakdown.tipAmount) || 0;

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
    if (order.driverId && (driverPayAmount > 0.009 || tipAmount > 0.009)) {
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
          // Create or update driver delivery transaction
          let driverDeliveryTransaction = await db.Transaction.findOne({
            where: {
              orderId: orderId,
              transactionType: 'delivery_pay',
              driverId: order.driverId
            },
            transaction: dbTransaction,
            lock: dbTransaction.LOCK.UPDATE
          });

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
            await driverDeliveryTransaction.update(driverDeliveryPayload, { transaction: dbTransaction });
            await driverDeliveryTransaction.reload({ transaction: dbTransaction });
            console.log(`✅ Updated driver delivery transaction #${driverDeliveryTransaction.id} for Order #${orderId}`);
          } else {
            // Check for pending transaction with null driverId (created before driver assignment)
            driverDeliveryTransaction = await db.Transaction.findOne({
              where: {
                orderId: orderId,
                transactionType: 'delivery_pay',
                driverId: null,
                driverWalletId: null
              },
              transaction: dbTransaction,
              lock: dbTransaction.LOCK.UPDATE
            });

            if (driverDeliveryTransaction) {
              await driverDeliveryTransaction.update(driverDeliveryPayload, { transaction: dbTransaction });
              await driverDeliveryTransaction.reload({ transaction: dbTransaction });
              console.log(`✅ Updated pending driver delivery transaction #${driverDeliveryTransaction.id} for Order #${orderId}`);
            } else {
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
        if (tipAmount > 0.009) {
          // Create or update tip transaction
          let tipTransaction = await db.Transaction.findOne({
            where: {
              orderId: orderId,
              transactionType: 'tip'
            },
            transaction: dbTransaction,
            lock: dbTransaction.LOCK.UPDATE
          });

          const paymentMethod = paymentTransaction.paymentMethod || order.paymentMethod || 'mobile_money';
          const paymentProvider = paymentTransaction.paymentProvider || 'mpesa';

          const tipPayload = {
            orderId: orderId,
            transactionType: 'tip',
            paymentMethod,
            paymentProvider,
            amount: tipAmount,
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
            await tipTransaction.update(tipPayload, { transaction: dbTransaction });
            await tipTransaction.reload({ transaction: dbTransaction });
            console.log(`✅ Updated tip transaction #${tipTransaction.id} for Order #${orderId}`);
          } else {
            tipTransaction = await db.Transaction.create(tipPayload, { transaction: dbTransaction });
            console.log(`✅ Created tip transaction #${tipTransaction.id} for Order #${orderId}`);
          }

          // Credit driver wallet
          const balanceAfterDeliveryPay = oldBalance + driverPayAmount;
          await driverWallet.update({
            balance: balanceAfterDeliveryPay + tipAmount,
            totalTipsReceived: oldTotalTipsReceived + tipAmount,
            totalTipsCount: oldTipsCount + 1
          }, { transaction: dbTransaction });

          console.log(`✅ Credited tip for Order #${orderId}:`);
          console.log(`   Amount: KES ${tipAmount.toFixed(2)}`);
          console.log(`   Wallet balance: ${balanceAfterDeliveryPay.toFixed(2)} → ${(balanceAfterDeliveryPay + tipAmount).toFixed(2)}`);
        }

        await driverWallet.reload({ transaction: dbTransaction });

        console.log(`✅ Credited driver wallet for Order #${orderId}:`);
        console.log(`   Delivery fee: KES ${driverPayAmount.toFixed(2)}`);
        console.log(`   Tip: KES ${tipAmount.toFixed(2)}`);
        console.log(`   Total: KES ${(driverPayAmount + tipAmount).toFixed(2)}`);
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
            tipAmount: tipAmount,
            totalCredited: driverPayAmount + tipAmount,
            walletBalance: parseFloat(driverWallet.balance)
          });
        }

        if (driver?.pushToken) {
          const notificationTitle = driverPayAmount > 0 && tipAmount > 0 
            ? 'Delivery Completed - Payment Credited'
            : driverPayAmount > 0 
            ? 'Delivery Fee Credited'
            : 'Tip Credited';
          
          const notificationBody = driverPayAmount > 0 && tipAmount > 0
            ? `KES ${(driverPayAmount + tipAmount).toFixed(2)} (Delivery: ${driverPayAmount.toFixed(2)}, Tip: ${tipAmount.toFixed(2)}) credited for Order #${orderId}`
            : driverPayAmount > 0
            ? `KES ${driverPayAmount.toFixed(2)} delivery fee credited for Order #${orderId}`
            : `KES ${tipAmount.toFixed(2)} tip credited for Order #${orderId}`;

          pushNotifications.sendPushNotification(driver.pushToken, {
            title: notificationTitle,
            body: notificationBody,
            data: {
              type: 'delivery_completed',
              orderId: orderId,
              deliveryPayAmount: driverPayAmount,
              tipAmount: tipAmount
            }
          }).catch((pushError) => {
            console.error('❌ Error sending delivery completion push notification:', pushError);
          });
        }

        result.driverCredited = true;
        result.driverCreditAmount = driverPayAmount + tipAmount;
      } catch (driverError) {
        console.error(`❌ Error crediting driver wallet for Order #${orderId}:`, driverError);
        result.driverError = driverError.message;
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
  }
};

module.exports = {
  creditWalletsOnDeliveryCompletion
};

