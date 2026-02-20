#!/usr/bin/env node

/**
 * Script to delete all orders and transactions from local database
 * WARNING: This will permanently delete all orders and transactions!
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // Also load .env

const db = require('../models');

async function deleteAllOrdersAndTransactions() {
  console.log('🗑️  Starting deletion of all orders and transactions...');
  console.log('⚠️  WARNING: This will permanently delete all data!');
  
  try {
    // Verify we're on local database
    const { isLocal } = require('../utils/envDetection');
    if (!isLocal()) {
      console.error('❌ ERROR: This script can only be run on local database!');
      console.error('   Current environment:', process.env.NODE_ENV);
      process.exit(1);
    }
    
    await db.sequelize.authenticate();
    console.log('✅ Connected to local database');
    
    // Start a transaction for safety
    const transaction = await db.sequelize.transaction();
    
    try {
      // Delete in order to respect foreign key constraints
      // 1. Delete transactions first (they reference orders)
      console.log('📊 Deleting transactions...');
      const deletedTransactions = await db.Transaction.destroy({
        where: {},
        transaction,
        force: true // Hard delete
      });
      console.log(`   ✅ Deleted ${deletedTransactions} transactions`);
      
      // 2. Delete order items (they reference orders)
      console.log('📦 Deleting order items...');
      const deletedOrderItems = await db.OrderItem.destroy({
        where: {},
        transaction,
        force: true
      });
      console.log(`   ✅ Deleted ${deletedOrderItems} order items`);
      
      // 3. Delete order notifications
      console.log('🔔 Deleting order notifications...');
      const deletedNotifications = await db.OrderNotification.destroy({
        where: {},
        transaction,
        force: true
      });
      console.log(`   ✅ Deleted ${deletedNotifications} order notifications`);
      
      // 4. Delete cash submissions that reference orders
      console.log('💰 Deleting cash submissions...');
      const deletedCashSubmissions = await db.CashSubmission.destroy({
        where: {},
        transaction,
        force: true
      });
      console.log(`   ✅ Deleted ${deletedCashSubmissions} cash submissions`);
      
      // 5. Finally, delete orders
      console.log('📋 Deleting orders...');
      const deletedOrders = await db.Order.destroy({
        where: {},
        transaction,
        force: true
      });
      console.log(`   ✅ Deleted ${deletedOrders} orders`);
      
      // Commit the transaction
      await transaction.commit();
      
      console.log('\n✅ Successfully deleted all orders and transactions!');
      console.log(`   - Orders: ${deletedOrders}`);
      console.log(`   - Order Items: ${deletedOrderItems}`);
      console.log(`   - Transactions: ${deletedTransactions}`);
      console.log(`   - Order Notifications: ${deletedNotifications}`);
      console.log(`   - Cash Submissions: ${deletedCashSubmissions}`);
      
    } catch (error) {
      // Rollback on error
      await transaction.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error deleting orders and transactions:', error);
    process.exit(1);
  } finally {
    await db.sequelize.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the script
deleteAllOrdersAndTransactions()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
