const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./models');

const app = express();

// Middleware
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  process.env.ADMIN_URL || 'http://localhost:3001',
  'http://localhost:3002',
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
  // Liquoros service URLs
  'https://liquoros-customer-910510650031.us-central1.run.app',
  'https://liquoros-admin-910510650031.us-central1.run.app',
  'https://liquoros-backend-910510650031.us-central1.run.app'
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // CRITICAL: Allow requests with no origin (like M-Pesa callbacks)
    // M-Pesa callbacks don't send Origin header, so we must allow them
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`Blocked CORS origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
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
app.use('/api/drinks', require('./routes/drinks'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/pos', require('./routes/pos'));
app.use('/api/inventory', require('./routes/inventory')); // Inventory management
app.use('/api/admin', require('./routes/admin'));
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
app.use('/api/cleanup', require('./routes/cleanup-drinks'));
app.use('/api/scrape-images', require('./routes/scrape-images'));
app.use('/api/places', require('./routes/places'));
app.use('/api/mpesa', require('./routes/mpesa'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/order-notifications', require('./routes/order-notifications'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/driver-orders', require('./routes/driver-orders'));
app.use('/api/driver-wallet', require('./routes/driver-wallet'));
app.use('/api/branches', require('./routes/branches'));

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

// Error handling middleware
app.use((err, req, res, next) => {
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
