const db = require('../models');
const { Op } = require('sequelize');
const { getOrCreateHoldDriver } = require('./holdDriver');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

/**
 * Find the nearest active driver to a branch
 * @param {number} branchId - Branch ID
 * @returns {Promise<Object|null>} - Nearest active driver object or HOLD driver if no drivers found
 */
const findNearestActiveDriverToBranch = async (branchId) => {
  try {
    console.log(`🔍 [DriverAssignment] Finding driver for branch ID: ${branchId}`);
    
    // Get the branch
    const branch = await db.Branch.findByPk(branchId);
    if (!branch) {
      console.log('⚠️  [DriverAssignment] Branch not found. Cannot assign driver.');
      return null;
    }
    console.log(`📍 [DriverAssignment] Branch found: ${branch.name} at ${branch.address}`);

    // Get all available drivers (exclude only 'offline' and 'inactive')
    // Drivers with 'active' or 'on_delivery' status can accept new orders
    const availableDrivers = await db.Driver.findAll({
      where: {
        status: {
          [Op.notIn]: ['offline', 'inactive']
        }
      }
    });

    console.log(`👥 [DriverAssignment] Found ${availableDrivers.length} available driver(s):`, 
      availableDrivers.map(d => `${d.name} (ID: ${d.id}, status: ${d.status})`).join(', '));

    if (!availableDrivers || availableDrivers.length === 0) {
      console.log('⚠️  [DriverAssignment] No available drivers found. Defaulting to HOLD driver.');
      const holdDriver = await getOrCreateHoldDriver();
      return holdDriver;
    }
    
    // Prefer active drivers over on_delivery drivers
    const activeDrivers = availableDrivers.filter(d => d.status === 'active');
    const driversToUse = activeDrivers.length > 0 ? activeDrivers : availableDrivers;

    // If only one available driver, assign to them
    if (driversToUse.length === 1) {
      console.log(`✅ [DriverAssignment] Only one available driver found: ${driversToUse[0].name}. Assigning automatically.`);
      return driversToUse[0];
    }

    // If no Google Maps API key, return first available driver as fallback
    if (!GOOGLE_MAPS_API_KEY) {
      console.log('⚠️  [DriverAssignment] Google Maps API key not configured. Assigning first available driver as fallback.');
      return driversToUse[0];
    }

    // For now, since drivers don't have location fields, we'll use a simple approach:
    // Prefer active drivers, but assign to on_delivery drivers if no active drivers available
    // TODO: If drivers get location tracking, use Distance Matrix API to find nearest driver
    console.log(`✅ [DriverAssignment] Assigning to first available driver: ${driversToUse[0].name} (ID: ${driversToUse[0].id}, status: ${driversToUse[0].status})`);
    return driversToUse[0];

    // Future implementation with driver location:
    // const driverAddresses = activeDrivers.map(driver => driver.address).filter(Boolean);
    // if (driverAddresses.length === 0) {
    //   return activeDrivers[0]; // Fallback if no addresses
    // }
    // 
    // const origins = branch.address;
    // const destinations = driverAddresses.join('|');
    // 
    // const mapsClient = new Client({});
    // const response = await mapsClient.distancematrix({
    //   params: {
    //     origins: [origins],
    //     destinations: driverAddresses,
    //     key: GOOGLE_MAPS_API_KEY,
    //     units: 'metric'
    //   }
    // });
    // 
    // // Find driver with shortest distance
    // let nearestDriver = null;
    // let shortestDistance = Infinity;
    // 
    // response.data.rows[0].elements.forEach((element, index) => {
    //   if (element.status === 'OK' && element.distance) {
    //     const distance = element.distance.value; // meters
    //     if (distance < shortestDistance) {
    //       shortestDistance = distance;
    //       nearestDriver = activeDrivers[index];
    //     }
    //   }
    // });
    // 
    // return nearestDriver || activeDrivers[0]; // Fallback to first driver

  } catch (error) {
    console.error('❌ Error finding nearest active driver:', error.message);
    // Fallback: try to get HOLD driver
    try {
      const holdDriver = await getOrCreateHoldDriver();
      console.log('✅ [DriverAssignment] Fallback: Using HOLD driver');
      return holdDriver;
    } catch (holdError) {
      console.error('❌ Error getting HOLD driver:', holdError.message);
      return null;
    }
  }
};

