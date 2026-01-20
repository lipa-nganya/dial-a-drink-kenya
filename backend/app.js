const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const db = require('./models');

const app = express();

// Middleware
// CRITICAL: Log environment variables for CORS debugging
console.log('🌐 CORS Configuration:');
console.log('   FRONTEND_URL:', process.env.FRONTEND_URL || 'NOT SET (using default)');
console.log('   ADMIN_URL:', process.env.ADMIN_URL || 'NOT SET (using default)');

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  process.env.ADMIN_URL || 'http://localhost:3001',
  process.env.ZEUS_URL || 'http://localhost:3003',
  process.env.SHOP_AGENT_URL || 'http://localhost:3002',
  'http://localhost:3002',
  'http://localhost:8080', // Wolfgang website
  // Old service URLs (kept for backward compatibility)
  'https://drink-suite-customer-910510650031.us-central1.run.app',
  'https://drink-suite-admin-910510650031.us-central1.run.app',
  // New service URLs - alphanumeric format
  'https://dialadrink-customer-p6bkgryxqa-uc.a.run.app',
  'https://dialadrink-admin-p6bkgryxqa-uc.a.run.app',
  // New service URLs - numeric format (Cloud Run can use either)
  'https://dialadrink-customer-910510650031.us-central1.run.app',
  'https://dialadrink-admin-910510650031.us-central1.run.app',
  'https://dialadrink-backend-910510650031.us-central1.run.app',
  // DeliveryOS backend service URLs (dev environment)
  'https://deliveryos-backend-p6bkgryxqa-uc.a.run.app',
  // Note: Frontends are on Netlify, not Cloud Run
  // Customer: https://dialadrink.thewolfgang.tech
  // Admin: https://dialadrink-admin.thewolfgang.tech
  // Liquoros service URLs
  'https://liquoros-customer-910510650031.us-central1.run.app',
  'https://liquoros-admin-910510650031.us-central1.run.app',
  'https://liquoros-backend-910510650031.us-central1.run.app',
  // Wolfgang website production URL
  'https://thewolfgang.tech',
  // Netlify production URLs
  'https://dialadrink-admin.thewolfgang.tech',
  'https://dialadrink.thewolfgang.tech',
  // Netlify preview URLs (wildcard pattern)
  'https://*.netlify.app'
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // CRITICAL: Allow requests with no origin (like M-Pesa callbacks)
    // M-Pesa callbacks don't send Origin header, so we must allow them
    if (!origin) {
      return callback(null, true);
    }
    
    // Check exact match first
    if (allowedOrigins.includes(origin)) {
      console.log(`✅ CORS allowed: ${origin} (exact match)`);
      return callback(null, origin); // Return origin explicitly for CORS headers
    }
    
    // Check for Netlify preview URLs (wildcard pattern)
    if (origin.includes('.netlify.app')) {
      console.log(`✅ CORS allowed: ${origin} (netlify.app domain)`);
      return callback(null, origin); // Return origin explicitly
    }
    
    // Check for thewolfgang.tech domains (any subdomain or root domain)
    if (origin.includes('.thewolfgang.tech') || origin === 'https://thewolfgang.tech') {
      console.log(`✅ CORS allowed: ${origin} (thewolfgang.tech domain)`);
      return callback(null, origin); // Return origin explicitly for CORS headers
    }
    
    console.warn(`❌ CORS blocked origin: ${origin}`);
    console.warn(`   Allowed origins:`, allowedOrigins.slice(0, 5), '...');
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
};

// CRITICAL: Explicit CORS headers FIRST (before cors package)
// This ensures headers are ALWAYS set, even if cors package fails
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Check if origin should be allowed (same logic as corsOptions)
  if (origin) {
    const isAllowed = 
      allowedOrigins.includes(origin) ||
      origin.includes('.netlify.app') ||
      origin.includes('.thewolfgang.tech') ||
      origin === 'https://thewolfgang.tech';
    
    if (isAllowed) {
      // Explicitly set CORS headers FIRST
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
      
      // Log for debugging (always log for thewolfgang.tech)
      if (origin.includes('thewolfgang.tech')) {
        console.log(`🔒 [CORS] Headers set for origin: ${origin}`);
      }
    }
  }
  
  // Handle preflight OPTIONS requests explicitly
  if (req.method === 'OPTIONS') {
    console.log(`🔒 [CORS] OPTIONS preflight for origin: ${origin || 'none'}`);
    return res.status(204).end();
  }
  
  next();
});

