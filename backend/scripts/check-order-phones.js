const db = require('../models');

async function checkOrderPhones() {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connected');

    // Get orders that should be found (the 9 orders currently showing)
    // First, let's check orders 293 and 304 specifically
    const missingOrders = await db.Order.findAll({
      where: {
        id: [293, 304]
      },
      attributes: ['id', 'customerPhone', 'customerEmail', 'customerName', 'deliveryAddress', 'createdAt']
    });

    console.log('\n📋 Missing Orders (293, 304):');
    missingOrders.forEach(order => {
      console.log(`  Order ${order.id}:`);
      console.log(`    Phone: "${order.customerPhone}"`);
      console.log(`    Email: "${order.customerEmail || 'N/A'}"`);
      console.log(`    Name: "${order.customerName || 'N/A'}"`);
      console.log(`    Address: "${order.deliveryAddress || 'N/A'}"`);
      console.log(`    Created: ${order.createdAt}`);
      console.log('');
    });

    // Get a sample of recent orders to see what phone format they use
    const recentOrders = await db.Order.findAll({
      where: {
        customerPhone: {
          [db.Sequelize.Op.like]: '%727893741%'
        }
      },
      attributes: ['id', 'customerPhone', 'customerEmail', 'customerName', 'deliveryAddress', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 20
    });

    console.log(`\n📋 Orders with phone containing 727893741 (found ${recentOrders.length} orders):`);
    recentOrders.forEach(order => {
      console.log(`  Order ${order.id}: "${order.customerPhone}"`);
    });

    // Check what phone number the customer is using
    const customerPhone = '0727893741';
    const cleanedPhone = customerPhone.replace(/\D/g, '');
    const normalizedPhone = cleanedPhone.startsWith('254') && cleanedPhone.length === 12
      ? cleanedPhone
      : cleanedPhone.startsWith('0') && cleanedPhone.length === 10
      ? `254${cleanedPhone.slice(1)}`
      : cleanedPhone.length === 9 && cleanedPhone.startsWith('7')
      ? `254${cleanedPhone}`
      : cleanedPhone;

    console.log(`\n🔍 Customer phone being searched: ${customerPhone}`);
    console.log(`   Cleaned: ${cleanedPhone}`);
    console.log(`   Normalized: ${normalizedPhone}`);

    // Check if orders 293 and 304 match any of the search variants
    const variants = [
      cleanedPhone,
      normalizedPhone,
      cleanedPhone.startsWith('254') ? '0' + cleanedPhone.slice(3) : null,
      cleanedPhone.startsWith('254') ? cleanedPhone.slice(3) : null,
      cleanedPhone.startsWith('0') && cleanedPhone.length === 10 ? `254${cleanedPhone.slice(1)}` : null,
      cleanedPhone.startsWith('0') && cleanedPhone.length === 10 ? cleanedPhone.slice(1) : null,
      cleanedPhone.length === 9 && cleanedPhone.startsWith('7') ? `0${cleanedPhone}` : null,
      cleanedPhone.length === 9 && cleanedPhone.startsWith('7') ? `254${cleanedPhone}` : null,
      cleanedPhone.slice(-9) // Last 9 digits
    ].filter(Boolean);

    console.log(`\n🔍 Search variants:`, variants);

    missingOrders.forEach(order => {
      const orderPhone = order.customerPhone ? order.customerPhone.replace(/\D/g, '') : '';
      console.log(`\n  Order ${order.id} phone: "${order.customerPhone}" (cleaned: "${orderPhone}")`);
      
      const matches = variants.some(variant => {
        const orderPhoneClean = order.customerPhone ? order.customerPhone.replace(/\D/g, '') : '';
        return orderPhoneClean.includes(variant) || variant.includes(orderPhoneClean);
      });
      
      console.log(`    Matches any variant: ${matches ? '✅ YES' : '❌ NO'}`);
      
      if (!matches) {
        console.log(`    ⚠️  Phone format mismatch!`);
        console.log(`    Order phone cleaned: "${orderPhone}"`);
        console.log(`    Variants tried: ${variants.join(', ')}`);
      }
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkOrderPhones();
