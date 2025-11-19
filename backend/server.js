// Load environment variables - don't fail if .env doesn't exist
require('dotenv').config();

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

// Cloud Run sets PORT automatically - use it or default to 8080
const PORT = process.env.PORT || 8080;

// Create minimal app with health check endpoint
const minimalApp = express();
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
console.log(`📡 Starting server on port ${PORT}...`);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server successfully started and listening on 0.0.0.0:${PORT}`);
  console.log(`🔗 Health check: http://0.0.0.0:${PORT}/api/health`);
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
    
    // Replace minimal app with full app
    server.removeAllListeners('request');
    server.on('request', app);
    
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
    const io = new Server(server, {
      cors: {
        origin: [
          process.env.FRONTEND_URL || 'http://localhost:3000',
          process.env.ADMIN_URL || 'http://localhost:3001',
          'http://localhost:3002',
          'https://drink-suite-customer-910510650031.us-central1.run.app',
          'https://drink-suite-admin-910510650031.us-central1.run.app',
          'https://dialadrink-customer-p6bkgryxqa-uc.a.run.app',
          'https://dialadrink-admin-p6bkgryxqa-uc.a.run.app',
          'https://dialadrink-customer-910510650031.us-central1.run.app',
          'https://dialadrink-admin-910510650031.us-central1.run.app',
          'https://dialadrink-backend-910510650031.us-central1.run.app',
          'https://liquoros-customer-910510650031.us-central1.run.app',
          'https://liquoros-admin-910510650031.us-central1.run.app',
          'https://liquoros-backend-910510650031.us-central1.run.app'
        ],
        methods: ["GET", "POST"],
        credentials: true
      }
    });
    
    app.set('io', io);
    
    // Setup Socket.IO handlers
    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      socket.on('join-admin', () => {
        socket.join('admin');
        console.log(`Client ${socket.id} joined admin room`);
      });

      socket.on('join-driver', (driverId) => {
        const roomName = `driver-${driverId}`;
        socket.join(roomName);
        console.log(`Client ${socket.id} joined driver room: ${roomName}`);
      });

      socket.on('join-order', (orderId) => {
        const roomName = `order-${orderId}`;
        socket.join(roomName);
        console.log(`Client ${socket.id} joined room: ${roomName}`);
      });
      
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
    
    // Initialize database asynchronously (non-blocking)
    initializeDatabase(db, seedData);
    
    // Start background job to auto-sync pending M-Pesa transactions
    startTransactionSyncJob();
    
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
        return addMissingColumns(db);
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
        const items = callbackMetadata?.Item || [];
        const receiptFromMetadata = items.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
        const receiptFromResponse = mpesaStatus?.ReceiptNumber;
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
