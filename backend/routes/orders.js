const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../models');
const { ensureCustomerFromOrder } = require('../utils/customerSync');
const smsService = require('../services/sms');
const whatsappService = require('../services/whatsapp');
const { findClosestBranch } = require('../utils/branchAssignment');
const { generateReceiptPDF } = require('../services/pdfReceipt');
const pushNotifications = require('../services/pushNotifications');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// Ensure dotenv is loaded for Google Maps API key
if (!process.env.GOOGLE_MAPS_API_KEY && !process.env.REACT_APP_GOOGLE_MAPS_API_KEY) {
  try {
    require('dotenv').config();
  } catch (e) {
    // dotenv might already be loaded
  }
}

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

// Reference point: Taveta Shopping Mall - M 48, Taveta Shopping Mall, Taveta Road, Nairobi
// This is a fallback if no branch is specified - should match branch 4 address
const ORIGIN_ADDRESS = 'Taveta Shopping Mall - M 48, Taveta Shopping Mall, Taveta Road, Nairobi';
const ORIGIN_COORDS = { lat: -1.359872, lng: 36.6641152 };

/**
 * Calculate road distance using Google Distance Matrix API
 * Falls back to Haversine formula if API is unavailable
 * @param {string} destinationAddress - Delivery address
 * @param {string} originAddress - Origin address (branch address). If not provided, uses default ORIGIN_ADDRESS
 * @returns {Promise<{distance: number, isRoadDistance: boolean}>} - Distance in kilometers
 */
