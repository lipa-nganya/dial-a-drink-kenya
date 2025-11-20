const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const mpesaService = require('../services/mpesa');

/**
 * Credit merchant wallet for POS order
 * POS orders don't have delivery fees, so we only credit the order total
 */
const creditMerchantWalletForPOSOrder = async (orderId, totalAmount, transaction = null) => {
  try {
    let adminWallet = await db.AdminWallet.findOne({ where: { id: 1 } }, { transaction });
    if (!adminWallet) {
      adminWallet = await db.AdminWallet.create({
        id: 1,
        balance: 0,
        totalRevenue: 0,
        totalOrders: 0
      }, { transaction });
    }

    const oldBalance = parseFloat(adminWallet.balance) || 0;
    const oldTotalRevenue = parseFloat(adminWallet.totalRevenue) || 0;
    const oldTotalOrders = adminWallet.totalOrders || 0;

    await adminWallet.update({
      balance: oldBalance + totalAmount,
      totalRevenue: oldTotalRevenue + totalAmount,
      totalOrders: oldTotalOrders + 1
    }, { transaction });

    await adminWallet.reload({ transaction });

    console.log(`✅ Credited merchant wallet for POS Order #${orderId}:`);
    console.log(`   Order total: KES ${totalAmount.toFixed(2)}`);
    console.log(`   Wallet balance: ${oldBalance.toFixed(2)} → ${parseFloat(adminWallet.balance).toFixed(2)}`);
    console.log(`   Total revenue: ${oldTotalRevenue.toFixed(2)} → ${parseFloat(adminWallet.totalRevenue).toFixed(2)}`);
    console.log(`   Total orders: ${oldTotalOrders} → ${adminWallet.totalOrders}`);

    return {
      success: true,
      merchantCreditAmount: totalAmount,
      walletBalance: parseFloat(adminWallet.balance)
    };
  } catch (error) {
    console.error(`❌ Error crediting merchant wallet for POS Order #${orderId}:`, error);
    throw error;
  }
};

// In-memory cart storage (in production, use Redis or database)
// Key: 'pos_cart', Value: Array of cart items
let posCart = [];

/**
 * Build phone number variants for lookup (handles Kenyan phone formats)
 */
function buildPhoneLookupVariants(phone) {
  const variants = new Set();
  if (!phone) return [];
  
  const digitsOnly = phone.replace(/\D/g, '');
  if (!digitsOnly) return [];
  
  variants.add(digitsOnly);
  
  // Handle Kenyan phone formats
  if (digitsOnly.startsWith('254') && digitsOnly.length === 12) {
    // 254712345678 -> 0712345678, 712345678
    variants.add('0' + digitsOnly.slice(3));
    variants.add(digitsOnly.slice(3));
  } else if (digitsOnly.startsWith('0') && digitsOnly.length === 10) {
    // 0712345678 -> 254712345678, 712345678
    variants.add('254' + digitsOnly.slice(1));
    variants.add(digitsOnly.slice(1));
  } else if (digitsOnly.length === 9 && digitsOnly.startsWith('7')) {
    // 712345678 -> 254712345678, 0712345678
    variants.add('254' + digitsOnly);
    variants.add('0' + digitsOnly);
  }
  
  return Array.from(variants).filter(Boolean);
}

/**
 * Lookup customer by phone number
 * GET /api/pos/customer/:phoneNumber
 */
