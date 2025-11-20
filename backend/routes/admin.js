const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const { getOrderFinancialBreakdown } = require('../utils/orderFinancials');
const { ensureDeliveryFeeSplit } = require('../utils/deliveryFeeTransactions');
const { creditWalletsOnDeliveryCompletion } = require('../utils/walletCredits');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const {
  syncCustomersFromOrders,
  normalizePhoneNumber,
  generatePhoneVariants
} = require('../utils/customerSync');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const ADMIN_TOKEN_TTL = process.env.ADMIN_TOKEN_TTL || '12h';

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

const buildAdminUserResponse = (adminInstance) => ({
  id: adminInstance.id,
  username: adminInstance.username,
  email: adminInstance.email,
  role: adminInstance.role || 'admin',
  createdAt: adminInstance.createdAt,
  updatedAt: adminInstance.updatedAt
});

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = parseFloat(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
};

const normalizeCapacityPricing = (input = []) => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry) => {
      if (!entry) {
        return null;
      }

      const capacity =
        typeof entry.capacity === 'string'
          ? entry.capacity.trim()
          : entry.capacity !== undefined && entry.capacity !== null
          ? String(entry.capacity).trim()
          : '';

      if (!capacity) {
        return null;
      }

      const originalPriceCandidate =
        entry.originalPrice ?? entry.price ?? entry.currentPrice;
      const currentPriceCandidate =
        entry.currentPrice ?? entry.price ?? entry.originalPrice;

      const originalPrice = toNumber(originalPriceCandidate);
      const currentPrice = toNumber(currentPriceCandidate);

      const resolvedOriginal =
        originalPrice !== null
          ? originalPrice
          : currentPrice !== null
          ? currentPrice
          : 0;

      const resolvedCurrent =
        currentPrice !== null
          ? currentPrice
          : originalPrice !== null
          ? originalPrice
          : 0;

      return {
        capacity,
        originalPrice: resolvedOriginal,
        currentPrice: resolvedCurrent
      };
    })
    .filter(Boolean);
};

const deriveCapacities = (explicitCapacities, pricing) => {
  const set = new Set();

  if (Array.isArray(explicitCapacities)) {
    explicitCapacities.forEach((capacity) => {
      if (typeof capacity === 'string' && capacity.trim()) {
        set.add(capacity.trim());
      } else if (capacity !== undefined && capacity !== null) {
        const value = String(capacity).trim();
        if (value) {
          set.add(value);
        }
      }
    });
  }

  pricing.forEach((pricingRow) => {
    if (pricingRow.capacity) {
      set.add(pricingRow.capacity);
    }
  });

  return Array.from(set);
};

const summarisePricing = (pricing, fallbackPrice, fallbackOriginalPrice) => {
  const priceCandidates = pricing
    .map((p) => toNumber(p.currentPrice))
    .filter((value) => value !== null);
  const originalCandidates = pricing
    .map((p) => toNumber(p.originalPrice))
    .filter((value) => value !== null);

  const finalPrice =
    priceCandidates.length > 0
      ? Math.min(...priceCandidates)
      : toNumber(fallbackPrice);

  let finalOriginal =
    originalCandidates.length > 0
      ? Math.min(...originalCandidates)
      : toNumber(fallbackOriginalPrice);

  if (finalOriginal === null && finalPrice !== null) {
    finalOriginal = finalPrice;
  }

  const isOnOfferFromPricing = pricing.some((row) => {
    const original = toNumber(row.originalPrice);
    const current = toNumber(row.currentPrice);
    return original !== null && current !== null && original > current;
  });

  const priceNumber = finalPrice !== null ? finalPrice : 0;
  const originalNumber =
    finalOriginal !== null ? finalOriginal : priceNumber || 0;
  const isOnOffer =
    isOnOfferFromPricing || originalNumber > priceNumber
      ? true
      : false;

  return {
    price: priceNumber,
    originalPrice: originalNumber,
    isOnOffer
  };
};

const buildCustomerOrderFilter = (customer) => {
  if (!customer) {
    return null;
  }

  const orClauses = [];
  const phoneVariants = generatePhoneVariants(customer.phone || customer.username);
  if (phoneVariants.length > 0) {
    orClauses.push({ customerPhone: { [Op.in]: phoneVariants } });
  }

  const emails = new Set();
  if (customer.email) {
    emails.add(customer.email);
    emails.add(customer.email.toLowerCase());
  }
  if (customer.username && customer.username.includes('@')) {
    emails.add(customer.username);
    emails.add(customer.username.toLowerCase());
  }

  if (emails.size > 0) {
    orClauses.push({ customerEmail: { [Op.in]: Array.from(emails).filter(Boolean) } });
  }

  return orClauses.length > 0 ? { [Op.or]: orClauses } : null;
};

const findLatestOtpForPhone = async (phone) => {
  if (!phone) {
    return null;
  }

  const variants = generatePhoneVariants(phone);
  const candidateSet = new Set();

  variants.forEach((value) => {
    if (!value) {
      return;
    }
    candidateSet.add(value);
    const digits = value.replace(/\D/g, '');
    if (digits) {
      candidateSet.add(digits);
      if (digits.startsWith('254')) {
        const local = digits.slice(3);
        if (local) {
          candidateSet.add(local);
          candidateSet.add(`0${local}`);
          candidateSet.add(`+254${local}`);
        }
      } else if (digits.startsWith('0')) {
        const local = digits.slice(1);
        candidateSet.add(local);
        candidateSet.add(`254${local}`);
      } else if (digits.length === 9) {
        candidateSet.add(`0${digits}`);
        candidateSet.add(`254${digits}`);
      }
    }
  });

  const candidateList = Array.from(candidateSet).filter(Boolean);
  if (candidateList.length === 0) {
    return null;
  }

  return db.Otp.findOne({
    where: {
      phoneNumber: {
        [Op.in]: candidateList
      },
      isUsed: false
    },
    order: [['createdAt', 'DESC']]
  });
};

router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    const trimmedUsername = username.trim();

    const adminUser = await db.Admin.findOne({
      where: {
        [Op.or]: [
          { username: trimmedUsername },
          { email: trimmedUsername }
        ]
      }
    });

    if (!adminUser || !adminUser.password) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, adminUser.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    const tokenPayload = {
      id: adminUser.id,
      username: adminUser.username,
      role: adminUser.role || 'admin'
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: ADMIN_TOKEN_TTL
    });

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: buildAdminUserResponse(adminUser)
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to log in. Please try again.'
    });
  }
});

router.use(verifyAdmin);

