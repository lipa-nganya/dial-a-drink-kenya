/**
 * Test 6: Cancelled Order Stock Restoration
 * Tests: Items put back in stock when cancelled order is accepted
 */

const db = require('../models');
const { increaseInventoryForOrder } = require('../utils/inventory');

async function testCancelledOrderStock() {
  console.log('\n🧪 Test 6: Cancelled Order Stock Restoration\n');
  
  try {
    // Test 6.1: Create a drink with known stock
    console.log('Test 6.1: Creating test drink...');
    // Get a valid category
    let category = await db.Category.findOne();
    if (!category) {
      throw new Error('No categories found in database. Please seed categories first.');
    }
    
    let drink = await db.Drink.findOne({ where: { name: 'Test Drink for Stock' } });
    if (!drink) {
      drink = await db.Drink.create({
        name: 'Test Drink for Stock',
        price: 500,
        stock: 10,
        isAvailable: true,
        categoryId: category.id
      });
    } else {
      await drink.update({ stock: 10, isAvailable: true });
    }
    const initialStock = parseInt(drink.stock);
    console.log(`✅ Test drink created: ${drink.name}, Stock: ${initialStock}`);
    
    // Test 6.2: Create order with this drink
    console.log('\nTest 6.2: Creating order with test drink...');
    const order = await db.Order.create({
      customerName: 'Test Customer',
      customerPhone: '254712345678',
      deliveryAddress: 'Test Address',
      totalAmount: 500,
      paymentType: 'pay_now',
      paymentStatus: 'paid',
      status: 'cancelled',
      adminOrder: true
    });
    
    await db.OrderItem.create({
      orderId: order.id,
      drinkId: drink.id,
      quantity: 2,
      price: 500
    });
    
    // Reduce stock (simulating order creation)
    await drink.update({ stock: initialStock - 2 });
    await drink.reload();
    console.log(`✅ Order created: Order #${order.id}, Stock after order: ${drink.stock}`);
    
    if (parseInt(drink.stock) !== initialStock - 2) {
      throw new Error('Stock reduction failed');
    }
    
    // Test 6.3: Restore stock when cancelled order is accepted
    console.log('\nTest 6.3: Restoring stock for cancelled order...');
    await increaseInventoryForOrder(order.id);
    await drink.reload();
    console.log(`✅ Stock restored: ${drink.stock}`);
    
    if (parseInt(drink.stock) !== initialStock) {
      throw new Error(`Stock restoration failed. Expected: ${initialStock}, Got: ${drink.stock}`);
    }
    console.log('✅ Stock correctly restored to initial value');
    
    // Cleanup
    await db.OrderItem.destroy({ where: { orderId: order.id } });
    await order.destroy();
    await drink.destroy();
    console.log('\n✅ Test 6 PASSED: Cancelled order stock restoration working correctly\n');
    
    return { success: true, message: 'Cancelled order stock restoration test passed' };
  } catch (error) {
    console.error('\n❌ Test 6 FAILED:', error.message);
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

if (require.main === module) {
  testCancelledOrderStock()
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

module.exports = { testCancelledOrderStock };