router.get('/customer/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const variants = buildPhoneLookupVariants(phoneNumber);
    
    console.log(`🔍 POS: Looking up customer with phone: ${phoneNumber}`);
    console.log(`📋 Phone variants:`, variants);
    
    if (variants.length === 0) {
      console.log('❌ No valid phone variants found');
      return res.json({ customer: null });
    }
    
    // First try to find in Customer table - try exact match and LIKE patterns
    const customerConditions = [];
    variants.forEach(variant => {
      customerConditions.push({ phone: variant });
      customerConditions.push({ phone: { [Op.iLike]: `%${variant}%` } });
    });
    
    // Also try with trimmed phone using raw SQL
    variants.forEach(variant => {
      customerConditions.push(
        db.sequelize.literal(`TRIM(phone) = '${variant.replace(/'/g, "''")}'`)
      );
    });
    
    let customer = await db.Customer.findOne({
      where: {
        [Op.or]: customerConditions
      }
    });
    
    console.log(`👤 Customer lookup result:`, customer ? `Found: ${customer.customerName || customer.username} (${customer.phone})` : 'Not found in Customer table');
    
    // If not found in Customer table, check Orders table for most recent order with this phone
    if (!customer) {
      const orderConditions = [];
      variants.forEach(variant => {
        orderConditions.push({ customerPhone: variant });
        orderConditions.push({ customerPhone: { [Op.iLike]: `%${variant}%` } });
      });
      
      // Also try with trimmed phone using raw SQL
      variants.forEach(variant => {
        orderConditions.push(
          db.sequelize.literal(`TRIM("customerPhone") = '${variant.replace(/'/g, "''")}'`)
        );
      });
      
      const order = await db.Order.findOne({
        where: {
          [Op.or]: orderConditions
        },
        order: [['createdAt', 'DESC']],
        attributes: ['customerName', 'customerPhone', 'customerEmail']
      });
      
      console.log(`📦 Order lookup result:`, order ? `Found: ${order.customerName} (${order.customerPhone})` : 'Not found in Orders table');
      
      if (order) {
        return res.json({
          customer: {
            name: order.customerName,
            phone: order.customerPhone,
            email: order.customerEmail
          }
        });
      }
    } else {
      const customerData = {
        name: customer.customerName || customer.username || null,
        phone: customer.phone,
        email: customer.email || null
      };
      console.log(`✅ Returning customer data:`, customerData);
      return res.json({
        customer: customerData
      });
    }
    
    console.log('❌ No customer found for phone:', phoneNumber);
    res.json({ customer: null });
  } catch (error) {
    console.error('❌ Error looking up customer by phone:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to lookup customer', details: error.message });
  }
});

// Get drink by barcode for POS
router.get('/drinks/barcode/:barcode', async (req, res) => {
  try {
    let { barcode } = req.params;
    
    // Normalize barcode: trim whitespace and remove any non-digit characters that might be added by scanner
    // But keep the original for exact match first
    const trimmedBarcode = barcode.trim();
    
    console.log(`🔍 POS: Looking up barcode: "${barcode}" (trimmed: "${trimmedBarcode}")`);
    
    // Try exact match first (with original and trimmed)
    let drink = await db.Drink.findOne({
      where: {
        [Op.or]: [
          { barcode: barcode },
          { barcode: trimmedBarcode }
        ],
        isAvailable: {
          [Op.ne]: false
        }
      },
      include: [{
        model: db.Category,
        as: 'category',
        attributes: ['id', 'name'],
        required: false
      }]
    });

    // If not found, try with trimmed leading zeros (some scanners add leading zeros)
    if (!drink && trimmedBarcode.length > 0) {
      const withoutLeadingZeros = trimmedBarcode.replace(/^0+/, '');
      if (withoutLeadingZeros !== trimmedBarcode && withoutLeadingZeros.length > 0) {
        console.log(`🔍 Trying without leading zeros: "${withoutLeadingZeros}"`);
        drink = await db.Drink.findOne({
          where: {
            barcode: withoutLeadingZeros,
            isAvailable: {
              [Op.ne]: false
            }
          },
          include: [{
            model: db.Category,
            as: 'category',
            attributes: ['id', 'name'],
            required: false
          }]
        });
      }
    }

    // If still not found, try case-insensitive match (though barcodes are usually numeric)
    if (!drink) {
      drink = await db.Drink.findOne({
        where: {
          barcode: {
            [Op.iLike]: trimmedBarcode
          },
          isAvailable: {
            [Op.ne]: false
          }
        },
        include: [{
          model: db.Category,
          as: 'category',
          attributes: ['id', 'name'],
          required: false
        }]
      });
    }

    if (!drink) {
      console.log(`❌ No product found with barcode: "${barcode}"`);
      // Log available barcodes for debugging (first 5)
      const sampleBarcodes = await db.Drink.findAll({
        where: {
          barcode: { [Op.ne]: null }
        },
        limit: 5,
        attributes: ['id', 'name', 'barcode']
      });
      console.log(`📋 Sample barcodes in database:`, sampleBarcodes.map(d => `${d.name}: ${d.barcode}`));
      
      return res.status(404).json({ error: 'Product not found with barcode: ' + barcode });
    }

    console.log(`✅ Found product: ${drink.name} (barcode: ${drink.barcode})`);
    res.json(drink);
  } catch (error) {
    console.error('Error fetching drink by barcode:', error);
    res.status(500).json({ error: 'Failed to fetch product by barcode', details: error.message });
  }
});

