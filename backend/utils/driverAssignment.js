const db = require('../models');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

/**
 * Find the nearest active driver to a branch
 * @param {number} branchId - Branch ID
 * @returns {Promise<Object|null>} - Nearest active driver object or null if no active drivers found
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

    // Get all active drivers (status = 'active')
    const activeDrivers = await db.Driver.findAll({
      where: {
        status: 'active'
      }
    });

    console.log(`👥 [DriverAssignment] Found ${activeDrivers.length} active driver(s):`, 
      activeDrivers.map(d => `${d.name} (ID: ${d.id})`).join(', '));

    if (!activeDrivers || activeDrivers.length === 0) {
      console.log('⚠️  [DriverAssignment] No active drivers found. Order will be created without driver assignment.');
      return null;
    }

    // If only one active driver, assign to them
    if (activeDrivers.length === 1) {
      console.log(`✅ [DriverAssignment] Only one active driver found: ${activeDrivers[0].name}. Assigning automatically.`);
      return activeDrivers[0];
    }

    // If no Google Maps API key, return first active driver as fallback
    if (!GOOGLE_MAPS_API_KEY) {
      console.log('⚠️  [DriverAssignment] Google Maps API key not configured. Assigning first active driver as fallback.');
      return activeDrivers[0];
    }

    // For now, since drivers don't have location fields, we'll use a simple approach:
    // Assign to the first active driver
    // TODO: If drivers get location tracking, use Distance Matrix API to find nearest driver
    console.log(`✅ [DriverAssignment] Assigning to first active driver: ${activeDrivers[0].name} (ID: ${activeDrivers[0].id})`);
    return activeDrivers[0];

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
    // Fallback: return first active driver
    const activeDrivers = await db.Driver.findAll({
      where: { status: 'active' },
      limit: 1
    });
    return activeDrivers.length > 0 ? activeDrivers[0] : null;
  }
};

/**
 * Find the nearest active driver to a branch address (for when branch is not yet saved)
 * @param {string} branchAddress - Branch address
 * @returns {Promise<Object|null>} - Nearest active driver object or null if no active drivers found
 */
const findNearestActiveDriverToAddress = async (branchAddress) => {
  try {
    // Get all active drivers
    const activeDrivers = await db.Driver.findAll({
      where: {
        status: 'active'
      }
    });

    if (!activeDrivers || activeDrivers.length === 0) {
      console.log('⚠️  No active drivers found.');
      return null;
    }

    // For now, return first active driver
    // TODO: Implement location-based assignment when drivers have location tracking
    return activeDrivers[0];

  } catch (error) {
    console.error('❌ Error finding nearest active driver to address:', error.message);
    const activeDrivers = await db.Driver.findAll({
      where: { status: 'active' },
      limit: 1
    });
    return activeDrivers.length > 0 ? activeDrivers[0] : null;
  }
};

module.exports = {
  findNearestActiveDriverToBranch,
  findNearestActiveDriverToAddress
};