const calculateRoadDistance = async (destinationAddress, originAddress = null) => {
  // If no API key, fall back to Haversine if we have coordinates
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('⚠️ Google Maps API key not configured. Cannot calculate road distance.');
    return { distance: null, isRoadDistance: false };
  }

  // Use branch address if provided, otherwise fall back to default
  const origin = originAddress || ORIGIN_ADDRESS;

  if (!origin || !origin.trim()) {
    console.error('❌ Origin address is empty! Cannot calculate distance.');
    return { distance: null, isRoadDistance: false };
  }

  try {
    const distanceMatrixUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destinationAddress)}&key=${GOOGLE_MAPS_API_KEY}&units=metric`;

    console.log(`🌐 Calling Google Distance Matrix API:`);
    console.log(`   Origin: ${origin}`);
    console.log(`   Destination: ${destinationAddress}`);

    const response = await fetch(distanceMatrixUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('❌ Google Distance Matrix API error:', data.status, data.error_message);
      return { distance: null, isRoadDistance: false };
    }

    if (data.rows && data.rows[0] && data.rows[0].elements && data.rows[0].elements[0]) {
      const element = data.rows[0].elements[0];
      
      if (element.status === 'OK' && element.distance) {
        const distanceKm = element.distance.value / 1000; // Convert meters to kilometers
        console.log(`✅ Distance Matrix API returned: ${distanceKm} km (${element.distance.text})`);
        return { distance: parseFloat(distanceKm.toFixed(2)), isRoadDistance: true };
      } else {
        console.warn(`⚠️ Distance Matrix API returned status: ${element.status} for origin "${origin}" to destination "${destinationAddress}"`);
        return { distance: null, isRoadDistance: false };
      }
    }

    console.warn(`⚠️ Distance Matrix API returned invalid response structure`);
    return { distance: null, isRoadDistance: false };
  } catch (error) {
    console.error('❌ Error calling Google Distance Matrix API:', error.message);
    console.error('   Origin:', origin);
    console.error('   Destination:', destinationAddress);
    return { distance: null, isRoadDistance: false };
  }
};

// Helper function to calculate delivery fee
const calculateDeliveryFee = async (items, itemsSubtotal = null, deliveryAddress = null, branchId = null) => {
  try {
    // Get delivery settings
    const [testModeSetting, feeModeSetting, withAlcoholSetting, withoutAlcoholSetting, perKmWithAlcoholSetting, perKmWithoutAlcoholSetting] = await Promise.all([
      db.Settings.findOne({ where: { key: 'deliveryTestMode' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'deliveryFeeMode' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'deliveryFeeWithAlcohol' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'deliveryFeeWithoutAlcohol' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'deliveryFeePerKmWithAlcohol' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'deliveryFeePerKmWithoutAlcohol' } }).catch(() => null)
    ]);

    const isTestMode = testModeSetting?.value === 'true';
    
    if (isTestMode) {
      return { fee: 0, distance: null };
    }

    const feeMode = feeModeSetting?.value || 'fixed';
    const isPerKmMode = feeMode === 'perKm';

    // Check if all items are from Soft Drinks category
    let allSoftDrinks = false;
    if (items && items.length > 0) {
      const drinkIds = items.map(item => item.drinkId);
      const drinks = await db.Drink.findAll({
        where: { id: drinkIds },
        include: [{
          model: db.Category,
          as: 'category'
        }]
      });

      allSoftDrinks = drinks.every(drink => 
        drink.category && drink.category.name === 'Soft Drinks'
      );
    }

    if (isPerKmMode) {
      // Per KM mode: calculate fee based on road distance
      const perKmWithAlcohol = parseFloat(perKmWithAlcoholSetting?.value || '20');
      const perKmWithoutAlcohol = parseFloat(perKmWithoutAlcoholSetting?.value || '15');
      
      const perKmRate = allSoftDrinks ? perKmWithoutAlcohol : perKmWithAlcohol;
      
      // Calculate road distance from branch to delivery address
      let distanceKm = null;
      if (deliveryAddress) {
        try {
          // Get branch address if branchId is provided
          let originAddress = null;
          if (branchId) {
            const branch = await db.Branch.findByPk(branchId);
            if (branch && branch.address) {
              originAddress = branch.address;
              console.log(`📍 Using branch address as origin: ${branch.name} (ID: ${branchId}) - ${originAddress}`);
            } else {
              console.warn(`⚠️ Branch ID ${branchId} not found or has no address, using ORIGIN_ADDRESS`);
            }
          } else {
            console.warn(`⚠️ No branchId provided, using ORIGIN_ADDRESS: ${ORIGIN_ADDRESS}`);
          }
          
          // Use Google Distance Matrix API to calculate road distance from branch to delivery address
          const distanceResult = await calculateRoadDistance(deliveryAddress, originAddress);
          if (distanceResult.isRoadDistance && distanceResult.distance) {
            distanceKm = distanceResult.distance;
            console.log(`✅ Road distance calculated: ${distanceKm} km from ${originAddress || ORIGIN_ADDRESS} to ${deliveryAddress}`);
          } else {
            // Fallback: use minimum 1km if road distance calculation fails
            console.warn(`⚠️ Road distance calculation failed (isRoadDistance: ${distanceResult.isRoadDistance}, distance: ${distanceResult.distance}), using minimum 1km`);
            console.warn(`   Origin: ${originAddress || ORIGIN_ADDRESS}`);
            console.warn(`   Destination: ${deliveryAddress}`);
            distanceKm = 1;
          }
        } catch (distanceError) {
          console.error('Error calculating road distance:', distanceError);
          distanceKm = 1; // Default to minimum 1km on error
        }
      } else {
        distanceKm = 1; // Default to minimum 1km if no address
      }
      
      // Ensure minimum 1km distance
      distanceKm = Math.max(distanceKm || 1, 1);
      
      const fee = distanceKm * perKmRate;
      // Round up to nearest whole number (no decimals)
      return { fee: Math.ceil(fee), distance: distanceKm };
    } else {
      // Fixed mode: use fixed amounts (no distance calculation needed)
      const deliveryFeeWithAlcohol = parseFloat(withAlcoholSetting?.value || '50');
      const deliveryFeeWithoutAlcohol = parseFloat(withoutAlcoholSetting?.value || '30');

      const fee = allSoftDrinks ? deliveryFeeWithoutAlcohol : deliveryFeeWithAlcohol;
      return { fee, distance: null }; // Distance is null for fixed mode
    }
  } catch (error) {
    console.error('Error calculating delivery fee:', error);
    // Default to standard delivery fee on error
    return { fee: 50, distance: null };
  }
};

// Create new order
router.post('/', async (req, res) => {
  try {
    console.log('🔍 RAW REQUEST BODY:', JSON.stringify(req.body, null, 2));
    console.log('🔍 RAW paymentMethod:', req.body.paymentMethod);
    console.log('🔍 RAW paymentType:', req.body.paymentType);
    
    const { 
      customerName, 
      customerPhone, 
      customerEmail, 
      deliveryAddress, 
      items, 
      notes, 
      paymentType, 
      paymentMethod, 
      tipAmount,
      adminOrder,
      territoryId,
      status,
      driverId,
      transactionCode,
      paymentStatus,
      isStop,
      stopDeductionAmount
    } = req.body;
    
    console.log('🔍 DESTRUCTURED paymentMethod:', paymentMethod);
    console.log('🔍 DESTRUCTURED paymentType:', paymentType);
    
    console.log('🛒 Incoming order payload:', JSON.stringify({
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      items,
      paymentType,
      paymentMethod,
      tipAmount
    }, null, 2));
    
    if (!customerName || !customerPhone || !deliveryAddress || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields or empty cart' });
    }

    const normalizedItems = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (!item || item.drinkId === undefined || item.drinkId === null) {
        return res.status(400).json({ error: `Invalid item at position ${index + 1}: missing drinkId` });
      }

      const drinkId = parseInt(item.drinkId, 10);
      if (!Number.isInteger(drinkId) || drinkId <= 0) {
        return res.status(400).json({ error: `Invalid drinkId for item ${index + 1}` });
      }

      const quantity = parseInt(item.quantity, 10);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({ error: `Invalid quantity for item ${index + 1}` });
      }

      const selectedPrice =
        item.selectedPrice !== undefined && item.selectedPrice !== null
          ? parseFloat(item.selectedPrice)
          : item.price !== undefined && item.price !== null
          ? parseFloat(item.price)
          : null;

      normalizedItems.push({
        drinkId,
        quantity,
        selectedPrice: Number.isFinite(selectedPrice) ? selectedPrice : null,
        selectedCapacity: item.selectedCapacity || null
      });
    }

    console.log('🛒 Normalized cart items:', JSON.stringify(normalizedItems, null, 2));

    if (!paymentType || !['pay_now', 'pay_on_delivery'].includes(paymentType)) {
      return res.status(400).json({ error: 'Invalid payment type' });
    }

    // Determine allowed payment methods based on order source
    // For admin orders (especially walk-in), allow cash in addition to card and mobile_money
    // For customer orders, only allow card and mobile_money
    const allowedPaymentMethods = adminOrder 
      ? ['card', 'mobile_money', 'cash'] 
      : ['card', 'mobile_money'];
    
    console.log('💳 Payment validation check:', {
      paymentType,
      paymentMethod,
      adminOrder,
      allowedPaymentMethods,
      isPayNow: paymentType === 'pay_now',
      hasPaymentMethod: !!paymentMethod
    });

    if (paymentType === 'pay_now') {
      // Normalize paymentMethod - trim whitespace and convert to string
      const normalizedPaymentMethod = paymentMethod ? String(paymentMethod).trim() : null;
      
      if (!normalizedPaymentMethod || normalizedPaymentMethod === '') {
        console.error('❌ Payment validation failed: paymentMethod is missing, null, or empty string');
        return res.status(400).json({ error: 'Payment method required when paying now' });
      }
      
      if (!allowedPaymentMethods.includes(normalizedPaymentMethod)) {
        console.error('❌ Payment validation failed:', {
          paymentMethod: normalizedPaymentMethod,
          allowedMethods: allowedPaymentMethods,
          adminOrder: adminOrder
        });
        return res.status(400).json({ error: 'Payment method required when paying now' });
      }
    }
    
    // Use normalized paymentMethod for the rest of the code
    const finalPaymentMethod = (paymentType === 'pay_now' && paymentMethod) ? String(paymentMethod).trim() : paymentMethod;

    let tip = parseFloat(tipAmount) || 0;
    if (tip < 0) {
      return res.status(400).json({ error: 'Tip amount cannot be negative' });
    }

    const [testModeSetting, maxTipSetting] = await Promise.all([
      db.Settings.findOne({ where: { key: 'deliveryTestMode' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'maxTipEnabled' } }).catch(() => null)
    ]);

    const isTestMode = testModeSetting?.value === 'true';
    const maxTipEnabled = maxTipSetting?.value === 'true';

    if (isTestMode && maxTipEnabled && tip > 1) {
      tip = 1;
    }
    
    let createdOrderId = null;
    let assignedDriver = null; // Declare outside try block so it's accessible for socket emission
    const transaction = await db.sequelize.transaction();

    try {
      // Check if purchasePrice column exists in database (once, not per item)
      let hasPurchasePrice = false;
      try {
        const [columns] = await db.sequelize.query(
          "SELECT column_name FROM information_schema.columns WHERE table_name = 'drinks' AND column_name = 'purchasePrice'",
          { transaction }
        );
        hasPurchasePrice = columns.length > 0;
      } catch (schemaError) {
        // If schema query fails, assume purchasePrice doesn't exist
        console.warn('⚠️ Could not check for purchasePrice column, excluding it:', schemaError.message);
      }
      
      // Build attributes list - exclude purchasePrice if it doesn't exist
      const drinkAttributes = ['id', 'name', 'price', 'image', 'isAvailable', 'categoryId', 'subCategoryId', 'brandId', 'originalPrice', 'capacity', 'capacityPricing', 'stock', 'isOnOffer', 'limitedTimeOffer'];
      if (hasPurchasePrice) {
        drinkAttributes.push('purchasePrice');
      }
      
      let totalAmount = 0;
      const orderItems = [];

      for (const item of normalizedItems) {
        const drink = await db.Drink.findByPk(item.drinkId, { 
          transaction,
          attributes: drinkAttributes
        });
        if (!drink) {
          await transaction.rollback();
          return res.status(400).json({ error: `Drink with ID ${item.drinkId} not found` });
        }

        const priceToUse =
          Number.isFinite(item.selectedPrice) && item.selectedPrice > 0
            ? item.selectedPrice
            : parseFloat(drink.price) || 0;

        console.log('[order:create] item', {
          drinkId: item.drinkId,
          quantity: item.quantity,
          selectedPrice: item.selectedPrice,
          drinkPrice: drink.price,
          computedPrice: priceToUse
        });

        const itemTotal = priceToUse * item.quantity;
        totalAmount += itemTotal;

        orderItems.push({
          drinkId: item.drinkId,
          quantity: item.quantity,
          price: priceToUse
        });
      }

      // Find closest branch to delivery address (needed for perKm fee calculation)
      // CRITICAL: Always assign a branch if one exists - this ensures orders are never created without a branch
      let closestBranch = null;
      let branchId = null;
      
      try {
        closestBranch = await findClosestBranch(deliveryAddress);
        branchId = closestBranch ? closestBranch.id : null;
        console.log(`📍 Closest branch found: ${closestBranch ? `${closestBranch.name} (ID: ${branchId})` : 'None'}`);
      } catch (branchError) {
        console.error('❌ Error during branch assignment:', branchError);
        closestBranch = null;
        branchId = null;
      }
      
      // ALWAYS ensure a branch is assigned if any active branches exist
      // This is a critical fallback to ensure orders are never created without a branch
      if (!branchId) {
        console.log('⚠️  No branch assigned from findClosestBranch. Attempting fallback to first active branch...');
        try {
          const fallbackBranch = await db.Branch.findOne({
            where: { isActive: true },
            order: [['id', 'ASC']]
          });
          if (fallbackBranch) {
            branchId = fallbackBranch.id;
            closestBranch = fallbackBranch;
            console.log(`✅ Fallback branch assigned: ${fallbackBranch.name} (ID: ${branchId})`);
          } else {
            console.error('❌ No active branches found in database. Order will be created without branch assignment.');
          }
        } catch (fallbackError) {
          console.error('❌ Fallback branch assignment failed:', fallbackError);
          // Last resort: try one more time without transaction
          try {
            const lastResortBranch = await db.Branch.findOne({
              where: { isActive: true },
              order: [['id', 'ASC']]
            });
            if (lastResortBranch) {
              branchId = lastResortBranch.id;
              closestBranch = lastResortBranch;
              console.log(`✅ Last resort branch assigned: ${lastResortBranch.name} (ID: ${branchId})`);
            }
          } catch (lastError) {
            console.error('❌ Last resort branch assignment also failed:', lastError);
          }
        }
      }
      
      // Final check: log branch assignment status
      if (branchId) {
        console.log(`✅ Branch assignment confirmed: Branch ID ${branchId} will be assigned to order`);
      } else {
        console.warn('⚠️  WARNING: Order will be created WITHOUT a branch assignment. This should not happen if branches exist.');
      }

      // Calculate delivery fee (after branch assignment, as it's needed for perKm mode)
      // CRITICAL: Walk-in orders (POS orders) should NOT have delivery fees
      // Walk-in orders are identified by: customerName === 'POS' OR deliveryAddress === 'In-Store Purchase'
      const isWalkInOrder = customerName === 'POS' || deliveryAddress === 'In-Store Purchase' || 
                           (deliveryAddress && deliveryAddress.includes('In-Store Purchase'));
      
      let deliveryFee = 0;
      let deliveryDistance = null;
      
      if (!isWalkInOrder) {
        // Only calculate delivery fee for non-walk-in orders
        const feeResult = await calculateDeliveryFee(normalizedItems, totalAmount, deliveryAddress, branchId);
        deliveryFee = feeResult.fee || 0;
        deliveryDistance = feeResult.distance || null;
      } else {
        console.log(`🛍️  Walk-in order detected (customerName: ${customerName}, deliveryAddress: ${deliveryAddress}). Skipping delivery fee calculation.`);
      }
      
      const finalTotal = totalAmount + deliveryFee + tip;

      // Only assign driver if explicitly provided (for admin orders)
      // Automatic driver assignment has been removed - drivers must be manually assigned
      if (adminOrder && driverId) {
        assignedDriver = await db.Driver.findByPk(driverId, { transaction });
        if (assignedDriver) {
          console.log(`✅ Admin order: Using provided driver ${assignedDriver.name} (ID: ${assignedDriver.id})`);
        } else {
          console.log(`⚠️  Admin order: Provided driver ID ${driverId} not found. Order will be created without driver assignment.`);
        }
      } else {
        console.log(`ℹ️  No driver assignment - order will be created without a driver. Driver must be manually assigned later.`);
      }

      // Determine final payment status and order status
      // For admin orders, allow setting paymentStatus to 'paid' if provided
      const finalPaymentStatus = (adminOrder && paymentStatus && ['pending', 'paid', 'unpaid'].includes(paymentStatus)) 
        ? paymentStatus 
        : 'pending';
      
      // For admin orders, allow setting status if provided, otherwise default to 'pending'
      const finalOrderStatus = (adminOrder && status && ['pending', 'confirmed', 'out_for_delivery', 'delivered', 'completed', 'cancelled', 'pos_order'].includes(status))
        ? status
        : 'pending';

      // Generate secure tracking token for customer SMS link
      const trackingToken = crypto.randomBytes(32).toString('hex');

      // Normalize phone number to ensure consistent format for searching
      const normalizePhoneForStorage = (phone) => {
        if (!phone) return phone;
        const cleaned = phone.replace(/\D/g, '');
        // Store in 254 format if it's a valid Kenyan number, otherwise store as-is
        if (cleaned.startsWith('254') && cleaned.length === 12) {
          return cleaned;
        } else if (cleaned.startsWith('0') && cleaned.length === 10) {
          return `254${cleaned.slice(1)}`;
        } else if (cleaned.length === 9 && cleaned.startsWith('7')) {
          return `254${cleaned}`;
        }
        return cleaned; // Return cleaned version
      };
      
      const normalizedCustomerPhone = normalizePhoneForStorage(customerPhone);
      console.log(`📱 Phone normalization: "${customerPhone}" -> "${normalizedCustomerPhone}"`);
      
      const order = await db.Order.create({
        customerName,
        customerPhone: normalizedCustomerPhone,
        customerEmail,
        deliveryAddress,
        totalAmount: finalTotal,
        tipAmount: tip,
        notes: (() => {
          let noteParts = [];
          if (notes) noteParts.push(notes);
          if (!isWalkInOrder && deliveryFee > 0) noteParts.push(`Delivery Fee: KES ${deliveryFee.toFixed(2)}`);
          if (tip > 0) noteParts.push(`Tip: KES ${tip.toFixed(2)}`);
          return noteParts.join('\n') || null;
        })(),
        paymentType: paymentType || 'pay_on_delivery',
        paymentMethod: paymentType === 'pay_now' || (adminOrder && finalPaymentStatus === 'paid') ? paymentMethod : null,
        paymentStatus: finalPaymentStatus,
        status: finalOrderStatus,
        driverId: assignedDriver ? assignedDriver.id : null, // Only assign driver if explicitly provided
        driverAccepted: null, // Explicitly set to null so order appears as pending
        branchId: branchId, // Assign closest branch
        adminOrder: adminOrder || false,
        territoryId: territoryId ? parseInt(territoryId) : null,
        isStop: isStop || false,
        stopDeductionAmount: isStop && stopDeductionAmount ? parseFloat(stopDeductionAmount) : null,
        trackingToken: trackingToken,
        deliveryDistance: deliveryDistance || null // Store road distance in kilometers
      }, { transaction });

      createdOrderId = order.id;

      await ensureCustomerFromOrder(order, { transaction });

      for (const item of orderItems) {
        console.log('[order:create] creating order item', item);
        await db.OrderItem.create({
          orderId: order.id,
          ...item
        }, { transaction });
      }

      // For admin orders with paid mobile money payment, create transaction record
      if (adminOrder && finalPaymentStatus === 'paid' && paymentMethod === 'mobile_money' && transactionCode) {
        const tipAmount = parseFloat(tip) || 0;
        const itemsTotal = totalAmount; // Items total without delivery fee and tip
        
        await db.Transaction.create({
          orderId: order.id,
          transactionType: 'payment',
          paymentMethod: 'mobile_money',
          paymentProvider: 'mpesa',
          amount: itemsTotal,
          status: 'completed',
          paymentStatus: 'paid',
          receiptNumber: transactionCode.trim(),
          transactionDate: new Date(),
          notes: `Admin-created order payment. Transaction code: ${transactionCode.trim()}`
        }, { transaction });
        
        console.log(`✅ Created payment transaction for admin order #${order.id} with transaction code: ${transactionCode}`);
      }

      await transaction.commit();
    } catch (error) {
      if (error?.errors) {
        console.error('Error creating order (validation):', error.errors.map((e) => ({
          message: e.message,
          path: e.path,
          value: e.value,
          type: e.type
        })));
      }
      console.error('Error creating order:', error);
      res.status(500).json({ error: error.message });
    }

    const completeOrder = await db.Order.findByPk(createdOrderId, {
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
          attributes: ['id', 'name', 'phoneNumber', 'pushToken']
        }
      ]
    });

    const io = req.app.get('io');
    if (!io) {
      console.error('❌ Socket.IO instance not available - cannot send driver notifications');
    }
    if (io && completeOrder) {
      // For "pay now" orders, don't emit new-order event until payment is confirmed
      // This prevents admin from seeing the order before payment is complete
      if (completeOrder.paymentType !== 'pay_now') {
        io.to('admin').emit('new-order', {
          order: completeOrder,
          timestamp: new Date(),
          message: `New order #${completeOrder.id} from ${completeOrder.customerName}`
        });
      } else {
        console.log(`📢 Skipping 'new-order' socket notification for pay_now order #${completeOrder.id} - will be sent after payment confirmation`);
      }

      // Notify driver if order was assigned to a real driver (not HOLD driver)
      if (completeOrder.driverId && completeOrder.driver && completeOrder.driver.name !== 'HOLD Driver') {
        const driverSocketMap = req.app.get('driverSocketMap');
        const driverSocketId = driverSocketMap ? driverSocketMap.get(parseInt(completeOrder.driverId)) : null;
        
        // Emit to driver room (works even if socket ID changes on reconnect)
        io.to(`driver-${completeOrder.driverId}`).emit('order-assigned', {
          order: completeOrder,
          playSound: true
        });
        console.log(`✅ Socket event sent to driver-${completeOrder.driverId} room for order #${completeOrder.id}`);
        
        // Also emit to specific socket ID if available (for immediate delivery)
        if (driverSocketId) {
          io.to(driverSocketId).emit('order-assigned', {
            order: completeOrder,
            playSound: true
          });
          console.log(`✅ Also sent socket event to driver ${completeOrder.driverId} (socket: ${driverSocketId}) for order #${completeOrder.id}`);
        }
        
        // Send push notification
        if (completeOrder.driver.pushToken) {
          console.log(`📤 Attempting to send push notification for order #${completeOrder.id} to driver ${completeOrder.driver.name} (ID: ${completeOrder.driverId})`);
          console.log(`📤 Push token: ${completeOrder.driver.pushToken.substring(0, 30)}...`);
          try {
            const pushResult = await pushNotifications.sendOrderNotification(
              completeOrder.driver.pushToken,
              completeOrder
            );
            if (pushResult.success) {
              console.log(`✅ Push notification sent successfully to driver ${completeOrder.driver.name} (ID: ${completeOrder.driverId}) for order #${completeOrder.id}`);
              console.log(`✅ Push receipt:`, pushResult.receipt);
            } else {
              console.error(`⚠️ Push notification failed for driver ${completeOrder.driver.name} (ID: ${completeOrder.driverId}) for order #${completeOrder.id}`);
              console.error(`⚠️ Failure details:`, pushResult);
              if (pushResult.receipt) {
                console.error(`⚠️ Push receipt (failure):`, pushResult.receipt);
              }
            }
          } catch (pushError) {
            console.error(`❌ Error sending push notification to driver ${completeOrder.driver.name} (ID: ${completeOrder.driverId}):`, pushError);
            console.error(`❌ Error stack:`, pushError.stack);
          }
        } else {
          console.error(`❌ Driver ${completeOrder.driver.name} (ID: ${completeOrder.driverId}) has NO push token registered - push notification NOT sent for order #${completeOrder.id}`);
          console.error(`❌ This driver needs to open the app and grant notification permissions to receive order assignments.`);
        }
      }
    }
    
    // Send SMS and WhatsApp notifications
    // For "pay now" orders, WhatsApp will be sent after payment confirmation
    // For "pay on delivery" orders, WhatsApp is sent immediately
    try {
      const smsEnabledSetting = await db.Settings.findOne({ 
        where: { key: 'smsEnabled' } 
      }).catch(() => null);
      
      const isSmsEnabledNotifications = smsEnabledSetting?.value !== 'false';
      
      if (!isSmsEnabledNotifications) {
        console.log('📱 SMS notifications are DISABLED - skipping SMS for order #' + completeOrder.id);
      } else {
        console.log('📱 SMS notifications are ENABLED - sending SMS for order #' + completeOrder.id);
        const activeNotifications = await db.OrderNotification.findAll({
          where: { isActive: true }
        });
        
        if (activeNotifications.length > 0) {
          const smsMessage = `Order ID: ${completeOrder.id}\n` +
            `Customer: ${completeOrder.customerName}\n` +
            `Phone: ${completeOrder.customerPhone}\n` +
            `Total: KES ${parseFloat(completeOrder.totalAmount).toFixed(2)}`;
        
          const smsPromises = activeNotifications.map(notification => 
            smsService.sendSMS(notification.phoneNumber, smsMessage)
              .catch(error => {
                console.error(`Failed to send SMS to ${notification.name} (${notification.phoneNumber}):`, error);
                return { success: false, phone: notification.phoneNumber, error: error.message };
              })
          );
          
          Promise.all(smsPromises).then(results => {
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;
            console.log(`📱 SMS notifications sent: ${successful} successful, ${failed} failed`);
          }).catch(error => {
            console.error('Error processing SMS notifications:', error);
          });
        } else {
          console.log('📱 No active notification recipients found');
        }
      }

      // Send SMS confirmation to customer with tracking link
      // Only send for customer orders (not admin orders)
      if (!adminOrder && completeOrder.trackingToken && completeOrder.customerPhone) {
        try {
          // Determine frontend URL based on environment
          const { isProduction } = require('../utils/envDetection');
          let frontendUrl;
          
          // Priority 1: Use FRONTEND_URL environment variable if explicitly set
          if (process.env.FRONTEND_URL) {
            frontendUrl = process.env.FRONTEND_URL;
            console.log(`✅ Using FRONTEND_URL from environment: ${frontendUrl}`);
          }
          // Priority 2: Use production URL if in production/cloud
          else if (isProduction()) {
            frontendUrl = 'https://dialadrink.thewolfgang.tech';
            console.log(`✅ Using production frontend URL: ${frontendUrl}`);
          }
          // Priority 3: Fallback to localhost for local development
          else {
            frontendUrl = 'http://localhost:3000';
            console.log(`⚠️  Using localhost fallback. Set FRONTEND_URL for production: ${frontendUrl}`);
          }
          
          const trackingUrl = `${frontendUrl}/order-tracking?token=${completeOrder.trackingToken}`;
          
          const customerSmsMessage = `Order Confirmed! Order #${completeOrder.id}\n` +
            `Total: KES ${parseFloat(completeOrder.totalAmount).toFixed(2)}\n` +
            `Track your order: ${trackingUrl}`;
          
          console.log(`📱 Sending order confirmation SMS to customer ${completeOrder.customerPhone} for order #${completeOrder.id}`);
          console.log(`📱 Tracking URL: ${trackingUrl}`);
          const smsResult = await smsService.sendSMS(completeOrder.customerPhone, customerSmsMessage);
          
          if (smsResult.success) {
            console.log(`✅ Order confirmation SMS sent successfully to customer ${completeOrder.customerPhone} for order #${completeOrder.id}`);
          } else {
            console.error(`❌ Failed to send order confirmation SMS to customer ${completeOrder.customerPhone} for order #${completeOrder.id}:`, smsResult.error);
          }
        } catch (smsError) {
          console.error(`❌ Error sending order confirmation SMS to customer for order #${completeOrder.id}:`, smsError);
          // Don't fail order creation if SMS fails
        }
      }

      // Send WhatsApp notifications for "pay on delivery" orders immediately
      // For "pay now" orders, WhatsApp will be sent after payment confirmation
      if (completeOrder.paymentType === 'pay_on_delivery') {
        console.log('📱 Sending WhatsApp notifications for pay_on_delivery order #' + completeOrder.id);
        const activeNotifications = await db.OrderNotification.findAll({
          where: { isActive: true }
        });
        
        if (activeNotifications.length > 0) {
          const whatsappMessage = `🛒 New Order #${completeOrder.id}\n\n` +
            `Customer: ${completeOrder.customerName}\n` +
            `Phone: ${completeOrder.customerPhone}\n` +
            `Address: ${completeOrder.deliveryAddress}\n` +
            `Total: KES ${parseFloat(completeOrder.totalAmount).toFixed(2)}\n` +
            `Payment: Pay on Delivery`;
          
          const whatsappPromises = activeNotifications.map(notification => {
            try {
              const result = whatsappService.sendCustomMessage(notification.phoneNumber, whatsappMessage);
              console.log(`📱 WhatsApp link generated for ${notification.name} (${notification.phoneNumber})`);
              return Promise.resolve({ success: true, phone: notification.phoneNumber, whatsappLink: result.whatsappLink });
            } catch (error) {
              console.error(`Failed to generate WhatsApp link for ${notification.name} (${notification.phoneNumber}):`, error);
              return Promise.resolve({ success: false, phone: notification.phoneNumber, error: error.message });
            }
          });
          
          Promise.all(whatsappPromises).then(results => {
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;
            console.log(`📱 WhatsApp notifications generated: ${successful} successful, ${failed} failed`);
            results.forEach(result => {
              if (result.success && result.whatsappLink) {
                console.log(`📱 WhatsApp link for ${result.phone}: ${result.whatsappLink}`);
              }
            });
          }).catch(error => {
            console.error('Error processing WhatsApp notifications:', error);
          });
        } else {
          console.log('📱 No active notification recipients found for WhatsApp');
        }
      } else {
        console.log('📱 Skipping WhatsApp notification for pay_now order #' + completeOrder.id + ' - will be sent after payment confirmation');
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
    
    return res.status(201).json(completeOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Find order by email or phone number (for customer login)
 * This route must be before /:id to avoid conflicts
 */
router.post('/find', async (req, res) => {
  try {
    const { email, phone, orderId } = req.body;

    if (!email && !phone && !orderId) {
      return res.status(400).json({ 
        success: false,
        error: 'Email, phone number, or order ID is required' 
      });
    }

    let whereClause = {};
    
    if (orderId) {
      whereClause.id = orderId;
    } else {
      if (email) {
        whereClause.customerEmail = email;
      }
      if (phone) {
        // Clean phone number for comparison
        const cleanedPhone = phone.replace(/\D/g, '');
        whereClause.customerPhone = {
          [db.Sequelize.Op.like]: `%${cleanedPhone}%`
        };
      }
    }

    const order = await db.Order.findOne({
      where: whereClause,
      include: [{
        model: db.OrderItem,
        as: 'items',
        include: [{
          model: db.Drink,
          as: 'drink'
        }]
      }],
      order: [['createdAt', 'DESC']] // Get most recent order
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found. Please check your email or phone number.'
      });
    }

    res.json({
      success: true,
      order: order
    });
  } catch (error) {
    console.error('Error finding order:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to find order' 
    });
  }
});

// Get order by tracking token (must be before /:id route)
router.get('/track/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Tracking token is required' });
    }

    // Get actual columns that exist in the database for Order
    const [existingOrderColumns] = await db.sequelize.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' ORDER BY column_name"
    );
    const orderColumnNames = new Set(existingOrderColumns.map(col => col.column_name.toLowerCase()));
    
    // Map model attributes to database column names and filter to only existing columns
    const validOrderAttributes = [];
    for (const [attrName, attrDef] of Object.entries(db.Order.rawAttributes)) {
      const dbColumnName = attrDef.field || attrName;
      // Check if the database column exists (case-insensitive)
      if (orderColumnNames.has(dbColumnName.toLowerCase())) {
        validOrderAttributes.push(attrName);
      }
    }

    const order = await db.Order.findOne({
      where: { trackingToken: token },
      attributes: validOrderAttributes,
      include: [{
        model: db.OrderItem,
        as: 'items',
        attributes: ['id', 'orderId', 'drinkId', 'quantity', 'price', 'createdAt', 'updatedAt'],
        include: [{
          model: db.Drink,
          as: 'drink',
          attributes: [
            'id', 'name', 'description', 'price', 'image', 'categoryId', 'subCategoryId', 'brandId',
            'isAvailable', 'isPopular', 'isBrandFocus', 'isOnOffer', 'limitedTimeOffer', 'originalPrice',
            'capacity', 'capacityPricing', 'abv', 'barcode', 'stock', 'createdAt', 'updatedAt'
          ],
          required: false
        }]
      }]
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching order by tracking token:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Generate PDF receipt for an order (must be before /:id route)
router.get('/:id/receipt', async (req, res) => {
  try {
    // Get actual columns that exist in the database for Order
    const [existingOrderColumns] = await db.sequelize.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' ORDER BY column_name"
    );
    const orderColumnNames = new Set(existingOrderColumns.map(col => col.column_name.toLowerCase()));
    
    // Map model attributes to database column names and filter to only existing columns
    const validOrderAttributes = [];
    for (const [attrName, attrDef] of Object.entries(db.Order.rawAttributes)) {
      const dbColumnName = attrDef.field || attrName;
      // Check if the database column exists (case-insensitive)
      if (orderColumnNames.has(dbColumnName.toLowerCase())) {
        validOrderAttributes.push(attrName);
      }
    }
    
    const order = await db.Order.findByPk(req.params.id, {
      attributes: validOrderAttributes,
      include: [
        {
          model: db.OrderItem,
          as: 'items',
          attributes: ['id', 'orderId', 'drinkId', 'quantity', 'price', 'createdAt', 'updatedAt'],
          include: [{
            model: db.Drink,
            as: 'drink',
            attributes: [
              'id', 'name', 'description', 'price', 'image', 'categoryId', 'subCategoryId', 'brandId',
              'isAvailable', 'isPopular', 'isBrandFocus', 'isOnOffer', 'limitedTimeOffer', 'originalPrice',
              'capacity', 'capacityPricing', 'abv', 'barcode', 'stock', 'createdAt', 'updatedAt'
            ],
            required: false
          }]
        },
        {
          model: db.Transaction,
          as: 'transactions',
          where: {
            transactionType: 'payment'
          },
          required: false,
          attributes: ['id', 'orderId', 'transactionType', 'amount', 'paymentStatus', 'receiptNumber', 'transactionDate', 'createdAt', 'updatedAt']
        }
      ]
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Check if request is from admin (has authorization header with admin token)
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const isAdminRequest = authHeader && authHeader.toLowerCase().startsWith('bearer ');
    
    // For admin requests, allow receipt download for complete orders
    // For customer requests, only allow for paid orders
    if (isAdminRequest) {
      // Admin can download receipts for complete orders (paid or completed)
      if (order.status !== 'completed' && order.paymentStatus !== 'paid' && order.status !== 'delivered') {
        return res.status(403).json({ 
          error: 'Receipt is only available for complete, paid, or delivered orders' 
        });
      }
    } else {
      // Customer can download receipts for paid, completed, or delivered orders
      if (order.paymentStatus !== 'paid' && order.status !== 'completed' && order.status !== 'delivered') {
        return res.status(403).json({ 
          error: 'Receipt is only available for paid, completed, or delivered orders' 
        });
      }
    }
    
    // Generate PDF
    const pdf = await generateReceiptPDF(order);
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-order-${order.id}.pdf"`);
    
    // Send PDF
    res.send(pdf);
  } catch (error) {
    console.error('Error generating receipt PDF:', error);
    res.status(500).json({ error: 'Failed to generate receipt. Please try again.' });
  }
});

// Get order by ID
router.get('/:id', async (req, res) => {
  try {
    // Get actual columns that exist in the database for Order
    const [existingOrderColumns] = await db.sequelize.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' ORDER BY column_name"
    );
    const orderColumnNames = new Set(existingOrderColumns.map(col => col.column_name.toLowerCase()));
    
    // Map model attributes to database column names and filter to only existing columns
    const validOrderAttributes = [];
    for (const [attrName, attrDef] of Object.entries(db.Order.rawAttributes)) {
      const dbColumnName = attrDef.field || attrName;
      // Check if the database column exists (case-insensitive)
      if (orderColumnNames.has(dbColumnName.toLowerCase())) {
        validOrderAttributes.push(attrName);
      }
    }
    
    const includes = [{
      model: db.OrderItem,
      as: 'items',
      attributes: ['id', 'orderId', 'drinkId', 'quantity', 'price', 'createdAt', 'updatedAt'],
      include: [{
        model: db.Drink,
        as: 'drink',
        attributes: [
          'id', 'name', 'description', 'price', 'image', 'categoryId', 'subCategoryId', 'brandId',
          'isAvailable', 'isPopular', 'isBrandFocus', 'isOnOffer', 'limitedTimeOffer', 'originalPrice',
          'capacity', 'capacityPricing', 'abv', 'barcode', 'stock', 'createdAt', 'updatedAt'
        ],
        required: false
      }]
    }];
    
    // Branch association removed - no longer relevant/displayed
    
    const order = await db.Order.findByPk(req.params.id, {
      attributes: validOrderAttributes,
      include: includes
    });
    
    if (!order) {
      return sendError(res, 'Order not found', 404);
    }
    
    // Map items to orderItems for compatibility
    const orderData = order.toJSON();
    if (orderData.items) {
      orderData.orderItems = orderData.items;
    }
    
    // Calculate delivery fee from order data (totalAmount - tipAmount - itemsTotal)
    // Use the same calculation logic as getOrderFinancialBreakdown for consistency
    const itemsTotalRaw = (orderData.items || []).reduce((sum, item) => {
      const price = parseFloat(item.price || 0);
      const quantity = parseFloat(item.quantity || 0);
      return sum + (price * quantity);
    }, 0);
    const itemsTotal = Number(itemsTotalRaw.toFixed(2));
    const tipAmount = parseFloat(orderData.tipAmount || 0);
    const totalAmount = parseFloat(orderData.totalAmount || 0);
    const deliveryFeeRaw = totalAmount - tipAmount - itemsTotal;
    const deliveryFee = Number(Math.max(deliveryFeeRaw, 0).toFixed(2));
    
    orderData.deliveryFee = deliveryFee;
    orderData.itemsTotal = itemsTotal;
    
    // For completed orders, include payment transaction data (transactionCode and transactionDate)
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
          orderData.transactionCode = txData.receiptNumber;
          orderData.transactionDate = txData.transactionDate;
        }
      } catch (txError) {
        // If transaction lookup fails, continue without transaction data
        console.warn(`Could not fetch transaction for order ${orderData.id}:`, txError.message);
      }
    }
    
    sendSuccess(res, orderData);
  } catch (error) {
    console.error('Error fetching order:', error);
    sendError(res, error.message, 500);
  }
});

