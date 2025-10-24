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

// Function to add missing columns for offers system
const addMissingColumns = async () => {
  try {
    console.log('Checking for missing columns...');
    
    // Add isOnOffer column if it doesn't exist
    await db.sequelize.query(`
      ALTER TABLE "drinks" 
      ADD COLUMN IF NOT EXISTS "isOnOffer" BOOLEAN DEFAULT false;
    `);
    console.log('✅ isOnOffer column checked/added');

    // Add originalPrice column if it doesn't exist
    await db.sequelize.query(`
      ALTER TABLE "drinks" 
      ADD COLUMN IF NOT EXISTS "originalPrice" DECIMAL(10,2);
    `);
    console.log('✅ originalPrice column checked/added');

    // Set originalPrice for existing drinks
    await db.sequelize.query(`
      UPDATE "drinks" 
      SET "originalPrice" = "price" 
      WHERE "originalPrice" IS NULL;
    `);
    console.log('✅ originalPrice set for existing drinks');

    // Update image column to TEXT type for longer URLs
    await db.sequelize.query(`
      ALTER TABLE "drinks" 
      ALTER COLUMN "image" TYPE TEXT;
    `);
    console.log('✅ Image column updated to TEXT type');

    // Add capacity and ABV columns if they don't exist
    await db.sequelize.query(`
      ALTER TABLE "drinks" 
      ADD COLUMN IF NOT EXISTS "capacity" JSON;
    `);
    console.log('✅ Capacity column checked/added (JSON type)');

    await db.sequelize.query(`
      ALTER TABLE "drinks" 
      ADD COLUMN IF NOT EXISTS "capacityPricing" JSON;
    `);
    console.log('✅ Capacity pricing column checked/added (JSON type)');

    await db.sequelize.query(`
      ALTER TABLE "drinks" 
      ADD COLUMN IF NOT EXISTS "abv" DECIMAL(5,2);
    `);
    console.log('✅ ABV column checked/added');

    return true;
  } catch (error) {
    console.warn('Column migration failed:', error.message);
    return false;
  }
};

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
        
        // Add missing columns for offers system
        return addMissingColumns();
      })
      .then(() => {
        console.log('Database columns updated successfully.');
        
        // Seed database if empty - non-blocking
        return db.Category.count();
      })
      .then(categoryCount => {
        if (categoryCount === 0) {
          console.log('Seeding database...');
          return seedData();
        }
      })
      .then(() => {
        console.log('Database setup completed.');
      })
      .catch(error => {
        console.warn('Database setup failed:', error.message);
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

// Set up periodic check for expired countdowns (every minute)
setInterval(async () => {
  try {
    const { Countdown, Drink } = require('./models');
    
    const activeCountdowns = await Countdown.findAll({
      where: { isActive: true }
    });

    const now = new Date();
    
    for (const countdown of activeCountdowns) {
      const endDate = new Date(countdown.endDate);
      
      if (now > endDate) {
        console.log(`⏰ Countdown "${countdown.title}" has expired, reverting offers...`);
        
        // Revert all offers
        const offerDrinks = await Drink.findAll({
          where: { isOnOffer: true }
        });

        for (const drink of offerDrinks) {
          if (drink.originalPrice) {
            await drink.update({
              isOnOffer: false,
              price: drink.originalPrice
            });
          }
        }
        
        await countdown.update({ isActive: false });
        console.log(`✅ Countdown "${countdown.title}" deactivated and ${offerDrinks.length} offers reverted`);
      }
    }
  } catch (error) {
    console.error('Error in periodic countdown check:', error);
  }
}, 60000); // Check every minute
