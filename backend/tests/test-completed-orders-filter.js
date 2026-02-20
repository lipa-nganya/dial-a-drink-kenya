/**
 * Test 3: Completed Orders Filter (Last 30 Days)
 * Tests: Filtering completed orders to show only last 30 days
 */

const db = require('../models');
const { Op } = require('sequelize');

async function testCompletedOrdersFilter() {
  console.log('\n🧪 Test 3: Completed Orders Filter (Last 30 Days)\n');
  
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyOneDaysAgo = new Date(now);
    thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
    
    // Test 3.1: Create order within last 30 days
    console.log('Test 3.1: Creating order within last 30 days...');
    const recentOrder = await db.Order.create({
      customerName: 'Recent Customer',
      customerPhone: '254712345678',
      deliveryAddress: 'Test Address',
      totalAmount: 1000,
      paymentType: 'pay_now',
      paymentStatus: 'paid',
      status: 'completed',
      adminOrder: true,
      createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
    });
    console.log(`✅ Recent order created: Order #${recentOrder.id}`);
    
    // Test 3.2: Create order older than 30 days
    console.log('\nTest 3.2: Creating order older than 30 days...');
    const oldOrder = await db.Order.create({
      customerName: 'Old Customer',
      customerPhone: '254712345679',
      deliveryAddress: 'Test Address',
      totalAmount: 1500,
      paymentType: 'pay_now',
      paymentStatus: 'paid',
      status: 'completed',
      adminOrder: true,
      createdAt: thirtyOneDaysAgo
    });
    console.log(`✅ Old order created: Order #${oldOrder.id}`);
    
    // Test 3.3: Query completed orders with 30-day filter
    console.log('\nTest 3.3: Querying completed orders (last 30 days)...');
    const filteredOrders = await db.Order.findAll({
      where: {
        status: 'completed',
        adminOrder: true,
        createdAt: {
          [Op.gte]: thirtyDaysAgo
        }
      },
      order: [['createdAt', 'DESC']]
    });
    
    console.log(`✅ Found ${filteredOrders.length} completed order(s) in last 30 days`);
    
    // Verify filtering
    const recentOrderIncluded = filteredOrders.some(o => o.id === recentOrder.id);
    const oldOrderExcluded = !filteredOrders.some(o => o.id === oldOrder.id);
    
    if (!recentOrderIncluded) {
      throw new Error('Recent order should be included in filtered results');
    }
    if (!oldOrderExcluded) {
      throw new Error('Old order should be excluded from filtered results');
    }
    
    console.log('✅ Filter correctly includes recent orders and excludes old orders');
    
    // Cleanup
    await recentOrder.destroy();
    await oldOrder.destroy();
    console.log('\n✅ Test 3 PASSED: Completed orders filter working correctly\n');
    
    return { success: true, message: 'Completed orders filter test passed' };
  } catch (error) {
    console.error('\n❌ Test 3 FAILED:', error.message);
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

if (require.main === module) {
  testCompletedOrdersFilter()
    .then(result => {
      if (result.success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { testCompletedOrdersFilter };