// CRITICAL: CORS middleware MUST be the FIRST middleware (before compression, json parsing, etc.)
// Using cors package with custom origin function for pattern matching
// This runs AFTER explicit headers as a backup
app.use(cors(corsOptions));

// Debug: Log CORS middleware application
console.log('✅ CORS middleware applied (cors package + explicit headers fallback)');

// Enable gzip compression for all responses (AFTER CORS)
// CRITICAL: Compression must come AFTER CORS to avoid interfering with headers
app.use(compression());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global request timeout middleware - prevent requests from hanging indefinitely
app.use((req, res, next) => {
  // Set a 30 second timeout for all requests
  req.setTimeout(30000, () => {
    if (!res.headersSent) {
      console.error(`⚠️ Request timeout for ${req.method} ${req.path}`);
      res.status(504).json({ error: 'Request timeout. Please try again.' });
    }
  });
  next();
});

// Serve static files (images)
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Routes
app.use('/api/categories', require('./routes/categories'));
app.use('/api/subcategories', require('./routes/subcategories'));
app.use('/api/brands', require('./routes/brands'));
app.use('/api/import-brands', require('./routes/import-brands'));
app.use('/api/drinks', require('./routes/drinks'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/pos', require('./routes/pos'));
app.use('/api/inventory', require('./routes/inventory')); // Inventory management
// Register admin notifications BEFORE /api/admin to ensure it matches first
app.use('/api/admin/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/shop-agents', require('./routes/shopAgents'));
app.use('/api/countdown', require('./routes/countdown'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/set-offers', require('./routes/set-offers'));
app.use('/api/seed', require('./routes/seed-subcategories'));
app.use('/api/import', require('./routes/import-data'));
app.use('/api/import-drinks', require('./routes/import-drinks'));
app.use('/api/import-smokes', require('./routes/import-smokes'));
app.use('/api/add-smokes-subcategories', require('./routes/add-smokes-subcategories'));
app.use('/api/test-import', require('./routes/test-import'));
app.use('/api/test-csv-import', require('./routes/test-csv-import'));
app.use('/api/import-all-smokes', require('./routes/import-all-smokes'));
app.use('/api/import-brandy', require('./routes/import-brandy'));
app.use('/api/import-champagne', require('./routes/import-champagne'));
app.use('/api/import-rum', require('./routes/import-rum'));
app.use('/api/import-gin', require('./routes/import-gin'));
app.use('/api/import-liqueurs', require('./routes/import-liqueurs'));
app.use('/api/import-whiskey', require('./routes/import-whiskey'));
app.use('/api/import-vodka', require('./routes/import-vodka'));
app.use('/api/import-dialadrink-vodka', require('./routes/import-dialadrink-vodka'));
app.use('/api/import-dialadrink-wine', require('./routes/import-dialadrink-wine'));
app.use('/api/import-missing-wines', require('./routes/import-missing-wines'));
app.use('/api/add-specific-wines', require('./routes/add-specific-wines'));
app.use('/api/add-out-of-stock-whisky', require('./routes/add-out-of-stock-whisky'));
app.use('/api/add-cognac-items', require('./routes/add-cognac-items'));
app.use('/api/add-missing-beer-items', require('./routes/add-missing-beer-items'));
app.use('/api/assign-wine-subcategories', require('./routes/assign-wine-subcategories'));
app.use('/api/assign-beer-subcategories', require('./routes/assign-beer-subcategories'));
app.use('/api/update-beer-subcategories', require('./routes/update-beer-subcategories'));
app.use('/api/update-brandy-subcategories', require('./routes/update-brandy-subcategories'));
app.use('/api/update-champagne-subcategories', require('./routes/update-champagne-subcategories'));
app.use('/api/update-cognac-subcategories', require('./routes/update-cognac-subcategories'));
app.use('/api/update-gin-subcategories', require('./routes/update-gin-subcategories'));
app.use('/api/update-liqueur-subcategories', require('./routes/update-liqueur-subcategories'));
app.use('/api/update-rum-subcategories', require('./routes/update-rum-subcategories'));
app.use('/api/update-smokes-subcategories', require('./routes/update-smokes-subcategories'));
app.use('/api/update-soft-drinks-subcategories', require('./routes/update-soft-drinks-subcategories'));
app.use('/api/update-tequila-subcategories', require('./routes/update-tequila-subcategories'));
app.use('/api/move-vapes-to-smokes', require('./routes/move-vapes-to-smokes'));
app.use('/api/remove-vapes-category', require('./routes/remove-vapes-category'));
app.use('/api/update-vodka-subcategories', require('./routes/update-vodka-subcategories'));
app.use('/api/update-whisky-subcategories', require('./routes/update-whisky-subcategories'));
app.use('/api/update-wine-subcategories', require('./routes/update-wine-subcategories'));
app.use('/api/cleanup', require('./routes/cleanup-drinks'));
app.use('/api/scrape-images', require('./routes/scrape-images'));
app.use('/api/places', require('./routes/places'));
app.use('/api/distance', require('./routes/distance'));
app.use('/api/mpesa', require('./routes/mpesa'));
app.use('/api/pesapal', require('./routes/pesapal'));
app.use('/api/pdq-payment', require('./routes/pdq-payment'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/order-notifications', require('./routes/order-notifications'));
app.use('/api/auth', require('./routes/auth'));
// Mount driver-notifications router BEFORE the main drivers router
// This ensures specific notification routes are matched first
app.use('/api/drivers', require('./routes/driver-notifications'));

// Log all requests to /api/drivers before routing
app.use('/api/drivers', (req, res, next) => {
  console.log(`🌐 [APP.JS] ${req.method} ${req.path} - OriginalUrl: ${req.originalUrl}`);
  if (req.path.includes('notifications')) {
    console.log(`🔔 [APP.JS] NOTIFICATION REQUEST: ${req.method} ${req.path}`);
    console.log(`🔔 [APP.JS] Headers:`, JSON.stringify(req.headers, null, 2));
  }
  next();
});
app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/driver-orders', require('./routes/driver-orders'));
app.use('/api/driver-wallet', require('./routes/driver-wallet'));
app.use('/api/driver-wallet', require('./routes/cash-submissions'));
app.use('/api/branches', require('./routes/branches'));
app.use('/api/territories', require('./routes/territories'));
app.use('/api/developers', require('./routes/developers'));

// Valkyrie Partner API (feature flag controlled)
if (process.env.ENABLE_VALKYRIE === 'true' || process.env.ENABLE_VALKYRIE === '1') {
  app.use('/api/valkyrie/v1', require('./routes/valkyrie'));
  console.log('✅ Valkyrie Partner API enabled at /api/valkyrie/v1');
} else {
  console.log('ℹ️  Valkyrie Partner API disabled (set ENABLE_VALKYRIE=true to enable)');
}

// Zeus Super Admin API (feature flag controlled)
if (process.env.ENABLE_ZEUS === 'true' || process.env.ENABLE_ZEUS === '1') {
  app.use('/api/zeus/v1', require('./routes/zeus'));
  console.log('✅ Zeus Super Admin API enabled at /api/zeus/v1');
} else {
  console.log('ℹ️  Zeus Super Admin API disabled (set ENABLE_ZEUS=true to enable)');
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Dial A Drink Kenya API', 
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      categories: '/api/categories',
      subcategories: '/api/subcategories',
      drinks: '/api/drinks',
      orders: '/api/orders',
      admin: '/api/admin',
      countdown: '/api/countdown'
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Dial A Drink API is running' });
});

// Test endpoint to verify requests are reaching the backend
app.get('/api/test-notifications', (req, res) => {
  console.log('🧪 [TEST] /api/test-notifications hit!');
  console.log('🧪 [TEST] Headers:', JSON.stringify(req.headers, null, 2));
  res.json({ status: 'OK', message: 'Test endpoint reached', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  // Don't send response if headers have already been sent
  if (res.headersSent) {
    return next(err);
  }
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler for all unmatched routes
app.use((req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    res.status(404).json({ error: 'API route not found' });
  } else {
    res.status(404).json({ error: 'Route not found' });
  }
});

module.exports = app;
