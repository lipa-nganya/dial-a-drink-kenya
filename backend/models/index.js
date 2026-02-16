const { Sequelize } = require('sequelize');
const config = require('../config');
const { getDatabaseConfigName } = require('../utils/envDetection');

// Use environment detection utility to determine correct config
const env = getDatabaseConfigName();
const dbConfig = config[env];

// Log environment detection (helpful for debugging)
const { isLocal, isProduction } = require('../utils/envDetection');
console.log(`🔍 Environment detection: NODE_ENV=${process.env.NODE_ENV || 'not set'}, Using config: ${env}, isLocal: ${isLocal()}, isProduction: ${isProduction()}`);
if (isLocal() && process.env.DATABASE_URL) {
  console.warn('⚠️  WARNING: DATABASE_URL is set in local environment. This may override local database config.');
  console.warn('⚠️  For local development, use DB_HOST, DB_PORT, etc. instead of DATABASE_URL.');
}

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
      // Some connection strings include ?sslmode=require which can conflict with
      // our explicit SSL settings. Strip that query parameter and rely on
      // dialectOptions.ssl (which we force to rejectUnauthorized: false).
      const sanitizedUrl = databaseUrl.replace(/\?sslmode=require/, '');
      // Preserve SSL settings from config - Sequelize URL parsing can override them
      const sslConfig = dbConfig.dialectOptions?.ssl;
      const baseDialectOptions = dbConfig.dialectOptions || {};
      sequelize = new Sequelize(sanitizedUrl, {
        ...dbConfig,
        pool: {
          max: 10,
          min: 2,
          acquire: 10000,
          idle: 10000,
          evict: 1000
        },
        dialectOptions: {
          ...baseDialectOptions,
          connectTimeout: 10000,
          statement_timeout: 5000,
          query_timeout: 5000,
          // Force SSL settings to prevent certificate verification errors
          // Sequelize URL parsing can create empty ssl: {}, so we override it
          ...(sslConfig ? {
            ssl: {
              require: true,
              rejectUnauthorized: false
            }
          } : {})
        }
      });
      // Ensure SSL settings are applied even if Sequelize URL parsing overrode them
      if (sslConfig && sequelize.options.dialectOptions) {
        sequelize.options.dialectOptions.ssl = {
          require: true,
          rejectUnauthorized: false
        };
      }
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
const Brand = require('./Brand')(sequelize, Sequelize.DataTypes);
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
const Territory = require('./Territory')(sequelize, Sequelize.DataTypes);
const Supplier = require('./Supplier')(sequelize, Sequelize.DataTypes);
const SupplierTransaction = require('./SupplierTransaction')(sequelize, Sequelize.DataTypes);
const Stop = require('./Stop')(sequelize, Sequelize.DataTypes);
const CashSubmission = require('./CashSubmission')(sequelize, Sequelize.DataTypes);
const Notification = require('./Notification')(sequelize, Sequelize.DataTypes);
const NotificationRead = require('./NotificationRead')(sequelize, Sequelize.DataTypes);
const InventoryCheck = require('./InventoryCheck')(sequelize, Sequelize.DataTypes);
const Loan = require('./Loan')(sequelize, Sequelize.DataTypes);
const Penalty = require('./Penalty')(sequelize, Sequelize.DataTypes);

// Valkyrie models (conditionally loaded if they exist)
let ValkyriePartner, ValkyriePartnerUser, ValkyriePartnerDriver, ValkyriePartnerOrder, PartnerGeofence;
// Zeus models (conditionally loaded if they exist)
let ZeusAdmin, PartnerUsage, PartnerInvoice;
try {
  ValkyriePartner = require('./ValkyriePartner')(sequelize, Sequelize.DataTypes);
} catch (error) {
  console.warn('⚠️ ValkyriePartner model not found:', error.message);
}
try {
  ValkyriePartnerUser = require('./ValkyriePartnerUser')(sequelize, Sequelize.DataTypes);
} catch (error) {
  console.warn('⚠️ ValkyriePartnerUser model not found:', error.message);
}
try {
  ValkyriePartnerDriver = require('./ValkyriePartnerDriver')(sequelize, Sequelize.DataTypes);
} catch (error) {
  console.warn('⚠️ ValkyriePartnerDriver model not found:', error.message);
}
try {
  ValkyriePartnerOrder = require('./ValkyriePartnerOrder')(sequelize, Sequelize.DataTypes);
} catch (error) {
  console.warn('⚠️ ValkyriePartnerOrder model not found:', error.message);
}
try {
  PartnerGeofence = require('./PartnerGeofence')(sequelize, Sequelize.DataTypes);
} catch (error) {
  console.warn('⚠️ PartnerGeofence model not found:', error.message);
}
try {
  ZeusAdmin = require('./ZeusAdmin')(sequelize, Sequelize.DataTypes);
} catch (error) {
  console.warn('⚠️ ZeusAdmin model not found:', error.message);
}
try {
  PartnerUsage = require('./PartnerUsage')(sequelize, Sequelize.DataTypes);
} catch (error) {
  console.warn('⚠️ PartnerUsage model not found:', error.message);
}
try {
  PartnerInvoice = require('./PartnerInvoice')(sequelize, Sequelize.DataTypes);
} catch (error) {
  console.warn('⚠️ PartnerInvoice model not found:', error.message);
}

