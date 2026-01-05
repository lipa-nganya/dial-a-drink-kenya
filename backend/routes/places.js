const express = require('express');
const router = express.Router();
const db = require('../models');
const { Op } = require('sequelize');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

// Google Places API costs (in USD) - approximate costs per call
// Autocomplete: ~$0.0032 per request
// Place Details: ~$0.017 per request
const GOOGLE_AUTOCOMPLETE_COST_USD = 0.0032;
const GOOGLE_DETAILS_COST_USD = 0.017;
// Exchange rate: 1 USD = ~150 KES (approximate, can be made configurable)
const USD_TO_KES_RATE = parseFloat(process.env.USD_TO_KES_RATE || '150');

// Get autocomplete suggestions
router.post('/autocomplete', async (req, res) => {
  try {
    const { input } = req.body;

    if (!input || input.length < 2) {
      return res.json({ suggestions: [] });
    }

    // Normalize input for searching
    const normalizedInput = input.toLowerCase().trim();

    // First, check database for saved addresses that match the input
    // Skip database lookup for now if columns are missing - will be fixed with migration
    let savedAddresses = [];
    try {
      // Only query columns that definitely exist
      savedAddresses = await db.SavedAddress.findAll({
        where: {
          address: {
            [Op.iLike]: `%${normalizedInput}%`
          }
        },
        order: [['createdAt', 'DESC']], // Removed searchCount in case column doesn't exist
        limit: 5,
        attributes: ['id', 'address', 'placeId', 'formattedAddress', 'createdAt', 'updatedAt'] // Only select columns that definitely exist
      });
    } catch (dbError) {
      // If there's an error (e.g., missing columns), just skip database lookup
      console.log('⚠️  Error querying saved addresses, skipping database lookup:', dbError.message);
      savedAddresses = [];
    }

    // If we found saved addresses, return them as suggestions
    if (savedAddresses.length > 0) {
      const suggestions = savedAddresses.map(addr => ({
        placeId: addr.placeId,
        description: addr.formattedAddress || addr.address,
        structuredFormat: {
          main_text: addr.address.split(',')[0] || addr.address,
          secondary_text: addr.address.split(',').slice(1).join(',').trim() || ''
        },
        fromDatabase: true // Flag to indicate this came from database
      }));

      // Update search count for all matched addresses (only if columns exist)
      try {
        // Try to update, but don't fail if columns don't exist
        await Promise.all(
          savedAddresses.map(async (addr) => {
            try {
              const updates = {};
              // Only update columns that exist
              if (addr.searchCount !== undefined) {
                updates.searchCount = (addr.searchCount || 0) + 1;
              }
              if (addr.apiCallsSaved !== undefined) {
                updates.apiCallsSaved = (addr.apiCallsSaved || 0) + 1;
              }
              if (addr.costSaved !== undefined) {
                updates.costSaved = parseFloat(addr.costSaved || 0) + (GOOGLE_AUTOCOMPLETE_COST_USD * USD_TO_KES_RATE);
              }
              if (Object.keys(updates).length > 0) {
                await addr.update(updates);
              }
            } catch (updateError) {
              // Ignore update errors for missing columns
              console.log('⚠️  Could not update address stats:', updateError.message);
            }
          })
        );
      } catch (updateError) {
        // If update fails, just log and continue
        console.log('⚠️  Error updating search count, continuing:', updateError.message);
      }

      console.log(`✅ Found ${savedAddresses.length} addresses in database, saved API call (KES ${(GOOGLE_AUTOCOMPLETE_COST_USD * USD_TO_KES_RATE).toFixed(4)})`);
      return res.json({ suggestions, fromDatabase: true });
    }

    // If no saved addresses found, call Google API
    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ 
        error: 'Google Maps API key not configured' 
      });
    }

    // Try the legacy Places API AutocompleteService (still works, even if deprecated)
    try {
      const legacyUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${GOOGLE_MAPS_API_KEY}&components=country:ke&types=geocode|establishment`;
      
      const legacyResponse = await fetch(legacyUrl);
      
      if (!legacyResponse.ok) {
        throw new Error(`HTTP error! status: ${legacyResponse.status}`);
      }
      
      const legacyData = await legacyResponse.json();

      if (legacyData && legacyData.predictions) {
        const formattedSuggestions = legacyData.predictions.map(pred => ({
          placeId: pred.place_id,
          description: pred.description,
          structuredFormat: pred.structured_formatting,
          fromDatabase: false
        }));

        // Save new unique addresses to database
        // Note: We'll save addresses when user selects them, not here
        // This prevents saving addresses that are never selected

        return res.json({ suggestions: formattedSuggestions, fromDatabase: false });
      }
    } catch (legacyError) {
      console.error('Places API failed:', legacyError.message);
      // Continue to return empty suggestions instead of throwing
    }

    res.json({ suggestions: [] });
  } catch (error) {
    console.error('Error fetching place suggestions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch address suggestions',
      message: error.message 
    });
  }
});

// Save address to database
router.post('/save', async (req, res) => {
  try {
    const { address, placeId, formattedAddress } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    // Normalize address for uniqueness
    const normalizedAddress = address.toLowerCase().trim();

    // Check if address already exists
    let savedAddress = await db.SavedAddress.findOne({
      where: {
        address: normalizedAddress
      }
    });

    if (savedAddress) {
      // Address already exists, just return it
      return res.json({ 
        success: true,
        address: savedAddress,
        message: 'Address already saved'
      });
    }

    // Save new address
    savedAddress = await db.SavedAddress.create({
      address: normalizedAddress,
      placeId: placeId || null,
      formattedAddress: formattedAddress || address
    });

    console.log(`✅ Saved new address: ${normalizedAddress}`);

    res.json({ 
      success: true,
      address: savedAddress,
      message: 'Address saved successfully'
    });
  } catch (error) {
    console.error('Error saving address:', error);
    res.status(500).json({ 
      error: 'Failed to save address',
      message: error.message 
    });
  }
});

// Get place details by placeId
router.get('/details/:placeId', async (req, res) => {
  try {
    const { placeId } = req.params;

    // Always fetch from Google API to get geometry (coordinates are required)
    // We'll check database first to see if we need to update it with coordinates
    let savedAddress = null;
    if (placeId) {
      savedAddress = await db.SavedAddress.findOne({
        where: { placeId: placeId }
      });
    }

    if (!GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ 
        error: 'Google Maps API key not configured' 
      });
    }

    // Use legacy Places API Details
    try {
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&key=${GOOGLE_MAPS_API_KEY}&fields=place_id,formatted_address,name,address_components,geometry`;
      
      const detailsResponse = await fetch(detailsUrl);
      
      if (!detailsResponse.ok) {
        throw new Error(`HTTP error! status: ${detailsResponse.status}`);
      }
      
      const detailsData = await detailsResponse.json();

      // Check for API errors
      if (detailsData.status && detailsData.status !== 'OK') {
        console.error('Google Places API error:', detailsData.status, detailsData.error_message);
        // Skip using saved coordinates as fallback (columns may not exist)
        // This will be re-enabled after migration
        return res.status(500).json({
          error: 'Google Places API error',
          message: detailsData.error_message || `API returned status: ${detailsData.status}`
        });
      }

      if (detailsData && detailsData.result) {
        const placeResult = detailsData.result;
        
        // Ensure geometry exists
        if (!placeResult.geometry || !placeResult.geometry.location) {
          console.error('Google Places API response missing geometry:', placeResult);
          return res.status(500).json({
            error: 'Invalid response from Google Places API',
            message: 'Place details missing geometry/coordinates'
          });
        }
        
        // Check if formatted_address is a Plus Code (e.g., "PP2X+58P, Nairobi, Kenya")
        const plusCodePattern = /^[A-Z0-9]{2,}\+[A-Z0-9]+/;
        const isPlusCode = placeResult.formatted_address && plusCodePattern.test(placeResult.formatted_address.split(',')[0].trim());
        
        if (isPlusCode && placeResult.address_components) {
          // Build a proper address from address_components
          const components = placeResult.address_components;
          
          // Extract address parts
          const streetNumber = components.find(c => c.types.includes('street_number'))?.long_name || '';
          const route = components.find(c => c.types.includes('route'))?.long_name || '';
          const sublocality = components.find(c => c.types.includes('sublocality') || c.types.includes('sublocality_level_1'))?.long_name || '';
          const locality = components.find(c => c.types.includes('locality'))?.long_name || '';
          const administrativeArea = components.find(c => c.types.includes('administrative_area_level_1'))?.long_name || '';
          const country = components.find(c => c.types.includes('country'))?.long_name || '';
          
          // Build address parts
          const addressParts = [];
          
          // Street address
          if (streetNumber || route) {
            addressParts.push(`${streetNumber} ${route}`.trim());
          } else if (sublocality) {
            addressParts.push(sublocality);
          }
          
          // Area/Locality
          if (locality && !addressParts.includes(locality)) {
            addressParts.push(locality);
          }
          
          // Administrative area (state/province)
          if (administrativeArea) {
            addressParts.push(administrativeArea);
          }
          
          // Country
          if (country) {
            addressParts.push(country);
          }
          
          // If we built a valid address, use it; otherwise fall back to name + location
          if (addressParts.length > 0) {
            placeResult.formatted_address = addressParts.join(', ');
          } else if (placeResult.name) {
            // Fallback: use name + locality/country
            const fallbackParts = [placeResult.name];
            if (locality) fallbackParts.push(locality);
            if (administrativeArea) fallbackParts.push(administrativeArea);
            if (country) fallbackParts.push(country);
            placeResult.formatted_address = fallbackParts.join(', ');
          }
        }
        
        // Save/update address in database with coordinates for future use
        if (placeResult.formatted_address && placeResult.geometry && placeResult.geometry.location) {
          const normalizedAddress = placeResult.formatted_address.toLowerCase().trim();
          const latitude = placeResult.geometry.location.lat;
          const longitude = placeResult.geometry.location.lng;
          
          try {
            // Check if already exists by placeId or address
            let existingAddress = savedAddress;
            if (!existingAddress) {
              // First try by placeId
              existingAddress = await db.SavedAddress.findOne({
                where: { placeId: placeId }
              });
              // If not found, try by address
              if (!existingAddress) {
                existingAddress = await db.SavedAddress.findOne({
                  where: { address: normalizedAddress }
                });
              }
            }

            if (!existingAddress) {
              // Create new address (without latitude/longitude - columns may not exist)
              const addressData = {
                address: normalizedAddress,
                placeId: placeId,
                formattedAddress: placeResult.formatted_address
              };
              await db.SavedAddress.create(addressData);
              console.log(`✅ Saved new address: ${normalizedAddress}`);
            } else {
              // Update existing address with placeId if different
              const updates = {};
              if (placeId && existingAddress.placeId !== placeId) {
                updates.placeId = placeId;
              }
              if (Object.keys(updates).length > 0) {
                await existingAddress.update(updates);
                console.log(`✅ Updated existing address: ${normalizedAddress}`);
              }
            }
          } catch (dbError) {
            // Handle duplicate key errors gracefully
            if (dbError.name === 'SequelizeUniqueConstraintError') {
              console.log(`⚠️ Address already exists (duplicate key): ${normalizedAddress}`);
              // Try to find it (skip coordinate updates - columns may not exist)
              const existingAddress = await db.SavedAddress.findOne({
                where: { address: normalizedAddress }
              });
              if (existingAddress) {
                console.log(`✅ Address already exists: ${normalizedAddress}`);
              }
            } else {
              console.error('Error saving address to database:', dbError.message);
              // Don't throw - continue with returning the place result
            }
          }
        }
        
        // Always return with geometry - remove fromDatabase flag since we fetched from Google
        const response = { ...placeResult };
        delete response.fromDatabase; // Remove this flag since we got fresh data from Google
        
        return res.json(response);
      }
    } catch (error) {
      console.error('Places Details API failed:', error.message);
      throw error;
    }

    res.status(404).json({ error: 'Place not found' });
  } catch (error) {
    console.error('Error fetching place details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch place details',
      message: error.message 
    });
  }
});

