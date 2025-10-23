const app = require('./app');
const db = require('./models');
const seedData = require('./seed');

const PORT = process.env.PORT || 5000;

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
    
    // Start server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
};

startServer();
