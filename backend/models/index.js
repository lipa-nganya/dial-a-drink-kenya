const { Sequelize } = require('sequelize');
const config = require('../config');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

let sequelize;
try {
  if (dbConfig.use_env_variable) {
    const databaseUrl = process.env[dbConfig.use_env_variable];
    
    // Log DATABASE_URL status (without exposing password)
    if (databaseUrl) {
      const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ':***@');
      console.log(`📊 DATABASE_URL found: ${maskedUrl.substring(0, 80)}...`);
    } else {
      console.warn(`⚠️ Warning: ${dbConfig.use_env_variable} environment variable is not set.`);
    }
    
    // Check if DATABASE_URL is missing or is a placeholder value
    if (!databaseUrl || databaseUrl.includes('[YOUR_DB_URL]') || databaseUrl.includes('placeholder')) {
      console.warn(`⚠️ Warning: ${dbConfig.use_env_variable} environment variable is not properly set.`);
      console.warn('⚠️ Creating placeholder Sequelize instance. Database connection will be deferred.');
      // Create a minimal Sequelize instance with dummy connection so models can initialize
      // The actual connection will be established later when DATABASE_URL is available
      sequelize = new Sequelize('postgres://placeholder:placeholder@localhost:5432/placeholder', {
        ...dbConfig,
        logging: false,
        pool: { max: 1, min: 0, idle: 10000 } // Minimal pool for placeholder
      });
    } else {
      console.log('✅ Initializing Sequelize with DATABASE_URL...');
      sequelize = new Sequelize(databaseUrl, {
        ...dbConfig,
        pool: {
          max: 10,
          min: 2,
          acquire: 10000,
          idle: 10000,
          evict: 1000
        },
        dialectOptions: {
          ...(dbConfig.dialectOptions || {}),
          connectTimeout: 10000,
          statement_timeout: 5000,
          query_timeout: 5000
        }
      });
    }
  } else {
    sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, dbConfig);
  }
} catch (error) {
  console.error('❌ Error initializing Sequelize:', error.message);
  console.warn('⚠️ Database connection will be deferred. Server will start but database operations will fail.');
  // Create a minimal placeholder instance
  sequelize = new Sequelize('postgres://placeholder:placeholder@localhost:5432/placeholder', {
    dialect: 'postgres',
    logging: false,
    pool: { max: 1, min: 0, idle: 10000 } // Minimal pool for placeholder
  });
}

const db = {};

// Import models
const Category = require('./Category')(sequelize, Sequelize.DataTypes);
const SubCategory = require('./SubCategory')(sequelize, Sequelize.DataTypes);
const Drink = require('./Drink')(sequelize, Sequelize.DataTypes);
const Order = require('./Order')(sequelize, Sequelize.DataTypes);
const OrderItem = require('./OrderItem')(sequelize, Sequelize.DataTypes);
const Countdown = require('./Countdown')(sequelize, Sequelize.DataTypes);
const Settings = require('./Settings')(sequelize, Sequelize.DataTypes);
const Admin = require('./Admin')(sequelize, Sequelize.DataTypes);
const Transaction = require('./Transaction')(sequelize, Sequelize.DataTypes);
const OrderNotification = require('./OrderNotification')(sequelize, Sequelize.DataTypes);
const Otp = require('./Otp')(sequelize, Sequelize.DataTypes);
const EmailConfirmation = require('./EmailConfirmation')(sequelize, Sequelize.DataTypes);
const Customer = require('./Customer')(sequelize, Sequelize.DataTypes);
const Driver = require('./Driver')(sequelize, Sequelize.DataTypes);
const DriverWallet = require('./DriverWallet')(sequelize, Sequelize.DataTypes);
const AdminWallet = require('./AdminWallet')(sequelize, Sequelize.DataTypes);
const SavedAddress = require('./SavedAddress')(sequelize, Sequelize.DataTypes);
const Branch = require('./Branch')(sequelize, Sequelize.DataTypes);

// Define associations
Category.hasMany(SubCategory, { foreignKey: 'categoryId', as: 'subcategories' });
SubCategory.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

Category.hasMany(Drink, { foreignKey: 'categoryId', as: 'drinks' });
Drink.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

SubCategory.hasMany(Drink, { foreignKey: 'subCategoryId', as: 'drinks' });
Drink.belongsTo(SubCategory, { foreignKey: 'subCategoryId', as: 'subCategory' });

Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'orderItems' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
OrderItem.belongsTo(Drink, { foreignKey: 'drinkId', as: 'drink' });

Order.hasMany(Transaction, { foreignKey: 'orderId', as: 'transactions' });
Transaction.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

// Transaction-Driver associations
if (Driver) {
  Transaction.belongsTo(Driver, { foreignKey: 'driverId', as: 'driver' });
  Driver.hasMany(Transaction, { foreignKey: 'driverId', as: 'transactions' });
}

// Transaction-DriverWallet associations
if (DriverWallet) {
  Transaction.belongsTo(DriverWallet, { foreignKey: 'driverWalletId', as: 'wallet' });
  DriverWallet.hasMany(Transaction, { foreignKey: 'driverWalletId', as: 'transactions' });
}

// Driver-Order associations
if (Driver) {
  Order.belongsTo(Driver, { foreignKey: 'driverId', as: 'driver' });
  Driver.hasMany(Order, { foreignKey: 'driverId', as: 'orders' });
}

// Branch-Order associations
if (Branch) {
  Order.belongsTo(Branch, { foreignKey: 'branchId', as: 'branch' });
  Branch.hasMany(Order, { foreignKey: 'branchId', as: 'orders' });
}

db.Category = Category;
db.SubCategory = SubCategory;
db.Drink = Drink;
db.Order = Order;
db.OrderItem = OrderItem;
db.Countdown = Countdown;
db.Settings = Settings;
db.Admin = Admin;
db.Transaction = Transaction;
db.OrderNotification = OrderNotification;
db.Otp = Otp;
db.EmailConfirmation = EmailConfirmation;
db.Customer = Customer;
db.Driver = Driver;
db.DriverWallet = DriverWallet;
db.AdminWallet = AdminWallet;
db.SavedAddress = SavedAddress;
db.Branch = Branch;
db.sequelize = sequelize;
db.Sequelize = Sequelize;

// DriverWallet associations
if (DriverWallet && Driver) {
  DriverWallet.belongsTo(Driver, { foreignKey: 'driverId', as: 'driver' });
  Driver.hasOne(DriverWallet, { foreignKey: 'driverId', as: 'wallet' });
}

module.exports = db;

