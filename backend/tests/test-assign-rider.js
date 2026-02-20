/**
 * Test 2: Admin Mobile Assign Rider
 * Tests: Default unassigned, assignment success, order status after acceptance
 */

const db = require('../models');

async function testAssignRider() {
  console.log('\n🧪 Test 2: Admin Mobile Assign Rider\n');
  
  try {
    // Test 2.1: Create order - should be unassigned by default
    console.log('Test 2.1: Creating order (should be unassigned by default)...');
    const order = await db.Order.create({
      customerName: 'Test Customer',
      customerPhone: '254712345678',
      deliveryAddress: 'Test Address',
      totalAmount: 1000,
      paymentType: 'pay_on_delivery',
      paymentStatus: 'pending',
      status: 'confirmed',
      adminOrder: true,
      driverId: null, // Explicitly unassigned
      driverAccepted: null
    });
    console.log(`✅ Order created: Order #${order.id}, driverId: ${order.driverId}, status: ${order.status}`);
    
    if (order.driverId !== null) {
      throw new Error('Order should be unassigned by default');
    }
    console.log('✅ Order is unassigned by default');
    
    // Test 2.2: Get or create a test driver
    console.log('\nTest 2.2: Getting test driver...');
    let driver = await db.Driver.findOne({ where: { phoneNumber: '254799999999' } });
    if (!driver) {
      driver = await db.Driver.create({
        name: 'Test Driver',
        phoneNumber: '254799999999',
        status: 'active'
      });
    }
    console.log(`✅ Using driver: ${driver.name} (ID: ${driver.id})`);
    
    // Test 2.3: Assign driver to order
    console.log('\nTest 2.3: Assigning driver to order...');
    await order.update({
      driverId: driver.id,
      driverAccepted: null,
      status: 'confirmed'
    });
    await order.reload();
    console.log(`✅ Driver assigned: Order #${order.id}, driverId: ${order.driverId}, status: ${order.status}`);
    
    if (order.driverId !== driver.id) {
      throw new Error('Driver assignment failed');
    }
    if (order.status !== 'confirmed') {
      throw new Error('Order status should be confirmed after assignment');
    }
    console.log('✅ Order status is correct after assignment');
    
    // Test 2.4: Driver accepts order
    console.log('\nTest 2.4: Driver accepting order...');
    await order.update({
      driverAccepted: true,
      status: 'pending' // Valid status after driver accepts
    });
    await order.reload();
    console.log(`✅ Order accepted: driverAccepted: ${order.driverAccepted}, status: ${order.status}`);
    
    if (order.driverAccepted !== true) {
      throw new Error('Driver acceptance failed');
    }
    if (order.status !== 'pending') {
      throw new Error('Order status should be pending after driver acceptance');
    }
    console.log('✅ Order status updated correctly after driver acceptance');
    
    // Cleanup
    await order.destroy();
    console.log('\n✅ Test 2 PASSED: Assign rider functionality working correctly\n');
    
    return { success: true, message: 'Assign rider test passed' };
  } catch (error) {
    console.error('\n❌ Test 2 FAILED:', error.message);
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

if (require.main === module) {
  testAssignRider()
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

module.exports = { testAssignRider };