// Get all drinks for POS (with inventory info)
router.get('/drinks', async (req, res) => {
  try {
    const drinks = await db.Drink.findAll({
      where: {
        isAvailable: {
          [Op.ne]: false // Include drinks where isAvailable is not explicitly false
        }
      },
      include: [{
        model: db.Category,
        as: 'category',
        attributes: ['id', 'name'],
        required: false // Left join - include drinks even if category is missing
      }],
      order: [['name', 'ASC']]
    });

    // Map drinks to ensure categoryId is included even if category association failed
    const drinksWithCategory = drinks.map(drink => {
      const drinkData = drink.toJSON();
      // Ensure categoryId is present
      if (!drinkData.categoryId && drink.categoryId) {
        drinkData.categoryId = drink.categoryId;
      }
      return drinkData;
    });

    res.json(drinksWithCategory);
  } catch (error) {
    console.error('❌ Error fetching drinks for POS:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ 
      error: 'Failed to fetch drinks',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create POS order with cash payment
router.post('/order/cash', async (req, res) => {
  const transaction = await db.sequelize.transaction();
  
  try {
    const { customerName, customerPhone, customerEmail, items, notes, branchId, amountPaid } = req.body;

    // Validation
    if (!customerName || !customerPhone || !Array.isArray(items) || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Missing required fields: customerName, customerPhone, and items are required' });
    }

    // Calculate totals
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const drink = await db.Drink.findByPk(item.drinkId, { transaction });
      if (!drink) {
        await transaction.rollback();
        return res.status(400).json({ error: `Drink with ID ${item.drinkId} not found` });
      }

      const priceToUse = Number.isFinite(item.selectedPrice) && item.selectedPrice > 0
        ? item.selectedPrice
        : parseFloat(drink.price) || 0;

      const itemTotal = priceToUse * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        drinkId: item.drinkId,
        quantity: item.quantity,
        price: priceToUse
      });
    }

    // Create order (POS orders don't have delivery address or delivery fee)
    const order = await db.Order.create({
      customerName,
      customerPhone,
      customerEmail: customerEmail || null,
      deliveryAddress: 'In-Store Purchase', // POS orders don't need delivery address
      totalAmount,
      tipAmount: 0, // POS orders typically don't have tips
      status: 'completed', // POS orders are completed immediately
      paymentStatus: 'paid',
      paymentType: 'pay_now',
      paymentMethod: 'cash',
      branchId: branchId || null,
      notes: notes || null
    }, { transaction });

    // Create order items
    for (const item of orderItems) {
      await db.OrderItem.create({
        orderId: order.id,
        drinkId: item.drinkId,
        quantity: item.quantity,
        price: item.price
      }, { transaction });
    }

    // Create cash payment transaction
    const cashNotes = amountPaid && parseFloat(amountPaid) > totalAmount
      ? `Cash payment for POS order #${order.id}. Customer: ${customerName} (${customerPhone}). Amount received: KES ${parseFloat(amountPaid).toFixed(2)}, Change given: KES ${(parseFloat(amountPaid) - totalAmount).toFixed(2)}`
      : `Cash payment for POS order #${order.id}. Customer: ${customerName} (${customerPhone})${amountPaid ? `. Amount received: KES ${parseFloat(amountPaid).toFixed(2)}` : ''}`;
    
    await db.Transaction.create({
      orderId: order.id,
      transactionType: 'payment',
      paymentMethod: 'cash',
      paymentProvider: 'cash',
      amount: totalAmount,
      status: 'completed',
      paymentStatus: 'paid',
      receiptNumber: 'POS', // POS transactions have receipt number "POS"
      notes: cashNotes
    }, { transaction });

    // Credit merchant wallet with order total
    await creditMerchantWalletForPOSOrder(order.id, totalAmount, transaction);

    // Decrease inventory stock for POS cash orders
    try {
      const { decreaseInventoryForOrder } = require('../utils/inventory');
      await decreaseInventoryForOrder(order.id, transaction);
      console.log(`📦 Inventory decreased for POS Order #${order.id}`);
    } catch (inventoryError) {
      console.error(`❌ Error decreasing inventory for POS Order #${order.id}:`, inventoryError);
      // Don't fail the order creation if inventory update fails
    }

    await transaction.commit();

    // Emit socket event for admin dashboard
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('new-order', {
        id: order.id,
        customerName: order.customerName,
        totalAmount: order.totalAmount,
        status: order.status,
        paymentMethod: 'cash',
        isPOS: true
      });
    }

    // Reload order with items
    const orderWithItems = await db.Order.findByPk(order.id, {
      include: [{
        model: db.OrderItem,
        as: 'items',
        include: [{
          model: db.Drink,
          as: 'drink',
          include: [{
            model: db.Category,
            as: 'category'
          }]
        }]
      }]
    });

    res.status(201).json({
      success: true,
      message: 'POS order created successfully',
      order: orderWithItems
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating POS cash order:', error);
    res.status(500).json({ error: 'Failed to create POS order', details: error.message });
  }
});

// Create POS order with M-Pesa payment
router.post('/order/mpesa', async (req, res) => {
  const transaction = await db.sequelize.transaction();
  
  try {
    const { customerName, customerPhone, customerEmail, items, notes, branchId, phoneNumber } = req.body;

    // Validation
    if (!customerName || !customerPhone || !Array.isArray(items) || items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!phoneNumber) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Phone number is required for M-Pesa payment' });
    }

    // Calculate totals
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const drink = await db.Drink.findByPk(item.drinkId, { transaction });
      if (!drink) {
        await transaction.rollback();
        return res.status(400).json({ error: `Drink with ID ${item.drinkId} not found` });
      }

      const priceToUse = Number.isFinite(item.selectedPrice) && item.selectedPrice > 0
        ? item.selectedPrice
        : parseFloat(drink.price) || 0;

      const itemTotal = priceToUse * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        drinkId: item.drinkId,
        quantity: item.quantity,
        price: priceToUse
      });
    }

    // Create order (pending payment)
    const order = await db.Order.create({
      customerName,
      customerPhone,
      customerEmail: customerEmail || null,
      deliveryAddress: 'In-Store Purchase',
      totalAmount,
      tipAmount: 0,
      status: 'pending',
      paymentStatus: 'pending',
      paymentType: 'pay_now',
      paymentMethod: 'mobile_money',
      branchId: branchId || null,
      notes: notes || null
    }, { transaction });

    // Create order items
    for (const item of orderItems) {
      await db.OrderItem.create({
        orderId: order.id,
        drinkId: item.drinkId,
        quantity: item.quantity,
        price: item.price
      }, { transaction });
    }

    await transaction.commit();

    // Initiate M-Pesa STK Push
    try {
      const stkResponse = await mpesaService.initiateSTKPush(
        phoneNumber,
        totalAmount,
        order.id.toString(),
        `POS Order #${order.id}`
      );

      // M-Pesa API returns ResponseCode: '0' for success
      const isSuccess = stkResponse.ResponseCode === '0' || stkResponse.ResponseCode === 0;
      const checkoutRequestID = stkResponse.CheckoutRequestID || stkResponse.checkoutRequestID;
      
      if (isSuccess && checkoutRequestID) {
        // Create pending transaction record
        await db.Transaction.create({
          orderId: order.id,
          transactionType: 'payment',
          paymentMethod: 'mobile_money',
          paymentProvider: 'mpesa',
          amount: totalAmount,
          status: 'pending',
          paymentStatus: 'pending',
          checkoutRequestID: checkoutRequestID,
          merchantRequestID: stkResponse.MerchantRequestID || stkResponse.merchantRequestID,
          phoneNumber: phoneNumber,
          notes: `M-Pesa STK Push initiated for POS order #${order.id}. Customer: ${customerName} (${customerPhone})`
        });

        // CRITICAL: Verify order is still pending before responding
        await order.reload();
        if (order.status !== 'pending' || order.paymentStatus !== 'pending') {
          console.error(`⚠️  WARNING: POS Order #${order.id} status changed unexpectedly! Status: ${order.status}, PaymentStatus: ${order.paymentStatus}`);
        } else {
          console.log(`✅ POS Order #${order.id} created successfully with status: 'pending', paymentStatus: 'pending'`);
        }

        res.json({
          success: true,
          message: 'M-Pesa payment initiated. Please check your phone.',
          orderId: order.id,
          checkoutRequestID: checkoutRequestID,
          customerMessage: stkResponse.CustomerMessage || stkResponse.customerMessage,
          orderStatus: order.status, // Include status in response for debugging
          paymentStatus: order.paymentStatus
        });
      } else {
        // M-Pesa API returned an error
        const errorMessage = stkResponse.errorMessage || 
                            stkResponse.ErrorMessage ||
                            stkResponse.CustomerMessage ||
                            `M-Pesa error: ResponseCode ${stkResponse.ResponseCode}` ||
                            'Failed to initiate M-Pesa payment';
        
        console.error('M-Pesa STK Push failed:', {
          ResponseCode: stkResponse.ResponseCode,
          ResponseDescription: stkResponse.ResponseDescription,
          CustomerMessage: stkResponse.CustomerMessage,
          ErrorMessage: stkResponse.ErrorMessage || stkResponse.errorMessage
        });
        
        res.status(400).json({
          success: false,
          error: errorMessage,
          orderId: order.id,
          responseCode: stkResponse.ResponseCode
        });
      }
    } catch (mpesaError) {
      console.error('M-Pesa STK Push error:', mpesaError);
      res.status(500).json({
        success: false,
        error: 'Failed to initiate M-Pesa payment',
        details: mpesaError.message,
        orderId: order.id
      });
    }
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating POS M-Pesa order:', error);
    res.status(500).json({ error: 'Failed to create POS order', details: error.message });
  }
});

