/**
 * Example: Calculate Order Cost
 * 
 * This example demonstrates how to calculate the cost of an order
 * from placement to completion.
 */

const { 
  calculateOrderCreationCost, 
  calculatePaymentCost, 
  calculateStatusUpdateCost,
  calculateFullOrderCost 
} = require('../services/orderCostCalculator');

// Example 1: Calculate cost for order creation
console.log('=== Example 1: Order Creation Cost ===\n');

const orderData = {
  id: 123,
  items: [
    { drinkId: 1, quantity: 2 },
    { drinkId: 2, quantity: 1 }
  ],
  driverId: 5,
  paymentType: 'pay_now',
  paymentMethod: 'mobile_money',
  smsNotificationsSent: 2 // 2 SMS notifications sent
};

const creationCost = calculateOrderCreationCost(orderData);
console.log('Creation Cost Summary:');
console.log(`Total Cost: ${creationCost.totalCost.formatted}`);
console.log(`Duration: ${creationCost.duration.seconds} seconds`);
console.log(`Database Operations: ${creationCost.costs.database.reads} reads, ${creationCost.costs.database.writes} writes, ${creationCost.costs.database.transactions} transactions`);
console.log(`SMS Sent: ${creationCost.costs.externalAPIs.sms}`);
console.log(`Push Notifications: ${creationCost.costs.externalAPIs.pushNotifications}`);
console.log(`Socket Messages: ${creationCost.costs.socket.messages}`);
console.log('\n');

// Example 2: Calculate cost for payment processing
console.log('=== Example 2: Payment Processing Cost ===\n');

const paymentCost = calculatePaymentCost(123, 'mobile_money');
console.log('Payment Cost Summary:');
console.log(`Total Cost: ${paymentCost.totalCost.formatted}`);
console.log(`M-Pesa STK Push: ${paymentCost.costs.externalAPIs.mpesaStkPush}`);
console.log(`M-Pesa Callbacks: ${paymentCost.costs.externalAPIs.mpesaCallbacks}`);
console.log(`Database Operations: ${paymentCost.costs.database.reads} reads, ${paymentCost.costs.database.writes} writes`);
console.log('\n');

// Example 3: Calculate cost for status updates
console.log('=== Example 3: Status Update Cost ===\n');

const statusUpdates = ['confirmed', 'preparing', 'out_for_delivery', 'delivered', 'completed'];
const statusUpdateCost = calculateStatusUpdateCost(123, statusUpdates);
console.log('Status Update Cost Summary:');
console.log(`Total Cost: ${statusUpdateCost.totalCost.formatted}`);
console.log(`Status Updates: ${statusUpdates.join(' → ')}`);
console.log(`Database Operations: ${statusUpdateCost.costs.database.reads} reads, ${statusUpdateCost.costs.database.writes} writes`);
console.log(`Socket Messages: ${statusUpdateCost.costs.socket.messages}`);
console.log('\n');

// Example 4: Calculate full order lifecycle cost
console.log('=== Example 4: Full Order Lifecycle Cost ===\n');

const fullOrderCost = calculateFullOrderCost(orderData);
console.log('Full Order Cost Summary:');
console.log(`Total Cost: ${fullOrderCost.total.formatted}`);
console.log(`\nBreakdown:`);
console.log(`  Creation: $${fullOrderCost.breakdown.creation.costs.total.toFixed(6)}`);
console.log(`  Payment: $${fullOrderCost.breakdown.payment.costs.total.toFixed(6)}`);
console.log(`  Status Updates: $${fullOrderCost.breakdown.statusUpdates.costs.total.toFixed(6)}`);
console.log(`\nSummary:`);
console.log(`  Total Database Operations: ${fullOrderCost.summary.databaseOperations}`);
console.log(`  Total External API Calls: ${fullOrderCost.summary.externalAPICalls}`);
console.log(`  Total Socket Messages: ${fullOrderCost.summary.socketMessages}`);
console.log('\n');

// Example 5: Compare different order types
console.log('=== Example 5: Cost Comparison ===\n');

const payNowOrder = {
  id: 124,
  items: [{ drinkId: 1, quantity: 1 }],
  driverId: 5,
  paymentType: 'pay_now',
  paymentMethod: 'mobile_money',
  smsNotificationsSent: 2
};

const payOnDeliveryOrder = {
  id: 125,
  items: [{ drinkId: 1, quantity: 1 }],
  driverId: 5,
  paymentType: 'pay_on_delivery',
  paymentMethod: null,
  smsNotificationsSent: 2
};

const payNowCost = calculateFullOrderCost(payNowOrder);
const payOnDeliveryCost = calculateFullOrderCost(payOnDeliveryOrder);

console.log('Pay Now Order Cost:', payNowCost.total.formatted);
console.log('Pay on Delivery Order Cost:', payOnDeliveryCost.total.formatted);
console.log(`Difference: $${(payNowCost.total.usd - payOnDeliveryCost.total.usd).toFixed(6)}`);
console.log('\n');

// Example 6: Cost breakdown by component
console.log('=== Example 6: Cost Breakdown by Component ===\n');

const breakdown = creationCost.costs.breakdown;
console.log('Cost Breakdown (% of total):');
console.log(`  Database: ${breakdown.database.percentage}% ($${breakdown.database.cost.toFixed(6)})`);
console.log(`  External APIs: ${breakdown.externalAPIs.percentage}% ($${breakdown.externalAPIs.cost.toFixed(6)})`);
console.log(`  Compute: ${breakdown.compute.percentage}% ($${breakdown.compute.cost.toFixed(6)})`);
console.log(`  Network: ${breakdown.network.percentage}% ($${breakdown.network.cost.toFixed(6)})`);
console.log(`  Storage: ${breakdown.storage.percentage}% ($${breakdown.storage.cost.toFixed(6)})`);
console.log(`  Socket: ${breakdown.socket.percentage}% ($${breakdown.socket.cost.toFixed(6)})`);