// Update order status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, reason } = req.body;
    const validStatuses = ['pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const order = await db.Order.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    let trimmedReason = null;
    if (status === 'cancelled') {
      trimmedReason = typeof reason === 'string' ? reason.trim() : '';
      if (!trimmedReason) {
        return res.status(400).json({ error: 'Cancellation reason is required' });
      }

      if (trimmedReason.length > 100) {
        return res.status(400).json({ error: 'Cancellation reason must be 100 characters or fewer' });
      }

      const cancellationNote = `[${new Date().toISOString()}] Cancelled by admin. Reason: ${trimmedReason}`;
      order.notes = order.notes ? `${order.notes}\n${cancellationNote}` : cancellationNote;
    }
    
    order.status = status;
    await order.save();

    if (trimmedReason) {
      order.setDataValue('cancellationReason', trimmedReason);
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Find all orders by email or phone number (for customer orders page)
 */
router.post('/find-all', async (req, res) => {
  try {
    const { email, phone, customerId } = req.body;
    
    console.log(`🔍 [FIND-ALL] Request received:`, { email, phone, customerId });
    console.log(`🔍 [FIND-ALL] Raw body:`, JSON.stringify(req.body, null, 2));

    if (!email && !phone && !customerId) {
      return res.status(400).json({ 
        success: false,
        error: 'Email, phone number, or customer ID is required' 
      });
    }

    let whereClause = {};
    const allConditions = [];
    const phoneConditions = []; // Initialize phoneConditions array
    
    // If customerId is provided, use it directly (most reliable)
    if (customerId) {
      // Note: We don't have a direct customerId field in orders, but we can check via Customer table
      // For now, we'll still use email/phone matching, but customerId can be used for validation
      console.log(`🔍 Customer ID provided: ${customerId} (will use email/phone matching)`);
    }
    
    if (email) {
      allConditions.push({ customerEmail: email });
    }
    
    if (phone) {
      // Build phone lookup variants to handle different formats
      const cleanedPhone = phone.replace(/\D/g, '');
      const normalizedPhone = cleanedPhone.startsWith('254') && cleanedPhone.length === 12
        ? cleanedPhone
        : cleanedPhone.startsWith('0') && cleanedPhone.length === 10
        ? `254${cleanedPhone.slice(1)}`
        : cleanedPhone.length === 9 && cleanedPhone.startsWith('7')
        ? `254${cleanedPhone}`
        : cleanedPhone;
      
      // Build phone variants for comprehensive matching
      const phoneVariants = new Set();
      phoneVariants.add(cleanedPhone);
      phoneVariants.add(normalizedPhone);
      
      if (cleanedPhone.startsWith('254')) {
        phoneVariants.add('0' + cleanedPhone.slice(3));
        phoneVariants.add(cleanedPhone.slice(3));
      }
      if (cleanedPhone.startsWith('0') && cleanedPhone.length === 10) {
        phoneVariants.add(`254${cleanedPhone.slice(1)}`);
        phoneVariants.add(cleanedPhone.slice(1));
      }
      if (cleanedPhone.length === 9 && cleanedPhone.startsWith('7')) {
        phoneVariants.add(`0${cleanedPhone}`);
        phoneVariants.add(`254${cleanedPhone}`);
      }
      
      const uniqueVariants = Array.from(phoneVariants).filter(Boolean);
      
      console.log(`🔍 Finding orders for phone: ${phone}`);
      console.log(`   Cleaned: ${cleanedPhone}`);
      console.log(`   Normalized: ${normalizedPhone}`);
      console.log(`   Variants: ${uniqueVariants.join(', ')}`);
      
      // Build phone conditions - use LIKE for flexible matching
      // Also try matching just the last 9 digits (core phone number without prefix)
      const corePhoneDigits = cleanedPhone.length >= 9 
        ? cleanedPhone.slice(-9) // Last 9 digits (e.g., "727893741" from "0727893741" or "254727893741")
        : cleanedPhone;
      
      // Build phone conditions with multiple matching strategies
      uniqueVariants.forEach(variant => {
        // LIKE match (handles partial matches)
        phoneConditions.push({
          customerPhone: {
            [db.Sequelize.Op.like]: `%${variant}%`
          }
        });
        
        // Exact match (handles exact phone numbers)
        phoneConditions.push({
          customerPhone: variant
        });
        
        // Trimmed match (handles phones with leading/trailing spaces)
        phoneConditions.push(
          db.sequelize.where(
            db.sequelize.fn('TRIM', db.sequelize.col('customerPhone')),
            variant
          )
        );
      });
      
      // Also add condition to match core phone digits (last 9 digits) - handles cases where phone is stored differently
      if (corePhoneDigits.length >= 9 && !uniqueVariants.includes(corePhoneDigits)) {
        phoneConditions.push({
          customerPhone: {
            [db.Sequelize.Op.like]: `%${corePhoneDigits}%`
          }
        });
        phoneConditions.push({
          customerPhone: corePhoneDigits
        });
        phoneConditions.push(
          db.sequelize.where(
            db.sequelize.fn('TRIM', db.sequelize.col('customerPhone')),
            corePhoneDigits
          )
        );
      }
      
      console.log(`   Phone conditions count: ${phoneConditions.length}`);
      console.log(`   Core digits (last 9): ${corePhoneDigits}`);
      
      // If multiple phone variants, combine with OR
      if (phoneConditions.length > 1) {
        allConditions.push({
          [db.Sequelize.Op.or]: phoneConditions
        });
      } else if (phoneConditions.length === 1) {
        allConditions.push(phoneConditions[0]);
      }
    }
    
    // Combine email and phone conditions with OR (customer can match by email OR phone)
    if (allConditions.length > 1) {
      whereClause[db.Sequelize.Op.or] = allConditions;
    } else if (allConditions.length === 1) {
      whereClause = allConditions[0];
    }

    console.log('🔍 Final whereClause structure:', JSON.stringify(whereClause, null, 2));
    console.log('🔍 All conditions count:', allConditions.length);
    console.log('🔍 Email condition:', email ? 'YES' : 'NO');
    console.log('🔍 Phone condition:', phone ? 'YES' : 'NO');

    // Get actual columns that exist in the database
    const [existingColumns] = await db.sequelize.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' ORDER BY column_name"
    );
    const columnNames = new Set(existingColumns.map(col => col.column_name.toLowerCase()));
    
    // Map model attributes to database column names and filter to only existing columns
    const validAttributes = [];
    for (const [attrName, attrDef] of Object.entries(db.Order.rawAttributes)) {
      const dbColumnName = attrDef.field || attrName;
      // Check if the database column exists (case-insensitive)
      if (columnNames.has(dbColumnName.toLowerCase())) {
        validAttributes.push(attrName);
      }
    }
    
    // Get all orders - only select columns that exist in database
    const orders = await db.Order.findAll({
      where: whereClause,
      attributes: validAttributes,
      logging: (sql) => {
        console.log('📊 SQL Query:', sql);
      },
      include: [
        {
          model: db.OrderItem,
          as: 'items',
          attributes: ['id', 'orderId', 'drinkId', 'quantity', 'price', 'createdAt', 'updatedAt'],
          include: [{
            model: db.Drink,
            as: 'drink',
            attributes: [
              'id', 'name', 'description', 'price', 'image', 'categoryId', 'subCategoryId', 'brandId',
              'isAvailable', 'isPopular', 'isBrandFocus', 'isOnOffer', 'limitedTimeOffer', 'originalPrice',
              'capacity', 'capacityPricing', 'abv', 'barcode', 'stock', 'createdAt', 'updatedAt'
            ],
            required: false
          }]
        },
        {
          model: db.Driver,
          as: 'driver',
          attributes: ['id', 'name', 'phoneNumber'],
          required: false // Left join - don't require driver to exist
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    console.log(`✅ Found ${orders.length} orders for ${email ? `email: ${email}` : ''} ${phone ? `phone: ${phone}` : ''}`);
    
    // Log details of each found order for debugging
    if (orders.length > 0) {
      console.log('📋 Found order IDs:', orders.map(o => o.id).join(', '));
      console.log('📋 Found order details:');
      orders.forEach(order => {
        console.log(`   Order ${order.id}: customerPhone="${order.customerPhone}", customerEmail="${order.customerEmail || '(null)'}", customerName="${order.customerName}"`);
      });
    } else {
      console.log('⚠️ No orders found. Checking for potential matches...');
    }
    
    // Always check Order 304 if phone is provided (for debugging)
    if (phone) {
      // Rebuild phone variants for debugging
      const cleanedPhone = phone.replace(/\D/g, '');
      const normalizedPhone = cleanedPhone.startsWith('254') && cleanedPhone.length === 12
        ? cleanedPhone
        : cleanedPhone.startsWith('0') && cleanedPhone.length === 10
        ? `254${cleanedPhone.slice(1)}`
        : cleanedPhone.length === 9 && cleanedPhone.startsWith('7')
        ? `254${cleanedPhone}`
        : cleanedPhone;
      
      const phoneVariants = new Set();
      phoneVariants.add(cleanedPhone);
      phoneVariants.add(normalizedPhone);
      
      if (cleanedPhone.startsWith('254')) {
        phoneVariants.add('0' + cleanedPhone.slice(3));
        phoneVariants.add(cleanedPhone.slice(3));
      }
      if (cleanedPhone.startsWith('0') && cleanedPhone.length === 10) {
        phoneVariants.add(`254${cleanedPhone.slice(1)}`);
        phoneVariants.add(cleanedPhone.slice(1));
      }
      if (cleanedPhone.length === 9 && cleanedPhone.startsWith('7')) {
        phoneVariants.add(`0${cleanedPhone}`);
        phoneVariants.add(`254${cleanedPhone}`);
      }
      const debugVariants = Array.from(phoneVariants).filter(Boolean);
      
      const directCheck = await db.Order.findOne({
        where: { id: 304 },
        attributes: ['id', 'customerPhone', 'customerEmail', 'customerName']
      });
      if (directCheck) {
        console.log(`🔍 DEBUG: Direct check for Order 304:`);
        console.log(`   Order 304 customerPhone: "${directCheck.customerPhone}"`);
        console.log(`   Order 304 customerEmail: "${directCheck.customerEmail || '(null)'}"`);
        console.log(`   Order 304 customerName: "${directCheck.customerName}"`);
        console.log(`   Search phone: "${phone}"`);
        console.log(`   Search email: "${email || '(null)'}"`);
        console.log(`   Phone variants generated: ${debugVariants.join(', ')}`);
        
        // Check if Order 304 would match
        const phoneMatches = debugVariants.some(variant => 
          directCheck.customerPhone && (
            directCheck.customerPhone === variant ||
            directCheck.customerPhone.includes(variant) ||
            variant.includes(directCheck.customerPhone)
          )
        );
        const emailMatches = email && directCheck.customerEmail && directCheck.customerEmail.toLowerCase() === email.toLowerCase();
        console.log(`   Order 304 would match by phone: ${phoneMatches}`);
        console.log(`   Order 304 would match by email: ${emailMatches}`);
        console.log(`   Order 304 should be included: ${phoneMatches || emailMatches}`);
      } else {
        console.log(`🔍 DEBUG: Order 304 not found in database`);
      }
    }
    
    if (orders.length > 0) {
      const orderIds = orders.map(o => o.id);
      console.log(`   Order IDs found:`, orderIds.join(', '));
      if (phone) {
        console.log(`   Order customerPhone values:`, orders.map(o => ({ id: o.id, phone: o.customerPhone })));
        
        // Check if specific orders are missing
        const missingOrderIds = [293, 304];
        const foundMissing = missingOrderIds.filter(id => orderIds.includes(id));
        const actuallyMissing = missingOrderIds.filter(id => !orderIds.includes(id));
        
        if (actuallyMissing.length > 0) {
          console.log(`   ⚠️  Missing order IDs: ${actuallyMissing.join(', ')}`);
          console.log(`   🔍 Checking why these orders are missing...`);
          
          // Query the missing orders directly to see their phone format
          const missingOrders = await db.Order.findAll({
            where: {
              id: actuallyMissing
            },
            attributes: ['id', 'customerPhone', 'customerEmail', 'customerName']
          });
          
          missingOrders.forEach(missingOrder => {
            const missingPhone = missingOrder.customerPhone ? missingOrder.customerPhone.replace(/\D/g, '') : '';
            const searchPhone = phone.replace(/\D/g, '');
            console.log(`   Order ${missingOrder.id}:`);
            console.log(`     Stored phone: "${missingOrder.customerPhone}" (cleaned: "${missingPhone}")`);
            console.log(`     Search phone: "${phone}" (cleaned: "${searchPhone}")`);
            console.log(`     Search variants: ${uniqueVariants.join(', ')}`);
            console.log(`     Core digits match: ${missingPhone.includes(corePhoneDigits) || corePhoneDigits.includes(missingPhone) ? '✅ YES' : '❌ NO'}`);
            console.log(`     Any variant match: ${uniqueVariants.some(v => missingPhone.includes(v) || v.includes(missingPhone)) ? '✅ YES' : '❌ NO'}`);
          });
        }
      }
    } else {
      console.log(`   ⚠️  No orders found. Check if phone number format matches stored format.`);
      if (phone) {
        console.log(`   Searched with variants: ${uniqueVariants.join(', ')}`);
      }
    }

    res.json({
      success: true,
      orders: orders
    });
  } catch (error) {
    console.error('Error finding orders:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    res.status(500).json({ 
      success: false,
      error: 'Failed to find orders',
      message: error.message || 'Unknown error occurred'
    });
  }
});

// Calculate order cost
router.get('/:id/cost', async (req, res) => {
  try {
    const { calculateFullOrderCost, calculateOrderCreationCost, calculatePaymentCost, calculateStatusUpdateCost, COSTS } = require('../services/orderCostCalculator');
    const USD_TO_KES_RATE = 130; // Exchange rate: 1 USD = 130 KES
    
    const order = await db.Order.findByPk(req.params.id, {
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
          attributes: ['id', 'name']
        }
      ]
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Get order data
    const orderData = {
      id: order.id,
      items: order.items || [],
      driverId: order.driverId,
      paymentType: order.paymentType,
      paymentMethod: order.paymentMethod,
      status: order.status,
      smsNotificationsSent: 0 // This would need to be tracked separately
    };
    
    // Calculate costs
    const creationCost = calculateOrderCreationCost(orderData);
    
    let paymentCost = null;
    if (order.paymentType === 'pay_now' && order.paymentMethod === 'mobile_money') {
      paymentCost = calculatePaymentCost(order.id, 'mobile_money');
    }
    
    // Determine status updates that occurred
    const statusFlow = ['pending', 'confirmed', 'out_for_delivery', 'delivered', 'completed'];
    const currentStatusIndex = statusFlow.indexOf(order.status);
    const statusUpdates = statusFlow.slice(1, currentStatusIndex + 1);
    
    const statusUpdateCost = calculateStatusUpdateCost(order.id, statusUpdates);
    
    // Calculate total
    const totalCost = 
      creationCost.costs.total +
      (paymentCost ? paymentCost.costs.total : 0) +
      statusUpdateCost.costs.total;
    
    res.json({
      orderId: order.id,
      orderStatus: order.status,
      paymentType: order.paymentType,
      paymentMethod: order.paymentMethod,
      costBreakdown: {
        creation: {
          cost: {
            kes: creationCost.costs.total,
            usd: (creationCost.costs.total / USD_TO_KES_RATE).toFixed(6),
            formatted: `KES ${creationCost.costs.total.toFixed(4)} ($${(creationCost.costs.total / USD_TO_KES_RATE).toFixed(6)})`
          },
          operations: {
            database: {
              reads: creationCost.costs.database.reads,
              writes: creationCost.costs.database.writes,
              transactions: creationCost.costs.database.transactions
            },
            externalAPIs: {
              sms: creationCost.costs.externalAPIs.sms,
              pushNotifications: creationCost.costs.externalAPIs.pushNotifications
            },
            socket: creationCost.costs.socket.messages
          }
        },
        payment: paymentCost ? {
          cost: {
            kes: paymentCost.costs.total,
            usd: (paymentCost.costs.total / USD_TO_KES_RATE).toFixed(6),
            formatted: `KES ${paymentCost.costs.total.toFixed(4)} ($${(paymentCost.costs.total / USD_TO_KES_RATE).toFixed(6)})`
          },
          operations: {
            database: {
              reads: paymentCost.costs.database.reads,
              writes: paymentCost.costs.database.writes
            },
            externalAPIs: {
              mpesaStkPush: paymentCost.costs.externalAPIs.mpesaStkPush,
              mpesaCallbacks: paymentCost.costs.externalAPIs.mpesaCallbacks
            },
            socket: paymentCost.costs.socket.messages
          }
        } : null,
        statusUpdates: {
          cost: {
            kes: statusUpdateCost.costs.total,
            usd: (statusUpdateCost.costs.total / USD_TO_KES_RATE).toFixed(6),
            formatted: `KES ${statusUpdateCost.costs.total.toFixed(4)} ($${(statusUpdateCost.costs.total / USD_TO_KES_RATE).toFixed(6)})`
          },
          statuses: statusUpdates,
          operations: {
            database: {
              reads: statusUpdateCost.costs.database.reads,
              writes: statusUpdateCost.costs.database.writes
            },
            socket: statusUpdateCost.costs.socket.messages
          }
        }
      },
      totalCost: {
        kes: totalCost,
        usd: (totalCost / USD_TO_KES_RATE).toFixed(6),
        formatted: `KES ${totalCost.toFixed(4)} ($${(totalCost / USD_TO_KES_RATE).toFixed(6)})`
      },
      summary: {
        totalDatabaseOperations: 
          creationCost.costs.database.reads + creationCost.costs.database.writes + creationCost.costs.database.transactions +
          (paymentCost ? paymentCost.costs.database.reads + paymentCost.costs.database.writes : 0) +
          statusUpdateCost.costs.database.reads + statusUpdateCost.costs.database.writes,
        totalExternalAPICalls:
          creationCost.costs.externalAPIs.sms + creationCost.costs.externalAPIs.mpesaStkPush + creationCost.costs.externalAPIs.pushNotifications +
          (paymentCost ? paymentCost.costs.externalAPIs.mpesaStkPush + paymentCost.costs.externalAPIs.mpesaCallbacks : 0),
        totalSocketMessages:
          creationCost.costs.socket.messages +
          (paymentCost ? paymentCost.costs.socket.messages : 0) +
          statusUpdateCost.costs.socket.messages,
        computeTime: {
          milliseconds: creationCost.duration.milliseconds + 
                       (paymentCost ? paymentCost.duration.milliseconds : 0) +
                       statusUpdateCost.duration.milliseconds,
          seconds: ((creationCost.duration.milliseconds + 
                    (paymentCost ? paymentCost.duration.milliseconds : 0) +
                    statusUpdateCost.duration.milliseconds) / 1000).toFixed(2)
        }
      }
    });
  } catch (error) {
    console.error('Error calculating order cost:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
