#!/usr/bin/env node

/**
 * Script to check if Order 413 has the correct savings credit transaction
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const db = require('../models');
const { getOrderFinancialBreakdown } = require('../utils/orderFinancials');

async function checkOrder413() {
  try {
    const orderId = 413;
    
    console.log(`\n🔍 Checking Order #${orderId}...\n`);
    
    // Get order
    const order = await db.Order.findByPk(orderId, {
      include: [
        { model: db.OrderItem, as: 'items' },
        { model: db.Driver, as: 'driver' }
      ]
    });
    
    if (!order) {
      console.error(`❌ Order #${orderId} not found`);
      process.exit(1);
    }
    
    console.log(`✅ Order #${orderId} found:`);
    console.log(`   Customer: ${order.customerName}`);
    console.log(`   Driver: ${order.driver?.name || 'N/A'} (ID: ${order.driverId})`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Payment Status: ${order.paymentStatus}`);
    console.log(`   Payment Method: ${order.paymentMethod}`);
    console.log(`   Payment Type: ${order.paymentType}`);
    console.log(`   Total Amount: KES ${parseFloat(order.totalAmount || 0).toFixed(2)}`);
    
    // Get financial breakdown
    const breakdown = await getOrderFinancialBreakdown(orderId);
    console.log(`\n💰 Financial Breakdown:`);
    console.log(`   Items Total: KES ${breakdown.itemsTotal.toFixed(2)}`);
    console.log(`   Delivery Fee: KES ${breakdown.deliveryFee.toFixed(2)}`);
    console.log(`   Tip Amount: KES ${breakdown.tipAmount.toFixed(2)}`);
    console.log(`   Expected Savings Credit: KES ${(breakdown.deliveryFee * 0.5).toFixed(2)}`);
    
    // Get cash submissions for this order
    const cashSubmissions = await db.sequelize.query(
      `SELECT cs.* FROM cash_submissions cs
       INNER JOIN cash_submission_orders cso ON cso."cashSubmissionId" = cs.id
       WHERE cso."orderId" = :orderId AND cs."submissionType" = 'order_payment'
       ORDER BY cs."createdAt" DESC`,
      {
        type: db.sequelize.QueryTypes.SELECT,
        replacements: { orderId }
      }
    );
    
    console.log(`\n📝 Cash Submissions for Order #${orderId}:`);
    if (cashSubmissions.length === 0) {
      console.log(`   ⚠️ No cash submissions found`);
    } else {
      cashSubmissions.forEach((submission, index) => {
        console.log(`\n   Submission #${index + 1} (ID: ${submission.id}):`);
        console.log(`      Amount: KES ${parseFloat(submission.amount || 0).toFixed(2)}`);
        console.log(`      Status: ${submission.status}`);
        console.log(`      Created: ${submission.createdAt}`);
      });
    }
    
    // Get savings credit transactions for this order
    const savingsTransactions = await db.Transaction.findAll({
      where: {
        orderId: orderId,
        transactionType: 'savings_credit',
        paymentProvider: 'order_payment_submission'
      },
      order: [['createdAt', 'DESC']]
    });
    
    console.log(`\n💵 Savings Credit Transactions for Order #${orderId}:`);
    if (savingsTransactions.length === 0) {
      console.log(`   ❌ NO SAVINGS CREDIT TRANSACTIONS FOUND!`);
      console.log(`   ⚠️ Expected: KES ${(breakdown.deliveryFee * 0.5).toFixed(2)}`);
    } else {
      savingsTransactions.forEach((txn, index) => {
        console.log(`\n   Transaction #${index + 1} (ID: ${txn.id}):`);
        console.log(`      Amount: KES ${parseFloat(txn.amount || 0).toFixed(2)}`);
        console.log(`      Status: ${txn.status}`);
        console.log(`      Payment Status: ${txn.paymentStatus}`);
        console.log(`      Notes: ${txn.notes || 'N/A'}`);
        console.log(`      Created: ${txn.createdAt}`);
        
        const expectedAmount = breakdown.deliveryFee * 0.5;
        const actualAmount = parseFloat(txn.amount || 0);
        if (Math.abs(actualAmount - expectedAmount) > 0.01) {
          console.log(`      ⚠️ Amount mismatch! Expected: KES ${expectedAmount.toFixed(2)}, Got: KES ${actualAmount.toFixed(2)}`);
        } else {
          console.log(`      ✅ Amount matches expected value`);
        }
      });
    }
    
    // Get driver wallet savings if driver exists
    if (order.driverId) {
      const driverWallet = await db.DriverWallet.findOne({
        where: { driverId: order.driverId }
      });
      
      if (driverWallet) {
        console.log(`\n👤 Driver Wallet (Driver ID: ${order.driverId}):`);
        console.log(`   Current Savings: KES ${parseFloat(driverWallet.savings || 0).toFixed(2)}`);
      } else {
        console.log(`\n⚠️ Driver wallet not found for driver ID ${order.driverId}`);
      }
    }
    
    console.log(`\n✨ Check complete!\n`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await db.sequelize.close();
  }
}

checkOrder413();