// Define associations
Category.hasMany(SubCategory, { foreignKey: 'categoryId', as: 'subcategories' });
SubCategory.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

Category.hasMany(Drink, { foreignKey: 'categoryId', as: 'drinks' });
Drink.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

SubCategory.hasMany(Drink, { foreignKey: 'subCategoryId', as: 'drinks' });
Drink.belongsTo(SubCategory, { foreignKey: 'subCategoryId', as: 'subCategory' });

Brand.hasMany(Drink, { foreignKey: 'brandId', as: 'drinks' });
Drink.belongsTo(Brand, { foreignKey: 'brandId', as: 'brand' });

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

// Driver-Stop associations
if (Driver && Stop) {
  Stop.belongsTo(Driver, { foreignKey: 'driverId', as: 'driver' });
  Driver.hasMany(Stop, { foreignKey: 'driverId', as: 'stops' });
}

// CashSubmission associations
if (CashSubmission && Driver) {
  CashSubmission.belongsTo(Driver, { foreignKey: 'driverId', as: 'driver' });
  Driver.hasMany(CashSubmission, { foreignKey: 'driverId', as: 'cashSubmissions' });
}
if (CashSubmission && Admin) {
  CashSubmission.belongsTo(Admin, { foreignKey: 'adminId', as: 'admin' });
  CashSubmission.belongsTo(Admin, { foreignKey: 'approvedBy', as: 'approver' });
  CashSubmission.belongsTo(Admin, { foreignKey: 'rejectedBy', as: 'rejector' });
}
if (CashSubmission && Order) {
  CashSubmission.belongsToMany(Order, {
    through: 'cash_submission_orders',
    foreignKey: 'cashSubmissionId',
    otherKey: 'orderId',
    as: 'orders'
  });
  Order.belongsToMany(CashSubmission, {
    through: 'cash_submission_orders',
    foreignKey: 'orderId',
    otherKey: 'cashSubmissionId',
    as: 'cashSubmissions'
  });
}

// Notification associations
if (Notification && Admin) {
  Notification.belongsTo(Admin, { foreignKey: 'sentBy', as: 'sender' });
  Admin.hasMany(Notification, { foreignKey: 'sentBy', as: 'notifications' });
}
if (Notification && NotificationRead && Driver) {
  Notification.hasMany(NotificationRead, { foreignKey: 'notificationId', as: 'reads' });
  NotificationRead.belongsTo(Notification, { foreignKey: 'notificationId', as: 'notification' });
  NotificationRead.belongsTo(Driver, { foreignKey: 'driverId', as: 'driver' });
  Driver.hasMany(NotificationRead, { foreignKey: 'driverId', as: 'notificationReads' });
}

// Branch-Order associations
if (Branch) {
  Order.belongsTo(Branch, { foreignKey: 'branchId', as: 'branch' });
  Branch.hasMany(Order, { foreignKey: 'branchId', as: 'orders' });
}

// Admin-Order associations
if (Admin && Order) {
  Order.belongsTo(Admin, { foreignKey: 'adminId', as: 'servicedByAdmin' });
  Admin.hasMany(Order, { foreignKey: 'adminId', as: 'servicedOrders' });
}

// Territory-Order associations
if (Territory && Order) {
  Order.belongsTo(Territory, { foreignKey: 'territoryId', as: 'territory' });
  Territory.hasMany(Order, { foreignKey: 'territoryId', as: 'orders' });
}

db.Category = Category;
db.SubCategory = SubCategory;
db.Brand = Brand;
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
db.Territory = Territory;
db.Supplier = Supplier;
db.SupplierTransaction = SupplierTransaction;
db.Stop = Stop;
db.CashSubmission = CashSubmission;
db.Notification = Notification;
db.NotificationRead = NotificationRead;
db.InventoryCheck = InventoryCheck;
db.Loan = Loan;
db.Penalty = Penalty;

// Loan and Penalty associations
if (Loan && Driver) {
  Loan.belongsTo(Driver, { foreignKey: 'driverId', as: 'driver' });
  Driver.hasMany(Loan, { foreignKey: 'driverId', as: 'loans' });
  Loan.belongsTo(Admin, { foreignKey: 'createdBy', as: 'creator' });
}
if (Penalty && Driver) {
  Penalty.belongsTo(Driver, { foreignKey: 'driverId', as: 'driver' });
  Driver.hasMany(Penalty, { foreignKey: 'driverId', as: 'penalties' });
  Penalty.belongsTo(Admin, { foreignKey: 'createdBy', as: 'creator' });
}

