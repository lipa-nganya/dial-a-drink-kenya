const db = require('../models');
const { Op } = require('sequelize');

/**
 * Check for drivers with no activity in the last 6 hours and set them to offline
 * This function should be called periodically (e.g., every hour)
 */
async function checkInactiveDrivers() {
  try {
    console.log('🕐 Checking for inactive drivers (no activity in 6 hours)...');
    
    // Calculate the threshold time (6 hours ago)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    
    // Find drivers who:
    // 1. Have lastActivity older than 6 hours (or null)
    // 2. Are currently active or on_delivery (not already offline/inactive)
    const inactiveDrivers = await db.Driver.findAll({
      where: {
        status: {
          [Op.in]: ['active', 'on_delivery']
        },
        [Op.or]: [
          { lastActivity: null },
          { lastActivity: { [Op.lt]: sixHoursAgo } }
        ]
      }
    });
    
    if (inactiveDrivers.length === 0) {
      console.log('✅ No inactive drivers found');
      return { updated: 0, drivers: [] };
    }
    
    console.log(`📋 Found ${inactiveDrivers.length} inactive driver(s):`);
    inactiveDrivers.forEach(driver => {
      const lastActivityStr = driver.lastActivity 
        ? new Date(driver.lastActivity).toISOString()
        : 'never';
      console.log(`   - Driver ${driver.id} (${driver.name}): Last activity ${lastActivityStr}, Current status: ${driver.status}`);
    });
    
    // Update all inactive drivers to offline
    const driverIds = inactiveDrivers.map(d => d.id);
    const [updatedCount] = await db.Driver.update(
      { 
        status: 'offline'
      },
      {
        where: {
          id: {
            [Op.in]: driverIds
          }
        }
      }
    );
    
    console.log(`✅ Updated ${updatedCount} driver(s) to offline status`);
    
    // Emit Socket.IO events for admin to see the status changes
    // Note: This requires the app instance, which we'll pass from server.js
    
    return {
      updated: updatedCount,
      drivers: inactiveDrivers.map(d => ({
        id: d.id,
        name: d.name,
        oldStatus: d.status,
        lastActivity: d.lastActivity
      }))
    };
  } catch (error) {
    console.error('❌ Error checking inactive drivers:', error);
    throw error;
  }
}

module.exports = {
  checkInactiveDrivers
};
