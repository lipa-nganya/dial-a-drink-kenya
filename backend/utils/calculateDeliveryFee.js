const db = require('../models');

// Ensure dotenv is loaded for Google Maps API key
if (!process.env.GOOGLE_MAPS_API_KEY && !process.env.REACT_APP_GOOGLE_MAPS_API_KEY) {
  try {
    require('dotenv').config();
  } catch (e) {
    // dotenv might already be loaded
  }
}

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

// Reference point: Taveta Shopping Mall - M 48, Taveta Shopping Mall, Taveta Road, Nairobi
// This is a fallback if no branch is specified - should match branch 4 address
const ORIGIN_ADDRESS = 'Taveta Shopping Mall - M 48, Taveta Shopping Mall, Taveta Road, Nairobi';

/**
 * Calculate road distance using Google Distance Matrix API
 * Falls back to Haversine formula if API is unavailable
 * @param {string} destinationAddress - Delivery address
 * @param {string} originAddress - Origin address (branch address). If not provided, uses default ORIGIN_ADDRESS
 * @returns {Promise<{distance: number, isRoadDistance: boolean}>} - Distance in kilometers
 */
const calculateRoadDistance = async (destinationAddress, originAddress = null) => {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('⚠️ Google Maps API key not configured. Cannot calculate road distance.');
    return { distance: null, isRoadDistance: false };
  }

  const origin = originAddress || ORIGIN_ADDRESS;

  if (!origin || !origin.trim()) {
    console.error('❌ Origin address is empty! Cannot calculate distance.');
    return { distance: null, isRoadDistance: false };
  }

  try {
    const distanceMatrixUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destinationAddress)}&key=${GOOGLE_MAPS_API_KEY}&units=metric`;

    console.log(`🌐 Calling Google Distance Matrix API:`);
    console.log(`   Origin: ${origin}`);
    console.log(`   Destination: ${destinationAddress}`);

    const response = await fetch(distanceMatrixUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('❌ Google Distance Matrix API error:', data.status, data.error_message);
      return { distance: null, isRoadDistance: false };
    }

    if (data.rows && data.rows[0] && data.rows[0].elements && data.rows[0].elements[0]) {
      const element = data.rows[0].elements[0];

      if (element.status === 'OK' && element.distance) {
        const distanceKm = element.distance.value / 1000;
        console.log(`✅ Distance Matrix API returned: ${distanceKm} km (${element.distance.text})`);
        return { distance: parseFloat(distanceKm.toFixed(2)), isRoadDistance: true };
      }
      console.warn(`⚠️ Distance Matrix API returned status: ${element.status} for origin "${origin}" to destination "${destinationAddress}"`);
      return { distance: null, isRoadDistance: false };
    }

    console.warn('⚠️ Distance Matrix API returned invalid response structure');
    return { distance: null, isRoadDistance: false };
  } catch (error) {
    console.error('❌ Error calling Google Distance Matrix API:', error.message);
    console.error('   Origin:', origin);
    console.error('   Destination:', destinationAddress);
    return { distance: null, isRoadDistance: false };
  }
};

/**
 * Settings-based delivery fee (fixed or per-km). Used when no territory applies.
 */
const calculateDeliveryFee = async (items, itemsSubtotal = null, deliveryAddress = null, branchId = null) => {
  try {
    const [testModeSetting, feeModeSetting, withAlcoholSetting, withoutAlcoholSetting, perKmWithAlcoholSetting, perKmWithoutAlcoholSetting] = await Promise.all([
      db.Settings.findOne({ where: { key: 'deliveryTestMode' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'deliveryFeeMode' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'deliveryFeeWithAlcohol' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'deliveryFeeWithoutAlcohol' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'deliveryFeePerKmWithAlcohol' } }).catch(() => null),
      db.Settings.findOne({ where: { key: 'deliveryFeePerKmWithoutAlcohol' } }).catch(() => null)
    ]);

    const isTestMode = testModeSetting?.value === 'true';

    if (isTestMode) {
      return { fee: 0, distance: null };
    }

    const feeMode = feeModeSetting?.value || 'fixed';
    const isPerKmMode = feeMode === 'perKm';

    let allSoftDrinks = false;
    if (items && items.length > 0) {
      const drinkIds = items.map(item => item.drinkId);
      const drinks = await db.Drink.findAll({
        where: { id: drinkIds },
        include: [{
          model: db.Category,
          as: 'category'
        }]
      });

      allSoftDrinks = drinks.every(drink =>
        drink.category && drink.category.name === 'Soft Drinks'
      );
    }

    if (isPerKmMode) {
      const perKmWithAlcohol = parseFloat(perKmWithAlcoholSetting?.value || '20');
      const perKmWithoutAlcohol = parseFloat(perKmWithoutAlcoholSetting?.value || '15');

      const perKmRate = allSoftDrinks ? perKmWithoutAlcohol : perKmWithAlcohol;

      let distanceKm = null;
      if (deliveryAddress) {
        try {
          let originAddress = null;
          if (branchId) {
            const branch = await db.Branch.findByPk(branchId);
            if (branch && branch.address) {
              originAddress = branch.address;
              console.log(`📍 Using branch address as origin: ${branch.name} (ID: ${branchId}) - ${originAddress}`);
            } else {
              console.warn(`⚠️ Branch ID ${branchId} not found or has no address, using ORIGIN_ADDRESS`);
            }
          } else {
            console.warn(`⚠️ No branchId provided, using ORIGIN_ADDRESS: ${ORIGIN_ADDRESS}`);
          }

          const distanceResult = await calculateRoadDistance(deliveryAddress, originAddress);
          if (distanceResult.isRoadDistance && distanceResult.distance) {
            distanceKm = distanceResult.distance;
            console.log(`✅ Road distance calculated: ${distanceKm} km from ${originAddress || ORIGIN_ADDRESS} to ${deliveryAddress}`);
          } else {
            console.warn(`⚠️ Road distance calculation failed (isRoadDistance: ${distanceResult.isRoadDistance}, distance: ${distanceResult.distance}), using minimum 1km`);
            console.warn(`   Origin: ${originAddress || ORIGIN_ADDRESS}`);
            console.warn(`   Destination: ${deliveryAddress}`);
            distanceKm = 1;
          }
        } catch (distanceError) {
          console.error('Error calculating road distance:', distanceError);
          distanceKm = 1;
        }
      } else {
        distanceKm = 1;
      }

      distanceKm = Math.max(distanceKm || 1, 1);

      const fee = distanceKm * perKmRate;
      return { fee: Math.ceil(fee), distance: distanceKm };
    }
    const deliveryFeeWithAlcohol = parseFloat(withAlcoholSetting?.value || '50');
    const deliveryFeeWithoutAlcohol = parseFloat(withoutAlcoholSetting?.value || '30');

    const fee = allSoftDrinks ? deliveryFeeWithoutAlcohol : deliveryFeeWithAlcohol;
    return { fee, distance: null };
  } catch (error) {
    console.error('Error calculating delivery fee:', error);
    return { fee: 50, distance: null };
  }
};

module.exports = {
  calculateDeliveryFee
};
