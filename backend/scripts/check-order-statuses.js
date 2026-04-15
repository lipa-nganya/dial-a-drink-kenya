// Check what order statuses exist in production
const db = require('../models');

async function checkOrderStatuses() {
  try {
    console.log('📊 Checking order statuses in database...\n');

    // Get count by status
    const [statusCounts] = await db.sequelize.query(`
      SELECT 
        status, 
        COUNT(*) as count,
        MIN(created_at) as oldest,
        MAX(created_at) as newest
      FROM orders
      GROUP BY status
      ORDER BY count DESC
    `);

    console.log('Order Status Distribution:');
    console.log('─'.repeat(80));
    statusCounts.forEach(row => {
      console.log(`${row.status.padEnd(20)} ${String(row.count).padStart(6)} orders   (oldest: ${new Date(row.oldest).toLocaleDateString()}, newest: ${new Date(row.newest).toLocaleDateString()})`);
    });
    console.log('─'.repeat(80));

    const total = statusCounts.reduce((sum, row) => sum + parseInt(row.count), 0);
    console.log(`Total: ${total} orders\n`);

    // Check orders from last 24 hours
    const [recentOrders] = await db.sequelize.query(`
      SELECT status, COUNT(*) as count
      FROM orders
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY status
      ORDER BY count DESC
    `);

    console.log('Orders in Last 24 Hours:');
    console.log('─'.repeat(50));
    recentOrders.forEach(row => {
      console.log(`${row.status.padEnd(20)} ${row.count} orders`);
    });

    if (recentOrders.length === 0) {
      console.log('(No orders in last 24 hours)');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkOrderStatuses();
