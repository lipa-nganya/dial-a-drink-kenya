const { Sequelize } = require('sequelize');

// Use the DATABASE_URL environment variable for Render
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: console.log
});

async function updateImageColumn() {
  try {
    await sequelize.authenticate();
    console.log('Connection to database has been established successfully.');

    // Update the image column to TEXT type
    await sequelize.query(`
      ALTER TABLE "drinks" 
      ALTER COLUMN "image" TYPE TEXT;
    `);
    
    console.log('✅ Image column updated to TEXT type successfully!');
  } catch (error) {
    console.error('❌ Error updating image column:', error);
  } finally {
    await sequelize.close();
  }
}

updateImageColumn();