/**
 * POST /api/places/generate-geojson
 * Generate a GeoJSON polygon from multiple location coordinates
 * Creates a convex hull or bounding box polygon that encompasses all points
 */
router.post('/generate-geojson', async (req, res) => {
  try {
    const { locations } = req.body;

    if (!locations || !Array.isArray(locations) || locations.length < 3) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'At least 3 locations are required to generate a polygon'
      });
    }

    // Extract coordinates
    const coordinates = locations.map(loc => {
      if (loc.coordinates) {
        return [loc.coordinates.lng, loc.coordinates.lat]; // GeoJSON format: [lng, lat]
      }
      return null;
    }).filter(coord => coord !== null);

    if (coordinates.length < 3) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'At least 3 valid coordinates are required'
      });
    }

    // Calculate bounding box
    const lngs = coordinates.map(c => c[0]);
    const lats = coordinates.map(c => c[1]);
    
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);

    // Create a buffer around the bounding box (5% padding)
    const lngBuffer = (maxLng - minLng) * 0.05;
    const latBuffer = (maxLat - minLat) * 0.05;

    // Generate a rectangular polygon (bounding box with buffer)
    // For a more accurate polygon, we could use a convex hull algorithm
    // For now, we'll create a rectangle that encompasses all points
    const polygon = {
      type: 'Polygon',
      coordinates: [[
        [minLng - lngBuffer, minLat - latBuffer], // Southwest
        [maxLng + lngBuffer, minLat - latBuffer], // Southeast
        [maxLng + lngBuffer, maxLat + latBuffer], // Northeast
        [minLng - lngBuffer, maxLat + latBuffer], // Northwest
        [minLng - lngBuffer, minLat - latBuffer]  // Close polygon
      ]]
    };

    // Create GeoJSON Feature with location data stored in properties
    const geojson = {
      type: 'Feature',
      properties: {
        name: 'Generated Delivery Zone',
        description: `Zone covering ${locations.length} locations`,
        generatedAt: new Date().toISOString(),
        locationCount: locations.length,
        sourceLocations: locations.map(loc => ({
          placeId: loc.placeId,
          description: loc.description,
          formattedAddress: loc.formattedAddress,
          coordinates: loc.coordinates
        }))
      },
      geometry: polygon
    };

    res.json({
      success: true,
      geojson: geojson,
      geometry: polygon,
      boundingBox: {
        minLng,
        maxLng,
        minLat,
        maxLat
      }
    });
  } catch (error) {
    console.error('Error generating GeoJSON:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate GeoJSON'
    });
  }
});

module.exports = router;