/**
 * Find the nearest active driver to a branch address (for when branch is not yet saved)
 * @param {string} branchAddress - Branch address
 * @returns {Promise<Object|null>} - Nearest active driver object or HOLD driver if no drivers found
 */
const findNearestActiveDriverToAddress = async (branchAddress) => {
  try {
    // Get all available drivers (exclude only 'offline' and 'inactive')
    const availableDrivers = await db.Driver.findAll({
      where: {
        status: {
          [Op.notIn]: ['offline', 'inactive']
        }
      }
    });

    if (!availableDrivers || availableDrivers.length === 0) {
      console.log('⚠️  No available drivers found. Defaulting to HOLD driver.');
      const holdDriver = await getOrCreateHoldDriver();
      return holdDriver;
    }

    // Prefer active drivers over on_delivery drivers
    const activeDrivers = availableDrivers.filter(d => d.status === 'active');
    const driversToUse = activeDrivers.length > 0 ? activeDrivers : availableDrivers;

    // For now, return first available driver
    // TODO: Implement location-based assignment when drivers have location tracking
    return driversToUse[0];

  } catch (error) {
    console.error('❌ Error finding nearest active driver to address:', error.message);
    // Fallback: try to get HOLD driver
    try {
      const holdDriver = await getOrCreateHoldDriver();
      console.log('✅ [DriverAssignment] Fallback: Using HOLD driver');
      return holdDriver;
    } catch (holdError) {
      console.error('❌ Error getting HOLD driver:', holdError.message);
      return null;
    }
  }
};

/**
 * Check if a driver has any active orders (not completed or cancelled)
 * @param {number} driverId - Driver ID
 * @returns {Promise<boolean>} - True if driver has active orders, false otherwise
 */
const driverHasActiveOrders = async (driverId) => {
  try {
    const activeOrdersCount = await db.Order.count({
      where: {
        driverId: driverId,
        status: {
          [Op.notIn]: ['completed', 'cancelled']
        }
      }
    });
    
    return activeOrdersCount > 0;
  } catch (error) {
    console.error(`❌ Error checking active orders for driver ${driverId}:`, error.message);
    // On error, assume driver has active orders to be safe (don't change status)
    return true;
  }
};

/**
 * Update driver status to 'active' if they have no more active orders
 * This should be called when an order is completed or cancelled
 * @param {number} driverId - Driver ID
 * @returns {Promise<void>}
 */
const updateDriverStatusIfNoActiveOrders = async (driverId) => {
  try {
    if (!driverId) {
      return; // No driver assigned, skip
    }

    const driver = await db.Driver.findByPk(driverId);
    if (!driver) {
      console.log(`⚠️  Driver ${driverId} not found, skipping status update`);
      return;
    }

    // Skip HOLD driver (ID: 5) - don't change its status
    if (driverId === 5) {
      return;
    }

    const hasActiveOrders = await driverHasActiveOrders(driverId);
    
    if (!hasActiveOrders) {
      // Driver has no more active orders, set status to 'active'
      await driver.update({ 
        status: 'active',
        lastActivity: new Date()
      });
      console.log(`✅ Driver ${driverId} (${driver.name}) status set to 'active' (no more active orders)`);
    } else {
      // Driver still has active orders, just update last activity
      await driver.update({ 
        lastActivity: new Date()
      });
      console.log(`ℹ️  Driver ${driverId} (${driver.name}) still has active orders, status remains '${driver.status}'`);
    }
  } catch (error) {
    console.error(`❌ Error updating driver status for driver ${driverId}:`, error.message);
    // Don't throw - this is a non-critical operation
  }
};

module.exports = {
  findNearestActiveDriverToBranch,
  findNearestActiveDriverToAddress,
  driverHasActiveOrders,
  updateDriverStatusIfNoActiveOrders
};

