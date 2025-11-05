const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const db = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const smsService = require('../services/sms');
const emailService = require('../services/email');
const crypto = require('crypto');


// Middleware to verify admin token
const verifyAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    req.adminId = decoded.id;
    req.adminUsername = decoded.username;
    
    // If role is missing from token, fetch from database
    if (!decoded.role) {
      try {
        const admin = await db.Admin.findByPk(decoded.id);
        if (admin) {
          const role = admin.role || 'admin';
          req.adminRole = role;
          // Update database if role was missing
          if (!admin.role) {
            await admin.update({ role: 'admin' });
          }
        } else {
          req.adminRole = 'admin'; // Default fallback
        }
      } catch (dbError) {
        console.error('Error fetching admin role:', dbError);
        req.adminRole = 'admin'; // Default fallback
      }
    } else {
      req.adminRole = decoded.role;
    }
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware to check if user is Admin (not Manager)
const requireAdmin = (req, res, next) => {
  if (!req.adminRole || req.adminRole !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }
  next();
};

/**
 * Admin login (public route - no authentication required)
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find admin by username
    const admin = await db.Admin.findOne({ where: { username } });

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user has set a password
    if (!admin.password) {
      return res.status(401).json({ error: 'Please set your password first. Check your email for the invite link.' });
    }

    // Ensure admin has a role (default to 'admin' if null/undefined)
    let adminRole = admin.role;
    if (!adminRole) {
      adminRole = 'admin'; // Default existing admins to admin role
      await admin.update({ role: 'admin' });
      console.log(`✅ Updated admin ${admin.username} to have admin role`);
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: adminRole },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: adminRole
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Public route: Setup password from invite token (no auth required)
// This must be BEFORE verifyAdmin middleware
router.post('/setup-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Find user by invite token
    const user = await db.Admin.findOne({
      where: { inviteToken: token }
    });

    if (!user) {
      return res.status(404).json({ error: 'Invalid or expired invite token' });
    }

    // Check if token is expired
    if (new Date() > user.inviteTokenExpiry) {
      return res.status(400).json({ error: 'Invite token has expired. Please request a new invite.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user with password and clear invite token
    await user.update({
      password: hashedPassword,
      inviteToken: null,
      inviteTokenExpiry: null
    });

    // Generate JWT token and log them in
    const jwtToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Password set successfully',
      token: jwtToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error setting password:', error);
    res.status(500).json({ error: 'Failed to set password' });
  }
});

// Protect all admin routes (require authentication)
router.use(verifyAdmin);

// Get current user info (requires authentication)
router.get('/me', async (req, res) => {
  try {
    const user = await db.Admin.findByPk(req.adminId, {
      attributes: ['id', 'username', 'email', 'role']
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user info:', error);
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

// User Management Routes (Admin only)
// Get all users
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await db.Admin.findAll({
      attributes: ['id', 'username', 'email', 'role', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'DESC']]
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch users',
      details: error.message 
    });
  }
});

// Create new user and send invite
router.post('/users', requireAdmin, async (req, res) => {
  console.log('🚀 POST /users endpoint called');
  console.log('📥 Request body:', JSON.stringify(req.body, null, 2));
  console.log('👤 Admin ID:', req.adminId);
  console.log('👤 Admin Role:', req.adminRole);
  try {
    console.log('📝 Creating new user:', req.body);
    const { username, email, role } = req.body;

    if (!username || !email || !role) {
      return res.status(400).json({ error: 'Username, email, and role are required' });
    }

    if (!['admin', 'manager'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "admin" or "manager"' });
    }

    // Check if username or email already exists
    console.log('🔍 Checking for existing user...');
    const existingUser = await db.Admin.findOne({
      where: {
        [Op.or]: [
          { username: username },
          { email: email }
        ]
      }
    }).catch(err => {
      console.error('❌ Database query error:', err);
      throw err;
    });

    if (existingUser) {
      console.log('⚠️ User already exists:', existingUser.username === username ? 'username' : 'email');
      return res.status(400).json({ 
        error: existingUser.username === username 
          ? 'Username already exists' 
          : 'Email already exists' 
      });
    }

    // Generate invite token
    console.log('🔑 Generating invite token...');
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenExpiry = new Date();
    inviteTokenExpiry.setDate(inviteTokenExpiry.getDate() + 7); // 7 days expiry

    // Create user without password
    console.log('💾 Creating user in database...');
    console.log('💾 User data:', { username, email, role, hasInviteToken: !!inviteToken, hasExpiry: !!inviteTokenExpiry });
    
    // First, ensure password column allows NULL
    try {
      await db.sequelize.query(`
        ALTER TABLE "admins" 
        ALTER COLUMN "password" DROP NOT NULL;
      `);
      console.log('✅ Ensured password column allows NULL');
    } catch (alterError) {
      // Column might already allow NULL, ignore error
      if (!alterError.message.includes('does not exist') && !alterError.message.includes('cannot drop')) {
        console.log('ℹ️ Password column constraint check:', alterError.message);
      }
    }
    
    let newUser;
    try {
      // Try Sequelize create first
      newUser = await db.Admin.create({
        username,
        email,
        role,
        inviteToken,
        inviteTokenExpiry,
        password: null
      });
      console.log('✅ User created successfully:', newUser.id);
    } catch (createError) {
      console.error('❌ Error creating user in database:');
      console.error('❌ Error name:', createError.name);
      console.error('❌ Error message:', createError.message);
      console.error('❌ Error original:', createError.original?.message);
      console.error('❌ Error code:', createError.original?.code);
      
      // If it's a NOT NULL constraint error for password, use raw SQL
      if (createError.original?.code === '23502' && createError.original?.column === 'password') {
        console.log('⚠️ Password NOT NULL constraint detected, using raw SQL insert...');
        try {
          const result = await db.sequelize.query(`
            INSERT INTO "admins" ("username", "email", "role", "inviteToken", "inviteTokenExpiry", "createdAt", "updatedAt")
            VALUES ($1, $2, $3::admin_role_enum, $4, $5, NOW(), NOW())
            RETURNING *
          `, {
            bind: [username, email, role, inviteToken, inviteTokenExpiry],
            type: db.sequelize.QueryTypes.SELECT
          });
          
          if (result && result.length > 0 && result[0].length > 0) {
            newUser = await db.Admin.findByPk(result[0][0].id);
            console.log('✅ User created using raw SQL (without password):', newUser.id);
          } else {
            throw new Error('Raw SQL insert returned no result');
          }
        } catch (rawSqlError) {
          console.error('❌ Raw SQL insert also failed:', rawSqlError.message);
          throw createError; // Throw original error
        }
      } else if (createError.original?.code === '42804' || createError.message?.includes('ENUM') || createError.original?.message?.includes('ENUM')) {
        console.log('⚠️ ENUM type error detected, trying raw SQL insert...');
        try {
          const result = await db.sequelize.query(`
            INSERT INTO "admins" ("username", "email", "role", "inviteToken", "inviteTokenExpiry", "createdAt", "updatedAt")
            VALUES ($1, $2, $3::admin_role_enum, $4, $5, NOW(), NOW())
            RETURNING *
          `, {
            bind: [username, email, role, inviteToken, inviteTokenExpiry],
            type: db.sequelize.QueryTypes.SELECT
          });
          
          if (result && result.length > 0 && result[0].length > 0) {
            newUser = await db.Admin.findByPk(result[0][0].id);
            console.log('✅ User created using raw SQL:', newUser.id);
          } else {
            throw new Error('Raw SQL insert returned no result');
          }
        } catch (rawSqlError) {
          console.error('❌ Raw SQL insert also failed:', rawSqlError.message);
          throw createError; // Throw original error
        }
      } else {
        if (createError.errors) {
          console.error('❌ Sequelize errors:', createError.errors.map(e => ({ path: e.path, message: e.message, value: e.value })));
        }
        throw createError;
      }
    }

    // Send invite email (non-blocking - don't fail user creation if email fails)
    let emailSent = false;
    try {
      const emailResult = await emailService.sendAdminInvite(email, inviteToken, username);
      emailSent = emailResult.success;
      if (!emailResult.success) {
        console.error('⚠️ Failed to send invite email:', emailResult.error);
        console.log(`📧 User created but email failed. Invite link: ${process.env.ADMIN_URL || 'http://localhost:3001'}/setup-password?token=${inviteToken}`);
      }
    } catch (emailError) {
      console.error('⚠️ Error sending invite email:', emailError);
      console.log(`📧 User created but email failed. Invite link: ${process.env.ADMIN_URL || 'http://localhost:3001'}/setup-password?token=${inviteToken}`);
    }

    res.json({
      success: true,
      message: emailSent 
        ? 'User created and invite email sent' 
        : 'User created. Email sending failed - please send invite link manually.',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role
      },
      inviteToken: emailSent ? undefined : inviteToken, // Only include token if email failed
      inviteUrl: emailSent ? undefined : `${process.env.ADMIN_URL || 'http://localhost:3001'}/setup-password?token=${inviteToken}`
    });
  } catch (error) {
    console.error('❌ Error creating user:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    if (error.errors) {
      console.error('❌ Sequelize validation errors:', JSON.stringify(error.errors, null, 2));
    }
    res.status(500).json({ 
      error: 'Failed to create user',
      details: error.message,
      errorName: error.name,
      errors: error.errors || undefined
    });
  }
});

// Get all orders for admin
router.get('/orders', async (req, res) => {
  try {
    const orders = await db.Order.findAll({
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
          model: db.Transaction,
          as: 'transactions',
          required: false // Left join - include orders even without transactions
        },
        {
          model: db.Driver,
          as: 'driver',
          required: false // Left join - include orders even without drivers
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    // Sync paymentStatus from transactions if needed
    const ordersWithSyncedPayment = await Promise.all(orders.map(async (order) => {
      // Check if order has completed transactions
      if (order.transactions && order.transactions.length > 0) {
        const hasCompletedTransaction = order.transactions.some(tx => tx.status === 'completed');
        
        // If there's a completed transaction but order paymentStatus is not 'paid', update it
        if (hasCompletedTransaction && order.paymentStatus !== 'paid') {
          try {
            // Use raw SQL to ensure update happens
            await db.sequelize.query(
              `UPDATE orders SET "paymentStatus" = 'paid', "updatedAt" = NOW() WHERE id = :id`,
              {
                replacements: { id: order.id }
              }
            );
            
            // Reload the order with fresh data
            await order.reload();
            
            // Update the paymentStatus in the response object
            order.paymentStatus = 'paid';
            
            console.log(`✅ Synced paymentStatus to 'paid' for Order #${order.id} (has completed transaction)`);
          } catch (updateError) {
            console.error(`⚠️  Failed to sync paymentStatus for Order #${order.id}:`, updateError);
          }
        }
      }
      
      return order;
    }));
    
    // Final pass: ensure all orders with completed transactions have paymentStatus = 'paid'
    // This handles any edge cases where the sync above might have failed
    const finalOrders = await Promise.all(ordersWithSyncedPayment.map(async (order) => {
      if (order.transactions && order.transactions.length > 0) {
        const hasCompletedTransaction = order.transactions.some(tx => tx.status === 'completed');
        if (hasCompletedTransaction && order.paymentStatus !== 'paid') {
          // Force update using direct database query
          try {
            await db.sequelize.query(
              `UPDATE orders SET "paymentStatus" = 'paid' WHERE id = :id`,
              {
                replacements: { id: order.id }
              }
            );
            order.paymentStatus = 'paid';
            console.log(`🔧 Force-synced paymentStatus for Order #${order.id}`);
          } catch (error) {
            console.error(`❌ Force sync failed for Order #${order.id}:`, error);
          }
        }
      }
      return order;
    }));
    
    res.json(finalOrders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all drinks for inventory management
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
    console.log(`Returning ${drinks.length} drinks for inventory management`);
    res.json(drinks);
  } catch (error) {
    console.error('Error fetching drinks for inventory:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update drink availability
router.patch('/drinks/:id/availability', async (req, res) => {
  try {
    const { isAvailable } = req.body;
    const drink = await db.Drink.findByPk(req.params.id);
    
    if (!drink) {
      return res.status(404).json({ error: 'Drink not found' });
    }
    
    drink.isAvailable = isAvailable;
    await drink.save();
    
    res.json(drink);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new drink
router.post('/drinks', async (req, res) => {
  try {
    const { 
      name, 
      description, 
      price, 
      originalPrice,
      isAvailable, 
      isPopular, 
      image,
      categoryId,
      subCategoryId,
      capacity,
      capacityPricing,
      abv
    } = req.body;

    if (!name || !price || !categoryId) {
      return res.status(400).json({ error: 'Name, price, and category are required' });
    }

    const drink = await db.Drink.create({
      name,
      description: description || '',
      price: parseFloat(price),
      originalPrice: originalPrice ? parseFloat(originalPrice) : parseFloat(price),
      isAvailable: isAvailable !== undefined ? isAvailable : true,
      isPopular: isPopular || false,
      isOnOffer: false, // No longer used - discounts determined by price difference
      image: image || '',
      categoryId: parseInt(categoryId),
      subCategoryId: subCategoryId ? parseInt(subCategoryId) : null,
      capacity: capacity || null,
      capacityPricing: capacityPricing || null,
      abv: abv ? parseFloat(abv) : null
    });

    const createdDrink = await db.Drink.findByPk(drink.id, {
      include: [{
        model: db.Category,
        as: 'category'
      }]
    });

    res.status(201).json(createdDrink);
  } catch (error) {
    console.error('Error creating drink:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update drink
router.put('/drinks/:id', async (req, res) => {
  try {
    const { 
      name, 
      description, 
      price, 
      originalPrice,
      isAvailable, 
      isPopular, 
      image,
      categoryId,
      capacity,
      capacityPricing,
      abv
    } = req.body;

    const drink = await db.Drink.findByPk(req.params.id);
    
    if (!drink) {
      return res.status(404).json({ error: 'Drink not found' });
    }

    drink.name = name;
    drink.description = description;
    drink.price = parseFloat(price);
    drink.isAvailable = isAvailable;
    drink.isPopular = isPopular;
    drink.isOnOffer = false; // No longer used - discounts determined by price difference
    drink.image = image;
    drink.categoryId = parseInt(categoryId);
    drink.capacity = capacity;
    drink.capacityPricing = capacityPricing;
    drink.abv = abv ? parseFloat(abv) : null;
    
    if (originalPrice) {
      drink.originalPrice = parseFloat(originalPrice);
    } else {
      drink.originalPrice = drink.price;
    }

    await drink.save();

    const updatedDrink = await db.Drink.findByPk(drink.id, {
      include: [{
        model: db.Category,
        as: 'category'
      }]
    });

    res.json(updatedDrink);
  } catch (error) {
    console.error('Error updating drink:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const totalOrders = await db.Order.count();
    const pendingOrders = await db.Order.count({ where: { status: 'pending' } });
    const totalDrinks = await db.Drink.count();
    const availableDrinks = await db.Drink.count({ where: { isAvailable: true } });
    
    // Get recent orders
    const recentOrders = await db.Order.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      include: [{
        model: db.OrderItem,
        as: 'items'
      }]
    });

    res.json({
      totalOrders,
      pendingOrders,
      totalDrinks,
      availableDrinks,
      recentOrders
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update order status
router.patch('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'completed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const order = await db.Order.findByPk(req.params.id, {
      include: [{
        model: db.OrderItem,
        as: 'items',
        include: [{
          model: db.Drink,
          as: 'drink'
        }]
      }]
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const oldStatus = order.status;
    order.status = status;
    
    // If order is marked as completed and payment is paid, ensure paymentStatus is paid
    if (status === 'completed' && order.paymentStatus !== 'paid') {
      order.paymentStatus = 'paid';
    }
    
    await order.save();
    
    // Reload order to get the latest data (including any related data that might have changed)
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
    
    // Emit Socket.IO event to notify customer and driver about order status update
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
      
      // Emit to order-specific room for customer tracking
      io.to(`order-${freshOrder.id}`).emit('order-status-updated', statusUpdateData);
      
      // Always emit to admin room (for admin portal)
      io.to('admin').emit('order-status-updated', statusUpdateData);
      console.log(`📡 Emitted order-status-updated to admin room`);
      
      // If order is assigned to a driver, also emit to driver room (for driver app)
      if (freshOrder.driverId) {
        io.to(`driver-${freshOrder.driverId}`).emit('order-status-updated', statusUpdateData);
        console.log(`📡 Emitted order-status-updated to driver room: driver-${freshOrder.driverId}`);
      }
      
      console.log(`📡 Emitted order-status-updated event for Order #${freshOrder.id}: ${oldStatus} → ${freshOrder.status}`);
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update payment status
// Assign/update driver for an order
router.patch('/orders/:id/driver', async (req, res) => {
  try {
    const { driverId } = req.body;
    const io = req.app.get('io'); // Get Socket.IO instance
    
    const order = await db.Order.findByPk(req.params.id, {
      include: [
        {
          model: db.OrderItem,
          as: 'items',
          include: [{
            model: db.Drink,
            as: 'drink'
          }]
        }
      ]
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Store the previous driver ID before updating
    const previousDriverId = order.driverId;
    
    // If driverId is provided, verify driver exists
    let driver = null;
    if (driverId !== null && driverId !== undefined) {
      driver = await db.Driver.findByPk(driverId);
      if (!driver) {
        return res.status(404).json({ error: 'Driver not found' });
      }
      order.driverId = driverId;
      // Reset acceptance status when assigning new driver
      order.driverAccepted = null;
    } else {
      // Remove driver assignment
      order.driverId = null;
      order.driverAccepted = null;
    }
    
    await order.save();
    
    // Reload order with driver information
    const updatedOrder = await db.Order.findByPk(order.id, {
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
          model: db.Transaction,
          as: 'transactions',
          required: false
        },
        {
          model: db.Driver,
          as: 'driver',
          required: false
        }
      ]
    });
    
    // If driver was removed (had a driver before, now null), notify the previous driver
    if (previousDriverId && !driverId && io) {
      const previousDriver = await db.Driver.findByPk(previousDriverId);
      if (previousDriver) {
        console.log(`📱 Emitting driver-removed event to driver ${previousDriver.id} (${previousDriver.phoneNumber})`);
        io.to(`driver-${previousDriver.id}`).emit('driver-removed', {
          orderId: order.id,
          message: `Order #${order.id} removed from your queue`
        });
      }
    }
    
    // Emit Socket.IO event to notify driver of new order assignment
    if (driver && io) {
      console.log(`📱 Emitting order-assigned event to driver ${driver.id} (${driver.phoneNumber})`);
      io.to(`driver-${driver.id}`).emit('order-assigned', {
        order: updatedOrder,
        message: `New order #${order.id} assigned to you`,
        playSound: true // Flag to indicate continuous sound/vibration
      });
    }
    
    // Also emit to admin room for real-time updates
    if (io) {
      io.to('admin').emit('order-updated', {
        order: updatedOrder,
        message: `Order #${order.id} driver assignment updated`
      });
    }
    
    res.json(updatedOrder);
  } catch (error) {
    console.error('Error assigning driver to order:', error);
    res.status(500).json({ error: error.message });
  }
});

router.patch('/orders/:id/payment-status', async (req, res) => {
  try {
    const { paymentStatus, receiptNumber, notes } = req.body;
    const validStatuses = ['pending', 'paid', 'unpaid'];
    
    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({ error: 'Invalid payment status' });
    }
    
    const order = await db.Order.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    order.paymentStatus = paymentStatus;
    
    // If payment is marked as paid, create or update transaction record
    if (paymentStatus === 'paid') {
      // Check if transaction already exists
      let transaction = await db.Transaction.findOne({
        where: { orderId: order.id }
      });

      if (!transaction) {
        // Create new transaction for cash payment or manual payment
        transaction = await db.Transaction.create({
          orderId: order.id,
          transactionType: 'payment',
          paymentMethod: order.paymentMethod || 'cash',
          paymentProvider: order.paymentMethod === 'mobile_money' ? 'mpesa' : null,
          amount: parseFloat(order.totalAmount),
          status: 'completed',
          receiptNumber: receiptNumber || null,
          phoneNumber: order.customerPhone,
          transactionDate: new Date(),
          notes: notes || 'Payment marked as received by admin'
        });
      } else if (transaction.status !== 'completed') {
        // Update existing transaction to completed
        await transaction.update({
          status: 'completed',
          receiptNumber: receiptNumber || transaction.receiptNumber,
          transactionDate: new Date(),
          notes: transaction.notes ? 
            `${transaction.notes}\n✅ Payment marked as received by admin` : 
            'Payment marked as received by admin'
        });
      }
    }
    
    // If payment is marked as paid and order is delivered, update to completed
    if (paymentStatus === 'paid' && order.status === 'delivered') {
      order.status = 'completed';
    }
    
    await order.save();
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all transactions (admin)
router.get('/transactions', async (req, res) => {
  try {
    const transactions = await db.Transaction.findAll({
      include: [{
        model: db.Order,
        as: 'order',
        include: [{
          model: db.OrderItem,
          as: 'items',
          include: [{
            model: db.Drink,
            as: 'drink'
          }]
        }]
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mount order notifications routes (protected by verifyAdmin middleware applied above)
router.use('/order-notifications', require('./order-notifications'));

// SMS Settings routes (must be after verifyAdmin middleware)

/**
 * Test SMS endpoint (admin only)
 */
