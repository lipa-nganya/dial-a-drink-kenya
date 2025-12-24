const db = require('../models');
const { Op } = require('sequelize');

/**
 * Geofence Service
 * Handles GeoJSON validation, point-in-polygon checks, and geofence enforcement
 */

/**
 * Validate GeoJSON structure (Polygon or MultiPolygon)
 */
function validateGeoJSON(geometry) {
  if (!geometry || !geometry.type) {
    throw new Error('Invalid GeoJSON: missing type');
  }

  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
    throw new Error(`Invalid GeoJSON type: ${geometry.type}. Only Polygon and MultiPolygon are supported.`);
  }

  if (!geometry.coordinates || !Array.isArray(geometry.coordinates)) {
    throw new Error('Invalid GeoJSON: missing or invalid coordinates');
  }

  // Basic validation for Polygon structure
  if (geometry.type === 'Polygon') {
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
      throw new Error('Invalid Polygon: coordinates must be a non-empty array');
    }
    for (const ring of geometry.coordinates) {
      if (!Array.isArray(ring) || ring.length < 4) {
        throw new Error('Invalid Polygon: ring must have at least 4 points (closed polygon)');
      }
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        throw new Error('Invalid Polygon: ring must be closed (first and last points must match)');
      }
      for (const coord of ring) {
        if (!Array.isArray(coord) || coord.length < 2 || typeof coord[0] !== 'number' || typeof coord[1] !== 'number') {
          throw new Error('Invalid coordinate: must be [longitude, latitude] with numeric values');
        }
        const [lon, lat] = coord;
        if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
          throw new Error('Invalid coordinate: longitude must be -180 to 180, latitude must be -90 to 90');
        }
      }
    }
  } else if (geometry.type === 'MultiPolygon') {
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
      throw new Error('Invalid MultiPolygon: coordinates must be a non-empty array');
    }
    for (const polygon of geometry.coordinates) {
      if (!Array.isArray(polygon) || polygon.length === 0) {
        throw new Error('Invalid MultiPolygon: polygon must be a non-empty array');
      }
      for (const ring of polygon) {
        if (!Array.isArray(ring) || ring.length < 4) {
          throw new Error('Invalid MultiPolygon: ring must have at least 4 points');
        }
      }
    }
  }
  return true;
}

// Alias for compatibility
const validateGeoJsonPolygon = validateGeoJSON;

/**
 * Check if a point is within a polygon using ray casting algorithm
 */
function pointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Check if a point is inside a GeoJSON geometry (Polygon or MultiPolygon)
 */
function pointInGeometry(point, geometry) {
  if (geometry.type === 'Polygon') {
    return pointInPolygon(point, geometry.coordinates[0]); // Assuming first ring is outer boundary
  } else if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some(polygon => pointInPolygon(point, polygon[0]));
  }
  return false;
}

/**
 * Enforce geofence on order creation
 * Validates pickup and dropoff locations against partner geofences
 */
const enforceGeofence = async (partnerId, pickupCoords, dropoffCoords) => {
  const partner = await db.ValkyriePartner.findByPk(partnerId, {
    include: [{
      model: db.PartnerGeofence,
      as: 'geofences',
      where: { active: true, source: 'partner' }, // Only consider partner-defined active geofences
      required: false
    }]
  });

  if (!partner) {
    return { allowed: false, message: 'Partner not found.' };
  }

  const activeGeofences = partner.geofences;

  if (!activeGeofences || activeGeofences.length === 0) {
    return { allowed: false, message: 'No active delivery zones defined for partner. Orders cannot be placed.' };
  }

  const isPickupAllowed = activeGeofences.some(geofence =>
    pointInGeometry([pickupCoords.longitude, pickupCoords.latitude], geofence.geometry)
  );
  const isDropoffAllowed = activeGeofences.some(geofence =>
    pointInGeometry([dropoffCoords.longitude, dropoffCoords.latitude], geofence.geometry)
  );

  if (!isPickupAllowed) {
    return { allowed: false, message: 'Pickup location is outside allowed delivery zones.' };
  }
  if (!isDropoffAllowed) {
    return { allowed: false, message: 'Dropoff location is outside allowed delivery zones.' };
  }

  return { allowed: true, message: 'Order within allowed delivery zones.' };
};

/**
 * Validate a partner-uploaded geofence against Zeus-defined geofences
 * Checks if all vertices of the partner geofence are within at least one Zeus geofence
 */
const validatePartnerGeofence = async (partnerId, newGeofenceGeometry) => {
  const zeusGeofences = await db.PartnerGeofence.findAll({
    where: {
      partnerId: partnerId,
      source: 'zeus',
      active: true
    }
  });

  if (zeusGeofences.length === 0) {
    return { valid: true, message: 'No Zeus geofences defined, partner geofence allowed.' };
  }

  // Extract all vertices from the new geofence
  const extractVertices = (geometry) => {
    const vertices = [];
    if (geometry.type === 'Polygon' && geometry.coordinates && geometry.coordinates[0]) {
      // Get outer ring coordinates (skip holes)
      geometry.coordinates[0].forEach(coord => {
        if (Array.isArray(coord) && coord.length >= 2) {
          vertices.push([coord[0], coord[1]]); // [lng, lat]
        }
      });
    } else if (geometry.type === 'MultiPolygon' && geometry.coordinates) {
      geometry.coordinates.forEach(polygon => {
        if (polygon[0]) {
          polygon[0].forEach(coord => {
            if (Array.isArray(coord) && coord.length >= 2) {
              vertices.push([coord[0], coord[1]]); // [lng, lat]
            }
          });
        }
      });
    }
    return vertices;
  };

  const partnerVertices = extractVertices(newGeofenceGeometry);

  if (partnerVertices.length === 0) {
    return { valid: false, message: 'Invalid geofence geometry: no vertices found.' };
  }

  // Check if all vertices are within at least one Zeus geofence
  // A vertex is valid if it's inside ANY Zeus geofence
  const allVerticesValid = partnerVertices.every(vertex => {
    return zeusGeofences.some(zeusGeofence => {
      return pointInGeometry(vertex, zeusGeofence.geometry);
    });
  });

  if (!allVerticesValid) {
    return { 
      valid: false, 
      message: 'Partner geofence must be entirely within Zeus-defined delivery zones. Some vertices are outside the allowed boundaries.' 
    };
  }

  return { valid: true, message: 'Partner geofence validated against Zeus boundaries.' };
};

/**
 * Parse coordinates from an address string (placeholder for geocoding)
 */
const parseAddressCoordinates = (address) => {
  // In a real application, this would involve a geocoding service (e.g., Google Maps API)
  console.warn(`Geocoding not implemented. Returning dummy coordinates for address: ${address}`);
  return { latitude: -1.286389, longitude: 36.817223 }; // Nairobi CBD
};

module.exports = {
  validateGeoJSON,
  validateGeoJsonPolygon,
  pointInGeometry,
  enforceGeofence,
  validatePartnerGeofence,
  parseAddressCoordinates
};
