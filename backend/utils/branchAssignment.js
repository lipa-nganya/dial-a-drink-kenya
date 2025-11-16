const db = require('../models');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

/**
 * Find the closest branch to a delivery address using Google Maps Distance Matrix API
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
    
    // Use Google Maps Distance Matrix API to find closest branch
    const origins = branches.map(branch => branch.address).join('|');
    const destinations = deliveryAddress;
    
    const distanceMatrixUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origins)}&destinations=${encodeURIComponent(destinations)}&key=${GOOGLE_MAPS_API_KEY}&units=metric`;
    
    const response = await fetch(distanceMatrixUrl);
    
    if (!response.ok) {
      throw new Error(`Distance Matrix API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status !== 'OK') {
      console.error('⚠️  Distance Matrix API error:', data.status, data.error_message);
      // Fallback to first branch
      return branches[0];
    }
    
    if (!data.rows || data.rows.length === 0) {
      console.log('⚠️  No distance data returned. Assigning first branch as fallback.');
      return branches[0];
    }
    
    // Find branch with shortest distance
    let closestBranch = null;
    let shortestDistance = Infinity;
    
    data.rows.forEach((row, index) => {
      if (row.elements && row.elements[0] && row.elements[0].status === 'OK') {
        const distance = row.elements[0].distance?.value; // Distance in meters
        if (distance && distance < shortestDistance) {
          shortestDistance = distance;
          closestBranch = branches[index];
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

