require('dotenv').config();
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
      process.env.FRONTEND_URL || 'http://localhost:3000',
      process.env.ADMIN_URL || 'http://localhost:3001',
      'http://localhost:3002',
      'https://drink-suite-customer-910510650031.us-central1.run.app',
      'https://drink-suite-admin-910510650031.us-central1.run.app'
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

    // Add limitedTimeOffer column if it doesn't exist
    await db.sequelize.query(`
      ALTER TABLE "drinks" 
      ADD COLUMN IF NOT EXISTS "limitedTimeOffer" BOOLEAN DEFAULT false;
    `);
    console.log('✅ limitedTimeOffer column checked/added');

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

    // Create subcategories table if it doesn't exist
    await db.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "subcategories" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL UNIQUE,
        "categoryId" INTEGER NOT NULL REFERENCES "categories"("id"),
        "isActive" BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);
    console.log('✅ subcategories table checked/created');

    // Add subCategoryId column to drinks table if it doesn't exist
    await db.sequelize.query(`
      ALTER TABLE "drinks" 
      ADD COLUMN IF NOT EXISTS "subCategoryId" INTEGER REFERENCES "subcategories"("id");
    `);
    console.log('✅ subCategoryId column checked/added');

    // Create settings table if it doesn't exist
    await db.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "settings" (
        "id" SERIAL PRIMARY KEY,
        "key" VARCHAR(255) NOT NULL UNIQUE,
        "value" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);
    console.log('✅ settings table checked/created');

    // Add payment columns to orders table if they don't exist
    // Check if paymentType column exists
    const paymentTypeCheck = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='orders' AND column_name='paymentType';
    `);
    
    if (paymentTypeCheck[0].length === 0) {
      // Create ENUM type if it doesn't exist
      await db.sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE payment_type_enum AS ENUM ('pay_now', 'pay_on_delivery');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      
      await db.sequelize.query(`
        ALTER TABLE "orders" 
        ADD COLUMN "paymentType" payment_type_enum DEFAULT 'pay_on_delivery';
      `);
      console.log('✅ paymentType column checked/added');
    } else {
      console.log('✅ paymentType column already exists');
    }

    // Check if driverId column exists
    const driverIdCheck = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='orders' AND column_name='driverId';
    `);
    
    if (driverIdCheck[0].length === 0) {
      await db.sequelize.query(`
        ALTER TABLE "orders" 
        ADD COLUMN "driverId" INTEGER REFERENCES "drivers"("id") ON DELETE SET NULL;
      `);
      console.log('✅ driverId column checked/added');
    } else {
      console.log('✅ driverId column already exists');
    }

    // Check if pinHash column exists in drivers table
    const pinHashCheck = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='drivers' AND column_name='pinHash';
    `);
    
    if (pinHashCheck[0].length === 0) {
      await db.sequelize.query(`
        ALTER TABLE "drivers" 
        ADD COLUMN "pinHash" VARCHAR(255);
      `);
      console.log('✅ pinHash column checked/added to drivers table');
    } else {
      console.log('✅ pinHash column already exists in drivers table');
    }

    // Check if driverAccepted column exists in orders table
    const driverAcceptedCheck = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='orders' AND column_name='driverAccepted';
    `);
    
    if (driverAcceptedCheck[0].length === 0) {
      await db.sequelize.query(`
        ALTER TABLE "orders" 
        ADD COLUMN "driverAccepted" BOOLEAN;
      `);
      console.log('✅ driverAccepted column checked/added to orders table');
    } else {
      console.log('✅ driverAccepted column already exists in orders table');
    }

    await db.sequelize.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "driverPayCredited" BOOLEAN DEFAULT false;
    `);
    await db.sequelize.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "driverPayCreditedAt" TIMESTAMP WITH TIME ZONE;
    `);
    await db.sequelize.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "driverPayAmount" DECIMAL(10,2) DEFAULT 0;
    `);
    console.log('✅ Driver pay tracking columns checked/added to orders table');

    // Check if paymentMethod column exists
    const paymentMethodCheck = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='orders' AND column_name='paymentMethod';
    `);
    
    if (paymentMethodCheck[0].length === 0) {
      // Create ENUM type if it doesn't exist
      await db.sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE payment_method_enum AS ENUM ('card', 'mobile_money');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      
      await db.sequelize.query(`
        ALTER TABLE "orders" 
        ADD COLUMN "paymentMethod" payment_method_enum;
      `);
      console.log('✅ paymentMethod column checked/added');
    } else {
      console.log('✅ paymentMethod column already exists');
    }

    // Check if paymentStatus column exists
    const paymentStatusCheck = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='orders' AND column_name='paymentStatus';
    `);
    
    if (paymentStatusCheck[0].length === 0) {
      // Create ENUM type if it doesn't exist
      await db.sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE payment_status_enum AS ENUM ('pending', 'paid', 'unpaid');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      
      await db.sequelize.query(`
        ALTER TABLE "orders" 
        ADD COLUMN "paymentStatus" payment_status_enum DEFAULT 'pending';
      `);
      console.log('✅ paymentStatus column checked/added');
    } else {
      console.log('✅ paymentStatus column already exists');
    }

    // Update status enum to include 'completed' if needed
    // Note: PostgreSQL doesn't support ALTER TYPE ADD VALUE in a transaction, so we do it separately
    try {
      await db.sequelize.query(`
        ALTER TYPE "enum_orders_status" ADD VALUE IF NOT EXISTS 'completed';
      `);
      console.log('✅ Status enum updated to include completed');
    } catch (error) {
      // If it fails, the enum might already have the value or the type doesn't exist yet
      console.log('Note: Status enum update attempted (may already exist)');
    }

    // Add tipAmount column to orders table if it doesn't exist
    const tipAmountCheck = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='orders' AND column_name='tipAmount';
    `);
    
    if (tipAmountCheck[0].length === 0) {
      await db.sequelize.query(`
        ALTER TABLE "orders" 
        ADD COLUMN "tipAmount" DECIMAL(10, 2) DEFAULT 0;
      `);
      console.log('✅ tipAmount column checked/added to orders table');
    } else {
      console.log('✅ tipAmount column already exists in orders table');
    }

    // Create transactions table if it doesn't exist
    await db.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "transactions" (
        "id" SERIAL PRIMARY KEY,
        "orderId" INTEGER REFERENCES "orders"("id") ON DELETE CASCADE,
        "driverId" INTEGER REFERENCES "drivers"("id") ON DELETE SET NULL,
        "driverWalletId" INTEGER,
        "transactionType" VARCHAR(255) DEFAULT 'payment',
        "paymentMethod" VARCHAR(255) NOT NULL,
        "paymentProvider" VARCHAR(255),
        "amount" DECIMAL(10, 2) NOT NULL,
        "status" VARCHAR(255) DEFAULT 'pending',
        "paymentStatus" VARCHAR(255) DEFAULT 'pending',
        "receiptNumber" VARCHAR(255),
        "checkoutRequestID" VARCHAR(255),
        "merchantRequestID" VARCHAR(255),
        "phoneNumber" VARCHAR(255),
        "transactionDate" TIMESTAMP WITH TIME ZONE,
        "notes" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);
    console.log('✅ transactions table checked/created');

    // Add paymentStatus column if it doesn't exist
    try {
      const paymentStatusCheck = await db.sequelize.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='transactions' AND column_name='paymentStatus';
      `);
      
      if (paymentStatusCheck[0].length === 0) {
        await db.sequelize.query(`
          ALTER TABLE transactions ADD COLUMN "paymentStatus" VARCHAR(255) DEFAULT 'pending';
        `);
        
        // Update existing transactions to set paymentStatus based on status
        await db.sequelize.query(`
          UPDATE transactions 
          SET "paymentStatus" = CASE 
            WHEN status = 'completed' THEN 'paid'
            WHEN status = 'failed' THEN 'failed'
            WHEN status = 'cancelled' THEN 'cancelled'
            ELSE 'pending'
          END;
        `);
        
        console.log('✅ paymentStatus column added to transactions table');
      } else {
        console.log('✅ paymentStatus column already exists in transactions table');
      }
    } catch (error) {
      console.log('Note: paymentStatus column check/update attempted (may already exist)');
    }

    // Update orderId column to allow NULL if it doesn't already
    try {
      const orderIdNullableCheck = await db.sequelize.query(`
        SELECT is_nullable 
        FROM information_schema.columns 
        WHERE table_name='transactions' AND column_name='orderId';
      `);
      
      if (orderIdNullableCheck[0].length > 0 && orderIdNullableCheck[0][0].is_nullable === 'NO') {
        await db.sequelize.query(`
          ALTER TABLE "transactions" 
          ALTER COLUMN "orderId" DROP NOT NULL;
        `);
        console.log('✅ Updated orderId column to allow NULL in transactions table');
      } else {
        console.log('✅ orderId column already allows NULL in transactions table');
      }
    } catch (error) {
      console.log('Note: orderId nullable check attempted (may already be nullable)');
    }

    // Add driverId and driverWalletId columns to transactions table if they don't exist
    const transactionsDriverIdCheck = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='transactions' AND column_name='driverId';
    `);
    
    if (transactionsDriverIdCheck[0].length === 0) {
      await db.sequelize.query(`
        ALTER TABLE "transactions" 
        ADD COLUMN "driverId" INTEGER REFERENCES "drivers"("id") ON DELETE SET NULL;
      `);
      console.log('✅ driverId column checked/added to transactions table');
    } else {
      console.log('✅ driverId column already exists in transactions table');
    }

    const driverWalletIdCheck = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='transactions' AND column_name='driverWalletId';
    `);
    
    if (driverWalletIdCheck[0].length === 0) {
      await db.sequelize.query(`
        ALTER TABLE "transactions" 
        ADD COLUMN "driverWalletId" INTEGER;
      `);
      console.log('✅ driverWalletId column checked/added to transactions table');
    } else {
      console.log('✅ driverWalletId column already exists in transactions table');
    }

    // Create ENUM types for transactions if they don't exist
    await db.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE transaction_type_enum AS ENUM ('payment', 'refund', 'tip', 'withdrawal');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `).catch(() => {});
    
    // Try to add 'tip' and 'withdrawal' to existing enum if they don't exist
    try {
      await db.sequelize.query(`ALTER TYPE transaction_type_enum ADD VALUE IF NOT EXISTS 'tip'`);
      console.log('✅ Added tip to transaction_type_enum');
    } catch (error) {
      console.log('Note: transaction_type_enum tip value update attempted (may already exist)');
    }
    
    try {
      await db.sequelize.query(`ALTER TYPE transaction_type_enum ADD VALUE IF NOT EXISTS 'withdrawal'`);
      console.log('✅ Added withdrawal to transaction_type_enum');
    } catch (error) {
      console.log('Note: transaction_type_enum withdrawal value update attempted (may already exist)');
    }

    try {
      await db.sequelize.query(`ALTER TYPE transaction_type_enum ADD VALUE IF NOT EXISTS 'delivery_pay'`);
      console.log('✅ Added delivery_pay to transaction_type_enum');
    } catch (error) {
      console.log('Note: transaction_type_enum delivery_pay value update attempted (may already exist)');
    }

    try {
      await db.sequelize.query(`ALTER TYPE transaction_type_enum ADD VALUE IF NOT EXISTS 'driver_pay'`);
      console.log('✅ Added driver_pay to transaction_type_enum');
    } catch (error) {
      console.log('Note: transaction_type_enum driver_pay value update attempted (may already exist)');
    }

    try {
      await db.sequelize.query(`ALTER TYPE transaction_type_enum ADD VALUE IF NOT EXISTS 'delivery_fee_debit'`);
      console.log('✅ Added delivery_fee_debit to transaction_type_enum');
    } catch (error) {
      console.log('Note: transaction_type_enum delivery_fee_debit value update attempted (may already exist)');
    }
    try {
      await db.sequelize.query(`ALTER TYPE transaction_type_enum ADD VALUE IF NOT EXISTS 'cash_settlement'`);
      console.log('✅ Added cash_settlement to transaction_type_enum');
    } catch (error) {
      console.log('Note: transaction_type_enum cash_settlement value update attempted (may already exist)');
    }

    await db.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE transaction_status_enum AS ENUM ('pending', 'completed', 'failed', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `).catch(() => {});

    await db.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE transaction_payment_method_enum AS ENUM ('card', 'mobile_money', 'cash', 'system');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `).catch(() => {});

    try {
      await db.sequelize.query(`ALTER TYPE transaction_payment_method_enum ADD VALUE IF NOT EXISTS 'system'`);
      console.log('✅ Added system to transaction_payment_method_enum');
    } catch (error) {
      console.log('Note: transaction_payment_method_enum system value update attempted (may already exist)');
    }

    // Ensure payment transactions have a transactionDate
    await db.sequelize.query(`
      UPDATE transactions
      SET "transactionDate" = "createdAt"
      WHERE "transactionType" = 'payment' AND "transactionDate" IS NULL;
    `);
    console.log('✅ Backfilled missing payment transaction dates');

    // Align tip transaction dates with corresponding payment transactions
    await db.sequelize.query(`
      UPDATE transactions AS tip
      SET "transactionDate" = pay."transactionDate"
      FROM transactions AS pay
      WHERE tip."transactionType" = 'tip'
        AND pay."transactionType" = 'payment'
        AND pay."status" = 'completed'
        AND tip."orderId" = pay."orderId"
        AND pay."transactionDate" IS NOT NULL
        AND tip."transactionDate" IS DISTINCT FROM pay."transactionDate";
    `);
    console.log('✅ Synchronized tip transaction dates with payment transactions');

    // Backfill remaining tip transactions without a timestamp
    await db.sequelize.query(`
      UPDATE transactions
      SET "transactionDate" = "createdAt"
      WHERE "transactionType" = 'tip' AND "transactionDate" IS NULL;
    `);
    console.log('✅ Backfilled missing tip transaction dates');

    // Try to update existing transactions table to use ENUMs if columns exist but aren't ENUMs
    try {
      const transactionTypeCheck = await db.sequelize.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name='transactions' AND column_name='transactionType';
      `);
      
      if (transactionTypeCheck[0].length > 0 && transactionTypeCheck[0][0].data_type !== 'USER-DEFINED') {
        // Column exists but isn't ENUM, try to convert
        await db.sequelize.query(`
          ALTER TABLE "transactions" 
          ALTER COLUMN "transactionType" TYPE transaction_type_enum USING "transactionType"::transaction_type_enum;
        `).catch(() => {});
      }
    } catch (error) {
      // Ignore errors
    }

    // Create order_notifications table if it doesn't exist
    await db.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "order_notifications" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL,
        "phoneNumber" VARCHAR(255) NOT NULL,
        "isActive" BOOLEAN DEFAULT true,
        "notes" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);
    console.log('✅ order_notifications table checked/created');

    // Create otps table if it doesn't exist
    await db.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "otps" (
        "id" SERIAL PRIMARY KEY,
        "phoneNumber" VARCHAR(255) NOT NULL,
        "otpCode" VARCHAR(10) NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "isUsed" BOOLEAN DEFAULT false,
        "attempts" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);
    console.log('✅ otps table checked/created');

    // Create email_confirmations table if it doesn't exist
    await db.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "email_confirmations" (
        "id" SERIAL PRIMARY KEY,
        "email" VARCHAR(255) NOT NULL,
        "token" VARCHAR(255) NOT NULL UNIQUE,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "isUsed" BOOLEAN DEFAULT false,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);
    console.log('✅ email_confirmations table checked/created');

    // Create customers table if it doesn't exist
    await db.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "customers" (
        "id" SERIAL PRIMARY KEY,
        "email" VARCHAR(255) UNIQUE,
        "phone" VARCHAR(255) UNIQUE,
        "username" VARCHAR(255) NOT NULL UNIQUE,
        "password" VARCHAR(255),
        "customerName" VARCHAR(255),
        "hasSetPassword" BOOLEAN DEFAULT false,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);
    console.log('✅ customers table checked/created');

    // Create driver_status enum if it doesn't exist
    await db.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE driver_status_enum AS ENUM ('active', 'inactive', 'on_delivery', 'offline');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `).catch(() => {});

    // Create drivers table if it doesn't exist
    await db.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "drivers" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(255) NOT NULL,
        "phoneNumber" VARCHAR(255) NOT NULL UNIQUE,
        "status" driver_status_enum DEFAULT 'offline',
        "lastActivity" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);
    console.log('✅ drivers table checked/created');

    // Create driver_wallets table if it doesn't exist
    await db.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "driver_wallets" (
        "id" SERIAL PRIMARY KEY,
        "driverId" INTEGER NOT NULL UNIQUE REFERENCES "drivers"("id") ON DELETE CASCADE,
        "balance" DECIMAL(10, 2) NOT NULL DEFAULT 0,
        "totalTipsReceived" DECIMAL(10, 2) NOT NULL DEFAULT 0,
        "totalTipsCount" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);
    console.log('✅ driver_wallets table checked/created');

    await db.sequelize.query(`
      ALTER TABLE "driver_wallets"
      ADD COLUMN IF NOT EXISTS "totalDeliveryPay" DECIMAL(10,2) DEFAULT 0;
    `);
    await db.sequelize.query(`
      ALTER TABLE "driver_wallets"
      ADD COLUMN IF NOT EXISTS "totalDeliveryPayCount" INTEGER DEFAULT 0;
    `);
    console.log('✅ Delivery pay tracking columns checked/added to driver_wallets table');

    // Create saved_addresses table if it doesn't exist
    await db.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "saved_addresses" (
        "id" SERIAL PRIMARY KEY,
        "address" TEXT NOT NULL UNIQUE,
        "placeId" VARCHAR(255),
        "formattedAddress" TEXT,
        "searchCount" INTEGER DEFAULT 0,
        "apiCallsSaved" INTEGER DEFAULT 0,
        "costSaved" DECIMAL(10, 4) DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);
    console.log('✅ saved_addresses table checked/created');

    // Create admins table if it doesn't exist
    await db.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "admins" (
        "id" SERIAL PRIMARY KEY,
        "username" VARCHAR(255) NOT NULL UNIQUE,
        "password" VARCHAR(255),
        "email" VARCHAR(255) NOT NULL UNIQUE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      );
    `);
    console.log('✅ admins table checked/created');
    
    // Fix password column to allow NULL if it has NOT NULL constraint
    try {
      const passwordColumnCheck = await db.sequelize.query(`
        SELECT is_nullable 
        FROM information_schema.columns 
        WHERE table_name='admins' AND column_name='password';
      `);
      
      if (passwordColumnCheck[0].length > 0 && passwordColumnCheck[0][0].is_nullable === 'NO') {
        console.log('⚠️ Password column has NOT NULL constraint, updating to allow NULL...');
        await db.sequelize.query(`
          ALTER TABLE "admins" 
          ALTER COLUMN "password" DROP NOT NULL;
        `);
        console.log('✅ Password column updated to allow NULL');
      }
    } catch (alterError) {
      console.warn('⚠️ Could not alter password column:', alterError.message);
    }

    // Add role column if it doesn't exist
    const roleCheck = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='admins' AND column_name='role';
    `);
    
    if (roleCheck[0].length === 0) {
      try {
        // Create ENUM type first
        await db.sequelize.query(`
          DO $$ BEGIN
            CREATE TYPE admin_role_enum AS ENUM ('admin', 'manager');
          EXCEPTION
            WHEN duplicate_object THEN null;
          END $$;
        `);
        
        // Add role column with ENUM type
        await db.sequelize.query(`
          ALTER TABLE "admins" 
          ADD COLUMN "role" admin_role_enum DEFAULT 'manager';
        `);
        console.log('✅ role column checked/added to admins table');
      } catch (roleError) {
        console.warn('⚠️ Error adding role column:', roleError.message);
        // Try adding as VARCHAR if ENUM fails
        try {
          await db.sequelize.query(`
            ALTER TABLE "admins" 
            ADD COLUMN "role" VARCHAR(20) DEFAULT 'manager';
          `);
          console.log('✅ role column added as VARCHAR (ENUM fallback)');
        } catch (varcharError) {
          console.warn('⚠️ Could not add role column:', varcharError.message);
        }
      }
    } else {
      console.log('✅ role column already exists in admins table');
    }

    // Add inviteToken columns if they don't exist
    const inviteTokenCheck = await db.sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='admins' AND column_name='inviteToken';
    `);
    
    if (inviteTokenCheck[0].length === 0) {
      await db.sequelize.query(`
        ALTER TABLE "admins" 
        ADD COLUMN "inviteToken" VARCHAR(255),
        ADD COLUMN "inviteTokenExpiry" TIMESTAMP WITH TIME ZONE;
      `);
      console.log('✅ inviteToken columns checked/added to admins table');
    } else {
      console.log('✅ inviteToken columns already exist in admins table');
    }

    // Create default admin user if it doesn't exist
    const existingAdmin = await db.Admin.findOne({ where: { username: 'admin' } });
    if (!existingAdmin) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await db.Admin.create({
        username: 'admin',
        password: hashedPassword,
        email: 'admin@dialadrink.com',
        role: 'admin'
      });
      console.log('✅ Default admin user created (username: admin, password: admin123)');
    } else {
      // Update existing admin to ensure it has admin role
      if (!existingAdmin.role || existingAdmin.role !== 'admin') {
        await existingAdmin.update({ role: 'admin' });
        console.log('✅ Updated existing admin user to have admin role');
      }
    }
    
    // Update all existing admin users without a role to have 'admin' role
    const adminsWithoutRole = await db.Admin.findAll({
      where: {
        role: null
      }
    });
    
    if (adminsWithoutRole.length > 0) {
      await db.Admin.update(
        { role: 'admin' },
        { where: { role: null } }
      );
      console.log(`✅ Updated ${adminsWithoutRole.length} admin user(s) to have admin role`);
    }

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
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Port: ${process.env.PORT || 5001}`);
    console.log(`Host: ${process.env.HOST || '0.0.0.0'}`);
    
    // Test database connection with timeout
    const dbTimeout = setTimeout(() => {
      console.log('⚠️ Database connection timeout - continuing with startup');
    }, 10000);
    
    try {
      await db.sequelize.authenticate();
      console.log('✅ Database connection established successfully.');
      clearTimeout(dbTimeout);
    } catch (dbError) {
      console.warn('⚠️ Database connection failed:', dbError.message);
      console.warn('⚠️ Continuing startup - database will retry on first request');
      clearTimeout(dbTimeout);
      // Continue startup even if database fails initially - don't crash
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

      // Allow clients to join order-specific rooms for payment notifications
      socket.on('join-order', (orderId) => {
        const roomName = `order-${orderId}`;
        socket.join(roomName);
        console.log(`Client ${socket.id} joined room: ${roomName}`);
      });
      
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
    
    // Start server immediately
    // Listen on 0.0.0.0 to accept connections from outside container (required for Cloud Run)
    const HOST = process.env.HOST || '0.0.0.0';
    
    // Start server - this must succeed for Cloud Run health checks
    server.listen(PORT, HOST, () => {
      console.log(`🚀 Server is running on ${HOST}:${PORT}`);
      console.log(`🔗 Health check: http://${HOST}:${PORT}/api/health`);
      console.log(`📊 API endpoints:`);
      console.log(`   - GET  /api/health`);
      console.log(`   - GET  /api/categories`);
      console.log(`   - GET  /api/drinks`);
      console.log(`   - POST /api/orders`);
      console.log(`   - GET  /api/admin/orders`);
      console.log(`🌐 Server ready to accept requests!`);
    });
    
    // Handle server errors gracefully
    server.on('error', (error) => {
      console.error('❌ Server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
      }
      // Don't exit - let Cloud Run handle it
    });
    
  } catch (error) {
    console.error('❌ Unable to start server:', error);
    console.error('Error stack:', error.stack);
    // Exit with error code so Cloud Run knows it failed
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
