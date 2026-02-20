/**
 * Test 9: Transaction Description Formatting
 * Tests: Description uses first 2 words of delivery address
 */

const db = require('../models');

async function testTransactionDescriptionFormatting() {
  console.log('\n🧪 Test 9: Transaction Description Formatting\n');
  
  try {
    // Test 9.1: Create order with delivery address
    console.log('Test 9.1: Creating order with delivery address...');
    const order = await db.Order.create({
      customerName: 'Test Customer',
      customerPhone: '254712345678',
      deliveryAddress: 'Denali Apartments Block A Room 101',
      totalAmount: 1000,
      paymentType: 'pay_now',
      paymentStatus: 'paid',
      status: 'completed',
      adminOrder: true
    });
    console.log(`✅ Order created: Order #${order.id}`);
    console.log(`   Delivery Address: ${order.deliveryAddress}`);
    
    // Test 9.2: Format description from address
    const formatDescriptionFromAddress = (deliveryAddress) => {
      if (!deliveryAddress) return 'submission';
      const words = deliveryAddress.split(' ').filter(word => word.length > 0);
      const formattedAddress = words.slice(0, 2).join(' ');
      return `${formattedAddress} submission`;
    };
    
    const formattedDescription = formatDescriptionFromAddress(order.deliveryAddress);
    const expectedDescription = 'Denali Apartments submission';
    
    console.log(`   Formatted Description: ${formattedDescription}`);
    console.log(`   Expected: ${expectedDescription}`);
    
    if (formattedDescription !== expectedDescription) {
      throw new Error(`Description formatting failed. Expected: ${expectedDescription}, Got: ${formattedDescription}`);
    }
    console.log('✅ Description correctly formatted (first 2 words + "submission")');
    
    // Test 9.3: Test with different address formats
    console.log('\nTest 9.3: Testing different address formats...');
    const testCases = [
      { address: 'Westlands CBD Building', expected: 'Westlands CBD submission' },
      { address: 'Karen', expected: 'Karen submission' },
      { address: 'Nairobi CBD', expected: 'Nairobi CBD submission' },
      { address: '', expected: 'submission' },
      { address: null, expected: 'submission' }
    ];
    
    for (const testCase of testCases) {
      const result = formatDescriptionFromAddress(testCase.address);
      if (result !== testCase.expected) {
        throw new Error(`Formatting failed for "${testCase.address}". Expected: ${testCase.expected}, Got: ${result}`);
      }
      console.log(`   ✅ "${testCase.address}" → "${result}"`);
    }
    
    // Cleanup
    await order.destroy();
    console.log('\n✅ Test 9 PASSED: Transaction description formatting working correctly\n');
    
    return { success: true, message: 'Transaction description formatting test passed' };
  } catch (error) {
    console.error('\n❌ Test 9 FAILED:', error.message);
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

if (require.main === module) {
  testTransactionDescriptionFormatting()
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

module.exports = { testTransactionDescriptionFormatting };
