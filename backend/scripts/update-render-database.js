const { Sequelize } = require('sequelize');

// Use the Render database URL
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

async function updateRenderDatabase() {
  try {
    console.log('Connecting to Render database...');
    await sequelize.authenticate();
    console.log('Connected to Render database successfully!');

    // Add isOnOffer column
    console.log('Adding isOnOffer column...');
    await sequelize.query(`
      ALTER TABLE "drinks" 
      ADD COLUMN IF NOT EXISTS "isOnOffer" BOOLEAN DEFAULT false;
    `);
    console.log('✅ isOnOffer column added');

    // Add originalPrice column
    console.log('Adding originalPrice column...');
    await sequelize.query(`
      ALTER TABLE "drinks" 
      ADD COLUMN IF NOT EXISTS "originalPrice" DECIMAL(10,2);
    `);
    console.log('✅ originalPrice column added');

    // Set originalPrice for existing drinks
    console.log('Setting originalPrice for existing drinks...');
    await sequelize.query(`
      UPDATE "drinks" 
      SET "originalPrice" = "price" 
      WHERE "originalPrice" IS NULL;
    `);
    console.log('✅ originalPrice set for existing drinks');

    // Set some drinks as offers for testing
    console.log('Setting up sample offers...');
    await sequelize.query(`
      UPDATE "drinks" 
      SET "isOnOffer" = true, 
          "price" = "price" * 0.8
      WHERE "id" IN (2, 3, 4)
      AND "isOnOffer" = false;
    `);
    console.log('✅ Sample offers created (20% discount)');

    console.log('🎉 Render database updated successfully!');
    
  } catch (error) {
    console.error('❌ Error updating Render database:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

updateRenderDatabase();