router.post('/test-sms', verifyAdmin, async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({ error: 'Phone number and message are required' });
    }
    
    const result = await smsService.sendSMS(phoneNumber, message);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'SMS sent successfully',
        messageId: result.messageId,
        mobile: result.mobile
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        code: result.code
      });
    }
  } catch (error) {
    console.error('Error testing SMS:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get SMS settings
 */
router.get('/sms-settings', verifyAdmin, async (req, res) => {
  try {
    const smsEnabledSetting = await db.Settings.findOne({ 
      where: { key: 'smsEnabled' } 
    });
    
    const isSmsEnabled = smsEnabledSetting?.value !== 'false'; // Default to enabled if not set
    
    res.json({
      smsEnabled: isSmsEnabled
    });
  } catch (error) {
    console.error('Error fetching SMS settings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update SMS settings
 */
router.put('/sms-settings', verifyAdmin, async (req, res) => {
  try {
    const { smsEnabled } = req.body;
    
    if (typeof smsEnabled !== 'boolean') {
      return res.status(400).json({ error: 'smsEnabled must be a boolean' });
    }
    
    // Find or create the setting
    let smsSetting = await db.Settings.findOne({ 
      where: { key: 'smsEnabled' } 
    });
    
    if (smsSetting) {
      await smsSetting.update({ value: smsEnabled.toString() });
    } else {
      smsSetting = await db.Settings.create({
        key: 'smsEnabled',
        value: smsEnabled.toString()
      });
    }
    
    console.log(`📱 SMS notifications ${smsEnabled ? 'enabled' : 'disabled'} by admin`);
    
    res.json({
      success: true,
      smsEnabled: smsEnabled,
      message: `SMS notifications ${smsEnabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    console.error('Error updating SMS settings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Manually verify and update payment status for an order
 * Admin can use this to manually confirm payment if callback didn't arrive
 */
router.post('/orders/:orderId/verify-payment', verifyAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { receiptNumber, amount, transactionDate } = req.body;
    
    const order = await db.Order.findByPk(orderId, {
      include: [{
        model: db.OrderItem,
        as: 'items'
      }]
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    if (order.paymentMethod !== 'mobile_money') {
      return res.status(400).json({ error: 'Order is not an M-Pesa payment' });
    }
    
    // Find or create transaction
    let transaction = await db.Transaction.findOne({
      where: { orderId: order.id },
      order: [['createdAt', 'DESC']]
    });
    
    const transactionAmount = amount || parseFloat(order.totalAmount);
    
    if (transaction) {
      // Update existing transaction
      await transaction.update({
        status: 'completed',
        receiptNumber: receiptNumber || transaction.receiptNumber || `MANUAL-${Date.now()}`,
        amount: transactionAmount,
        transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
        notes: transaction.notes ? 
          `${transaction.notes}\n✅ Manually verified by admin at ${new Date().toISOString()}` : 
          `✅ Payment manually verified by admin at ${new Date().toISOString()}`
      });
      await transaction.reload();
    } else {
      // Create new transaction
      transaction = await db.Transaction.create({
        orderId: order.id,
        transactionType: 'payment',
        paymentMethod: 'mobile_money',
        paymentProvider: 'mpesa',
        amount: transactionAmount,
        status: 'completed',
        receiptNumber: receiptNumber || `MANUAL-${Date.now()}`,
        phoneNumber: order.customerPhone,
        transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
        notes: `✅ Payment manually verified by admin at ${new Date().toISOString()}`
      });
    }
    
    // Update order status
    await order.update({
      status: 'confirmed',
      paymentStatus: 'paid',
      notes: order.notes ? 
        `${order.notes}\n✅ Payment manually verified by admin. Receipt: ${transaction.receiptNumber}` : 
        `✅ Payment manually verified by admin. Receipt: ${transaction.receiptNumber}`
    });
    
    await order.reload();
    
    // Emit Socket.IO event
    const io = req.app.get('io');
    if (io) {
      io.to(`order-${order.id}`).emit('payment-confirmed', {
        orderId: order.id,
        status: 'confirmed',
        paymentStatus: 'paid',
        receiptNumber: transaction.receiptNumber,
        amount: transactionAmount,
        transactionId: transaction.id,
        transactionStatus: 'completed',
        message: `Payment manually verified for Order #${order.id}`
      });
      
      io.to('admin').emit('payment-confirmed', {
        orderId: order.id,
        status: 'confirmed',
        paymentStatus: 'paid',
        receiptNumber: transaction.receiptNumber,
        amount: transactionAmount,
        transactionId: transaction.id,
        transactionStatus: 'completed',
        message: `Payment manually verified for Order #${order.id}`
      });
    }
    
    console.log(`✅ Payment manually verified for Order #${order.id} by admin`);
    
    res.json({
      success: true,
      message: 'Payment verified successfully',
      order: {
        id: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus
      },
      transaction: {
        id: transaction.id,
        status: transaction.status,
        receiptNumber: transaction.receiptNumber
      }
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export verifyAdmin middleware for use in other routes
module.exports = router;
module.exports.verifyAdmin = verifyAdmin;
