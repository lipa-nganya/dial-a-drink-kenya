// Load environment variables - don't fail if .env doesn't exist
// Priority: .env.local (local overrides) > .env (shared/default)
require('dotenv').config({ path: '.env.local' }); // Load local overrides first
require('dotenv').config(); // Then load default .env (won't override existing vars)

// Handle unhandled promise rejections to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - let the server continue running
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // CRITICAL: Don't exit - let the server continue running
  // Cloud Run will restart if needed, but we want to try to serve health checks
});

// CRITICAL: Start server FIRST with minimal health endpoint
// This ensures Cloud Run health checks pass even if routes/models fail to load
const http = require('http');
const express = require('express');

// Cloud Run sets PORT automatically - use it or default to 5001
const PORT = process.env.PORT || 5001;

// Create minimal app with health check endpoint
const minimalApp = express();

// CORS middleware for minimal app (before routes)
const allowedOrigins = [
  'http://localhost:3000', // Customer local
  'http://localhost:3001', // Admin local
  'http://localhost:3002', // Shop agent / consoles local
  'http://localhost:3003', // Zeus local
  'http://localhost:8080', // Wolfgang website (local dev)
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
  process.env.ZEUS_URL,
  process.env.SHOP_AGENT_URL,
].filter(Boolean);

minimalApp.use((req, res, next) => {
  const origin = req.headers.origin;
  
  const isOriginAllowed = (originToCheck) => {
    if (!originToCheck) return false;
    return (
      allowedOrigins.includes(originToCheck) ||
      originToCheck.includes('.netlify.app') ||
      originToCheck.includes('.thewolfgang.tech') ||
      originToCheck.includes('.ruakadrinksdelivery.co.ke') ||
      originToCheck.includes('.drinksdeliverykenya.com') ||
      originToCheck.includes('.run.app') ||
      originToCheck === 'https://thewolfgang.tech'
    );
  };
  
  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    if (origin && isOriginAllowed(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '86400');
      return res.status(204).end();
    }
    return res.status(204).end();
  }
  
  // For all other requests, set CORS headers if origin is allowed
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  
  next();
});

minimalApp.use(express.json());

// Health check endpoint - MUST work immediately
minimalApp.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Dial A Drink API is running' });
});

// Root endpoint
minimalApp.get('/', (req, res) => {
  res.json({ 
    message: 'Dial A Drink Kenya API', 
    version: '1.0.0',
    status: 'running',
    health: '/api/health'
  });
});

const server = http.createServer(minimalApp);

// Start server IMMEDIATELY - before loading anything else
// Use 0.0.0.0 to allow Android emulator access (10.0.2.2 maps to host's localhost)
// Check if we're in Cloud Run (has PORT env var and K_SERVICE or GOOGLE_CLOUD_PROJECT)
const isCloudRun = !!process.env.K_SERVICE || !!process.env.GOOGLE_CLOUD_PROJECT;
const isProduction = process.env.NODE_ENV === 'production';
// Always use 0.0.0.0 to allow Android emulator and other network access
// Android emulator uses 10.0.2.2 to access host's localhost, which requires 0.0.0.0 binding
const HOST = process.env.HOST || '0.0.0.0';
console.log(`📡 Starting server on ${HOST}:${PORT}...`);
console.log(`🔧 Environment: NODE_ENV=${process.env.NODE_ENV || 'undefined'}, isProduction=${isProduction}`);
server.listen(PORT, HOST, () => {
  console.log(`✅ Server successfully started and listening on ${HOST}:${PORT}`);
  console.log(`🔗 Health check: http://${HOST}:${PORT}/api/health`);
  console.log(`🌐 Server ready to accept requests!`);
  
  // NOW load the full app and routes asynchronously (non-blocking)
  setImmediate(() => {
    loadFullApplication();
  });
});

// Handle server errors gracefully
server.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
});