// Get POS orders (in-store orders)
router.get('/orders', async (req, res) => {
  try {
    const { status, startDate, endDate, limit = 50 } = req.query;

    const where = {
      deliveryAddress: 'In-Store Purchase'
    };

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const orders = await db.Order.findAll({
      where,
      include: [{
        model: db.OrderItem,
        as: 'items',
        include: [{
          model: db.Drink,
          as: 'drink',
          include: [{
            model: db.Category,
            as: 'category'
          }]
        }]
      }, {
        model: db.Transaction,
        as: 'transactions',
        where: {
          transactionType: 'payment'
        },
        required: false
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit)
    });

    res.json(orders);
  } catch (error) {
    console.error('Error fetching POS orders:', error);
    res.status(500).json({ error: 'Failed to fetch POS orders' });
  }
});

// Get POS order by ID
router.get('/orders/:id', async (req, res) => {
  try {
    const order = await db.Order.findByPk(req.params.id, {
      include: [{
        model: db.OrderItem,
        as: 'items',
        include: [{
          model: db.Drink,
          as: 'drink',
          include: [{
            model: db.Category,
            as: 'category'
          }]
        }]
      }, {
        model: db.Transaction,
        as: 'transactions'
      }]
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching POS order:', error);
    res.status(500).json({ error: 'Failed to fetch POS order' });
  }
});

// Complete POS order manually (for cash payments that were recorded after order creation)
router.post('/orders/:id/complete', async (req, res) => {
  const transaction = await db.sequelize.transaction();
  
  try {
    const order = await db.Order.findByPk(req.params.id, { transaction });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.deliveryAddress !== 'In-Store Purchase') {
      await transaction.rollback();
      return res.status(400).json({ error: 'This endpoint is only for POS orders' });
    }

    // Update order status
    await order.update({
      status: 'completed',
      paymentStatus: 'paid'
    }, { transaction });

    // Ensure payment transaction exists
    const paymentTransaction = await db.Transaction.findOne({
      where: {
        orderId: order.id,
        transactionType: 'payment'
      },
      transaction
    });

    if (!paymentTransaction) {
      // Create cash transaction if it doesn't exist
      await db.Transaction.create({
        orderId: order.id,
        transactionType: 'payment',
        paymentMethod: 'cash',
        paymentProvider: 'cash',
        amount: order.totalAmount,
        status: 'completed',
        paymentStatus: 'paid',
        notes: `Cash payment for POS order #${order.id}`
      }, { transaction });
    } else {
      // Update existing transaction
      await paymentTransaction.update({
        status: 'completed',
        paymentStatus: 'paid'
      }, { transaction });
    }

    await transaction.commit();

    // Clear POS cart after successful order
    posCart = [];
    console.log('✅ POS cart cleared after order completion');

    res.json({
      success: true,
      message: 'POS order completed successfully',
      order
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error completing POS order:', error);
    res.status(500).json({ error: 'Failed to complete POS order' });
  }
});

/**
 * Get current POS cart
 * GET /api/pos/cart
 */
router.get('/cart', async (req, res) => {
  try {
    res.json({ cart: posCart });
  } catch (error) {
    console.error('Error fetching POS cart:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

/**
 * Add item to POS cart
 * POST /api/pos/cart/add
 * Body: { drinkId, quantity }
 */
router.post('/cart/add', async (req, res) => {
  try {
    const { drinkId, quantity = 1 } = req.body;

    if (!drinkId) {
      return res.status(400).json({ error: 'drinkId is required' });
    }

    // Fetch drink details
    const drink = await db.Drink.findByPk(drinkId, {
      include: [{
        model: db.Category,
        as: 'category',
        attributes: ['id', 'name']
      }]
    });

    if (!drink) {
      return res.status(404).json({ error: 'Drink not found' });
    }

    // Check if item already in cart
    const existingIndex = posCart.findIndex(item => item.drinkId === drinkId);

    if (existingIndex >= 0) {
      // Update quantity
      posCart[existingIndex].quantity += quantity;
    } else {
      // Add new item
      posCart.push({
        drinkId: drink.id,
        name: drink.name,
        price: parseFloat(drink.price) || 0,
        quantity: quantity,
        image: drink.image,
        category: drink.category ? { id: drink.category.id, name: drink.category.name } : null
      });
    }

    console.log(`✅ Added item to POS cart: ${drink.name} (qty: ${quantity})`);
    res.json({ success: true, cart: posCart });
  } catch (error) {
    console.error('Error adding item to POS cart:', error);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
});

/**
 * Remove item from POS cart
 * POST /api/pos/cart/remove
 * Body: { drinkId }
 */
router.post('/cart/remove', async (req, res) => {
  try {
    const { drinkId } = req.body;

    if (!drinkId) {
      return res.status(400).json({ error: 'drinkId is required' });
    }

    const initialLength = posCart.length;
    posCart = posCart.filter(item => item.drinkId !== drinkId);

    if (posCart.length < initialLength) {
      console.log(`✅ Removed item from POS cart: drinkId ${drinkId}`);
      res.json({ success: true, cart: posCart });
    } else {
      res.status(404).json({ error: 'Item not found in cart' });
    }
  } catch (error) {
    console.error('Error removing item from POS cart:', error);
    res.status(500).json({ error: 'Failed to remove item from cart' });
  }
});

/**
 * Update item quantity in POS cart
 * POST /api/pos/cart/update
 * Body: { drinkId, quantity }
 */
router.post('/cart/update', async (req, res) => {
  try {
    const { drinkId, quantity } = req.body;

    if (!drinkId || quantity === undefined) {
      return res.status(400).json({ error: 'drinkId and quantity are required' });
    }

    if (quantity <= 0) {
      // Remove item if quantity is 0 or less
      posCart = posCart.filter(item => item.drinkId !== drinkId);
      res.json({ success: true, cart: posCart });
      return;
    }

    const itemIndex = posCart.findIndex(item => item.drinkId === drinkId);

    if (itemIndex >= 0) {
      posCart[itemIndex].quantity = quantity;
      console.log(`✅ Updated item quantity in POS cart: drinkId ${drinkId}, qty: ${quantity}`);
      res.json({ success: true, cart: posCart });
    } else {
      res.status(404).json({ error: 'Item not found in cart' });
    }
  } catch (error) {
    console.error('Error updating item in POS cart:', error);
    res.status(500).json({ error: 'Failed to update item in cart' });
  }
});

/**
 * Clear POS cart
 * DELETE /api/pos/cart
 */
router.delete('/cart', async (req, res) => {
  try {
    posCart = [];
    console.log('✅ POS cart cleared');
    res.json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    console.error('Error clearing POS cart:', error);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

module.exports = router;

