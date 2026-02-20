/**
 * Test 1: Admin Mobile POS Payment Methods
 * Tests: pay on delivery, swipe on delivery, already paid
 */

const db = require('../models');

async function testPosPaymentMethods() {
  console.log('\n🧪 Test 1: Admin Mobile POS Payment Methods\n');
  
  try {
    // Test 1.1: Create order with "pay_on_delivery" payment method
    console.log('Test 1.1: Creating order with pay_on_delivery...');
    const order1 = await db.Order.create({
      customerName: 'Test Customer 1',
      customerPhone: '254712345678',
      deliveryAddress: 'Test Address 1',
      totalAmount: 1000,
      paymentType: 'pay_on_delivery',
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      status: 'pending',
      adminOrder: true
    });
    console.log(`✅ Order created with pay_on_delivery: Order #${order1.id}`);
    
    // Test 1.2: Create order with "swipe_on_delivery" payment method
    console.log('\nTest 1.2: Creating order with swipe_on_delivery...');
    const order2 = await db.Order.create({
      customerName: 'Test Customer 2',
      customerPhone: '254712345679',
      deliveryAddress: 'Test Address 2',
      totalAmount: 1500,
      paymentType: 'pay_on_delivery',
      paymentMethod: 'card',
      paymentStatus: 'pending',
      status: 'pending',
      adminOrder: true
    });
    console.log(`✅ Order created with swipe_on_delivery: Order #${order2.id}`);
    
    // Test 1.3: Create order with "already_paid" status
    console.log('\nTest 1.3: Creating order with already_paid status...');
    const order3 = await db.Order.create({
      customerName: 'Test Customer 3',
      customerPhone: '254712345680',
      deliveryAddress: 'Test Address 3',
      totalAmount: 2000,
      paymentType: 'pay_now',
      paymentMethod: 'mobile_money',
      paymentStatus: 'paid',
      status: 'confirmed',
      adminOrder: true
    });
    console.log(`✅ Order created with already_paid: Order #${order3.id}`);
    
    // Verify payment methods are stored correctly
    console.log('\nVerifying payment methods...');
    const verify1 = await db.Order.findByPk(order1.id);
    const verify2 = await db.Order.findByPk(order2.id);
    const verify3 = await db.Order.findByPk(order3.id);
    
    if (verify1.paymentType === 'pay_on_delivery' && verify1.paymentMethod === 'cash') {
      console.log('✅ pay_on_delivery with cash verified');
    } else {
      throw new Error('pay_on_delivery verification failed');
    }
    
    if (verify2.paymentType === 'pay_on_delivery' && verify2.paymentMethod === 'card') {
      console.log('✅ swipe_on_delivery (card) verified');
    } else {
      throw new Error('swipe_on_delivery verification failed');
    }
    
    if (verify3.paymentStatus === 'paid') {
      console.log('✅ already_paid status verified');
    } else {
      throw new Error('already_paid verification failed');
    }
    
    // Cleanup
    await order1.destroy();
    await order2.destroy();
    await order3.destroy();
    console.log('\n✅ Test 1 PASSED: All payment methods working correctly\n');
    
    return { success: true, message: 'Payment methods test passed' };
  } catch (error) {
    console.error('\n❌ Test 1 FAILED:', error.message);
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

// Run test if called directly
if (require.main === module) {
  testPosPaymentMethods()
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

module.exports = { testPosPaymentMethods };