// InventoryCheck associations
if (InventoryCheck && Admin) {
  InventoryCheck.belongsTo(Admin, { foreignKey: 'shopAgentId', as: 'shopAgent' });
  InventoryCheck.belongsTo(Admin, { foreignKey: 'approvedBy', as: 'approver' });
  Admin.hasMany(InventoryCheck, { foreignKey: 'shopAgentId', as: 'inventoryChecks' });
}
if (InventoryCheck && Drink) {
  InventoryCheck.belongsTo(Drink, { foreignKey: 'drinkId', as: 'drink' });
  Drink.hasMany(InventoryCheck, { foreignKey: 'drinkId', as: 'inventoryChecks' });
}

// Supplier associations - only set up if models are loaded successfully
try {
  if (Supplier && SupplierTransaction) {
    Supplier.hasMany(SupplierTransaction, { foreignKey: 'supplierId', as: 'transactions' });
    SupplierTransaction.belongsTo(Supplier, { foreignKey: 'supplierId', as: 'supplier' });
  }
  
  if (Admin && SupplierTransaction) {
    SupplierTransaction.belongsTo(Admin, { foreignKey: 'createdBy', as: 'createdByAdmin' });
    Admin.hasMany(SupplierTransaction, { foreignKey: 'createdBy', as: 'supplierTransactions' });
  }
} catch (associationError) {
  console.warn('⚠️  Warning: Could not set up SupplierTransaction associations:', associationError.message);
  // Continue without associations - they'll be set up when the table exists
}

// Add Valkyrie models if they exist
if (ValkyriePartner) db.ValkyriePartner = ValkyriePartner;
if (ValkyriePartnerUser) db.ValkyriePartnerUser = ValkyriePartnerUser;
if (ValkyriePartnerDriver) db.ValkyriePartnerDriver = ValkyriePartnerDriver;
if (ValkyriePartnerOrder) db.ValkyriePartnerOrder = ValkyriePartnerOrder;
if (PartnerGeofence) db.PartnerGeofence = PartnerGeofence;
// Add Zeus models if they exist
if (ZeusAdmin) db.ZeusAdmin = ZeusAdmin;
if (PartnerUsage) db.PartnerUsage = PartnerUsage;
if (PartnerInvoice) db.PartnerInvoice = PartnerInvoice;

// Valkyrie model associations
if (ValkyriePartner && ValkyriePartnerUser) {
  ValkyriePartner.hasMany(ValkyriePartnerUser, { foreignKey: 'partnerId', as: 'users' });
  ValkyriePartnerUser.belongsTo(ValkyriePartner, { foreignKey: 'partnerId', as: 'partner' });
}
if (ValkyriePartner && PartnerGeofence) {
  ValkyriePartner.hasMany(PartnerGeofence, { foreignKey: 'partnerId', as: 'geofences' });
  PartnerGeofence.belongsTo(ValkyriePartner, { foreignKey: 'partnerId', as: 'partner' });
}
if (ZeusAdmin && PartnerGeofence) {
  PartnerGeofence.belongsTo(ZeusAdmin, { foreignKey: 'createdBy', as: 'creator' });
}
if (ValkyriePartner && PartnerUsage) {
  ValkyriePartner.hasMany(PartnerUsage, { foreignKey: 'partnerId', as: 'usage' });
  PartnerUsage.belongsTo(ValkyriePartner, { foreignKey: 'partnerId', as: 'partner' });
}
if (ValkyriePartner && PartnerInvoice) {
  ValkyriePartner.hasMany(PartnerInvoice, { foreignKey: 'partnerId', as: 'invoices' });
  PartnerInvoice.belongsTo(ValkyriePartner, { foreignKey: 'partnerId', as: 'partner' });
}

// ValkyriePartnerDriver associations
if (ValkyriePartnerDriver && Driver) {
  ValkyriePartnerDriver.belongsTo(Driver, { foreignKey: 'driverId', as: 'driver' });
  Driver.hasMany(ValkyriePartnerDriver, { foreignKey: 'driverId', as: 'partnerDrivers' });
}
if (ValkyriePartnerDriver && ValkyriePartner) {
  ValkyriePartnerDriver.belongsTo(ValkyriePartner, { foreignKey: 'partnerId', as: 'partner' });
  ValkyriePartner.hasMany(ValkyriePartnerDriver, { foreignKey: 'partnerId', as: 'partnerDrivers' });
}
if (ValkyriePartnerOrder && ValkyriePartner) {
  ValkyriePartnerOrder.belongsTo(ValkyriePartner, { foreignKey: 'partnerId', as: 'partner' });
  ValkyriePartner.hasMany(ValkyriePartnerOrder, { foreignKey: 'partnerId', as: 'partnerOrders' });
}
if (ValkyriePartnerOrder && Order) {
  ValkyriePartnerOrder.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
  Order.hasMany(ValkyriePartnerOrder, { foreignKey: 'orderId', as: 'partnerOrders' });
}

db.sequelize = sequelize;
db.Sequelize = Sequelize;

// DriverWallet associations
if (DriverWallet && Driver) {
  DriverWallet.belongsTo(Driver, { foreignKey: 'driverId', as: 'driver' });
  Driver.hasOne(DriverWallet, { foreignKey: 'driverId', as: 'wallet' });
}

module.exports = db;

