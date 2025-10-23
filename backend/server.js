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
    origin: "http://localhost:3001",
    methods: ["GET", "POST"]
  }
});

// Make io available globally
app.set('io', io);

// Sync database and start server
const startServer = async () => {
  try {
    // Test database connection
    await db.sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    // Sync database (create tables if they don't exist)
    await db.sequelize.sync({ force: false });
    console.log('Database synchronized successfully.');
    
    // Seed database if empty
    const categoryCount = await db.Category.count();
    if (categoryCount === 0) {
      console.log('Seeding database...');
      await seedData();
      console.log('Database seeded successfully.');
    }
    
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
    
    // Start server
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
};

startServer();
