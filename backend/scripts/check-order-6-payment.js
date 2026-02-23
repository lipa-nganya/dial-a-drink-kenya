/**
 * Script to check Order #6 payment rejection details
 * Run: node backend/scripts/check-order-6-payment.js
 */

const db = require('../models');

async function checkOrder6Payment() {
  try {
    console.log('🔍 Checking Order #6 Payment Details...\n');
    
    // Find order #6
    const order = await db.Order.findByPk(6, {
      include: [
        {
          model: db.Transaction,
          as: 'transactions',
          where: {
            transactionType: 'payment'
          },
          required: false
        }
      ]
    });

    if (!order) {
      console.log('❌ Order #6 not found');
      process.exit(1);
    }

    console.log('📦 Order Details:');
    console.log(`   ID: ${order.id}`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Payment Status: ${order.paymentStatus}`);
    console.log(`   Payment Type: ${order.paymentType}`);
    console.log(`   Payment Method: ${order.paymentMethod || 'N/A'}`);
    console.log(`   Total Amount: KES ${order.totalAmount}`);
    console.log(`   Customer: ${order.customerName} (${order.customerPhone})`);
    console.log(`   Notes: ${order.notes || 'None'}`);
    console.log('');

    // Find all payment transactions for this order
    const paymentTransactions = await db.Transaction.findAll({
      where: {
        orderId: 6,
        transactionType: 'payment'
      },
      order: [['createdAt', 'DESC']]
    });

    console.log(`💳 Payment Transactions (${paymentTransactions.length}):`);
    paymentTransactions.forEach((tx, index) => {
      console.log(`\n   Transaction #${index + 1}:`);
      console.log(`   ID: ${tx.id}`);
      console.log(`   Status: ${tx.status}`);
      console.log(`   Payment Status: ${tx.paymentStatus}`);
      console.log(`   Amount: KES ${tx.amount}`);
      console.log(`   CheckoutRequestID: ${tx.checkoutRequestID || 'N/A'}`);
      console.log(`   Receipt Number: ${tx.receiptNumber || 'N/A'}`);
      console.log(`   Created: ${tx.createdAt}`);
      console.log(`   Updated: ${tx.updatedAt}`);
      console.log(`   Notes: ${tx.notes || 'None'}`);
      
      // Check notes for ResultCode information
      if (tx.notes) {
        const resultCodeMatch = tx.notes.match(/ResultCode[:\s]+(\d+)/i);
        const resultDescMatch = tx.notes.match(/ResultDesc[:\s]+([^\n]+)/i);
        if (resultCodeMatch) {
          console.log(`   ⚠️  ResultCode found in notes: ${resultCodeMatch[1]}`);
        }
        if (resultDescMatch) {
          console.log(`   ⚠️  ResultDesc found in notes: ${resultDescMatch[1].trim()}`);
        }
      }
    });

    // Check for any failed transactions
    const failedTransactions = paymentTransactions.filter(tx => 
      tx.status === 'failed' || tx.paymentStatus === 'unpaid' || tx.paymentStatus === 'failed'
    );

    if (failedTransactions.length > 0) {
      console.log('\n❌ Failed Payment Transactions:');
      failedTransactions.forEach(tx => {
        console.log(`\n   Transaction #${tx.id}:`);
        console.log(`   Status: ${tx.status}`);
        console.log(`   Payment Status: ${tx.paymentStatus}`);
        console.log(`   Notes: ${tx.notes || 'None'}`);
        
        // Parse notes for rejection reason
        if (tx.notes) {
          const rejectionMatch = tx.notes.match(/Payment (?:Failed|Rejected)[:\s]+(.+?)(?:\n|$)/i);
          if (rejectionMatch) {
            console.log(`   🔴 Rejection Reason: ${rejectionMatch[1].trim()}`);
          }
        }
      });
    }

    // Check order notes for payment failure information
    if (order.notes && order.notes.includes('Payment Failed') || order.notes.includes('Payment Rejected')) {
      console.log('\n📝 Order Notes contain payment failure information:');
      const notesLines = order.notes.split('\n');
      notesLines.forEach(line => {
        if (line.includes('Payment Failed') || line.includes('Payment Rejected') || line.includes('ResultCode')) {
          console.log(`   ${line}`);
        }
      });
    }

    // Common M-Pesa ResultCodes and their meanings
    console.log('\n📚 Common M-Pesa ResultCodes:');
    console.log('   0 = Success');
    console.log('   1 = Insufficient balance');
    console.log('   1032 = Request timeout (customer did not complete payment)');
    console.log('   1037 = Request cancelled by customer');
    console.log('   2001 = Wrong PIN');
    console.log('   2006 = Wrong PIN (alternative code)');
    console.log('');

    await db.sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await db.sequelize.close();
    process.exit(1);
  }
}

checkOrder6Payment();
