/**
 * Test 5: Walk-in Order Creation
 * Tests: Customer prompt, territory set to "1 Default", delivery fee hidden, payment methods
 */

const db = require('../models');

async function testWalkinOrder() {
  console.log('\n🧪 Test 5: Walk-in Order Creation\n');
  
  try {
    // Test 5.1: Create walk-in order with Cash payment
    console.log('Test 5.1: Creating walk-in order with Cash payment...');
    const walkInOrder1 = await db.Order.create({
      customerName: 'Walk-in Customer 1',
      customerPhone: '254712345678',
      deliveryAddress: '1 Default',
      totalAmount: 1000,
      paymentType: 'pay_on_delivery',
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      status: 'completed',
      adminOrder: true,
      deliveryFee: null, // Should be null for walk-in
      territoryId: 1 // Should be "1 Default"
    });
    console.log(`✅ Walk-in order created: Order #${walkInOrder1.id}`);
    console.log(`   Delivery Address: ${walkInOrder1.deliveryAddress}`);
    console.log(`   Territory ID: ${walkInOrder1.territoryId}`);
    console.log(`   Delivery Fee: ${walkInOrder1.deliveryFee}`);
    console.log(`   Payment Method: ${walkInOrder1.paymentMethod}`);
    
    if (walkInOrder1.deliveryAddress !== '1 Default') {
      throw new Error('Walk-in order should have delivery address "1 Default"');
    }
    if (walkInOrder1.territoryId !== 1) {
      throw new Error('Walk-in order should have territoryId = 1');
    }
    // Note: deliveryFee might not be a field in Order model, so we check if it's null or undefined
    if (walkInOrder1.deliveryFee !== null && walkInOrder1.deliveryFee !== undefined) {
      throw new Error('Walk-in order should have null/undefined delivery fee');
    }
    if (walkInOrder1.paymentMethod !== 'cash') {
      throw new Error('Walk-in order payment method should be cash');
    }
    console.log('✅ Walk-in order with Cash payment verified');
    
    // Test 5.2: Create walk-in order with Mpesa (prompt) payment
    console.log('\nTest 5.2: Creating walk-in order with Mpesa (prompt) payment...');
    const walkInOrder2 = await db.Order.create({
      customerName: 'Walk-in Customer 2',
      customerPhone: '254712345679',
      deliveryAddress: '1 Default',
      totalAmount: 1500,
      paymentType: 'pay_on_delivery',
      paymentMethod: 'mobile_money',
      paymentStatus: 'pending',
      status: 'confirmed',
      adminOrder: true,
      deliveryFee: null,
      territoryId: 1
    });
    console.log(`✅ Walk-in order created: Order #${walkInOrder2.id}`);
    console.log(`   Payment Method: ${walkInOrder2.paymentMethod}`);
    console.log(`   Payment Status: ${walkInOrder2.paymentStatus}`);
    
    if (walkInOrder2.paymentMethod !== 'mobile_money') {
      throw new Error('Walk-in order payment method should be mobile_money for Mpesa prompt');
    }
    console.log('✅ Walk-in order with Mpesa (prompt) payment verified');
    
    // Cleanup
    await walkInOrder1.destroy();
    await walkInOrder2.destroy();
    console.log('\n✅ Test 5 PASSED: Walk-in order creation working correctly\n');
    
    return { success: true, message: 'Walk-in order test passed' };
  } catch (error) {
    console.error('\n❌ Test 5 FAILED:', error.message);
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

if (require.main === module) {
  testWalkinOrder()
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

module.exports = { testWalkinOrder };