// Get admin stats
router.get('/stats', async (req, res) => {
  try {
    // Get total orders count
    const totalOrders = await db.Order.count();

    // Get pending orders count
    const pendingOrders = await db.Order.count({
      where: {
        status: {
          [Op.in]: ['pending', 'confirmed']
        }
      }
    });

    // Get today's orders
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = await db.Order.count({
      where: {
        createdAt: {
          [Op.gte]: today
        }
      }
    });

    // Get today's revenue (excluding tips - tips go to drivers, not business)
    // Revenue = totalAmount - tipAmount (order + delivery fee only)
    const todayPaidOrders = await db.Order.findAll({
      where: {
        createdAt: {
          [Op.gte]: today
        },
        paymentStatus: 'paid'
      },
      attributes: ['totalAmount', 'tipAmount']
    });
    const todayRevenue = todayPaidOrders.reduce((sum, order) => {
      const orderAmount = parseFloat(order.totalAmount) || 0;
      const tipAmount = parseFloat(order.tipAmount) || 0;
      return sum + (orderAmount - tipAmount); // Exclude tip
    }, 0);

    // Get total revenue (excluding tips)
    const allPaidOrders = await db.Order.findAll({
      where: {
        paymentStatus: 'paid'
      },
      attributes: ['totalAmount', 'tipAmount']
    });
    const totalRevenue = allPaidOrders.reduce((sum, order) => {
      const orderAmount = parseFloat(order.totalAmount) || 0;
      const tipAmount = parseFloat(order.tipAmount) || 0;
      return sum + (orderAmount - tipAmount); // Exclude tip
    }, 0);

    // Get tip stats
    const todayTips = todayPaidOrders.reduce((sum, order) => {
      return sum + (parseFloat(order.tipAmount) || 0);
    }, 0);
    const totalTips = allPaidOrders.reduce((sum, order) => {
      return sum + (parseFloat(order.tipAmount) || 0);
    }, 0);
    const totalTipTransactions = await db.Transaction.count({
      where: {
        transactionType: 'tip',
        status: 'completed'
      }
    });
    const todayTipTransactions = await db.Transaction.count({
      where: {
        transactionType: 'tip',
        status: 'completed',
        createdAt: {
          [Op.gte]: today
        }
      }
    });

    // Cancelled orders count
    const cancelledOrders = await db.Order.count({
      where: { status: 'cancelled' }
    });

    // Inventory stats
    const totalDrinks = await db.Drink.count();
    const availableItems = await db.Drink.count({
      where: {
        isAvailable: true
      }
    });
    const outOfStockItems = await db.Drink.count({
      where: {
        isAvailable: {
          [Op.not]: true
        }
      }
    });
    const limitedOfferItems = await db.Drink.count({
      where: {
        [Op.or]: [
          { limitedTimeOffer: true },
          { isOnOffer: true }
        ]
      }
    });

    res.json({
      totalOrders,
      pendingOrders,
      cancelledOrders,
      todayOrders,
      todayRevenue: parseFloat(todayRevenue) || 0,
      totalRevenue: parseFloat(totalRevenue) || 0,
      totalDrinks,
      totalItems: totalDrinks,
      availableItems,
      outOfStockItems,
      limitedOfferItems,
      // Tip stats
      todayTips: parseFloat(todayTips) || 0,
      totalTips: parseFloat(totalTips) || 0,
      totalTipTransactions: totalTipTransactions || 0,
      todayTipTransactions: todayTipTransactions || 0
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get all transactions (admin)
router.get('/transactions', async (req, res) => {
  try {
    // Build includes array conditionally
    const orderIncludes = [
      {
        model: db.OrderItem,
        as: 'items',
        required: false,
        include: [{
          model: db.Drink,
          as: 'drink',
          required: false
        }]
      },
      {
        model: db.Driver,
        as: 'driver',
        required: false,
        attributes: ['id', 'name', 'phoneNumber', 'status']
      }
    ];
    
    // Include Branch association (branchId column exists and association is set up)
    if (db.Branch && db.Order && db.Order.associations && db.Order.associations.branch) {
      orderIncludes.push({
        model: db.Branch,
        as: 'branch',
        required: false,
        attributes: ['id', 'name', 'address']
      });
    }
    
    const transactions = await db.Transaction.findAll({
      include: [{
        model: db.Order,
        as: 'order',
        required: false,
        include: orderIncludes
      }, {
        model: db.Driver,
        as: 'driver',
        required: false,
        attributes: ['id', 'name', 'phoneNumber', 'status']
      }],
      order: [['createdAt', 'DESC']]
    });

    // Ensure all transactions have a transactionType (default to 'payment' if null, undefined, or empty string)
    const normalizedTransactions = transactions.map(transaction => {
      const transactionData = transaction.toJSON ? transaction.toJSON() : transaction;
      // If transactionType is null, undefined, empty string, or not a valid string, default to 'payment'
      if (!transactionData.transactionType || 
          typeof transactionData.transactionType !== 'string' || 
          transactionData.transactionType.trim() === '') {
        console.log(`⚠️  Transaction #${transactionData.id} has missing/null transactionType, defaulting to 'payment'`);
        transactionData.transactionType = 'payment';
      }
      return transactionData;
    });

    res.json(normalizedTransactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get merchant wallet (admin wallet)
router.get('/merchant-wallet', async (req, res) => {
  try {
    // Get or create admin wallet (single wallet for all admin revenue)
    let adminWallet = await db.AdminWallet.findOne({ where: { id: 1 } });
    if (!adminWallet) {
      adminWallet = await db.AdminWallet.create({
        id: 1,
        balance: 0,
        totalRevenue: 0,
        totalOrders: 0
      });
    }

    // Get total orders count (all orders)
    const totalOrders = await db.Order.count();

    res.json({
      balance: parseFloat(adminWallet.balance) || 0,
      totalRevenue: parseFloat(adminWallet.totalRevenue) || 0,
      totalOrders: adminWallet.totalOrders || 0,
      allOrdersCount: totalOrders || 0
    });
  } catch (error) {
    console.error('Error fetching merchant wallet:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all drinks (admin)
router.get('/drinks', async (req, res) => {
  try {
    const drinks = await db.Drink.findAll({
      include: [{
        model: db.Category,
        as: 'category'
      }, {
        model: db.SubCategory,
        as: 'subCategory'
      }],
      order: [['name', 'ASC']]
    });

    res.json(drinks);
  } catch (error) {
    console.error('Error fetching drinks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new drink (admin)
router.post('/drinks', async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      originalPrice,
      image,
      categoryId,
      subCategoryId,
      isAvailable,
      isPopular,
      limitedTimeOffer,
      capacity,
      capacityPricing,
      abv
    } = req.body;

    const normalizedName = typeof name === 'string' ? name.trim() : '';
    if (!normalizedName) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const parsedCategoryId = parseInt(categoryId, 10);
    if (Number.isNaN(parsedCategoryId)) {
      return res.status(400).json({ error: 'Name and categoryId are required' });
    }

    let parsedSubCategoryId = null;
    if (subCategoryId !== undefined && subCategoryId !== null && subCategoryId !== '') {
      const parsed = parseInt(subCategoryId, 10);
      if (Number.isNaN(parsed)) {
        return res.status(400).json({ error: 'subCategoryId must be a number if provided' });
      }
      parsedSubCategoryId = parsed;
    }

    const normalizedPricing = normalizeCapacityPricing(capacityPricing);
    const capacities = deriveCapacities(capacity, normalizedPricing);
    const summary = summarisePricing(normalizedPricing, price, originalPrice);
    const limitedTimeFlag = typeof limitedTimeOffer === 'boolean' ? limitedTimeOffer : false;

    const newDrink = await db.Drink.create({
      name: normalizedName,
      description:
        typeof description === 'string' && description.trim()
          ? description.trim()
          : null,
      price: summary.price,
      originalPrice: summary.originalPrice,
      image:
        typeof image === 'string' && image.trim() ? image.trim() : null,
      categoryId: parsedCategoryId,
      subCategoryId: parsedSubCategoryId,
      isAvailable:
        typeof isAvailable === 'boolean' ? isAvailable : true,
      isPopular: typeof isPopular === 'boolean' ? isPopular : false,
      limitedTimeOffer: limitedTimeFlag,
      isOnOffer: summary.isOnOffer,
      capacity: capacities,
      capacityPricing: normalizedPricing,
      abv: toNumber(abv)
    });

    const drinkWithRelations = await db.Drink.findByPk(newDrink.id, {
      include: [
        { model: db.Category, as: 'category' },
        { model: db.SubCategory, as: 'subCategory' }
      ]
    });

    res.status(201).json(drinkWithRelations);
  } catch (error) {
    console.error('Error creating drink:', error);
    res.status(500).json({ error: 'Failed to create drink' });
  }
});

// Update an existing drink (admin)
router.put('/drinks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const drink = await db.Drink.findByPk(id);

    if (!drink) {
      return res.status(404).json({ error: 'Drink not found' });
    }

    const {
      name,
      description,
      price,
      originalPrice,
      image,
      categoryId,
      subCategoryId,
      isAvailable,
      isPopular,
      limitedTimeOffer,
      capacity,
      capacityPricing,
      abv
    } = req.body;

    const normalizedName = typeof name === 'string' ? name.trim() : '';
    if (!normalizedName) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const parsedCategoryId = parseInt(categoryId, 10);
    if (Number.isNaN(parsedCategoryId)) {
      return res.status(400).json({ error: 'categoryId must be a number' });
    }

    let parsedSubCategoryId = null;
    if (subCategoryId !== undefined && subCategoryId !== null && subCategoryId !== '') {
      const parsed = parseInt(subCategoryId, 10);
      if (Number.isNaN(parsed)) {
        return res.status(400).json({ error: 'subCategoryId must be a number if provided' });
      }
      parsedSubCategoryId = parsed;
    }

    const normalizedPricing = normalizeCapacityPricing(capacityPricing);
    const capacities = deriveCapacities(capacity, normalizedPricing);
    const summary = summarisePricing(normalizedPricing, price, originalPrice);
    const limitedTimeFlag = typeof limitedTimeOffer === 'boolean' ? limitedTimeOffer : drink.limitedTimeOffer;

    // Handle stock update
    const stockValue = req.body.stock !== undefined && req.body.stock !== null
      ? parseInt(req.body.stock) || 0
      : drink.stock !== undefined && drink.stock !== null
      ? drink.stock
      : 0;

    // Automatically set isAvailable based on stock if stock is being updated
    const shouldAutoSetAvailable = req.body.stock !== undefined && req.body.stock !== null;
    const autoAvailable = shouldAutoSetAvailable ? stockValue > 0 : undefined;
    
    // Store current stock for alert checking
    const currentStock = parseInt(drink.stock) || 0;
    const isStockBeingUpdated = req.body.stock !== undefined && req.body.stock !== null;

    await drink.update({
      name: normalizedName,
      description:
        typeof description === 'string' && description.trim()
          ? description.trim()
          : null,
      price: summary.price,
      originalPrice: summary.originalPrice,
      image:
        typeof image === 'string' && image.trim() ? image.trim() : null,
      categoryId: parsedCategoryId,
      subCategoryId: parsedSubCategoryId,
      isAvailable:
        autoAvailable !== undefined 
          ? autoAvailable 
          : (typeof isAvailable === 'boolean' ? isAvailable : drink.isAvailable),
      isPopular:
        typeof isPopular === 'boolean' ? isPopular : drink.isPopular,
      limitedTimeOffer: limitedTimeFlag,
      isOnOffer: summary.isOnOffer,
      capacity: capacities,
      capacityPricing: normalizedPricing,
      abv: toNumber(abv),
      stock: stockValue
      // isAvailable is set above based on stock if stock is being updated
    });

    const updatedDrink = await db.Drink.findByPk(id, {
      include: [
        { model: db.Category, as: 'category' },
        { model: db.SubCategory, as: 'subCategory' }
      ]
    });

    res.json(updatedDrink);
  } catch (error) {
    console.error('Error updating drink:', error);
    res.status(500).json({ error: 'Failed to update drink' });
  }
});

// Update drink availability (admin)
router.patch('/drinks/:id/availability', async (req, res) => {
  try {
    const { id } = req.params;
    const { isAvailable } = req.body;

    if (typeof isAvailable !== 'boolean') {
      return res.status(400).json({ error: 'isAvailable must be a boolean value' });
    }

    const drink = await db.Drink.findByPk(id);
    if (!drink) {
      return res.status(404).json({ error: 'Drink not found' });
    }

    await drink.update({ isAvailable });

    res.json({ id: drink.id, isAvailable: drink.isAvailable });
  } catch (error) {
    console.error('Error updating drink availability:', error);
    res.status(500).json({ error: 'Failed to update drink availability' });
  }
});

// Get Save the Fishes stats
router.get('/save-the-fishes', async (req, res) => {
  try {
    // Get total saved addresses count
    const totalAddresses = await db.SavedAddress.count();

    // Get total cost saved (sum of all costSaved values)
    const totalCostSaved = await db.SavedAddress.sum('costSaved') || 0;

    // Get total API calls saved
    const totalApiCallsSaved = await db.SavedAddress.sum('apiCallsSaved') || 0;

    // Get most searched addresses
    const topAddresses = await db.SavedAddress.findAll({
      order: [['searchCount', 'DESC']],
      limit: 10,
      attributes: ['id', 'address', 'formattedAddress', 'searchCount', 'apiCallsSaved', 'costSaved']
    });

    res.json({
      totalAddresses,
      totalCostSaved: parseFloat(totalCostSaved) || 0,
      totalApiCallsSaved: parseInt(totalApiCallsSaved) || 0,
      topAddresses: topAddresses.map(addr => ({
        id: addr.id,
        address: addr.formattedAddress || addr.address,
        searchCount: addr.searchCount || 0,
        apiCallsSaved: addr.apiCallsSaved || 0,
        costSaved: parseFloat(addr.costSaved || 0)
      }))
    });
  } catch (error) {
    console.error('Error fetching Save the Fishes stats:', error);
    res.status(500).json({ error: 'Failed to fetch Save the Fishes stats' });
  }
});

// Get all orders (admin)
router.get('/orders', async (req, res) => {
  try {
    // Build includes array conditionally
    const orderIncludes = [
      {
        model: db.OrderItem,
        as: 'items',
        required: false,
        include: [
          {
            model: db.Drink,
            as: 'drink',
            required: false
          }
        ]
      },
      {
        model: db.Transaction,
        as: 'transactions',
        required: false
      },
      {
        model: db.Driver,
        as: 'driver',
        required: false,
        attributes: ['id', 'name', 'phoneNumber', 'status']
      }
    ];
    
    // Include Branch association (branchId column exists and association is set up)
    if (db.Branch && db.Order && db.Order.associations && db.Order.associations.branch) {
      orderIncludes.push({
        model: db.Branch,
        as: 'branch',
        required: false,
        attributes: ['id', 'name', 'address']
      });
    }
    
    const orders = await db.Order.findAll({
      include: orderIncludes,
      order: [['createdAt', 'DESC']]
    });

    // Map items to orderItems for compatibility
    const ordersWithMappedItems = orders.map(order => {
      const orderData = order.toJSON();
      if (orderData.items) {
        orderData.orderItems = orderData.items;
      }
      return orderData;
    });

    res.json(ordersWithMappedItems);
  } catch (error) {
    console.error('Error fetching admin orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Update order status (admin)
router.patch('/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = await db.Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // CRITICAL: If order is being marked as completed or delivered and payment is paid, sync pending transactions first
    // This ensures transactions are updated even if callback wasn't received
    if ((status === 'completed' || status === 'delivered') && order.paymentStatus === 'paid') {
      try {
        const { syncPendingTransactionsForOrder } = require('../utils/transactionSync');
        await syncPendingTransactionsForOrder(order.id);
      } catch (syncError) {
        console.error(`⚠️  Error syncing pending transactions for Order #${order.id}:`, syncError.message);
        // Don't fail - continue with status update
      }
    }

    // Update order status
    await order.update({ status });

    // If delivered and payment is paid, auto-update to completed
    let finalStatus = status;
    if (status === 'delivered' && order.paymentStatus === 'paid') {
      await order.update({ status: 'completed' });
      finalStatus = 'completed';
    }

    // Credit all wallets when order is completed (delivery completed)
    if (finalStatus === 'completed') {
      try {
        await creditWalletsOnDeliveryCompletion(order.id, req);
        console.log(`✅ Wallets credited for Order #${order.id} on delivery completion (admin status update)`);
      } catch (walletError) {
        console.error(`❌ Error crediting wallets for Order #${order.id}:`, walletError);
        // Don't fail the status update if wallet crediting fails
      }
      
      // Decrease inventory stock for completed orders
      try {
        const { decreaseInventoryForOrder } = require('../utils/inventory');
        await decreaseInventoryForOrder(order.id);
        console.log(`📦 Inventory decreased for Order #${order.id} (admin status update)`);
      } catch (inventoryError) {
        console.error(`❌ Error decreasing inventory for Order #${order.id}:`, inventoryError);
        // Don't fail the status update if inventory update fails
      }
      
      // Update driver status if they have no more active orders
      if (order.driverId) {
        try {
          const { updateDriverStatusIfNoActiveOrders } = require('../utils/driverAssignment');
          await updateDriverStatusIfNoActiveOrders(order.driverId);
        } catch (driverStatusError) {
          console.error(`❌ Error updating driver status for Order #${order.id}:`, driverStatusError);
          // Don't fail the status update if driver status update fails
        }
      }
    }
    
    // If order is cancelled, also check if driver has more active orders
    if (status === 'cancelled' && order.driverId) {
      try {
        const { updateDriverStatusIfNoActiveOrders } = require('../utils/driverAssignment');
        await updateDriverStatusIfNoActiveOrders(order.driverId);
      } catch (driverStatusError) {
        console.error(`❌ Error updating driver status for cancelled Order #${order.id}:`, driverStatusError);
        // Don't fail the status update if driver status update fails
      }
    }

    // Note: All wallet credits (merchant, driver delivery fee, tip) are now handled by creditWalletsOnDeliveryCompletion
    // which is called above when order status is 'completed'

    // CRITICAL: Don't call ensureDeliveryFeeSplit when order is completed - creditWalletsOnDeliveryCompletion handles everything
    // Only call ensureDeliveryFeeSplit for non-completed orders to sync delivery fee transactions
    if (order.paymentStatus === 'paid' && finalStatus !== 'completed') {
      try {
        await ensureDeliveryFeeSplit(order, { context: 'admin-status-update' });
      } catch (syncError) {
        console.error('❌ Error syncing delivery fee transactions (admin status update):', syncError);
      }
    }

    // Reload order to get updated data
    await order.reload({
      include: [
        {
          model: db.OrderItem,
          as: 'items',
          include: [{ model: db.Drink, as: 'drink' }]
        },
        {
          model: db.Transaction,
          as: 'transactions'
        },
        {
          model: db.Driver,
          as: 'driver'
        }
      ]
    });

    let orderData = order.toJSON();
    if (orderData.items) {
      orderData.orderItems = orderData.items;
    }
    orderData.status = finalStatus;

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('order-status-updated', {
        orderId: order.id,
        status: finalStatus,
        paymentStatus: order.paymentStatus,
        order: orderData
      });

      // Also notify driver if assigned
      if (order.driverId) {
        io.to(`driver-${order.driverId}`).emit('order-status-updated', {
          orderId: order.id,
          status: finalStatus,
          paymentStatus: order.paymentStatus,
          order: orderData
        });
      }
    }

    res.json(orderData);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Update payment status (admin)
router.patch('/orders/:id/payment-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;

    const order = await db.Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // CRITICAL: If order is being marked as paid, sync pending transactions first
    // This ensures transactions are updated even if callback wasn't received
    if (paymentStatus === 'paid') {
      try {
        const { syncPendingTransactionsForOrder } = require('../utils/transactionSync');
        await syncPendingTransactionsForOrder(order.id);
      } catch (syncError) {
        console.error(`⚠️  Error syncing pending transactions for Order #${order.id}:`, syncError.message);
        // Don't fail - continue with payment status update
      }
    }

    // Update payment status
    await order.update({ paymentStatus });

    // If delivered and payment is paid, auto-update to completed
    let finalStatus = order.status;
    if (order.status === 'delivered' && paymentStatus === 'paid') {
      await order.update({ status: 'completed' });
      finalStatus = 'completed';
    }

    // CRITICAL: Wallet crediting is now handled by creditWalletsOnDeliveryCompletion
    // when the order is marked as completed, not when payment status is updated.
    // This prevents crediting wallets before delivery is completed.
    // If order is marked as completed (or becomes completed) and payment is paid, credit wallets
    if (finalStatus === 'completed' && paymentStatus === 'paid' && order.driverId) {
      try {
        const { creditWalletsOnDeliveryCompletion } = require('../utils/walletCredits');
        await creditWalletsOnDeliveryCompletion(order.id, req);
        console.log(`✅ Wallets credited for Order #${order.id} on payment status update (order completed)`);
      } catch (walletError) {
        console.error(`❌ Error crediting wallets for Order #${order.id}:`, walletError);
        // Don't fail the payment status update if wallet crediting fails
      }
      
      // Update driver status if they have no more active orders
      try {
        const { updateDriverStatusIfNoActiveOrders } = require('../utils/driverAssignment');
        await updateDriverStatusIfNoActiveOrders(order.driverId);
      } catch (driverStatusError) {
        console.error(`❌ Error updating driver status for Order #${order.id}:`, driverStatusError);
        // Don't fail the payment status update if driver status update fails
      }
    }

    // Reload order to get updated data
    await order.reload({
      include: [
        {
          model: db.OrderItem,
          as: 'items',
          include: [{ model: db.Drink, as: 'drink' }]
        },
        {
          model: db.Transaction,
          as: 'transactions'
        },
        {
          model: db.Driver,
          as: 'driver'
        }
      ]
    });

    const orderData = order.toJSON();
    if (orderData.items) {
      orderData.orderItems = orderData.items;
    }

    // Emit socket events for real-time updates
    const io = req.app.get('io');
    if (io) {
      // Emit payment confirmed event if payment is now paid
      if (paymentStatus === 'paid') {
        io.to('admin').emit('payment-confirmed', {
          orderId: order.id,
          status: finalStatus,
          paymentStatus: 'paid',
          order: orderData
        });

        // Notify driver if assigned
        if (order.driverId) {
          io.to(`driver-${order.driverId}`).emit('payment-confirmed', {
            orderId: order.id,
            status: finalStatus,
            paymentStatus: 'paid',
            order: orderData
          });
        }
      }

      // Also emit order status update
      const orderStatusUpdateData = {
        orderId: order.id,
        status: finalStatus,
        paymentStatus: paymentStatus,
        order: orderData,
        message: `Order #${order.id} status updated`
      };
      
      io.to(`order-${order.id}`).emit('order-status-updated', orderStatusUpdateData);
      io.to('admin').emit('order-status-updated', orderStatusUpdateData);

      if (order.driverId) {
        io.to(`driver-${order.driverId}`).emit('order-status-updated', orderStatusUpdateData);
      }
    }

    res.json(orderData);
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
});

// Update order branch (admin)
router.patch('/orders/:id/branch', async (req, res) => {
  try {
    const { id } = req.params;
    const { branchId, reassignDriver } = req.body;

    const order = await db.Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // If branchId is null or empty string, set to null
    const newBranchId = branchId === '' || branchId === null || branchId === undefined ? null : parseInt(branchId);

    // Validate branch exists if provided
    if (newBranchId !== null) {
      const branch = await db.Branch.findByPk(newBranchId);
      if (!branch) {
        return res.status(404).json({ error: 'Branch not found' });
      }
      if (!branch.isActive) {
        return res.status(400).json({ error: 'Cannot assign order to inactive branch' });
      }
    }

    // Update order branch
    await order.update({ branchId: newBranchId });

    // If reassignDriver is true and new branch is set, find nearest active driver to new branch
    if (reassignDriver === true && newBranchId !== null) {
      const { findNearestActiveDriverToBranch } = require('../utils/driverAssignment');
      const nearestDriver = await findNearestActiveDriverToBranch(newBranchId);
      
      if (nearestDriver) {
        await order.update({ driverId: nearestDriver.id });
        console.log(`✅ Reassigned driver to ${nearestDriver.name} (ID: ${nearestDriver.id}) for order ${order.id}`);
      } else {
        console.log(`⚠️  No active driver found for branch ${newBranchId}. Keeping current driver.`);
      }
    }

    // Reload order with branch
    await order.reload({
      include: [
        {
          model: db.OrderItem,
          as: 'items',
          include: [{ model: db.Drink, as: 'drink' }]
        },
        {
          model: db.Branch,
          as: 'branch',
          required: false
        },
        {
          model: db.Driver,
          as: 'driver',
          required: false
        }
      ]
    });

    const orderData = order.toJSON();
    if (orderData.items) {
      orderData.orderItems = orderData.items;
    }

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('order-branch-updated', {
          orderId: order.id,
        branchId: newBranchId,
          order: orderData
        });

        // Notify driver if assigned
        if (order.driverId) {
        io.to(`driver-${order.driverId}`).emit('order-branch-updated', {
            orderId: order.id,
          branchId: newBranchId,
          order: orderData
        });
      }
    }

    res.json(orderData);
  } catch (error) {
    console.error('Error updating order branch:', error);
    res.status(500).json({ error: 'Failed to update order branch' });
  }
});

router.patch('/orders/:id/driver', async (req, res) => {
  try {
    const { id } = req.params;
    const { driverId } = req.body;

    const order = await db.Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if order is delivered - if so, don't allow driver removal
    if (order.status === 'delivered' || order.status === 'completed') {
      return res.status(400).json({ error: 'Cannot modify driver assignment for delivered/completed orders' });
    }

    const oldDriverId = order.driverId;

    // Update driver assignment
    await order.update({ driverId: driverId || null });

    // Reload order to get updated data
    await order.reload({
      include: [
        {
          model: db.OrderItem,
          as: 'items',
          include: [{ model: db.Drink, as: 'drink' }]
        },
        {
          model: db.Transaction,
          as: 'transactions'
        },
        {
          model: db.Driver,
          as: 'driver',
          attributes: ['id', 'name', 'phoneNumber', 'status']
        }
      ]
    });

    const orderData = order.toJSON();
    if (orderData.items) {
      orderData.orderItems = orderData.items;
    }

    // If driver was assigned and payment is completed, credit tip immediately if not already credited
    if (driverId && order.paymentStatus === 'paid' && order.tipAmount && parseFloat(order.tipAmount) > 0) {
      try {
        // Find pending tip transaction
        const tipTransaction = await db.Transaction.findOne({
          where: {
            orderId: order.id,
            transactionType: 'tip',
            status: 'pending'
          }
        });

        if (tipTransaction) {
          // Get or create driver wallet
          let driverWallet = await db.DriverWallet.findOne({ where: { driverId: driverId } });
          if (!driverWallet) {
            driverWallet = await db.DriverWallet.create({
              driverId: driverId,
              balance: 0,
              totalTipsReceived: 0,
              totalTipsCount: 0
            });
          }

          const tipAmount = parseFloat(order.tipAmount);

          // Align tip transaction date with merchant payment
          let transactionDateToUse = tipTransaction.transactionDate;
          try {
            const paymentTransaction = await db.Transaction.findOne({
              where: {
                orderId: order.id,
                transactionType: 'payment',
                status: 'completed'
              },
              order: [
                ['transactionDate', 'DESC'],
                ['createdAt', 'DESC']
              ]
            });

            if (paymentTransaction) {
              transactionDateToUse = paymentTransaction.transactionDate || paymentTransaction.createdAt;
            }
          } catch (paymentLookupError) {
            console.warn('⚠️ Could not fetch payment transaction for tip synchronization:', paymentLookupError.message);
          }

          if (!transactionDateToUse) {
            transactionDateToUse = tipTransaction.createdAt;
          }

          // Credit tip to driver wallet
          await driverWallet.update({
            balance: parseFloat(driverWallet.balance) + tipAmount,
            totalTipsReceived: parseFloat(driverWallet.totalTipsReceived) + tipAmount,
            totalTipsCount: driverWallet.totalTipsCount + 1
          });

          // Update tip transaction
          await tipTransaction.update({
            driverId: driverId,
            driverWalletId: driverWallet.id,
            status: 'completed',
            paymentStatus: 'paid',
            transactionDate: transactionDateToUse,
            notes: `Tip for Order #${order.id} - ${order.customerName} (credited to driver wallet)`
          });

          console.log(`✅ Tip of KES ${tipAmount} credited to driver #${driverId} wallet for Order #${order.id}`);
        }
      } catch (tipError) {
        console.error('❌ Error crediting tip when driver assigned:', tipError);
        // Don't fail driver assignment if tip credit fails
      }
    }

    if (order.paymentStatus === 'paid') {
      try {
        await ensureDeliveryFeeSplit(order, {
          context: driverId ? 'admin-driver-assigned' : 'admin-driver-unassigned'
        });
      } catch (syncError) {
        console.error('❌ Error syncing delivery fee transactions (admin driver assignment):', syncError);
      }
    }

    // Emit socket events for real-time updates
    const io = req.app.get('io');
    if (io) {
      // Notify admin about driver assignment change
      io.to('admin').emit('order-updated', {
        orderId: order.id,
        order: orderData,
        message: driverId ? `Driver assigned to order #${order.id}` : `Driver removed from order #${order.id}`
      });

      // If driver was assigned and tip was credited, notify the driver
      if (driverId && order.paymentStatus === 'paid' && order.tipAmount && parseFloat(order.tipAmount) > 0) {
        try {
          const tipTransaction = await db.Transaction.findOne({
            where: {
              orderId: order.id,
              transactionType: 'tip',
              status: 'completed',
              driverId: driverId
            }
          });
          if (tipTransaction) {
            const driverWallet = await db.DriverWallet.findOne({ where: { driverId: driverId } });
            io.to(`driver-${driverId}`).emit('tip-received', {
              orderId: order.id,
              tipAmount: parseFloat(order.tipAmount),
              customerName: order.customerName,
              walletBalance: parseFloat(driverWallet?.balance || 0)
            });
          }
        } catch (error) {
          console.error('Error sending tip notification:', error);
        }
      }

      // If driver was assigned, notify the driver
      if (driverId) {
        const driver = await db.Driver.findByPk(driverId);
        if (driver) {
          io.to(`driver-${driverId}`).emit('order-assigned', {
            order: orderData,
            playSound: true
          });
        }
      }

      // If driver was removed, notify the old driver
      if (oldDriverId && oldDriverId !== driverId) {
        io.to(`driver-${oldDriverId}`).emit('driver-removed', {
          orderId: order.id
        });
      }
    }

    res.json(orderData);
  } catch (error) {
    console.error('Error updating driver assignment:', error);
    res.status(500).json({ error: 'Failed to update driver assignment' });
  }
});

// Verify payment manually (admin)
router.post('/orders/:id/verify-payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { receiptNumber } = req.body;

    const order = await db.Order.findByPk(id, {
      include: [
        {
          model: db.Transaction,
          as: 'transactions'
        }
      ]
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update payment status to paid
    await order.update({ 
      paymentStatus: 'paid',
      status: order.status === 'pending' ? 'confirmed' : order.status
    });

    // Update transaction if exists
    if (order.transactions && order.transactions.length > 0) {
      const transaction = order.transactions[0];
      await transaction.update({
        status: 'completed',
        paymentStatus: 'paid',
        receiptNumber: receiptNumber || transaction.receiptNumber
      });
    }

    // Create tip transaction if order has tip (only after payment is verified)
    if (order.tipAmount && parseFloat(order.tipAmount) > 0) {
      try {
        // Check if tip transaction already exists
        const existingTipTransaction = await db.Transaction.findOne({
          where: {
            orderId: order.id,
            transactionType: 'tip'
          }
        });

        if (!existingTipTransaction) {
          const tipAmount = parseFloat(order.tipAmount);
          // Get payment transaction to share payment attributes
          const paymentTransaction = await db.Transaction.findOne({
            where: {
              orderId: order.id,
              transactionType: 'payment',
              status: 'completed'
            },
            order: [['createdAt', 'DESC']]
          });
          
          let tipTransactionData = {
            orderId: order.id,
            transactionType: 'tip',
            paymentMethod: paymentTransaction?.paymentMethod || 'mobile_money', // Same payment method as order payment
            paymentProvider: paymentTransaction?.paymentProvider || 'mpesa', // Same payment provider
            amount: tipAmount,
            status: 'completed', // Tip is paid when order payment is paid
            paymentStatus: 'paid', // Tip is paid when order payment is paid
            receiptNumber: paymentTransaction?.receiptNumber || receiptNumber || null, // Same receipt number as order payment
            checkoutRequestID: paymentTransaction?.checkoutRequestID || null, // Same checkout request ID
            merchantRequestID: paymentTransaction?.merchantRequestID || null, // Same merchant request ID
            phoneNumber: paymentTransaction?.phoneNumber || null, // Same phone number
            transactionDate: paymentTransaction?.transactionDate || paymentTransaction?.createdAt || new Date(), // Align with payment transaction timestamp
            notes: `Tip for Order #${order.id} - ${order.customerName} (from same M-Pesa payment as order)`
          };

          // If driver is already assigned, credit tip immediately
          if (order.driverId) {
            try {
              // Get or create driver wallet
              let driverWallet = await db.DriverWallet.findOne({ where: { driverId: order.driverId } });
              if (!driverWallet) {
                driverWallet = await db.DriverWallet.create({
                  driverId: order.driverId,
                  balance: 0,
                  totalTipsReceived: 0,
                  totalTipsCount: 0
                });
              }

              // Credit tip to driver wallet
              await driverWallet.update({
                balance: parseFloat(driverWallet.balance) + tipAmount,
                totalTipsReceived: parseFloat(driverWallet.totalTipsReceived) + tipAmount,
                totalTipsCount: driverWallet.totalTipsCount + 1
              });

              // Update tip transaction data with driver info
              tipTransactionData.driverId = order.driverId;
              tipTransactionData.driverWalletId = driverWallet.id;
              tipTransactionData.status = 'completed'; // Completed since driver is assigned
              tipTransactionData.notes = `Tip for Order #${order.id} - ${order.customerName} (credited to driver wallet)`;

              console.log(`✅ Tip of KES ${tipAmount} credited to driver #${order.driverId} wallet for Order #${order.id}`);
            } catch (walletError) {
              console.error('❌ Error crediting tip to driver wallet:', walletError);
              // Continue with tip transaction creation even if wallet credit fails
              tipTransactionData.status = 'pending'; // Will be completed when driver is assigned
              tipTransactionData.notes = `Tip for Order #${order.id} - ${order.customerName} (pending driver assignment)`;
            }
          } else {
            tipTransactionData.status = 'pending'; // Will be completed when driver is assigned
            tipTransactionData.notes = `Tip for Order #${order.id} - ${order.customerName} (pending driver assignment)`;
          }

          await db.Transaction.create(tipTransactionData);
          console.log(`✅ Tip transaction created for Order #${order.id}: KES ${tipAmount} (after payment verification)`);
        } else {
          console.log(`⚠️  Tip transaction already exists for Order #${order.id}`);
        }
      } catch (tipError) {
        console.error('❌ Error creating tip transaction:', tipError);
        // Don't fail payment verification if tip transaction fails
      }
    }

    // Credit order payment to admin wallet (order total minus tip, since tip goes to driver)
    try {
      // Get or create admin wallet (single wallet for all admin revenue)
      let adminWallet = await db.AdminWallet.findOne({ where: { id: 1 } });
      if (!adminWallet) {
        adminWallet = await db.AdminWallet.create({
          id: 1,
          balance: 0,
          totalRevenue: 0,
          totalOrders: 0
        });
      }

      // Order total for admin is order.totalAmount - tipAmount (tip goes to driver)
      // Note: payment transaction amount already excludes tip
      const tipAmount = parseFloat(order.tipAmount) || 0;
      const orderTotalForAdmin = parseFloat(order.totalAmount) - tipAmount;

      // Update admin wallet
      await adminWallet.update({
        balance: parseFloat(adminWallet.balance) + orderTotalForAdmin,
        totalRevenue: parseFloat(adminWallet.totalRevenue) + orderTotalForAdmin,
        totalOrders: adminWallet.totalOrders + 1
      });

      console.log(`✅ Order payment of KES ${orderTotalForAdmin} credited to admin wallet for Order #${order.id}`);
    } catch (adminWalletError) {
      console.error('❌ Error crediting order payment to admin wallet:', adminWalletError);
      // Don't fail payment verification if admin wallet credit fails
    }

    // Reload order
    await order.reload({
      include: [
        {
          model: db.OrderItem,
          as: 'items',
          include: [{ model: db.Drink, as: 'drink' }]
        },
        {
          model: db.Transaction,
          as: 'transactions'
        },
        {
          model: db.Driver,
          as: 'driver'
        }
      ]
    });

    const orderData = order.toJSON();
    if (orderData.items) {
      orderData.orderItems = orderData.items;
    }

    res.json({ success: true, order: orderData });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// Get current admin user
router.get('/me', async (req, res) => {
  try {
    if (!req.admin?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const adminRecord = await db.Admin.findByPk(req.admin.id);

    if (!adminRecord) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    return res.json(buildAdminUserResponse(adminRecord));
  } catch (error) {
    console.error('Error fetching current admin user:', error);
    return res.status(500).json({ error: 'Failed to fetch admin profile' });
  }
});

// Get all admin users
router.get('/users', async (req, res) => {
  try {
    const users = await db.Admin.findAll({
      attributes: ['id', 'username', 'email', 'role', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new admin user (invite)
router.post('/users', async (req, res) => {
  try {
    const { username, email, role } = req.body;

    if (!username || !email) {
      return res.status(400).json({ error: 'Username and email are required' });
    }

    // Check if user already exists
    const existingUser = await db.Admin.findOne({
      where: {
        [Op.or]: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this username or email already exists' });
    }

    // Generate invite token
    const crypto = require('crypto');
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create user
    const user = await db.Admin.create({
      username,
      email,
      role: role || 'manager',
      password: null, // Password will be set when user accepts invite
      inviteToken,
      inviteTokenExpiry
    });

    // Send invite email
    const emailService = require('../services/email');
    const emailResult = await emailService.sendAdminInvite(email, inviteToken, username);

    if (!emailResult.success) {
      console.error('Failed to send invite email:', emailResult.error);
      // User is created, but email failed - still return success
    }

    res.status(201).json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get order notifications (admin)
router.get('/order-notifications', async (req, res) => {
  try {
    const notifications = await db.OrderNotification.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching order notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create order notification (admin)
router.post('/order-notifications', async (req, res) => {
  try {
    const { name, phoneNumber, isActive, notes } = req.body;

    if (!name || !phoneNumber) {
      return res.status(400).json({ error: 'Name and phone number are required' });
    }

    const notification = await db.OrderNotification.create({
      name: name.trim(),
      phoneNumber: phoneNumber.trim(),
      isActive: isActive !== undefined ? isActive : true,
      notes: notes || null
    });

    res.status(201).json(notification);
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update order notification (admin)
router.put('/order-notifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phoneNumber, isActive, notes } = req.body;

    const notification = await db.OrderNotification.findByPk(id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (!name || !phoneNumber) {
      return res.status(400).json({ error: 'Name and phone number are required' });
    }

    await notification.update({
      name: name.trim(),
      phoneNumber: phoneNumber.trim(),
      isActive: isActive !== undefined ? isActive : notification.isActive,
      notes: notes !== undefined ? notes : notification.notes
    });

    res.json(notification);
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete order notification (admin)
router.delete('/order-notifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await db.OrderNotification.findByPk(id);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await notification.destroy();
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get SMS settings
router.get('/sms-settings', async (req, res) => {
  try {
    const setting = await db.Settings.findOne({ where: { key: 'smsEnabled' } });
    res.json({
      smsEnabled: setting?.value !== 'false' // Default to enabled if not set
    });
  } catch (error) {
    console.error('Error fetching SMS settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update SMS settings
router.put('/sms-settings', async (req, res) => {
  try {
    const { smsEnabled } = req.body;

    const [setting] = await db.Settings.findOrCreate({
      where: { key: 'smsEnabled' },
      defaults: { value: smsEnabled.toString() }
    });

    if (!setting.isNewRecord) {
      setting.value = smsEnabled.toString();
      await setting.save();
    }

    res.json({
      smsEnabled: setting.value === 'true'
    });
  } catch (error) {
    console.error('Error updating SMS settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get latest transactions (admin dashboard)
router.get('/latest-transactions', async (req, res) => {
  try {
    const transactions = await db.Transaction.findAll({
      order: [['createdAt', 'DESC']],
      limit: 10,
      include: [{
        model: db.Order,
        as: 'order',
        attributes: ['customerName', 'deliveryAddress']
      }]
    });

    const formatted = transactions.map(tx => {
      const amount = parseFloat(tx.amount) || 0;
      const status = typeof tx.get === 'function' ? tx.get('status') : tx.status;
      const paymentStatus = typeof tx.get === 'function' ? tx.get('paymentStatus') : tx.paymentStatus;
      const resolvedStatus = status || paymentStatus || null;
      let customerName = tx.customerName || tx.order?.customerName || null;

      if (!customerName && tx.paymentDetails) {
        try {
          const details = typeof tx.paymentDetails === 'string' ? JSON.parse(tx.paymentDetails) : tx.paymentDetails;
          customerName = details?.payerName || details?.customerName || null;
        } catch (error) {
          console.warn('Failed to parse paymentDetails for transaction', tx.id, error.message);
        }
      }

      // Ensure transactionType is always present (default to 'payment' if null, undefined, or empty)
      let transactionType = tx.transactionType;
      if (!transactionType || 
          typeof transactionType !== 'string' || 
          transactionType.trim() === '') {
        console.log(`⚠️  Latest Transactions: Transaction #${tx.id} has missing/null transactionType, defaulting to 'payment'`);
        transactionType = 'payment';
      }

      const isPOS = tx.order?.deliveryAddress === 'In-Store Purchase';
      
      return {
        id: tx.id,
        orderId: tx.orderId,
        transactionType: transactionType,
        amount: amount,
        paymentMethod: tx.paymentMethod || null,
        status: status || null,
        paymentStatus: paymentStatus || null,
        transactionStatus: resolvedStatus,
        customerName: customerName || 'Guest Customer',
        createdAt: tx.createdAt,
        driverId: tx.driverId || null,
        driverWalletId: tx.driverWalletId || null,
        isPOS: isPOS,
        deliveryAddress: tx.order?.deliveryAddress || null
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching latest transactions:', error);
    res.status(500).json({ error: 'Failed to fetch latest transactions' });
  }
});

// Get customers list (admin dashboard)
router.get('/customers', async (req, res) => {
  try {
    await syncCustomersFromOrders();

    const customers = await db.Customer.findAll({
      order: [['createdAt', 'DESC']]
    });

    const orders = await db.Order.findAll({
      attributes: ['id', 'customerName', 'customerPhone', 'customerEmail', 'totalAmount', 'tipAmount', 'status', 'paymentStatus', 'paymentType', 'paymentMethod', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });

    const ordersByPhone = new Map();
    const ordersByEmail = new Map();

    orders.forEach((order) => {
      const phoneKey = normalizePhoneNumber(order.customerPhone);
      if (phoneKey) {
        if (!ordersByPhone.has(phoneKey)) {
          ordersByPhone.set(phoneKey, []);
        }
        ordersByPhone.get(phoneKey).push(order);
      }

      if (order.customerEmail) {
        const emailKey = order.customerEmail.toLowerCase();
        if (!ordersByEmail.has(emailKey)) {
          ordersByEmail.set(emailKey, []);
        }
        ordersByEmail.get(emailKey).push(order);
      }
    });

    const formatted = customers.map((customer) => {
      try {
        const customerName = typeof customer.customerName === 'string'
          ? customer.customerName
          : (customer.customerName != null ? String(customer.customerName) : null);
        const username = typeof customer.username === 'string'
          ? customer.username
          : (customer.username != null ? String(customer.username) : null);
        const email = typeof customer.email === 'string'
          ? customer.email
          : (customer.email != null ? String(customer.email) : null);
        const phone = typeof customer.phone === 'string'
          ? customer.phone
          : (customer.phone != null ? String(customer.phone) : null);

        const phoneCandidate = phone || (/^\+?\d+$/.test(username || '') ? username : null);
        const phoneKey = normalizePhoneNumber(phoneCandidate);
        const ordersFromPhone = phoneKey ? (ordersByPhone.get(phoneKey) || []) : [];

        const emailKeys = new Set();
        if (email) {
          emailKeys.add(email.toLowerCase());
        }
        if (username && username.includes('@')) {
          emailKeys.add(username.toLowerCase());
        }

        const ordersFromEmail = Array.from(emailKeys).flatMap((key) => ordersByEmail.get(key) || []);

        const orderMap = new Map();
        [...ordersFromPhone, ...ordersFromEmail].forEach((order) => {
          orderMap.set(order.id, order);
        });

        const customerOrders = Array.from(orderMap.values()).sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );

        const totalOrders = customerOrders.length;
        const lastOrderAt = totalOrders ? customerOrders[0].createdAt : null;
        const firstOrderAt = totalOrders ? customerOrders[customerOrders.length - 1].createdAt : null;
        const totalSpent = customerOrders.reduce(
          (sum, order) => sum + (parseFloat(order.totalAmount) || 0),
          0
        );

        const dateJoinedCandidates = [customer.createdAt, firstOrderAt]
          .filter(Boolean)
          .map((date) => new Date(date));
        const dateJoined = dateJoinedCandidates.length
          ? new Date(
              Math.min(
                ...dateJoinedCandidates.map((d) => d.getTime())
              )
            )
          : customer.createdAt;

        return {
          id: customer.id,
          name: customerName || username || 'Customer',
          username,
          email,
          phone,
          createdAt: customer.createdAt,
          dateJoined,
          totalOrders,
          totalSpent,
          lastOrderAt
        };
      } catch (formatError) {
        console.error('Failed to format customer record', {
          id: customer?.id,
          rawCustomer: customer?.toJSON ? customer.toJSON() : customer,
          message: formatError?.message,
          stack: formatError?.stack
        });
        throw formatError;
      }
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching customers:', error?.stack || error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Get customer details
router.get('/customers/:id', async (req, res) => {
  try {
    const customer = await db.Customer.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const orderFilter = buildCustomerOrderFilter(customer);

    let orders = [];
    if (orderFilter) {
      orders = await db.Order.findAll({
        where: orderFilter,
        order: [['createdAt', 'DESC']],
        limit: 100
      });
    }

    const orderData = orders.map((order) => ({
      id: order.id,
      orderNumber: order.id,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
      totalAmount: parseFloat(order.totalAmount) || 0,
      tipAmount: parseFloat(order.tipAmount) || 0,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentType: order.paymentType,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt
    }));

    const totalOrders = orderData.length;
    const totalSpent = orderData.reduce((sum, order) => sum + (parseFloat(order.totalAmount) || 0), 0);
    const lastOrderAt = totalOrders ? orderData[0].createdAt : null;
    const firstOrderAt = totalOrders ? orderData[orderData.length - 1].createdAt : null;

    let transactions = [];
    if (orderFilter) {
      transactions = await db.Transaction.findAll({
        order: [['createdAt', 'DESC']],
        limit: 100,
        include: [{
          model: db.Order,
          as: 'order',
          attributes: ['id', 'customerName', 'customerPhone', 'customerEmail'],
          where: orderFilter
        }]
      });
    }

    const transactionData = transactions.map((tx) => ({
      id: tx.id,
      orderId: tx.orderId,
      transactionType: tx.transactionType,
      paymentMethod: tx.paymentMethod,
      amount: parseFloat(tx.amount) || 0,
      status: tx.status,
      paymentStatus: tx.paymentStatus,
      createdAt: tx.createdAt
    }));

    const dateJoinedCandidates = [customer.createdAt, firstOrderAt]
      .filter(Boolean)
      .map((date) => new Date(date));
    const dateJoined = dateJoinedCandidates.length
      ? new Date(
          Math.min(
            ...dateJoinedCandidates.map((d) => d.getTime())
          )
        )
      : customer.createdAt;

    res.json({
      customer: {
        id: customer.id,
        name: customer.customerName || customer.username || 'Customer',
        username: customer.username,
        email: customer.email,
        phone: customer.phone,
        createdAt: customer.createdAt
      },
      stats: {
        totalOrders,
        totalSpent,
        dateJoined,
        lastOrderAt
      },
      orders: orderData,
      transactions: transactionData
    });
  } catch (error) {
    console.error('Error fetching customer details:', error);
    res.status(500).json({ error: 'Failed to fetch customer details' });
  }
});

// Get latest OTP for a customer
router.get('/customers/:id/latest-otp', async (req, res) => {
  try {
    const customer = await db.Customer.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const otp = await findLatestOtpForPhone(customer.phone || customer.username);
    if (!otp) {
      return res.json({
        hasOtp: false,
        message: 'No active OTP found for this customer'
      });
    }

    const isExpired = otp.expiresAt ? new Date() > new Date(otp.expiresAt) : false;

    res.json({
      hasOtp: true,
      otpCode: otp.otpCode,
      expiresAt: otp.expiresAt,
      isExpired,
      createdAt: otp.createdAt,
      attempts: otp.attempts
    });
  } catch (error) {
    console.error('Error fetching customer OTP:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get latest orders (admin dashboard)
router.get('/latest-orders', async (req, res) => {
  try {
    const orders = await db.Order.findAll({
      attributes: ['id', 'customerName', 'status', 'totalAmount', 'createdAt', 'deliveryAddress'],
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    const formatted = orders.map(order => {
      const orderJson = order.toJSON();
      const isPOS = orderJson.deliveryAddress === 'In-Store Purchase';
      return {
        id: orderJson.id,
        orderNumber: orderJson.id,
        customerName: orderJson.customerName || 'Guest Customer',
        totalAmount: parseFloat(orderJson.totalAmount) || 0,
        status: orderJson.status,
        createdAt: orderJson.createdAt,
        isPOS: isPOS,
        deliveryAddress: orderJson.deliveryAddress,
        transactionNumber: null // Not available in orders table
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching latest orders:', error);
    res.status(500).json({ error: 'Failed to fetch latest orders' });
  }
});

// Get top inventory items by total quantity sold (admin dashboard)
router.get('/top-inventory-items', async (req, res) => {
  try {
    const totalOrders = await db.Order.count();

    const results = await db.OrderItem.findAll({
      attributes: [
        'drinkId',
        [db.sequelize.fn('SUM', db.sequelize.col('quantity')), 'totalQuantity'],
        [
          db.sequelize.fn('COUNT', db.sequelize.fn('DISTINCT', db.sequelize.col('orderId'))),
          'ordersCount'
        ]
      ],
      group: ['OrderItem.drinkId', 'drink.id', 'drink->category.id'],
      order: [[db.sequelize.fn('SUM', db.sequelize.col('quantity')), 'DESC']],
      include: [
        {
          model: db.Drink,
          as: 'drink',
          attributes: ['id', 'name', 'categoryId'],
          include: [{
            model: db.Category,
            as: 'category',
            attributes: ['id', 'name']
          }]
        }
      ]
    });

    const aggregated = results
      .filter((item) => item.drink)
      .map((item) => {
        const drink = item.drink;
        const totalQuantity = parseInt(item.get('totalQuantity'), 10) || 0;
        const ordersCount = parseInt(item.get('ordersCount'), 10) || 0;
        const ordersPercentage =
          totalOrders > 0 ? Number(((ordersCount / totalOrders) * 100).toFixed(1)) : 0;

        return {
          drinkId: drink.id,
          name: drink.name,
          category: drink.category ? drink.category.name : 'Uncategorized',
          totalQuantity,
          ordersCount,
          ordersPercentage
        };
      })
      .sort((a, b) => b.totalQuantity - a.totalQuantity);

    let finalList = aggregated.slice(0, 10);

    if (finalList.length < 10 && totalOrders > 0) {
      const eightyPercentThreshold = totalOrders * 0.8;
      const highCoverageItems = aggregated.filter((item) => item.ordersCount >= eightyPercentThreshold);

      const mergedMap = new Map();
      finalList.forEach((item) => mergedMap.set(item.drinkId, item));
      highCoverageItems.forEach((item) => {
        if (!mergedMap.has(item.drinkId)) {
          mergedMap.set(item.drinkId, item);
        }
      });

      finalList = Array.from(mergedMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
    }

    res.json(finalList);
  } catch (error) {
    console.error('Error fetching top inventory items:', error);
    res.status(500).json({ error: 'Failed to fetch top inventory items' });
  }
});

module.exports = router;
module.exports.verifyAdmin = verifyAdmin;