// Function to load the full application after server starts
async function loadFullApplication() {
  try {
    console.log('📦 Loading full application...');
    
    // Load the full Express app
    const app = require('./app');
    
    // CRITICAL: Properly replace the request handler
    // Remove all existing request listeners
    server.removeAllListeners('request');
    // Attach the full Express app as the request handler
    server.on('request', app);
    console.log('✅ Full Express app attached to server');
    
    // Load models with error handling
    let db, seedData;
    try {
      db = require('./models');
      seedData = require('./seed');
    } catch (modelError) {
      console.error('⚠️ Error loading models:', modelError.message);
      console.warn('⚠️ Server running but database operations will fail');
      db = { 
        sequelize: { 
          authenticate: () => Promise.reject(new Error('Models not loaded')), 
          sync: () => Promise.resolve() 
        } 
      };
      seedData = () => Promise.resolve();
    }
    
    // Initialize Socket.IO
    const { Server } = require('socket.io');
    // Always include localhost origins for Socket.IO, regardless of env vars
    const socketAllowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:8080',
      process.env.FRONTEND_URL,
      process.env.ADMIN_URL,
      process.env.ZEUS_URL,
    ].filter(Boolean);

    const io = new Server(server, {
      cors: {
        origin: (origin, callback) => {
          // Allow requests with no origin (like mobile apps or Postman)
          if (!origin) {
            return callback(null, true);
          }
          
          const allowedOrigins = [
            ...socketAllowedOrigins,
            'https://drink-suite-customer-910510650031.us-central1.run.app',
            'https://drink-suite-admin-910510650031.us-central1.run.app',
            'https://dialadrink-customer-p6bkgryxqa-uc.a.run.app',
            'https://dialadrink-admin-p6bkgryxqa-uc.a.run.app',
            'https://dialadrink-customer-910510650031.us-central1.run.app',
            'https://dialadrink-admin-910510650031.us-central1.run.app',
            // Note: dialadrink-backend-910510650031 is deprecated - use deliveryos-production-backend or deliveryos-development-backend
            'https://deliveryos-backend-910510650031.us-central1.run.app',
            'https://deliveryos-backend-p6bkgryxqa-uc.a.run.app',
            'https://deliveryos-backend-805803410802.us-central1.run.app',
            'https://deliveryos-development-backend-lssctajjoq-uc.a.run.app',
            // Note: Frontends are on Netlify, not Cloud Run
            // Customer: https://dialadrink.thewolfgang.tech (already in Netlify URLs below)
            // Admin: https://dialadrink-admin.thewolfgang.tech (already in Netlify URLs below)
            // Wolfgang website production URL
            'https://thewolfgang.tech',
            // Netlify Production Domains
            'https://dialadrink.thewolfgang.tech',
            'https://dialadrink-admin.thewolfgang.tech',
            // Production customer sites
            'https://ruakadrinksdelivery.co.ke',
            'https://www.ruakadrinksdelivery.co.ke',
            'https://drinksdeliverykenya.com',
            'https://www.drinksdeliverykenya.com',
            // Admin production sites
            'https://admin.ruakadrinksdelivery.co.ke',
            'https://www.admin.ruakadrinksdelivery.co.ke'
          ];
          
          // Check exact match
          if (allowedOrigins.includes(origin)) {
            return callback(null, true);
          }
          
          // Check for thewolfgang.tech domains (more permissive - matches any subdomain or root)
          if (origin.includes('.thewolfgang.tech') || origin === 'https://thewolfgang.tech') {
            return callback(null, true);
          }
          
          // Check ruakadrinksdelivery.co.ke subdomains
          if (origin.includes('.ruakadrinksdelivery.co.ke')) {
            return callback(null, true);
          }
          
          // Check Cloud Run service URLs (e.g., deliveryos-admin-frontend-*.run.app)
          if (origin.includes('.run.app')) {
            return callback(null, true);
          }
          
          // Check netlify.app subdomains
          if (origin.includes('.netlify.app')) {
            return callback(null, true);
          }
          
          console.warn(`Socket.IO blocked CORS origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        },
        methods: ["GET", "POST"],
        credentials: true
      }
    });
    
    app.set('io', io);
    
    // Map to track driver ID -> socket ID (for direct emission without rooms)
    const driverSocketMap = new Map(); // driverId -> socketId

    // Setup Socket.IO handlers
    // Store driver socket map in app for access from routes
    app.set('driverSocketMap', driverSocketMap);
    
    io.on('connection', (socket) => {
      console.log('✅✅✅ Client connected:', socket.id);
      console.log('✅✅✅ Socket transport:', socket.transport?.name || 'unknown');
      console.log('✅✅✅ Socket handshake:', {
        address: socket.handshake?.address || 'unknown',
        headers: socket.handshake?.headers || {},
        query: socket.handshake?.query || {}
      });
      
      socket.on('join-admin', () => {
        socket.join('admin');
        console.log(`Client ${socket.id} joined admin room`);
      });

      socket.on('register-driver', (driverId) => {
        const driverIdInt = parseInt(driverId);
        driverSocketMap.set(driverIdInt, socket.id);
        // Join driver room for real-time updates (works even if socket reconnects)
        const roomName = `driver-${driverIdInt}`;
        socket.join(roomName);
        console.log(`Driver ${driverIdInt} registered with socket ${socket.id} and joined room ${roomName}`);
      });

      socket.on('join-driver', (driverId) => {
        const driverIdInt = parseInt(driverId);
        driverSocketMap.set(driverIdInt, socket.id);
        // Join driver room for real-time updates
        const roomName = `driver-${driverIdInt}`;
        socket.join(roomName);
        console.log(`Driver ${driverIdInt} registered via join-driver with socket ${socket.id} and joined room ${roomName}`);
      });

      socket.on('join-order', (orderId) => {
        const roomName = `order-${orderId}`;
        socket.join(roomName);
        console.log(`Client ${socket.id} joined room: ${roomName}`);
      });
      
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        // Remove driver from map if they disconnect
        for (const [driverId, socketId] of driverSocketMap.entries()) {
          if (socketId === socket.id) {
            driverSocketMap.delete(driverId);
            console.log(`✅✅✅ Driver ${driverId} unregistered (disconnected)`);
            break;
          }
        }
      });
    });
    
    // Initialize database asynchronously (non-blocking)
    initializeDatabase(db, seedData);
    
    // Start background job to auto-sync pending M-Pesa transactions
    startTransactionSyncJob();
    
    // Start background job to check for inactive drivers and set them to offline
    startDriverActivityCheckJob(app);
    
    console.log('✅ Full application loaded successfully');
  } catch (appError) {
    console.error('⚠️ Error loading full application:', appError.message);
    console.error('Stack:', appError.stack);
    console.warn('⚠️ Server running with minimal functionality (health check only)');
  }
}

// Function to initialize database (non-blocking)
async function initializeDatabase(db, seedData) {
  try {
    // Test database connection with timeout
    const dbTimeout = setTimeout(() => {
      console.log('⚠️ Database connection timeout - continuing');
    }, 10000);
    
    try {
      await db.sequelize.authenticate();
      console.log('✅ Database connection established successfully.');
      clearTimeout(dbTimeout);
    } catch (dbError) {
      console.warn('⚠️ Database connection failed:', dbError.message);
      console.warn('⚠️ Continuing - database will retry on first request');
      clearTimeout(dbTimeout);
      return; // Don't continue with sync if auth fails
    }
    
    // Sync database (create tables if they don't exist) - non-blocking
    db.sequelize.sync({ force: false })
      .then(() => {
        console.log('Database synchronized successfully.');
        // Ensure Brand model is synced
        if (db.Brand) {
          return db.Brand.sync({ alter: false }).then(() => {
            console.log('Brand model synchronized.');
            return db.Brand.count().then(count => {
              console.log(`Brands in database: ${count}`);
            });
          });
        }
        return Promise.resolve();
      })
      .then(() => {
        return addMissingColumns(db);
      })
      .then(() => {
        return checkAndCreatePenaltiesTable(db);
      })
      .then(() => {
        console.log('Database columns updated successfully.');
        return db.Category ? db.Category.count() : Promise.resolve(0);
      })
      .then(categoryCount => {
        if (categoryCount === 0 && seedData) {
          console.log('Seeding database...');
          return seedData();
        }
      })
      .then(() => {
        console.log('Database setup completed.');
      })
      .catch(error => {
        console.warn('Database setup failed:', error.message);
        // Don't crash - server is already running
      });
  } catch (error) {
    console.warn('Database initialization failed:', error.message);
  }
}

// Function to add missing columns (simplified version)
async function addMissingColumns(db) {
  try {
    console.log('Checking for missing columns...');
    
    // Check if branchId column exists in orders table
    const [results] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'branchId'
    `);
    
    if (results.length === 0) {
      console.log('📝 Adding missing branchId column to orders table...');
      await db.sequelize.query(`
        ALTER TABLE orders 
        ADD COLUMN "branchId" INTEGER 
        REFERENCES branches(id)
      `);
      console.log('✅ Added branchId column to orders table');
    } else {
      console.log('✅ branchId column already exists in orders table');
    }
    
    // Check if barcode column exists in drinks table
    const [barcodeResults] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'drinks' AND column_name = 'barcode'
    `);
    
    if (barcodeResults.length === 0) {
      console.log('📝 Adding missing barcode column to drinks table...');
      await db.sequelize.query(`
        ALTER TABLE drinks 
        ADD COLUMN barcode VARCHAR(255) UNIQUE
      `);
      console.log('✅ Added barcode column to drinks table');
    } else {
      console.log('✅ barcode column already exists in drinks table');
    }
    
    // Check if stock column exists in drinks table
    const [stockResults] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'drinks' AND column_name = 'stock'
    `);
    
    if (stockResults.length === 0) {
      console.log('📝 Adding missing stock column to drinks table...');
      await db.sequelize.query(`
        ALTER TABLE drinks 
        ADD COLUMN stock INTEGER DEFAULT 0
      `);
      console.log('✅ Added stock column to drinks table');
    } else {
      console.log('✅ stock column already exists in drinks table');
    }
    
    // Check if deliverySequence column exists in orders table
    const [deliverySequenceResults] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'deliverySequence'
    `);
    
    if (deliverySequenceResults.length === 0) {
      console.log('📝 Adding missing deliverySequence column to orders table...');
      await db.sequelize.query(`
        ALTER TABLE orders 
        ADD COLUMN "deliverySequence" INTEGER
      `);
      console.log('✅ Added deliverySequence column to orders table');
    } else {
      console.log('✅ deliverySequence column already exists in orders table');
    }
    
    // Check if locationLatitude column exists in drivers table
    const [locationLatitudeResults] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'drivers' AND column_name = 'locationLatitude'
    `);
    
    if (locationLatitudeResults.length === 0) {
      console.log('📝 Adding missing locationLatitude column to drivers table...');
      await db.sequelize.query(`
        ALTER TABLE drivers 
        ADD COLUMN "locationLatitude" DECIMAL(10, 8)
      `);
      console.log('✅ Added locationLatitude column to drivers table');
    } else {
      console.log('✅ locationLatitude column already exists in drivers table');
    }
    
    // Check if locationLongitude column exists in drivers table
    const [locationLongitudeResults] = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'drivers' AND column_name = 'locationLongitude'
    `);
    
    if (locationLongitudeResults.length === 0) {
      console.log('📝 Adding missing locationLongitude column to drivers table...');
      await db.sequelize.query(`
        ALTER TABLE drivers 
        ADD COLUMN "locationLongitude" DECIMAL(11, 8)
      `);
      console.log('✅ Added locationLongitude column to drivers table');
    } else {
      console.log('✅ locationLongitude column already exists in drivers table');
    }
    
    // Check if 'cash' exists in payment_method_enum
    const [enumResults] = await db.sequelize.query(`
      SELECT unnest(enum_range(NULL::payment_method_enum))::text AS enum_value
    `);
    
    const enumValues = enumResults.map(r => r.enum_value);
    if (!enumValues.includes('cash')) {
      console.log('📝 Adding "cash" to payment_method_enum...');
      await db.sequelize.query(`
        ALTER TYPE payment_method_enum ADD VALUE IF NOT EXISTS 'cash'
      `);
      console.log('✅ Added "cash" to payment_method_enum');
    } else {
      console.log('✅ "cash" already exists in payment_method_enum');
    }
    
    return true;
  } catch (error) {
    console.warn('Column migration failed:', error.message);
    // Don't fail completely - try to continue
    return false;
  }
}

// Function to check and create penalties table if it doesn't exist
async function checkAndCreatePenaltiesTable(db) {
  try {
    // Check if penalties table exists
    const [penaltiesCheck] = await db.sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'penalties'
      ) as table_exists;
    `);

    if (!penaltiesCheck[0]?.table_exists) {
      console.log('📝 Creating penalties table...');
      
      await db.sequelize.query(`
        CREATE TABLE penalties (
          id SERIAL PRIMARY KEY,
          "driverId" INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
          amount DECIMAL(10, 2) NOT NULL,
          balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
          reason TEXT NOT NULL,
          "createdBy" INTEGER REFERENCES admins(id),
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await db.sequelize.query(`
        CREATE INDEX idx_penalties_driver_id ON penalties("driverId");
        CREATE INDEX idx_penalties_created_at ON penalties("createdAt");
      `);

      console.log('✅ Penalties table created successfully');
    } else {
      console.log('✅ Penalties table already exists');
    }

    // Also check loans table
    const [loansCheck] = await db.sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'loans'
      ) as table_exists;
    `);

    if (!loansCheck[0]?.table_exists) {
      console.log('📝 Creating loans table...');
      
      await db.sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE loan_status_enum AS ENUM ('active', 'paid_off', 'cancelled');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      
      await db.sequelize.query(`
        CREATE TABLE loans (
          id SERIAL PRIMARY KEY,
          "driverId" INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
          amount DECIMAL(10, 2) NOT NULL,
          balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
          reason TEXT NOT NULL,
          "nextDeductionDate" TIMESTAMP WITH TIME ZONE,
          status loan_status_enum NOT NULL DEFAULT 'active',
          "createdBy" INTEGER REFERENCES admins(id),
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await db.sequelize.query(`
        CREATE INDEX idx_loans_driver_id ON loans("driverId");
        CREATE INDEX idx_loans_status ON loans(status);
        CREATE INDEX idx_loans_created_at ON loans("createdAt");
      `);

      console.log('✅ Loans table created successfully');
    } else {
      console.log('✅ Loans table already exists');
    }
  } catch (error) {
    console.warn('Error checking/creating penalties/loans tables:', error.message);
  }
}

// Background job to automatically sync pending M-Pesa transactions
// This runs every 30 seconds to check for completed payments that didn't receive callbacks
function startTransactionSyncJob() {
  console.log('🔄 Starting background transaction sync job (runs every 30 seconds)...');
  
  // Run immediately on startup, then every 30 seconds
  setTimeout(() => {
    syncPendingTransactions();
  }, 10000); // Wait 10 seconds after startup to ensure DB is ready
  
  // Then run every 30 seconds
  setInterval(() => {
    syncPendingTransactions();
  }, 30000); // 30 seconds
}

// Background job to check for inactive drivers and set them to offline
// This runs every hour to check for drivers with no activity in 6 hours
function startDriverActivityCheckJob(app) {
  console.log('🔄 Starting driver activity check job (runs every hour)...');
  
  const { checkInactiveDrivers } = require('./utils/driverActivity');
  
  // Run immediately on startup (after a delay), then every hour
  setTimeout(async () => {
    try {
      const result = await checkInactiveDrivers();
      
      // Emit Socket.IO events if drivers were updated
      if (result.updated > 0 && app) {
        const io = app.get('io');
        if (io) {
          result.drivers.forEach(driver => {
            io.to('admin').emit('driver-status-updated', {
              driverId: driver.id,
              name: driver.name,
              oldStatus: driver.oldStatus,
              newStatus: 'offline',
              reason: 'inactive_6_hours',
              lastActivity: driver.lastActivity
            });
            console.log(`📡 Emitted driver-status-updated event for driver ${driver.id} (auto-offline)`);
          });
        }
      }
    } catch (error) {
      console.error('❌ Error in driver activity check:', error);
    }
  }, 30000); // Wait 30 seconds after startup to ensure DB is ready
  
  // Then run every hour (3600000 ms)
  setInterval(async () => {
    try {
      const result = await checkInactiveDrivers();
      
      // Emit Socket.IO events if drivers were updated
      if (result.updated > 0 && app) {
        const io = app.get('io');
        if (io) {
          result.drivers.forEach(driver => {
            io.to('admin').emit('driver-status-updated', {
              driverId: driver.id,
              name: driver.name,
              oldStatus: driver.oldStatus,
              newStatus: 'offline',
              reason: 'inactive_6_hours',
              lastActivity: driver.lastActivity
            });
            console.log(`📡 Emitted driver-status-updated event for driver ${driver.id} (auto-offline)`);
          });
        }
      }
    } catch (error) {
      console.error('❌ Error in driver activity check:', error);
    }
  }, 3600000); // 1 hour
}

async function syncPendingTransactions() {
  try {
    const db = require('./models');
    const { Op } = require('sequelize');
    const mpesaService = require('./services/mpesa');
    const { finalizeOrderPayment } = require('./routes/mpesa');
    
    // Find all pending payment transactions created in the last 30 minutes
    // (older transactions are likely failed/cancelled)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    const pendingTransactions = await db.Transaction.findAll({
      where: {
        transactionType: 'payment',
        status: {
          [Op.in]: ['pending', 'processing']
        },
        checkoutRequestID: {
          [Op.ne]: null
        },
        createdAt: {
          [Op.gte]: thirtyMinutesAgo
        }
      },
      include: [{
        model: db.Order,
        as: 'order',
        attributes: ['id', 'status', 'paymentStatus']
      }],
      limit: 20 // Process max 20 at a time to avoid rate limits
    });
    
    if (pendingTransactions.length === 0) {
      return; // No pending transactions
    }
    
    console.log(`🔄 Background sync: Checking ${pendingTransactions.length} pending transaction(s)...`);
    
    for (const transaction of pendingTransactions) {
      try {
        // Skip if order is already paid
        if (transaction.order && transaction.order.paymentStatus === 'paid') {
          continue;
        }
        
        // Query M-Pesa for status
        const mpesaStatus = await mpesaService.checkTransactionStatus(transaction.checkoutRequestID);
        
        const callbackMetadata = mpesaStatus?.CallbackMetadata;
        const items = callbackMetadata?.Item || callbackMetadata?.item || [];
        const receiptItem = items.find(item => 
          item.Name === 'MpesaReceiptNumber' || item.name === 'MpesaReceiptNumber'
        );
        const receiptFromMetadata = receiptItem?.Value || receiptItem?.value;
        const receiptFromResponse = mpesaStatus?.ReceiptNumber || mpesaStatus?.receiptNumber || mpesaStatus?.MpesaReceiptNumber;
        const receiptNumber = receiptFromMetadata || receiptFromResponse;
        const resultCode = mpesaStatus?.ResultCode;
        
        // Payment completed if ResultCode is 0 and we have a receipt number
        if (resultCode === 0 && receiptNumber) {
          console.log(`✅✅✅ Background sync: Payment completed for Order #${transaction.orderId}! Receipt: ${receiptNumber}`);
          
          // Finalize the payment
          await finalizeOrderPayment({
            orderId: transaction.orderId,
            paymentTransaction: transaction,
            receiptNumber: receiptNumber,
            req: null, // No req object in background job
            context: 'Background auto-sync job'
          });
          
          console.log(`✅✅✅ Background sync: Order #${transaction.orderId} updated automatically!`);
        }
      } catch (error) {
        // Don't log errors for rate limits (429) - these are expected
        if (!error.message.includes('429')) {
          console.error(`❌ Background sync error for transaction #${transaction.id}:`, error.message);
        }
        // Continue with next transaction
      }
    }
    
    console.log(`✅ Background sync completed`);
  } catch (error) {
    console.error('❌ Background transaction sync job error:', error.message);
    // Don't throw - this is a background job, failures shouldn't crash the server
  }
}
