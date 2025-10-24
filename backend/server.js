const app = require('./app');
const db = require('./models');
const seedData = require('./seed');
const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 5001;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || "http://localhost:3000",
      "http://localhost:3001",
      "https://dialadrink-frontend.onrender.com"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Make io available globally
app.set('io', io);

// Sync database and start server
const startServer = async () => {
  try {
    console.log('Starting server initialization...');
    
    // Test database connection with timeout
    const dbTimeout = setTimeout(() => {
      console.log('Database connection timeout - continuing with startup');
    }, 10000);
    
    try {
      await db.sequelize.authenticate();
      console.log('Database connection established successfully.');
      clearTimeout(dbTimeout);
    } catch (dbError) {
      console.warn('Database connection failed:', dbError.message);
      clearTimeout(dbTimeout);
      // Continue startup even if database fails initially
    }
    
    // Sync database (create tables if they don't exist) - non-blocking
    db.sequelize.sync({ force: false })
      .then(() => {
        console.log('Database synchronized successfully.');
        
        // Seed database if empty - non-blocking
        db.Category.count()
          .then(categoryCount => {
            if (categoryCount === 0) {
              console.log('Seeding database...');
              return seedData();
            }
          })
          .then(() => {
            console.log('Database seeded successfully.');
          })
          .catch(seedError => {
            console.warn('Database seeding failed:', seedError.message);
          });
      })
      .catch(syncError => {
        console.warn('Database sync failed:', syncError.message);
      });
    
    // Socket.IO connection handling
    io.on('connection', (socket) => {
      console.log('Admin connected:', socket.id);
      
      socket.on('join-admin', () => {
        socket.join('admin');
        console.log('Admin joined admin room');
      });
      
      socket.on('disconnect', () => {
        console.log('Admin disconnected:', socket.id);
      });
    });
    
    // Start server immediately
    server.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📊 API endpoints:`);
      console.log(`   - GET  /api/health`);
      console.log(`   - GET  /api/categories`);
      console.log(`   - GET  /api/drinks`);
      console.log(`   - POST /api/orders`);
      console.log(`   - GET  /api/admin/orders`);
      console.log(`🌐 Server ready to accept requests!`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
};

startServer();
