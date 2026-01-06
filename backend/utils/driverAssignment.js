const db = require('../models');
const { Op } = require('sequelize');
const { getOrCreateHoldDriver } = require('./holdDriver');
const { filterDriversByCreditLimit } = require('./creditLimit');

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

    // Get ONLY drivers who are on shift (status = 'active')
    // Drivers must be on shift to receive orders
    // Note: Location check removed - drivers can receive orders without location
    const availableDrivers = await db.Driver.findAll({
      where: {
        status: 'active'
      }
    });

    console.log(`👥 [DriverAssignment] Found ${availableDrivers.length} available driver(s):`, 
      availableDrivers.map(d => `${d.name} (ID: ${d.id}, status: ${d.status})`).join(', '));

    // Filter out drivers who have exceeded their credit limit
    const eligibleDrivers = await filterDriversByCreditLimit(availableDrivers);
    console.log(`💳 [DriverAssignment] After credit limit check: ${eligibleDrivers.length} eligible driver(s) (${availableDrivers.length - eligibleDrivers.length} excluded due to credit limit)`);

    if (!eligibleDrivers || eligibleDrivers.length === 0) {
      console.log('⚠️  [DriverAssignment] No eligible drivers found (all exceeded credit limit). Defaulting to HOLD driver.');
      const holdDriver = await getOrCreateHoldDriver();
      return holdDriver;
    }
    
    // All drivers are already 'active' and have location, so use all eligible drivers
    const driversToUse = eligibleDrivers;

    // If only one available driver, assign to them
    if (driversToUse.length === 1) {
      console.log(`✅ [DriverAssignment] Only one available driver found: ${driversToUse[0].name}. Assigning automatically.`);
      return driversToUse[0];
    }

    // Get branch location (latitude/longitude)
    // If branch doesn't have lat/long, we'll need to geocode the address
    let branchLat = branch.latitude || null;
    let branchLng = branch.longitude || null;

    // If branch doesn't have coordinates, try to geocode the address
    if ((!branchLat || !branchLng) && branch.address && GOOGLE_MAPS_API_KEY) {
      try {
        const axios = require('axios');
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(branch.address)}&key=${GOOGLE_MAPS_API_KEY}`;
        const geocodeResponse = await axios.get(geocodeUrl);
        if (geocodeResponse.data.results && geocodeResponse.data.results.length > 0) {
          const location = geocodeResponse.data.results[0].geometry.location;
          branchLat = location.lat;
          branchLng = location.lng;
          console.log(`📍 [DriverAssignment] Geocoded branch address: ${branchLat}, ${branchLng}`);
        }
      } catch (geocodeError) {
        console.error('❌ [DriverAssignment] Error geocoding branch address:', geocodeError.message);
      }
    }

    // If we still don't have branch coordinates, fallback to first driver
    if (!branchLat || !branchLng) {
      console.log('⚠️  [DriverAssignment] Branch coordinates not available. Assigning first available driver as fallback.');
      return driversToUse[0];
    }

    // Calculate distance from branch to each driver and find nearest
    let nearestDriver = null;
    let shortestDistance = Infinity;

    for (const driver of driversToUse) {
      const driverLat = parseFloat(driver.locationLatitude);
      const driverLng = parseFloat(driver.locationLongitude);

      if (!driverLat || !driverLng) {
        continue; // Skip drivers without valid location
      }

      // Calculate distance using Haversine formula
      const R = 6371; // Earth's radius in kilometers
      const dLat = (branchLat - driverLat) * Math.PI / 180;
      const dLng = (branchLng - driverLng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(driverLat * Math.PI / 180) * Math.cos(branchLat * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c; // Distance in kilometers

      if (distance < shortestDistance) {
        shortestDistance = distance;
        nearestDriver = driver;
      }
    }

    if (nearestDriver) {
      console.log(`✅ [DriverAssignment] Found nearest driver: ${nearestDriver.name} (ID: ${nearestDriver.id}) at ${shortestDistance.toFixed(2)} km from branch`);
      return nearestDriver;
    }

    // Fallback to first driver if no distance calculation worked
    console.log('⚠️  [DriverAssignment] Could not calculate distances. Assigning first available driver as fallback.');
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
    // Get ONLY drivers who are on shift (status = 'active')
    // Note: Location check removed - drivers can receive orders without location
    const availableDrivers = await db.Driver.findAll({
      where: {
        status: 'active'
      }
    });

    // Filter out drivers who have exceeded their credit limit
    const eligibleDrivers = await filterDriversByCreditLimit(availableDrivers);
    console.log(`💳 [DriverAssignment] After credit limit check: ${eligibleDrivers.length} eligible driver(s) (${availableDrivers.length - eligibleDrivers.length} excluded due to credit limit)`);

    if (!eligibleDrivers || eligibleDrivers.length === 0) {
      console.log('⚠️  No eligible drivers found (all exceeded credit limit). Defaulting to HOLD driver.');
      const holdDriver = await getOrCreateHoldDriver();
      return holdDriver;
    }

    // All drivers are already 'active' and have location, so use all eligible drivers
    const driversToUse = eligibleDrivers;

    // If only one available driver, assign to them
    if (driversToUse.length === 1) {
      return driversToUse[0];
    }

    // For address-based assignment, we'd need to geocode the address first
    // For now, return first available driver
    // TODO: Implement location-based assignment using geocoded address
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

