const db = require('../models');
// Ensure dotenv is loaded if not already loaded
if (!process.env.GOOGLE_MAPS_API_KEY && !process.env.REACT_APP_GOOGLE_MAPS_API_KEY) {
  try {
    require('dotenv').config();
  } catch (e) {
    // dotenv might already be loaded or not available
  }
}

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

/**
 * Find the closest branch to a delivery address using Google Routes API
 * @param {string} deliveryAddress - Customer delivery address
 * @returns {Promise<Object|null>} - Closest branch object or null if no branches found
 */
const findClosestBranch = async (deliveryAddress) => {
  try {
    // Get all active branches
    const branches = await db.Branch.findAll({
      where: { isActive: true }
    });
    
    if (!branches || branches.length === 0) {
      console.log('⚠️  No active branches found. Order will be created without branch assignment.');
      return null;
    }
    
    if (branches.length === 1) {
      console.log(`✅ Only one active branch found: ${branches[0].name}. Assigning automatically.`);
      return branches[0];
    }
    
    // If no Google Maps API key, return first branch as fallback
    if (!GOOGLE_MAPS_API_KEY) {
      console.log('⚠️  Google Maps API key not configured. Assigning first branch as fallback.');
      return branches[0];
    }
    
    // Use Google Routes API computeRouteMatrix to find closest branch
    // NOTE: This requires the Routes API to be enabled in Google Cloud Console
    // Enable it at: https://console.cloud.google.com/apis/library/routes.googleapis.com
    const routesApiUrl = `https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix?key=${GOOGLE_MAPS_API_KEY}`;
    
    console.log(`🌐 Calling Google Routes API...`);
    console.log(`   Origins: ${branches.length} branches`);
    console.log(`   Destination: ${deliveryAddress}`);
    
    // Prepare origins (branches)
    const origins = branches.map((branch) => ({
      waypoint: {
        address: branch.address
      },
      routeModifiers: {
        avoidTolls: false,
        avoidHighways: false,
        avoidFerries: false
      }
    }));
    
    // Prepare destination
    const destination = {
      waypoint: {
        address: deliveryAddress
      }
    };
    
    // Prepare request body
    const requestBody = {
      origins: origins,
      destinations: [destination],
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      units: 'METRIC'
    };
    
    let response;
    try {
      response = await fetch(routesApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,status'
        },
        body: JSON.stringify(requestBody)
      });
    } catch (fetchError) {
      console.error('❌ Network error calling Routes API:', fetchError.message);
      return branches[0];
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Routes API HTTP error: ${response.status} ${response.statusText}`);
      console.error(`❌ Error details: ${errorText}`);
      if (response.status === 403) {
        console.error('❌ Routes API is not enabled for this API key.');
        console.error('❌ To enable it, go to: https://console.cloud.google.com/apis/library/routes.googleapis.com');
        console.error('❌ Click "Enable" and ensure your API key has access to this API.');
        console.error('⚠️  Falling back to first branch until API is enabled.');
      }
      return branches[0];
    }
    
    const data = await response.json();
    
    // Check for errors in response (if it's an object with error property)
    if (data.error) {
      console.error('⚠️  Routes API error:', data.error.message || JSON.stringify(data.error));
      if (data.error.message && data.error.message.includes('not enabled')) {
        console.error('❌ Routes API is not enabled for this API key.');
        console.error('❌ To enable it, go to: https://console.cloud.google.com/apis/library/routes.googleapis.com');
        console.error('❌ Click "Enable" and ensure your API key has access to this API.');
        console.error('⚠️  Falling back to first branch until API is enabled.');
      }
      return branches[0];
    }
    
    // Routes API returns an array of route matrix elements directly
    const routeMatrixElements = Array.isArray(data) ? data : (data.routeMatrixElements || []);
    
    if (!routeMatrixElements || routeMatrixElements.length === 0) {
      console.log('⚠️  No distance data returned. Assigning first branch as fallback.');
      return branches[0];
    }
    
    // Find branch with shortest distance
    let closestBranch = null;
    let shortestDistance = Infinity;
    
    console.log(`🔍 Calculating distances from ${branches.length} branches to: ${deliveryAddress}`);
    
    routeMatrixElements.forEach((element) => {
      const originIndex = element.originIndex;
      const branch = branches[originIndex];
      
      // Check if status indicates an error (empty object {} means success)
      if (element.status && Object.keys(element.status).length > 0 && element.status.code !== 'OK') {
        console.warn(`  ⚠️  ${branch.name}: Status ${element.status.code}`);
        return;
      }
      
      if (element.distanceMeters) {
        const distance = element.distanceMeters; // Distance in meters
        if (distance < shortestDistance) {
          shortestDistance = distance;
          closestBranch = branch;
          const distanceKm = (distance / 1000).toFixed(2);
          console.log(`  📍 ${branch.name}: ${distanceKm} km (NEW CLOSEST)`);
        } else {
          const distanceKm = (distance / 1000).toFixed(2);
          console.log(`  📍 ${branch.name}: ${distanceKm} km`);
        }
      }
    });
    
    if (closestBranch) {
      const distanceKm = (shortestDistance / 1000).toFixed(2);
      console.log(`✅ Closest branch found: ${closestBranch.name} (${distanceKm} km away)`);
      return closestBranch;
    }
    
    // Fallback to first branch if no valid distances found
    console.log('⚠️  No valid distances found. Assigning first branch as fallback.');
    return branches[0];
    
  } catch (error) {
    console.error('❌ Error finding closest branch:', error.message);
    // Fallback: return first active branch
    const branches = await db.Branch.findAll({
      where: { isActive: true },
      limit: 1
    });
    return branches.length > 0 ? branches[0] : null;
  }
};

module.exports = {
  findClosestBranch
};

