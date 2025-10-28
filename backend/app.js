const express = require('express');
const cors = require('cors');
const db = require('./models');

const app = express();

// Middleware
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "https://dialadrink-frontend.onrender.com"
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/categories', require('./routes/categories'));
app.use('/api/subcategories', require('./routes/subcategories'));
app.use('/api/drinks', require('./routes/drinks'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/countdown', require('./routes/countdown'));
app.use('/api/set-offers', require('./routes/set-offers'));
app.use('/api/seed', require('./routes/seed-subcategories'));

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
