const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');
const { getOrderFinancialBreakdown } = require('../utils/orderFinancials');
const { ensureDeliveryFeeSplit } = require('../utils/deliveryFeeTransactions');
const { creditWalletsOnDeliveryCompletion } = require('../utils/walletCredits');
const mpesaService = require('../services/mpesa');
const pushNotifications = require('../services/pushNotifications');
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

const buildAdminUserResponse = (adminInstance) => {
  if (!adminInstance) {
    return null;
  }
  const data = adminInstance.toJSON ? adminInstance.toJSON() : adminInstance;
  return {
    id: data.id,
    username: data.username,
    email: data.email,
    role: data.role || 'admin',
    name: data.name || null,
    mobileNumber: data.mobileNumber || null,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null
  };
};

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

// Admin login route - MUST be before router.use(verifyAdmin)
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Basic validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    const trimmedUsername = username.trim().toLowerCase();

    // Find admin user using Sequelize
    const adminUser = await db.Admin.findOne({
      where: {
        [Op.or]: [
          db.sequelize.where(
            db.sequelize.fn('LOWER', db.sequelize.col('username')),
            trimmedUsername
          ),
          db.sequelize.where(
            db.sequelize.fn('LOWER', db.sequelize.col('email')),
            trimmedUsername
          )
        ]
      },
      attributes: ['id', 'username', 'email', 'password', 'role', 'name', 'mobileNumber', 'createdAt', 'updatedAt'],
      raw: false // Return Sequelize instance, not plain object
    });

    if (!adminUser) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    // Check if password exists
    if (!adminUser.password) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, adminUser.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password'
      });
    }

    // Generate JWT token
    const tokenPayload = {
      id: adminUser.id,
      username: adminUser.username,
      role: adminUser.role || 'admin'
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: ADMIN_TOKEN_TTL
    });

    // Return success response
    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: buildAdminUserResponse(adminUser)
    });
  } catch (error) {
    console.error('Admin login error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to log in. Please try again.',
      ...(process.env.NODE_ENV === 'development' && {
        details: error.message
      })
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
        attributes: ['id', 'name', 'address', 'latitude', 'longitude']
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
      // Include all attributes by default (purchasePrice is included)
      include: [{
        model: db.Category,
        as: 'category'
      }, {
        model: db.SubCategory,
        as: 'subCategory'
      }, {
        model: db.Brand,
        as: 'brand'
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
      brandId,
      isAvailable,
      isPopular,
      isBrandFocus,
      limitedTimeOffer,
      capacity,
      capacityPricing,
      abv,
      purchasePrice
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

    let parsedBrandId = null;
    if (brandId !== undefined && brandId !== null && brandId !== '') {
      const parsed = parseInt(brandId, 10);
      if (Number.isNaN(parsed)) {
        return res.status(400).json({ error: 'brandId must be a number if provided' });
      }
      parsedBrandId = parsed;
    }

    // Handle purchasePrice calculation
    let finalPrice = price;
    let finalPurchasePrice = purchasePrice !== undefined && purchasePrice !== null 
      ? parseFloat(purchasePrice) 
      : null;
    
    // If purchasePrice is explicitly provided, use it
    if (purchasePrice !== undefined && purchasePrice !== null && !isNaN(parseFloat(purchasePrice))) {
      const parsedPurchasePrice = parseFloat(purchasePrice);
      if (parsedPurchasePrice > 0) {
        finalPurchasePrice = parsedPurchasePrice;
        // If purchasePrice is provided and price is not, auto-calculate price as 70% of purchasePrice
        if (price === undefined || price === null) {
          finalPrice = (parsedPurchasePrice * 0.7).toFixed(2);
        }
      }
    } else if (originalPrice !== undefined && originalPrice !== null && !isNaN(parseFloat(originalPrice))) {
      // If purchasePrice is not provided but originalPrice is, calculate purchasePrice as 70% of originalPrice
      const parsedOriginalPrice = parseFloat(originalPrice);
      if (parsedOriginalPrice > 0) {
        finalPurchasePrice = Math.round(parsedOriginalPrice * 0.7 * 100) / 100;
      }
    }

    const normalizedPricing = normalizeCapacityPricing(capacityPricing);
    const capacities = deriveCapacities(capacity, normalizedPricing);
    const summary = summarisePricing(normalizedPricing, finalPrice, originalPrice);
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
      brandId: parsedBrandId,
      isAvailable:
        typeof isAvailable === 'boolean' ? isAvailable : true,
      isPopular: typeof isPopular === 'boolean' ? isPopular : false,
      isBrandFocus: typeof isBrandFocus === 'boolean' ? isBrandFocus : false,
      limitedTimeOffer: limitedTimeFlag,
      isOnOffer: summary.isOnOffer,
      capacity: capacities,
      capacityPricing: normalizedPricing,
      abv: toNumber(abv),
      purchasePrice: finalPurchasePrice
    });

    const drinkWithRelations = await db.Drink.findByPk(newDrink.id, {
      include: [
        { model: db.Category, as: 'category' },
        { model: db.SubCategory, as: 'subCategory' },
        { model: db.Brand, as: 'brand' }
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
      brandId,
      isAvailable,
      isPopular,
      isBrandFocus,
      limitedTimeOffer,
      capacity,
      capacityPricing,
      abv,
      purchasePrice
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

    let parsedBrandId = null;
    if (brandId !== undefined && brandId !== null && brandId !== '') {
      const parsed = parseInt(brandId, 10);
      if (Number.isNaN(parsed)) {
        return res.status(400).json({ error: 'brandId must be a number if provided' });
      }
      parsedBrandId = parsed;
    }

    // Handle purchasePrice calculation
    let finalPrice = price;
    let finalPurchasePrice = purchasePrice !== undefined && purchasePrice !== null 
      ? parseFloat(purchasePrice) 
      : drink.purchasePrice;
    
    // If purchasePrice is explicitly provided, use it
    if (purchasePrice !== undefined && purchasePrice !== null && !isNaN(parseFloat(purchasePrice))) {
      const parsedPurchasePrice = parseFloat(purchasePrice);
      if (parsedPurchasePrice > 0) {
        finalPurchasePrice = parsedPurchasePrice;
        // If purchasePrice is provided and price is not, auto-calculate price as 70% of purchasePrice
        if (price === undefined || price === null) {
          finalPrice = (parsedPurchasePrice * 0.7).toFixed(2);
        }
      }
    } else if (originalPrice !== undefined && originalPrice !== null && !isNaN(parseFloat(originalPrice))) {
      // If purchasePrice is not provided but originalPrice is, calculate purchasePrice as 70% of originalPrice
      const parsedOriginalPrice = parseFloat(originalPrice);
      if (parsedOriginalPrice > 0) {
        finalPurchasePrice = Math.round(parsedOriginalPrice * 0.7 * 100) / 100;
      }
    } else if (drink.originalPrice && !finalPurchasePrice) {
      // If neither purchasePrice nor originalPrice is provided, but drink has originalPrice, calculate from it
      const parsedOriginalPrice = parseFloat(drink.originalPrice);
      if (parsedOriginalPrice > 0) {
        finalPurchasePrice = Math.round(parsedOriginalPrice * 0.7 * 100) / 100;
      }
    }

    const normalizedPricing = normalizeCapacityPricing(capacityPricing);
    const capacities = deriveCapacities(capacity, normalizedPricing);
    const summary = summarisePricing(normalizedPricing, finalPrice, originalPrice);
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
      brandId: parsedBrandId,
      isAvailable:
        autoAvailable !== undefined 
          ? autoAvailable 
          : (typeof isAvailable === 'boolean' ? isAvailable : drink.isAvailable),
      isPopular:
        typeof isPopular === 'boolean' ? isPopular : drink.isPopular,
      isBrandFocus:
        isBrandFocus !== undefined && isBrandFocus !== null
          ? (typeof isBrandFocus === 'boolean' ? isBrandFocus : Boolean(isBrandFocus))
          : drink.isBrandFocus,
      limitedTimeOffer: limitedTimeFlag,
      isOnOffer: summary.isOnOffer,
      capacity: capacities,
      capacityPricing: normalizedPricing,
      abv: toNumber(abv),
      stock: stockValue,
      purchasePrice: finalPurchasePrice !== undefined && finalPurchasePrice !== null 
        ? finalPurchasePrice 
        : drink.purchasePrice
      // isAvailable is set above based on stock if stock is being updated
      // brandId is set above
    });

    const updatedDrink = await db.Drink.findByPk(id, {
      include: [
        { model: db.Category, as: 'category' },
        { model: db.SubCategory, as: 'subCategory' },
        { model: db.Brand, as: 'brand' }
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

// Bulk populate purchase prices for all inventory items
// Purchase price = 70% of selling price (price field)
router.post('/drinks/populate-purchase-prices', async (req, res) => {
  try {
    // Get all drinks with prices
    const drinks = await db.Drink.findAll({
      where: {
        price: {
          [db.Sequelize.Op.gt]: 0
        }
      },
      attributes: ['id', 'name', 'price', 'purchasePrice']
    });

    if (drinks.length === 0) {
      return res.json({
        success: true,
        message: 'No drinks found to update',
        updated: 0,
        skipped: 0,
        total: 0
      });
    }

    let updated = 0;
    let skipped = 0;
    const errors = [];

    // Update each drink's purchase price
    for (const drink of drinks) {
      try {
        const sellingPrice = parseFloat(drink.price);
        if (sellingPrice <= 0) {
          skipped++;
          continue;
        }

        // Calculate purchase price as 70% of selling price
        const purchasePrice = Math.round(sellingPrice * 0.7 * 100) / 100;

        // Only update if purchase price is different (to avoid unnecessary updates)
        const currentPurchasePrice = drink.purchasePrice ? parseFloat(drink.purchasePrice) : null;
        if (currentPurchasePrice === null || Math.abs(currentPurchasePrice - purchasePrice) > 0.01) {
          await drink.update({ purchasePrice });
          updated++;
        } else {
          skipped++;
        }
      } catch (error) {
        errors.push({
          drinkId: drink.id,
          drinkName: drink.name,
          error: error.message
        });
        skipped++;
      }
    }

    res.json({
      success: true,
      message: `Purchase prices populated successfully. Updated: ${updated}, Skipped: ${skipped}`,
      updated,
      skipped,
      total: drinks.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error populating purchase prices:', error);
    res.status(500).json({ error: 'Failed to populate purchase prices' });
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
router.get('/orders', verifyAdmin, async (req, res) => {
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
            // Include all attributes by default (purchasePrice should be included)
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
    
    // Include Admin association if it exists (for POS orders)
    if (db.Admin && db.Order && db.Order.associations && db.Order.associations.servicedByAdmin) {
      orderIncludes.push({
        model: db.Admin,
        as: 'servicedByAdmin',
        required: false,
        attributes: ['id', 'username', 'name']
      });
    }
    
    // Include Branch association only if it exists and is properly set up
    try {
      if (db.Branch && db.Order && db.Order.associations && db.Order.associations.branch) {
        orderIncludes.push({
          model: db.Branch,
          as: 'branch',
          required: false,
          attributes: ['id', 'name', 'address', 'latitude', 'longitude']
        });
      }
    } catch (branchError) {
      console.warn('Warning: Could not include Branch association:', branchError.message);
      // Continue without Branch association
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
    console.error('Error stack:', error.stack);
    // Return more detailed error in development, generic in production
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Failed to fetch orders' 
      : (error.message || 'Failed to fetch orders');
    res.status(500).json({ error: errorMessage });
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

/**
 * Approve or reject driver cancellation request
 * PATCH /api/admin/orders/:id/cancellation-request
 */
router.patch('/orders/:id/cancellation-request', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { approved } = req.body;
    const adminId = req.admin.id;

    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'approved must be a boolean' });
    }

    const order = await db.Order.findByPk(id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!order.cancellationRequested) {
      return res.status(400).json({ error: 'No cancellation request found for this order' });
    }

    if (order.cancellationApproved !== null) {
      return res.status(400).json({ error: 'Cancellation request already processed' });
    }

    const now = new Date();

    if (approved) {
      // Approve cancellation - mark order as cancelled
      await order.update({
        cancellationApproved: true,
        cancellationApprovedAt: now,
        cancellationApprovedBy: adminId,
        status: 'cancelled',
        paymentStatus: 'cancelled'
      });

      // Add note
      const approvalNote = `[${now.toISOString()}] Cancellation approved by admin. Reason: ${order.cancellationReason || 'N/A'}`;
      order.notes = order.notes ? `${order.notes}\n${approvalNote}` : approvalNote;
      await order.save();

      console.log(`✅ Order #${order.id} cancellation approved by admin ${adminId}`);

      // Send push notification to driver
      if (order.driverId) {
        try {
          const driver = await db.Driver.findByPk(order.driverId);
          if (driver && driver.pushToken) {
            const message = {
              sound: 'default',
              title: '✅ Cancellation Approved',
              body: `Your cancellation request for Order #${order.id} has been approved. You can now accept new orders.`,
              data: {
                type: 'cancellation-approved',
                orderId: String(order.id),
                message: `Your cancellation request for Order #${order.id} has been approved. You can now accept new orders.`
              },
              priority: 'high',
              badge: 1,
              channelId: 'notifications',
            };
            
            const pushResult = await pushNotifications.sendFCMNotification(driver.pushToken, message);
            if (pushResult.success) {
              console.log(`✅ Push notification sent to driver ${driver.name} (ID: ${order.driverId}) for cancellation approval`);
            } else {
              console.error(`⚠️ Failed to send push notification to driver ${driver.name}:`, pushResult.error);
            }
          } else {
            console.log(`⚠️ Driver ${order.driverId} has no push token - notification not sent`);
          }
        } catch (pushError) {
          console.error(`❌ Error sending push notification for cancellation approval:`, pushError);
        }

        // Update driver status if they have no more active orders
        try {
          const { updateDriverStatusIfNoActiveOrders } = require('../utils/driverAssignment');
          await updateDriverStatusIfNoActiveOrders(order.driverId);
        } catch (driverStatusError) {
          console.error(`❌ Error updating driver status for cancelled Order #${order.id}:`, driverStatusError);
        }
      }
    } else {
      // Reject cancellation - keep order active
      await order.update({
        cancellationApproved: false,
        cancellationApprovedAt: now,
        cancellationApprovedBy: adminId,
        cancellationRequested: false // Reset cancellation request
      });

      // Add note
      const rejectionNote = `[${now.toISOString()}] Cancellation request rejected by admin. Order remains active.`;
      order.notes = order.notes ? `${order.notes}\n${rejectionNote}` : rejectionNote;
      await order.save();

      console.log(`❌ Order #${order.id} cancellation rejected by admin ${adminId}`);
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
          model: db.Driver,
          as: 'driver'
        }
      ]
    });

    let orderData = order.toJSON();
    if (orderData.items) {
      orderData.orderItems = orderData.items;
    }

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to('admin').emit('order-cancellation-processed', {
        orderId: order.id,
        approved: approved,
        order: orderData
      });

      if (order.driverId) {
        io.to(`driver-${order.driverId}`).emit('order-cancellation-processed', {
          orderId: order.id,
          approved: approved,
          order: orderData
        });
      }
    }

    res.json(orderData);
  } catch (error) {
    console.error('Error processing cancellation request:', error);
    res.status(500).json({ error: error.message });
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

// Prompt customer for payment (admin)
router.post('/orders/:id/prompt-payment', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await db.Order.findByPk(id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if order is pay on delivery
    if (order.paymentType !== 'pay_on_delivery') {
      return res.status(400).json({ error: 'Order is not pay on delivery' });
    }

    // Check if already paid
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ error: 'Order is already paid' });
    }

    // Format phone number
    const customerPhone = order.customerPhone;
    const cleanedPhone = customerPhone.replace(/\D/g, '');
    let formattedPhone = cleanedPhone;
    
    if (cleanedPhone.startsWith('0')) {
      formattedPhone = '254' + cleanedPhone.substring(1);
    } else if (!cleanedPhone.startsWith('254')) {
      formattedPhone = '254' + cleanedPhone;
    }

    // Initiate STK push
    const amount = parseFloat(order.totalAmount);
    const stkResult = await mpesaService.initiateSTKPush(
      formattedPhone,
      amount,
      order.id,
      `Payment for order #${order.id}`
    );

    // Check if STK push was initiated successfully
    if (stkResult.success || stkResult.checkoutRequestID || stkResult.CheckoutRequestID) {
      const checkoutRequestID = stkResult.checkoutRequestID || stkResult.CheckoutRequestID;
      const merchantRequestID = stkResult.merchantRequestID || stkResult.MerchantRequestID;
      
      // Store checkout request ID in order notes
      const checkoutNote = `M-Pesa CheckoutRequestID: ${checkoutRequestID} (Admin-initiated)`;
      await order.update({
        paymentMethod: 'mobile_money',
        notes: order.notes ? 
          `${order.notes}\n${checkoutNote}` : 
          checkoutNote
      });
      
      // Create transaction records for STK push initiation
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

        const paymentNote = `STK Push initiated by admin. Customer pays KES ${amount.toFixed(2)}. Item portion: KES ${itemsTotal.toFixed(2)}.${tipAmount > 0 ? ` Tip (KES ${tipAmount.toFixed(2)}) will be recorded separately.` : ''}`;

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
          console.log(`✅ Payment transaction updated for admin-initiated payment on Order #${order.id} (transaction #${paymentTransaction.id})`);
        } else {
          paymentTransaction = await db.Transaction.create({
            ...baseTransactionPayload,
            transactionType: 'payment',
            amount: itemsTotal,
            notes: paymentNote
          });
          console.log(`✅ Payment transaction created for admin-initiated payment on Order #${order.id} (transaction #${paymentTransaction.id})`);
        }

        const deliveryNote = driverPayAmount > 0
          ? `Delivery fee portion for Order #${id}. Merchant share: KES ${merchantDeliveryAmount.toFixed(2)}. Driver payout KES ${driverPayAmount.toFixed(2)} pending.`
          : `Delivery fee portion for Order #${id}. Amount: KES ${deliveryFee.toFixed(2)}. Included in same M-Pesa payment.`;

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
          console.log(`✅ Delivery fee transaction updated for Order #${id} (transaction #${deliveryTransaction.id})`);
        } else {
          deliveryTransaction = await db.Transaction.create({
            ...baseTransactionPayload,
            transactionType: 'delivery_pay',
            amount: merchantDeliveryAmount,
            notes: deliveryNote
          });
          console.log(`✅ Delivery fee transaction created for Order #${id} (transaction #${deliveryTransaction.id})`);
        }
      } catch (transactionError) {
        console.error('❌ Error preparing admin-initiated transactions:', transactionError);
        // Don't fail the STK push if transaction creation fails - log it but continue
        console.log('⚠️  Continuing with STK push despite transaction preparation error');
      }
      
      console.log(`✅ STK Push initiated by admin for Order #${id}. CheckoutRequestID: ${checkoutRequestID}`);
      
      res.json({
        success: true,
        message: 'Payment request sent to customer. Waiting for payment confirmation...',
        checkoutRequestID: checkoutRequestID,
        merchantRequestID: merchantRequestID,
        status: 'pending'
      });
    } else {
      res.status(500).json({
        success: false,
        error: stkResult.error || 'Failed to initiate payment request'
      });
    }
  } catch (error) {
    console.error('Error prompting payment:', error);
    res.status(500).json({ error: error.message });
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

    // Track if driver was auto-reassigned
    let driverWasReassigned = false;
    let oldDriverId = order.driverId;
    
    // If reassignDriver is true and new branch is set, find nearest active driver to new branch
    if (reassignDriver === true && newBranchId !== null) {
      const { findNearestActiveDriverToBranch } = require('../utils/driverAssignment');
      const nearestDriver = await findNearestActiveDriverToBranch(newBranchId);
      
      if (nearestDriver && nearestDriver.id !== oldDriverId) {
        await order.update({ 
          driverId: nearestDriver.id,
          driverAccepted: null // Reset to null so it appears as pending for new driver
        });
        driverWasReassigned = true;
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
        
        // If driver was auto-reassigned, also emit order-assigned event and send push notification
        if (driverWasReassigned && order.driver && order.driver.name !== 'HOLD Driver') {
          io.to(`driver-${order.driverId}`).emit('order-assigned', {
            order: orderData,
            playSound: true
          });
          console.log(`📢 Notified driver ${order.driver.name} (ID: ${order.driverId}) about auto-reassigned order #${order.id}`);
          
          // Send push notification to trigger OrderAcceptanceActivity
          if (order.driver.pushToken) {
            console.log(`📤 [BRANCH REASSIGN] Attempting to send push notification for order #${order.id} to driver ${order.driver.name} (ID: ${order.driverId})`);
            try {
              const pushResult = await pushNotifications.sendOrderNotification(
                order.driver.pushToken,
                order
              );
              if (pushResult.success) {
                console.log(`✅ [BRANCH REASSIGN] Push notification sent successfully to driver ${order.driver.name} (ID: ${order.driverId}) for order #${order.id}`);
              } else {
                console.error(`⚠️ [BRANCH REASSIGN] Push notification failed for driver ${order.driver.name} (ID: ${order.driverId}) for order #${order.id}`);
              }
            } catch (pushError) {
              console.error(`❌ [BRANCH REASSIGN] Error sending push notification to driver ${order.driver.name} (ID: ${order.driverId}):`, pushError);
            }
          } else {
            console.log(`⚠️ [BRANCH REASSIGN] Driver ${order.driver.name} (ID: ${order.driverId}) has NO push token registered - push notification NOT sent for order #${order.id}`);
          }
        }
      }
      
      // If old driver was removed, notify them
      if (oldDriverId && oldDriverId !== order.driverId) {
        io.to(`driver-${oldDriverId}`).emit('driver-removed', {
          orderId: order.id
        });
        
        // Send push notification to the previous driver
        try {
          const oldDriver = await db.Driver.findByPk(oldDriverId);
          if (oldDriver && oldDriver.pushToken) {
            console.log(`📤 Sending order reassignment notification to previous driver ${oldDriver.name} (ID: ${oldDriverId}) for order #${order.id} (branch change)`);
            const pushResult = await pushNotifications.sendOrderReassignmentNotification(
              oldDriver.pushToken,
              order
            );
            if (pushResult.success) {
              console.log(`✅ Order reassignment notification sent successfully to driver ${oldDriver.name} (ID: ${oldDriverId}) for order #${order.id}`);
            } else {
              console.error(`⚠️ Order reassignment notification failed for driver ${oldDriver.name} (ID: ${oldDriverId}) for order #${order.id}`);
              console.error(`⚠️ Failure details:`, pushResult);
            }
          } else {
            console.log(`⚠️ Previous driver ${oldDriverId} has no push token - reassignment notification not sent for order #${order.id}`);
          }
        } catch (pushError) {
          console.error(`❌ Error sending order reassignment notification to driver ${oldDriverId} for order #${order.id}:`, pushError);
          // Don't fail the request if push notification fails
        }
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
    const newDriverId = driverId ? parseInt(driverId) : null;
    console.log(`🔄 [DRIVER ASSIGNMENT] Order #${order.id}: oldDriverId=${oldDriverId}, newDriverId=${newDriverId || 'null'}`);

    // Update driver assignment
    // If assigning a driver (new or reassigning), reset driverAccepted to null so it appears as pending
    const updateData = { driverId: newDriverId };
    if (newDriverId) {
      // Always reset driverAccepted when assigning/reassigning a driver
      updateData.driverAccepted = null;
    }
    await order.update(updateData);

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

      // If driver was assigned (new assignment OR reassignment), ALWAYS notify the driver
      // This includes both first-time assignments and reassignments from another driver
      if (newDriverId) {
        const isReassignment = oldDriverId && oldDriverId !== newDriverId;
        console.log(`📤 [DRIVER ASSIGNMENT] ${isReassignment ? 'REASSIGNMENT' : 'NEW ASSIGNMENT'}: Driver ${newDriverId} for order #${order.id} (oldDriverId: ${oldDriverId || 'none'})`);
        
        const driver = await db.Driver.findByPk(newDriverId);
        if (!driver) {
          console.error(`❌ [MANUAL ASSIGN] Driver ID ${newDriverId} not found in database`);
        } else if (!driver.pushToken) {
          console.error(`❌ [MANUAL ASSIGN] Driver ${driver.name} (ID: ${newDriverId}) has NO push token registered - push notification NOT sent for order #${order.id}`);
        } else {
          console.log(`📤 [DRIVER ASSIGNMENT] Driver found: ${driver.name} (ID: ${newDriverId}), pushToken: exists`);
          
          // Send socket event if driver is connected
          const driverSocketMap = req.app.get('driverSocketMap');
          const driverSocketId = driverSocketMap ? driverSocketMap.get(parseInt(newDriverId)) : null;
          
          // Emit to driver room (works even if socket ID changes on reconnect)
          io.to(`driver-${newDriverId}`).emit('order-assigned', {
            order: orderData,
            playSound: true
          });
          console.log(`✅ [MANUAL ASSIGN] Socket event sent to driver-${newDriverId} room for order #${order.id}`);
          
          // Also emit to specific socket ID if available (for immediate delivery)
          if (driverSocketId) {
            console.log(`📡 [MANUAL ASSIGN] Also sending socket event directly to driver ${newDriverId} (socket: ${driverSocketId}) for order #${order.id}`);
            io.to(driverSocketId).emit('order-assigned', {
              order: orderData,
              playSound: true
            });
          } else {
            console.log(`⚠️⚠️⚠️ [MANUAL ASSIGN] WARNING: Driver ${newDriverId} not registered with socket! App may not be connected. Push notification will still be sent.`);
          }
          
          // ALWAYS send push notification when a driver is assigned (new or reassigned)
          // This is critical - driver must receive notification even if socket is not connected
          console.log(`📤 [MANUAL ASSIGN] Sending push notification for order #${order.id} to driver ${driver.name} (ID: ${newDriverId})`);
          console.log(`📤 [MANUAL ASSIGN] Order data: id=${orderData.id}, customerName=${orderData.customerName}, deliveryAddress=${orderData.deliveryAddress}, totalAmount=${orderData.totalAmount}`);
          
          // Use orderData (JSON) instead of order (Sequelize model) for push notification
          // Ensure we have all required fields
          const orderForNotification = {
            id: orderData.id || order.id,
            customerName: orderData.customerName || order.customerName || 'Customer',
            deliveryAddress: orderData.deliveryAddress || order.deliveryAddress || 'Address not provided',
            totalAmount: parseFloat(orderData.totalAmount || order.totalAmount || 0)
          };
          
          console.log(`📤 [MANUAL ASSIGN] Order for notification:`, JSON.stringify(orderForNotification));
          
          // CRITICAL: Send push notification synchronously with timeout to ensure it's sent
          // This is essential for reassignments - driver MUST receive notification
          try {
            const pushResult = await Promise.race([
              pushNotifications.sendOrderNotification(driver.pushToken, orderForNotification),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Push notification timeout')), 10000))
            ]);
            
            if (pushResult.success) {
              console.log(`✅✅✅ [MANUAL ASSIGN] Push notification SENT SUCCESSFULLY to driver ${driver.name} (ID: ${newDriverId}) for order #${order.id}`);
              console.log(`✅ [MANUAL ASSIGN] Push receipt:`, pushResult.receipt || pushResult.messageId);
            } else {
              console.error(`❌❌❌ [MANUAL ASSIGN] CRITICAL: Push notification FAILED for driver ${driver.name} (ID: ${newDriverId}) for order #${order.id}`);
              console.error(`❌ [MANUAL ASSIGN] Failure details:`, JSON.stringify(pushResult, null, 2));
              if (pushResult.receipt) {
                console.error(`❌ [MANUAL ASSIGN] Push receipt (failure):`, pushResult.receipt);
              }
            }
          } catch (pushError) {
            if (pushError.message === 'Push notification timeout') {
              console.error(`❌❌❌ [MANUAL ASSIGN] CRITICAL: Push notification TIMEOUT for driver ${driver.name} (ID: ${newDriverId}) for order #${order.id} - notification may not have been sent`);
            } else {
              console.error(`❌❌❌ [MANUAL ASSIGN] CRITICAL ERROR sending push notification to driver ${driver.name} (ID: ${newDriverId}):`, pushError);
              console.error(`❌ [MANUAL ASSIGN] Error stack:`, pushError.stack);
            }
          }
        }
      } else {
        console.log(`📤 [DRIVER ASSIGNMENT] No driver assigned (driverId is null) for order #${order.id}`);
      }

      // If driver was removed, notify the old driver
      // Check if oldDriverId exists and is different from new driverId (including when new is null)
      const driverWasRemoved = oldDriverId && (oldDriverId !== newDriverId);
      console.log(`🔍 [DRIVER ASSIGNMENT] Checking if driver was removed: oldDriverId=${oldDriverId}, newDriverId=${newDriverId || 'null'}, driverWasRemoved=${driverWasRemoved}`);
      
      if (driverWasRemoved) {
        console.log(`📤 [DRIVER REMOVAL] Sending notification to old driver ${oldDriverId} for order #${order.id}`);
        io.to(`driver-${oldDriverId}`).emit('driver-removed', {
          orderId: order.id
        });
        
        // Send push notification to the previous driver
        try {
          const oldDriver = await db.Driver.findByPk(oldDriverId);
          if (oldDriver) {
            console.log(`📤 [DRIVER REMOVAL] Old driver found: ${oldDriver.name} (ID: ${oldDriverId}), pushToken: ${oldDriver.pushToken ? 'exists' : 'missing'}`);
            if (oldDriver.pushToken) {
              console.log(`📤 [DRIVER REMOVAL] Sending order reassignment notification to previous driver ${oldDriver.name} (ID: ${oldDriverId}) for order #${order.id}`);
              // Use orderData (JSON) instead of order (Sequelize model) for push notification
              const orderForNotification = {
                id: orderData.id || order.id,
                customerName: orderData.customerName || order.customerName || 'Customer',
                deliveryAddress: orderData.deliveryAddress || order.deliveryAddress || 'Address not provided',
                totalAmount: parseFloat(orderData.totalAmount || order.totalAmount || 0)
              };
              const pushResult = await pushNotifications.sendOrderReassignmentNotification(
                oldDriver.pushToken,
                orderForNotification
              );
              if (pushResult.success) {
                console.log(`✅ [DRIVER REMOVAL] Order reassignment notification sent successfully to driver ${oldDriver.name} (ID: ${oldDriverId}) for order #${order.id}`);
              } else {
                console.error(`⚠️ [DRIVER REMOVAL] Order reassignment notification failed for driver ${oldDriver.name} (ID: ${oldDriverId}) for order #${order.id}`);
                console.error(`⚠️ [DRIVER REMOVAL] Failure details:`, pushResult);
              }
            } else {
              console.log(`⚠️ [DRIVER REMOVAL] Previous driver ${oldDriverId} has no push token - reassignment notification not sent for order #${order.id}`);
            }
          } else {
            console.error(`❌ [DRIVER REMOVAL] Old driver ${oldDriverId} not found in database`);
          }
        } catch (pushError) {
          console.error(`❌ [DRIVER REMOVAL] Error sending order reassignment notification to driver ${oldDriverId} for order #${order.id}:`, pushError);
          console.error(`❌ [DRIVER REMOVAL] Error stack:`, pushError.stack);
          // Don't fail the request if push notification fails
        }
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

    // For pay_on_delivery orders, check if payment prompt was sent
    if (order.paymentType === 'pay_on_delivery') {
      const hasPaymentPrompt = order.transactions && order.transactions.some(
        t => t.transactionType === 'payment' && t.checkoutRequestID
      );
      
      if (!hasPaymentPrompt) {
        // Log warning but allow admin to verify payment (they may have received cash or verified manually)
        console.log(`⚠️  WARNING: Admin verifying payment for Order #${order.id} (pay_on_delivery) without payment prompt being sent.`);
        console.log(`   This may indicate payment was received via cash or verified manually.`);
        console.log(`   Driver will see a warning that payment was marked as paid without prompt.`);
        
        // Add note to order about manual verification (this will be visible to driver)
        const verificationNote = `[ADMIN VERIFICATION] Payment verified manually by admin${receiptNumber ? ` (Receipt: ${receiptNumber})` : ''} without payment prompt being sent.`;
        const updatedNotes = order.notes ? `${order.notes}\n${verificationNote}` : verificationNote;
        
        // Update notes before updating payment status
        await order.update({ notes: updatedNotes });
      }
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

// Get WhatsApp invite link for a shop agent (must be before /users route)
router.get('/users/:id/whatsapp-link', async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await db.Admin.findByPk(id, {
      attributes: ['id', 'role', 'name', 'mobileNumber', 'inviteToken', 'inviteTokenExpiry', 'hasSetPin']
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role !== 'shop_agent') {
      return res.status(400).json({ error: 'WhatsApp link is only available for shop agents' });
    }

    if (!user.mobileNumber) {
      return res.status(400).json({ error: 'Shop agent mobile number is required' });
    }

    const whatsappService = require('../services/whatsapp');
    
    // Get shop agent app URL - prefer environment variable, then try to get ngrok URL, fallback to localhost
    let shopAgentAppUrl = process.env.SHOP_AGENT_APP_URL;
    
    if (!shopAgentAppUrl || shopAgentAppUrl.includes('localhost')) {
      // Try to get ngrok URL for port 3002
      try {
        const axios = require('axios');
        const ngrokResponse = await axios.get('http://localhost:4040/api/tunnels', { timeout: 2000 });
        const tunnels = ngrokResponse.data?.tunnels || [];
        const shopAgentTunnel = tunnels.find(t => 
          t.config?.addr?.includes(':3002') || t.config?.addr?.includes('localhost:3002')
        );
        if (shopAgentTunnel?.public_url) {
          shopAgentAppUrl = shopAgentTunnel.public_url;
          console.log(`✅ Using ngrok URL for shop agent app: ${shopAgentAppUrl}`);
        }
      } catch (ngrokError) {
        console.log('⚠️ Could not fetch ngrok URL, using default');
      }
    }
    
    // Don't use localhost - mobile devices can't access it
    // If no public URL is available, return an error
    if (!shopAgentAppUrl || shopAgentAppUrl.includes('localhost')) {
      return res.status(400).json({ 
        error: 'Shop agent app URL is not configured for mobile access',
        instructions: 'Please set SHOP_AGENT_APP_URL environment variable to a public URL (e.g., ngrok URL for port 3002). Localhost URLs will not work on mobile devices.',
        help: 'To fix this:\n1. Start ngrok: ngrok http 3002\n2. Set environment variable: SHOP_AGENT_APP_URL=https://your-ngrok-url.ngrok-free.dev\n3. Or use the ngrok API (already configured to auto-detect)'
      });
    }
    
    // Always direct to phone number entry page
    // Ensure URL starts with http:// or https:// for mobile WhatsApp to detect it
    let setupPinUrl = `${shopAgentAppUrl}/`;
    if (!setupPinUrl.startsWith('http://') && !setupPinUrl.startsWith('https://')) {
      setupPinUrl = `https://${setupPinUrl}`;
    }
    
    // Format message with URL on its own line, ensuring it's properly formatted
    // Mobile WhatsApp requires URLs to be on their own line and start with http:// or https://
    const message = `Hi ${user.name || 'there'}! 👋\n\nYou have been invited to the Dial A Drink Shop Agent App.\n\nClick or copy this link to get started:\n\n${setupPinUrl}\n\nWelcome aboard! 🎉`;
    
    const whatsappResult = whatsappService.sendCustomMessage(user.mobileNumber, message);
    
    if (whatsappResult.success) {
      return res.json({
        success: true,
        whatsappLink: whatsappResult.whatsappLink,
        message: message
      });
    } else {
      return res.status(500).json({
        error: whatsappResult.error || 'Failed to generate WhatsApp link'
      });
    }
  } catch (error) {
    console.error('Error generating WhatsApp link:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all admin users
router.get('/users', async (req, res) => {
  try {
    const users = await db.Admin.findAll({
      attributes: ['id', 'username', 'email', 'role', 'name', 'mobileNumber', 'createdAt', 'hasSetPin'],
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
    const { username, email, role, name, mobileNumber } = req.body;

    console.log('Creating user with data:', { role, username, email, name, mobileNumber });

    // For shop agents, name and mobileNumber are required instead of username/email
    // Normalize role to handle any case variations
    const normalizedRole = role ? role.trim().toLowerCase() : '';
    if (normalizedRole === 'shop_agent') {
      if (!name || !mobileNumber) {
        return res.status(400).json({ error: 'Name and mobile number are required for shop agents' });
      }

      // Generate username from mobile number (remove non-digits, use as username)
      const cleanMobile = mobileNumber.replace(/\D/g, '');
      const generatedUsername = `shop_agent_${cleanMobile}`;
      const generatedEmail = `${cleanMobile}@shopagent.local`;

      // Check if user already exists
      const existingUser = await db.Admin.findOne({
        where: {
          [Op.or]: [
            { username: generatedUsername },
            { email: generatedEmail },
            { mobileNumber: mobileNumber.trim() }
          ]
        }
      });

      if (existingUser) {
        return res.status(400).json({ error: 'Shop agent with this mobile number already exists' });
      }

      // Generate invite token for PIN setup
      const crypto = require('crypto');
      const inviteToken = crypto.randomBytes(32).toString('hex');
      const inviteTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Create shop agent
      const user = await db.Admin.create({
        username: generatedUsername,
        email: generatedEmail,
        role: 'shop_agent',
        password: null, // Shop agents don't need password/login
        name: name.trim(),
        mobileNumber: mobileNumber.trim(),
        inviteToken,
        inviteTokenExpiry,
        hasSetPin: false
      });

      // Generate WhatsApp invitation link
      let whatsappLink = null;
      try {
        const whatsappService = require('../services/whatsapp');
        
        // Get shop agent app URL - prefer environment variable, then try to get ngrok URL, fallback to localhost
        let shopAgentAppUrl = process.env.SHOP_AGENT_APP_URL;
        
        if (!shopAgentAppUrl || shopAgentAppUrl.includes('localhost')) {
          // Try to get ngrok URL for port 3002
          try {
            const axios = require('axios');
            const ngrokResponse = await axios.get('http://localhost:4040/api/tunnels', { timeout: 2000 });
            const tunnels = ngrokResponse.data?.tunnels || [];
            const shopAgentTunnel = tunnels.find(t => 
              t.config?.addr?.includes(':3002') || t.config?.addr?.includes('localhost:3002')
            );
            if (shopAgentTunnel?.public_url) {
              shopAgentAppUrl = shopAgentTunnel.public_url;
              console.log(`✅ Using ngrok URL for shop agent app: ${shopAgentAppUrl}`);
            }
          } catch (ngrokError) {
            console.log('⚠️ Could not fetch ngrok URL, using default');
          }
        }
        
        // Check if we have a valid public URL (not localhost)
        if (!shopAgentAppUrl || shopAgentAppUrl.includes('localhost')) {
          console.warn('⚠️ Shop agent app URL is set to localhost - WhatsApp link will not work on mobile devices.');
          console.warn('⚠️ Please set SHOP_AGENT_APP_URL environment variable or configure ngrok for port 3002.');
          // Don't fail user creation, but log the warning
        } else {
          // Always direct to phone number entry page
          // Ensure URL starts with http:// or https:// for mobile WhatsApp to detect it
          let setupPinUrl = `${shopAgentAppUrl}/`;
          if (!setupPinUrl.startsWith('http://') && !setupPinUrl.startsWith('https://')) {
            setupPinUrl = `https://${setupPinUrl}`;
          }
          
          // Format message with URL on its own line for mobile WhatsApp detection
          const message = `Hi ${name.trim()}! 👋\n\nYou have been invited to the Dial A Drink Shop Agent App.\n\nClick or copy this link to get started:\n\n${setupPinUrl}\n\nWelcome aboard! 🎉`;
          
          const whatsappResult = whatsappService.sendCustomMessage(mobileNumber.trim(), message);
          
          if (whatsappResult.success) {
            whatsappLink = whatsappResult.whatsappLink;
            console.log(`✅ WhatsApp invitation link generated for shop agent ${name} (${mobileNumber})`);
            console.log(`📱 WhatsApp link: ${whatsappLink}`);
          } else {
            console.error(`❌ Failed to generate WhatsApp invitation: ${whatsappResult.error}`);
          }
        }
      } catch (whatsappError) {
        console.error('❌ Error generating WhatsApp invitation:', whatsappError);
        // Don't fail user creation if WhatsApp fails
      }

      return res.status(201).json({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        name: user.name,
        mobileNumber: user.mobileNumber,
        createdAt: user.createdAt,
        whatsappLink: whatsappLink // Include WhatsApp link in response
      });
    }

    // For admin and manager roles, username and email are required
    // Skip this validation for shop_agent (already handled above)
    const normalizedRoleForValidation = role ? role.trim().toLowerCase() : '';
    if (normalizedRoleForValidation !== 'shop_agent' && (!username || !email)) {
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
/**
 * Get shift report - Calculate driver shift durations per day
 * GET /api/admin/shift-report
 * IMPORTANT: This route must be defined BEFORE any parameterized routes like /:id
 */
router.get('/shift-report', verifyAdmin, async (req, res) => {
  try {
    console.log('📊 Shift report request received:', req.query);
    const { startDate, endDate } = req.query;
    
    // Parse date range
    let start, end;
    if (startDate && endDate) {
      start = new Date(startDate);
      if (isNaN(start.getTime())) {
        throw new Error('Invalid startDate format');
      }
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      if (isNaN(end.getTime())) {
        throw new Error('Invalid endDate format');
      }
      // Include current day - set to current time if it's today, otherwise end of day
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDateOnly = new Date(end);
      endDateOnly.setHours(0, 0, 0, 0);
      
      if (endDateOnly.getTime() === today.getTime()) {
        // Current day - use current time
        end = new Date();
      } else {
        // Past day - use end of day
        end.setHours(23, 59, 59, 999);
      }
    } else {
      // Default to last 30 days, including current day
      end = new Date(); // Current time for today
      start = new Date(end);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    }

    console.log('📊 Date range:', { start: start.toISOString(), end: end.toISOString() });

    // Get all drivers
    const drivers = await db.Driver.findAll({
      order: [['name', 'ASC']]
    });

    console.log(`📊 Found ${drivers.length} drivers`);

    const now = new Date();
    const shiftReport = [];

    // For each driver, calculate shift time per day (with hourly tracking)
    for (const driver of drivers) {
      const driverShifts = [];
      
      // Group by day, but track hourly activity
      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);
        
        // Check if this is the current day
        const isCurrentDay = currentDate.toDateString() === now.toDateString();
        const effectiveDayEnd = isCurrentDay ? now : dayEnd;
        
        // Calculate shift time for this day with hourly breakdown
        const lastActivity = driver.lastActivity ? new Date(driver.lastActivity) : new Date(driver.updatedAt);
        const updatedAt = new Date(driver.updatedAt);
        
        let dayShiftDurationMs = 0;
        const hourlyShifts = {}; // Track shifts by hour for THIS day only
        
        // Check if driver was active during this day
        if (driver.status === 'active' || driver.status === 'on_delivery') {
          // Driver is currently active
          if (lastActivity >= dayStart && lastActivity <= effectiveDayEnd) {
            // Shift started today, calculate time until now
            dayShiftDurationMs = Math.max(0, effectiveDayEnd - lastActivity);
            
            // Track hourly: break down the shift by hour
            let currentHour = new Date(lastActivity);
            currentHour.setMinutes(0, 0, 0);
            
            while (currentHour < effectiveDayEnd) {
              const hourStart = new Date(Math.max(currentHour, lastActivity));
              const hourEnd = new Date(Math.min(
                new Date(currentHour.getTime() + 60 * 60 * 1000), // Next hour
                effectiveDayEnd
              ));
              
              const hourKey = currentHour.toISOString().slice(0, 13); // "2025-01-13T10"
              if (!hourlyShifts[hourKey]) {
                hourlyShifts[hourKey] = { start: hourStart, end: hourEnd, durationMs: 0 };
              }
              
              hourlyShifts[hourKey].durationMs += (hourEnd - hourStart);
              hourlyShifts[hourKey].end = hourEnd; // Update end time
              
              // Move to next hour
              currentHour = new Date(currentHour.getTime() + 60 * 60 * 1000);
            }
          } else if (lastActivity < dayStart && effectiveDayEnd >= dayStart) {
            // Shift started before this day but is still active today
            // Count from start of day until now
            dayShiftDurationMs = effectiveDayEnd - dayStart;
            
            // Track hourly for the full day
            let currentHour = new Date(dayStart);
            while (currentHour < effectiveDayEnd) {
              const hourStart = currentHour;
              const hourEnd = new Date(Math.min(
                new Date(currentHour.getTime() + 60 * 60 * 1000),
                effectiveDayEnd
              ));
              
              const hourKey = currentHour.toISOString().slice(0, 13);
              if (!hourlyShifts[hourKey]) {
                hourlyShifts[hourKey] = { start: hourStart, end: hourEnd, durationMs: 0 };
              }
              
              hourlyShifts[hourKey].durationMs += (hourEnd - hourStart);
              hourlyShifts[hourKey].end = hourEnd;
              
              currentHour = new Date(currentHour.getTime() + 60 * 60 * 1000);
            }
          } else if (lastActivity < dayStart && now > dayEnd) {
            // Shift started before this day and ended after this day, count full day
            dayShiftDurationMs = dayEnd - dayStart;
            
            // Track hourly for the full day
            let currentHour = new Date(dayStart);
            while (currentHour <= dayEnd) {
              const hourStart = currentHour;
              const hourEnd = new Date(Math.min(
                new Date(currentHour.getTime() + 60 * 60 * 1000),
                dayEnd
              ));
              
              const hourKey = currentHour.toISOString().slice(0, 13);
              if (!hourlyShifts[hourKey]) {
                hourlyShifts[hourKey] = { start: hourStart, end: hourEnd, durationMs: 0 };
              }
              
              hourlyShifts[hourKey].durationMs += (hourEnd - hourStart);
              hourlyShifts[hourKey].end = hourEnd;
              
              currentHour = new Date(currentHour.getTime() + 60 * 60 * 1000);
            }
          }
        } else {
          // Driver is not currently active
          // For historical days, estimate based on when driver was last active
          if (lastActivity >= dayStart && lastActivity <= dayEnd) {
            // Driver was active at some point today
            const shiftStart = updatedAt >= dayStart && updatedAt <= dayEnd && updatedAt < lastActivity
              ? updatedAt
              : dayStart;
            
            dayShiftDurationMs = Math.max(0, lastActivity - shiftStart);
            dayShiftDurationMs = Math.min(dayShiftDurationMs, 12 * 60 * 60 * 1000);
            
            // Track hourly for estimated shift
            let currentHour = new Date(shiftStart);
            currentHour.setMinutes(0, 0, 0);
            
            while (currentHour < lastActivity) {
              const hourStart = new Date(Math.max(currentHour, shiftStart));
              const hourEnd = new Date(Math.min(
                new Date(currentHour.getTime() + 60 * 60 * 1000),
                lastActivity
              ));
              
              const hourKey = currentHour.toISOString().slice(0, 13);
              if (!hourlyShifts[hourKey]) {
                hourlyShifts[hourKey] = { start: hourStart, end: hourEnd, durationMs: 0 };
              }
              
              hourlyShifts[hourKey].durationMs += (hourEnd - hourStart);
              hourlyShifts[hourKey].end = hourEnd;
              
              currentHour = new Date(currentHour.getTime() + 60 * 60 * 1000);
            }
          } else if (updatedAt >= dayStart && updatedAt <= dayEnd && driver.status === 'offline') {
            // Driver went offline on this day
            const shiftEnd = updatedAt;
            dayShiftDurationMs = Math.max(0, shiftEnd - dayStart);
            dayShiftDurationMs = Math.min(dayShiftDurationMs, 12 * 60 * 60 * 1000);
            
            // Track hourly
            let currentHour = new Date(dayStart);
            while (currentHour < shiftEnd) {
              const hourStart = currentHour;
              const hourEnd = new Date(Math.min(
                new Date(currentHour.getTime() + 60 * 60 * 1000),
                shiftEnd
              ));
              
              const hourKey = currentHour.toISOString().slice(0, 13);
              if (!hourlyShifts[hourKey]) {
                hourlyShifts[hourKey] = { start: hourStart, end: hourEnd, durationMs: 0 };
              }
              
              hourlyShifts[hourKey].durationMs += (hourEnd - hourStart);
              hourlyShifts[hourKey].end = hourEnd;
              
              currentHour = new Date(currentHour.getTime() + 60 * 60 * 1000);
            }
          }
        }
        
        if (dayShiftDurationMs > 0) {
          // Format date as YYYY-MM-DD in local timezone to avoid timezone issues
          const year = dayStart.getFullYear();
          const month = String(dayStart.getMonth() + 1).padStart(2, '0');
          const day = String(dayStart.getDate()).padStart(2, '0');
          const dateString = `${year}-${month}-${day}`;
          
          driverShifts.push({
            date: dateString,
            dateISO: dayStart.toISOString(), // Keep ISO for reference
            shiftDurationMs: dayShiftDurationMs,
            hourlyBreakdown: Object.keys(hourlyShifts)
              .filter(key => {
                const hourDate = new Date(key);
                return hourDate >= dayStart && hourDate <= dayEnd;
              })
              .map(key => ({
                hour: key,
                durationMs: hourlyShifts[key].durationMs,
                start: hourlyShifts[key].start.toISOString(),
                end: hourlyShifts[key].end.toISOString()
              }))
              .sort((a, b) => a.hour.localeCompare(b.hour))
          });
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Calculate total shift time for this driver
      const totalShiftMs = driverShifts.reduce((sum, shift) => sum + shift.shiftDurationMs, 0);
      
      if (driverShifts.length > 0 || totalShiftMs > 0) {
        shiftReport.push({
          driverId: driver.id,
          driverName: driver.name,
          phoneNumber: driver.phoneNumber,
          shifts: driverShifts,
          totalShiftMs: totalShiftMs
        });
      }
    }

    console.log(`📊 Generated shift report with ${shiftReport.length} drivers`);
    
    res.json({
      success: true,
      data: shiftReport,
      startDate: start.toISOString(),
      endDate: end.toISOString()
    });
  } catch (error) {
    console.error('❌ Error generating shift report:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to generate shift report' 
    });
  }
});

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

// Get customer's most recent order delivery address
router.get('/customers/:id/latest-address', async (req, res) => {
  try {
    const customer = await db.Customer.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Find most recent order for this customer
    const phone = customer.phone || customer.username;
    const email = customer.email;
    
    const whereClause = {
      [Op.or]: []
    };

    if (phone) {
      whereClause[Op.or].push({
        customerPhone: { [Op.like]: `%${phone}%` }
      });
    }

    if (email) {
      whereClause[Op.or].push({
        customerEmail: email
      });
    }

    if (whereClause[Op.or].length === 0) {
      return res.json({ deliveryAddress: null });
    }

    const mostRecentOrder = await db.Order.findOne({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      attributes: ['deliveryAddress']
    });

    if (mostRecentOrder && mostRecentOrder.deliveryAddress) {
      return res.json({ deliveryAddress: mostRecentOrder.deliveryAddress });
    }

    res.json({ deliveryAddress: null });
  } catch (error) {
    console.error('Error fetching customer latest address:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create customer
router.post('/customers', async (req, res) => {
  try {
    const { phone, customerName, email } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Check if customer already exists
    const existingCustomer = await db.Customer.findOne({
      where: {
        [Op.or]: [
          { phone: phone },
          { username: phone }
        ]
      }
    });

    if (existingCustomer) {
      return res.json({
        success: true,
        customer: {
          id: existingCustomer.id,
          name: existingCustomer.customerName || existingCustomer.username || 'Customer',
          username: existingCustomer.username,
          email: existingCustomer.email,
          phone: existingCustomer.phone,
          customerName: existingCustomer.customerName
        }
      });
    }

    // Create new customer
    const newCustomer = await db.Customer.create({
      phone: phone,
      username: phone,
      customerName: customerName || 'Online Customer',
      email: email || null
    });

    res.json({
      success: true,
      customer: {
        id: newCustomer.id,
        name: newCustomer.customerName || newCustomer.username || 'Customer',
        username: newCustomer.username,
        email: newCustomer.email,
        phone: newCustomer.phone,
        customerName: newCustomer.customerName
      }
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: error.message });
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

// Get inventory analytics (stock valuation, out of stock, slow-moving)
router.get('/inventory-analytics', verifyAdmin, async (req, res) => {
  try {
    // Get all drinks with their stock and purchase price
    const allDrinks = await db.Drink.findAll({
      attributes: ['id', 'name', 'stock', 'purchasePrice', 'isAvailable', 'price', 'originalPrice'],
      include: [{
        model: db.Category,
        as: 'category',
        attributes: ['id', 'name']
      }],
      order: [['name', 'ASC']]
    });

    // Calculate stock valuation (sum of stock * purchasePrice)
    let totalStockValuation = 0;
    const drinksWithValuation = allDrinks.map(drink => {
      const stock = parseInt(drink.stock) || 0;
      const purchasePrice = parseFloat(drink.purchasePrice) || 0;
      const valuation = stock * purchasePrice;
      totalStockValuation += valuation;
      
      return {
        id: drink.id,
        name: drink.name,
        stock: stock,
        purchasePrice: purchasePrice,
        valuation: valuation,
        category: drink.category
      };
    });

    // Get out of stock items (stock = 0 or isAvailable = false)
    const outOfStockItems = allDrinks.filter(drink => {
      const stock = parseInt(drink.stock) || 0;
      return stock === 0 || drink.isAvailable === false;
    }).map(drink => ({
      id: drink.id,
      name: drink.name,
      stock: parseInt(drink.stock) || 0,
      purchasePrice: parseFloat(drink.purchasePrice) || 0,
      price: parseFloat(drink.price) || 0,
      originalPrice: parseFloat(drink.originalPrice) || 0,
      category: drink.category ? {
        id: drink.category.id,
        name: drink.category.name
      } : null
    }));

    // Get slow-moving stock (no sales in completed orders in the last 3 months)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Get all drinks that have been sold in completed orders in the last 3 months
    const recentlySoldDrinks = await db.OrderItem.findAll({
      attributes: [
        'drinkId',
        [db.sequelize.fn('MAX', db.sequelize.col('Order.updatedAt')), 'lastSoldDate']
      ],
      include: [{
        model: db.Order,
        as: 'order',
        attributes: [],
        where: {
          status: 'completed',
          updatedAt: {
            [Op.gte]: threeMonthsAgo
          }
        },
        required: true
      }],
      group: ['OrderItem.drinkId'],
      raw: true
    });

    // Get last sale date for ALL drinks (even if older than 3 months)
    const allLastSales = await db.OrderItem.findAll({
      attributes: [
        'drinkId',
        [db.sequelize.fn('MAX', db.sequelize.col('Order.updatedAt')), 'lastSoldDate']
      ],
      include: [{
        model: db.Order,
        as: 'order',
        attributes: [],
        where: {
          status: 'completed'
        },
        required: true
      }],
      group: ['OrderItem.drinkId'],
      raw: true
    });

    const recentlySoldDrinkIds = new Set(recentlySoldDrinks.map(item => item.drinkId));
    const lastSaleMap = new Map();
    allLastSales.forEach(item => {
      lastSaleMap.set(item.drinkId, item.lastSoldDate);
    });

    // Find drinks that are NOT in the recently sold list (no sales in last 3 months)
    const slowMovingItems = allDrinks
      .filter(drink => !recentlySoldDrinkIds.has(drink.id))
      .map(drink => ({
        id: drink.id,
        name: drink.name,
        stock: parseInt(drink.stock) || 0,
        purchasePrice: parseFloat(drink.purchasePrice) || 0,
        price: parseFloat(drink.price) || 0,
        originalPrice: parseFloat(drink.originalPrice) || 0,
        lastSoldDate: lastSaleMap.get(drink.id) || null,
        category: drink.category ? {
          id: drink.category.id,
          name: drink.category.name
        } : null
      }));

    res.json({
      success: true,
      stockValuation: {
        total: totalStockValuation,
        currency: 'KES',
        itemCount: allDrinks.length
      },
      outOfStock: {
        items: outOfStockItems,
        count: outOfStockItems.length
      },
      slowMoving: {
        items: slowMovingItems,
        count: slowMovingItems.length,
        thresholdMonths: 3
      }
    });
  } catch (error) {
    console.error('Error fetching inventory analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch inventory analytics'
    });
  }
});

/**
 * Get all inventory checks
 * GET /api/admin/inventory-checks
 */
router.get('/inventory-checks', verifyAdmin, async (req, res) => {
  try {
    const { status, flagged } = req.query;

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }
    if (flagged !== undefined) {
      whereClause.isFlagged = flagged === 'true';
    }

    const inventoryChecks = await db.InventoryCheck.findAll({
      where: whereClause,
      include: [
        {
          model: db.Admin,
          as: 'shopAgent',
          attributes: ['id', 'name', 'mobileNumber']
        },
        {
          model: db.Drink,
          as: 'drink',
          attributes: ['id', 'name', 'barcode', 'stock'],
          include: [{
            model: db.Category,
            as: 'category',
            attributes: ['id', 'name']
          }]
        },
        {
          model: db.Admin,
          as: 'approver',
          attributes: ['id', 'name', 'username'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      checks: inventoryChecks.map(check => ({
        id: check.id,
        shopAgent: check.shopAgent ? {
          id: check.shopAgent.id,
          name: check.shopAgent.name,
          mobileNumber: check.shopAgent.mobileNumber
        } : null,
        drink: check.drink ? {
          id: check.drink.id,
          name: check.drink.name,
          barcode: check.drink.barcode,
          currentStock: check.drink.stock || 0,
          category: check.drink.category ? {
            id: check.drink.category.id,
            name: check.drink.category.name
          } : null
        } : null,
        agentCount: check.agentCount,
        databaseCount: check.databaseCount,
        status: check.status,
        isFlagged: check.isFlagged,
        approvedBy: check.approver ? {
          id: check.approver.id,
          name: check.approver.name || check.approver.username
        } : null,
        approvedAt: check.approvedAt,
        notes: check.notes,
        createdAt: check.createdAt,
        updatedAt: check.updatedAt
      }))
    });
  } catch (error) {
    console.error('Error fetching inventory checks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inventory checks'
    });
  }
});

/**
 * Approve inventory check
 * POST /api/admin/inventory-checks/:checkId/approve
 */
router.post('/inventory-checks/:checkId/approve', verifyAdmin, async (req, res) => {
  try {
    const { checkId } = req.params;
    const { updateStock, notes } = req.body;
    const adminId = req.admin.id;

    const inventoryCheck = await db.InventoryCheck.findByPk(checkId, {
      include: [
        {
          model: db.Drink,
          as: 'drink'
        },
        {
          model: db.Admin,
          as: 'shopAgent',
          attributes: ['id', 'name', 'mobileNumber']
        }
      ]
    });

    if (!inventoryCheck) {
      return res.status(404).json({
        success: false,
        error: 'Inventory check not found'
      });
    }

    // Update inventory check status
    await inventoryCheck.update({
      status: 'approved',
      approvedBy: adminId,
      approvedAt: new Date(),
      notes: notes || inventoryCheck.notes
    });

    // If updateStock is true, update the drink stock to match agent count
    if (updateStock === true && inventoryCheck.drink) {
      await inventoryCheck.drink.update({
        stock: inventoryCheck.agentCount
      });
    }

    res.json({
      success: true,
      message: 'Inventory check approved',
      check: {
        id: inventoryCheck.id,
        status: inventoryCheck.status,
        approvedBy: adminId,
        stockUpdated: updateStock === true
      }
    });
  } catch (error) {
    console.error('Error approving inventory check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve inventory check'
    });
  }
});

/**
 * Request recount for inventory check
 * POST /api/admin/inventory-checks/:checkId/request-recount
 */
router.post('/inventory-checks/:checkId/request-recount', verifyAdmin, async (req, res) => {
  try {
    const { checkId } = req.params;
    const { notes } = req.body;

    const inventoryCheck = await db.InventoryCheck.findByPk(checkId, {
      include: [
        {
          model: db.Drink,
          as: 'drink'
        },
        {
          model: db.Admin,
          as: 'shopAgent',
          attributes: ['id', 'name', 'mobileNumber']
        }
      ]
    });

    if (!inventoryCheck) {
      return res.status(404).json({
        success: false,
        error: 'Inventory check not found'
      });
    }

    // Update status to recount_requested
    await inventoryCheck.update({
      status: 'recount_requested',
      notes: notes || inventoryCheck.notes
    });

    // Create notification for shop agent
    try {
      await db.Notification.create({
        sentBy: req.admin.id,
        recipientType: 'shop_agent',
        recipientId: inventoryCheck.shopAgentId,
        type: 'inventory_recount',
        title: 'Inventory Recount Requested',
        message: `A recount has been requested for ${inventoryCheck.drink?.name || 'an item'}. Please submit a new inventory check.`,
        data: {
          checkId: inventoryCheck.id,
          drinkId: inventoryCheck.drinkId,
          drinkName: inventoryCheck.drink?.name
        }
      });
    } catch (notifError) {
      console.error('Error creating notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.json({
      success: true,
      message: 'Recount requested. Shop agent has been notified.',
      check: {
        id: inventoryCheck.id,
        status: inventoryCheck.status
      }
    });
  } catch (error) {
    console.error('Error requesting recount:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to request recount'
    });
  }
});

// Get sales analytics (online sales, admin sales, admin cash at hand)
router.get('/sales-analytics', verifyAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Set date range (default to last 30 days)
    let start, end;
    if (startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      end = new Date();
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    }

    // Get online sales (customer orders - adminOrder = false)
    const onlineOrders = await db.Order.findAll({
      where: {
        adminOrder: false,
        status: {
          [Op.in]: ['completed', 'delivered']
        },
        createdAt: {
          [Op.between]: [start, end]
        }
      },
      attributes: ['id', 'totalAmount', 'createdAt', 'paymentStatus', 'paymentMethod'],
      order: [['createdAt', 'DESC']]
    });

    const onlineSalesTotal = onlineOrders.reduce((sum, order) => {
      return sum + (parseFloat(order.totalAmount) || 0);
    }, 0);

    // Get admin sales (adminOrder = true) grouped by admin
    const adminOrders = await db.Order.findAll({
      where: {
        adminOrder: true,
        status: {
          [Op.in]: ['completed', 'delivered']
        },
        createdAt: {
          [Op.between]: [start, end]
        }
      },
      include: [{
        model: db.Admin,
        as: 'servicedByAdmin',
        attributes: ['id', 'name', 'username', 'email'],
        required: false
      }],
      attributes: ['id', 'totalAmount', 'createdAt', 'paymentStatus', 'paymentMethod', 'adminId'],
      order: [['createdAt', 'DESC']]
    });

    // Group admin sales by admin
    const adminSalesByAdmin = {};
    adminOrders.forEach(order => {
      const adminId = order.adminId || 'unassigned';
      const adminName = order.servicedByAdmin 
        ? (order.servicedByAdmin.name || order.servicedByAdmin.username || `Admin #${adminId}`)
        : 'Unassigned';
      
      if (!adminSalesByAdmin[adminId]) {
        adminSalesByAdmin[adminId] = {
          adminId: adminId,
          adminName: adminName,
          orders: [],
          totalSales: 0,
          orderCount: 0
        };
      }
      
      adminSalesByAdmin[adminId].orders.push({
        id: order.id,
        totalAmount: parseFloat(order.totalAmount) || 0,
        createdAt: order.createdAt,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod
      });
      
      adminSalesByAdmin[adminId].totalSales += parseFloat(order.totalAmount) || 0;
      adminSalesByAdmin[adminId].orderCount += 1;
    });

    const adminSalesList = Object.values(adminSalesByAdmin).sort((a, b) => b.totalSales - a.totalSales);
    const totalAdminSales = adminSalesList.reduce((sum, admin) => sum + admin.totalSales, 0);

    // Get admin cash at hand (from AdminWallet)
    let adminWallet = await db.AdminWallet.findOne({ where: { id: 1 } });
    if (!adminWallet) {
      adminWallet = await db.AdminWallet.create({
        id: 1,
        balance: 0,
        totalRevenue: 0,
        totalOrders: 0
      });
    }

    // Calculate cash at hand from cash transactions
    // Cash at hand = Cash received from cash orders - Cash settlements
    const cashOrders = await db.Order.findAll({
      where: {
        adminOrder: true,
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        status: {
          [Op.in]: ['completed', 'delivered']
        }
      },
      attributes: ['id', 'totalAmount', 'createdAt']
    });

    const cashReceived = cashOrders.reduce((sum, order) => {
      return sum + (parseFloat(order.totalAmount) || 0);
    }, 0);

    // Get cash settlements (cash remitted/submitted)
    const cashSettlements = await db.Transaction.findAll({
      where: {
        transactionType: 'cash_settlement',
        status: 'completed',
        amount: {
          [Op.lt]: 0 // Negative amounts (cash remitted)
        }
      },
      attributes: ['id', 'amount', 'createdAt', 'notes']
    });

    const cashRemitted = Math.abs(cashSettlements.reduce((sum, tx) => {
      return sum + (parseFloat(tx.amount) || 0);
    }, 0));

    // Also check admin cash submissions
    const adminCashSubmissions = await db.CashSubmission.findAll({
      where: {
        driverId: null, // Admin submissions (driverId is null for admin)
        status: 'approved'
      },
      attributes: ['id', 'amount', 'createdAt']
    });

    const adminCashSubmitted = adminCashSubmissions.reduce((sum, submission) => {
      return sum + (parseFloat(submission.amount) || 0);
    }, 0);

    const calculatedCashAtHand = Math.max(0, cashReceived - cashRemitted - adminCashSubmitted);

    res.json({
      success: true,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      onlineSales: {
        total: onlineSalesTotal,
        orderCount: onlineOrders.length,
        orders: onlineOrders.map(order => ({
          id: order.id,
          totalAmount: parseFloat(order.totalAmount) || 0,
          createdAt: order.createdAt,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod
        }))
      },
      adminSales: {
        total: totalAdminSales,
        totalOrderCount: adminOrders.length,
        byAdmin: adminSalesList
      },
      adminCashAtHand: {
        walletBalance: parseFloat(adminWallet.balance) || 0,
        calculatedCashAtHand: calculatedCashAtHand,
        cashReceived: cashReceived,
        cashRemitted: cashRemitted,
        cashSubmitted: adminCashSubmitted,
        currency: 'KES'
      }
    });
  } catch (error) {
    console.error('Error fetching sales analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch sales analytics'
    });
  }
});

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

/**
 * Settle driver balance (admin initiated with PIN verification)
 * POST /api/admin/drivers/:driverId/settle-balance
 */
router.post('/drivers/:driverId/settle-balance', async (req, res) => {
  try {
    const { driverId } = req.params;
    const { amount, pin } = req.body;

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    }

    const settlementAmount = parseFloat(amount);

    // Find driver
    const driver = await db.Driver.findByPk(driverId);
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Verify PIN
    if (!driver.pinHash) {
      return res.status(400).json({ error: 'Driver PIN not set. Please ask driver to set up their PIN first.' });
    }

    const isPinValid = await bcrypt.compare(pin, driver.pinHash);
    if (!isPinValid) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }

    // Calculate balance owed
    const balanceOwed = (driver.driverPayAmount || 0) - (driver.driverPayCredited || 0);

    // Validate amount doesn't exceed balance owed
    if (settlementAmount > balanceOwed) {
      return res.status(400).json({ 
        error: `Settlement amount (KES ${settlementAmount.toFixed(2)}) cannot exceed balance owed (KES ${balanceOwed.toFixed(2)})` 
      });
    }

    // Update driver's credited amount
    const newCreditedAmount = (driver.driverPayCredited || 0) + settlementAmount;
    await driver.update({
      driverPayCredited: newCreditedAmount
    });

    // Create transaction record for the settlement
    const settlementTransaction = await db.Transaction.create({
      driverId: driver.id,
      orderId: null,
      transactionType: 'cash_settlement',
      paymentMethod: 'cash',
      amount: -settlementAmount, // Negative because it's money going from driver to business
      status: 'completed',
      paymentStatus: 'paid',
      notes: `Balance settlement initiated by admin. Amount: KES ${settlementAmount.toFixed(2)}. PIN verified.`,
      transactionDate: new Date()
    });

    console.log(`✅ Driver balance settled: ${driver.name} (ID: ${driver.id}) - Amount: KES ${settlementAmount.toFixed(2)}`);

    res.json({
      success: true,
      message: `Balance settlement of KES ${settlementAmount.toFixed(2)} processed successfully`,
      transaction: {
        id: settlementTransaction.id,
        amount: settlementAmount,
        date: settlementTransaction.createdAt
      },
      driver: {
        id: driver.id,
        name: driver.name,
        balanceOwed: balanceOwed - settlementAmount,
        driverPayCredited: newCreditedAmount
      }
    });
  } catch (error) {
    console.error('Error settling driver balance:', error);
    res.status(500).json({ error: error.message || 'Failed to settle driver balance' });
  }
});

/**
 * Get driver locations
 * GET /api/admin/drivers/locations
 */
router.get('/drivers/locations', verifyAdmin, async (req, res) => {
  try {
    // Try to get drivers with location data
    // Check which location columns exist in the Driver model
    const driverAttributes = ['id', 'name', 'phoneNumber', 'status', 'lastActivity'];
    const locationAttributes = [];
    const locationWhere = {};
    
    // Check if location columns exist in the model
    if (db.Driver.rawAttributes && db.Driver.rawAttributes.latitude) {
      driverAttributes.push('latitude');
      locationAttributes.push('latitude');
      locationWhere.latitude = { [Op.ne]: null };
    }
    if (db.Driver.rawAttributes && db.Driver.rawAttributes.longitude) {
      driverAttributes.push('longitude');
      locationAttributes.push('longitude');
      if (locationAttributes.length === 1) {
        locationWhere.longitude = { [Op.ne]: null };
      } else {
        locationWhere[Op.and] = [
          { latitude: { [Op.ne]: null } },
          { longitude: { [Op.ne]: null } }
        ];
      }
    }
    
    // If no location columns found, return empty array
    if (locationAttributes.length === 0) {
      return res.json({
        success: true,
        locations: []
      });
    }
    
    const drivers = await db.Driver.findAll({
      attributes: driverAttributes,
      where: locationWhere
    });
    
    const locations = drivers.map(driver => ({
      id: driver.id,
      name: driver.name,
      phoneNumber: driver.phoneNumber,
      status: driver.status,
      latitude: parseFloat(driver.latitude || 0),
      longitude: parseFloat(driver.longitude || 0),
      lastActivity: driver.lastActivity
    }));
    
    res.json({
      success: true,
      locations
    });
  } catch (error) {
    console.error('Error fetching driver locations:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch driver locations' });
  }
});

/**
 * Update order delivery sequence
 * PATCH /api/admin/orders/:id/sequence
 */
router.patch('/orders/:id/sequence', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { deliverySequence } = req.body;

    const order = await db.Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await order.update({ deliverySequence: deliverySequence !== undefined ? deliverySequence : null });

    res.json({
      success: true,
      order: order.toJSON()
    });
  } catch (error) {
    console.error('Error updating order sequence:', error);
    res.status(500).json({ error: error.message || 'Failed to update order sequence' });
  }
});

/**
 * Create a stop
 * POST /api/admin/stops
 */
router.post('/stops', verifyAdmin, async (req, res) => {
  try {
    const { driverId, name, location, instruction, payment, insertAfterIndex, sequence } = req.body;

    if (!driverId || !name || !location) {
      return res.status(400).json({ error: 'driverId, name, and location are required' });
    }

    const stop = await db.Stop.create({
      driverId,
      name,
      location,
      instruction: instruction || null,
      payment: payment ? parseFloat(payment) : 0,
      insertAfterIndex: insertAfterIndex !== undefined ? insertAfterIndex : -1,
      sequence: sequence !== undefined ? sequence : 0
    });

    res.status(201).json({
      success: true,
      stop: stop.toJSON()
    });
  } catch (error) {
    console.error('Error creating stop:', error);
    res.status(500).json({ error: error.message || 'Failed to create stop' });
  }
});

/**
 * Update a stop
 * PATCH /api/admin/stops/:id
 */
router.patch('/stops/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { driverId, name, location, instruction, payment, insertAfterIndex, sequence } = req.body;

    const stop = await db.Stop.findByPk(id);
    if (!stop) {
      return res.status(404).json({ error: 'Stop not found' });
    }

    const updateData = {};
    if (driverId !== undefined) updateData.driverId = driverId;
    if (name !== undefined) updateData.name = name;
    if (location !== undefined) updateData.location = location;
    if (instruction !== undefined) updateData.instruction = instruction;
    if (payment !== undefined) updateData.payment = parseFloat(payment);
    if (insertAfterIndex !== undefined) updateData.insertAfterIndex = insertAfterIndex;
    if (sequence !== undefined) updateData.sequence = sequence;

    await stop.update(updateData);

    res.json({
      success: true,
      stop: stop.toJSON()
    });
  } catch (error) {
    console.error('Error updating stop:', error);
    res.status(500).json({ error: error.message || 'Failed to update stop' });
  }
});

/**
 * Delete a stop
 * DELETE /api/admin/stops/:id
 */
router.delete('/stops/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const stop = await db.Stop.findByPk(id);
    if (!stop) {
      return res.status(404).json({ error: 'Stop not found' });
    }

    await stop.destroy();

    res.json({
      success: true,
      message: 'Stop deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting stop:', error);
    res.status(500).json({ error: error.message || 'Failed to delete stop' });
  }
});

/**
 * Get stops for a driver
 * GET /api/admin/stops/driver/:driverId
 */
router.get('/stops/driver/:driverId', verifyAdmin, async (req, res) => {
  try {
    const { driverId } = req.params;

    const stops = await db.Stop.findAll({
      where: { driverId },
      order: [['insertAfterIndex', 'ASC'], ['sequence', 'ASC']]
    });

    res.json({
      success: true,
      stops: stops.map(stop => stop.toJSON())
    });
  } catch (error) {
    console.error('Error fetching stops:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch stops' });
  }
});

/**
 * Alert admin about driver missing location
 * POST /api/admin/driver-location-alert
 */
router.post('/driver-location-alert', async (req, res) => {
  try {
    const { driverId, message } = req.body;

    if (!driverId) {
      return res.status(400).json({ error: 'Driver ID is required' });
    }

    const driver = await db.Driver.findByPk(driverId);
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    const io = req.app.get('io');
    if (io) {
      // Emit alert to admin room
      io.to('admin').emit('driver-location-alert', {
        driverId: driverId,
        driverName: driver.name,
        driverPhone: driver.phoneNumber,
        message: message || `Driver ${driver.name} (ID: ${driverId}) does not have location set. Please ensure location services are enabled.`,
        timestamp: new Date()
      });
      console.log(`📢 Alerted admin about missing location for driver ${driver.name} (ID: ${driverId})`);
    }

    res.json({
      success: true,
      message: 'Admin alerted successfully'
    });
  } catch (error) {
    console.error('Error alerting admin about driver location:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
module.exports.verifyAdmin = verifyAdmin;
