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

    if (!input || input.length < 1) {
      return res.json({ suggestions: [] });
    }

    // Normalize input for searching
    const normalizedInput = input.toLowerCase().trim();

    // Check Google API first - it's fast and comprehensive
    // Database will be checked in parallel for exact/starts-with matches only
    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY.trim() === '') {
      console.error('⚠️  GOOGLE_MAPS_API_KEY is not configured in environment variables');
      // Return empty suggestions instead of 500 error - allows manual typing
      return res.json({ 
        suggestions: [],
        error: 'Google Maps API key not configured. Please configure GOOGLE_MAPS_API_KEY environment variable.',
        fromDatabase: false,
        hasGoogleResults: false
      });
    }

    // Call Google API immediately (don't wait for database)
    let googleSuggestions = [];
    try {
      const legacyUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${GOOGLE_MAPS_API_KEY}&components=country:ke&types=geocode|establishment`;
      
      const legacyResponse = await fetch(legacyUrl);
      
      if (legacyResponse.ok) {
        const legacyData = await legacyResponse.json();
        
        if (legacyData && legacyData.predictions) {
          googleSuggestions = legacyData.predictions.map(pred => ({
            placeId: pred.place_id,
            description: pred.description,
            structuredFormat: pred.structured_formatting,
            fromDatabase: false
          }));
        }
      }
    } catch (googleError) {
      console.error('Places API failed:', googleError.message);
      // Continue even if Google fails - will check database
    }

    // Check database in parallel for exact/starts-with matches only (more strict than before)
    // This prevents database from blocking Google results with broad partial matches
    let savedAddresses = [];
    try {
      // Extract first word from input for database search (autosuggest from first word)
      const words = normalizedInput.split(' ').filter(w => w.length > 0);
      const firstWord = words.length > 0 ? words[0] : normalizedInput;
      
      // Only search for addresses that start with the first word (strict match)
      // This is much more restrictive than '%input%' and won't block Google
      savedAddresses = await db.SavedAddress.findAll({
        where: {
          address: {
            [Op.iLike]: `${firstWord}%` // Starts with first word, not contains
          }
        },
        order: [['createdAt', 'DESC']],
        limit: 3, // Fewer database results since we have Google too
        attributes: ['id', 'address', 'placeId', 'formattedAddress', 'createdAt', 'updatedAt']
      });
    } catch (dbError) {
      // If there's an error, just skip database lookup
      console.log('⚠️  Error querying saved addresses, skipping database lookup:', dbError.message);
      savedAddresses = [];
    }

    // Convert database addresses to suggestion format
    const dbSuggestions = savedAddresses.map(addr => ({
      placeId: addr.placeId,
      description: addr.formattedAddress || addr.address,
      structuredFormat: {
        main_text: addr.address.split(',')[0] || addr.address,
        secondary_text: addr.address.split(',').slice(1).join(',').trim() || ''
      },
      fromDatabase: true
    }));

    // Merge results: database matches first (if any), then Google results
    // Remove duplicates based on description (case-insensitive)
    const allSuggestions = [];
    const seenDescriptions = new Set();

    // Add database suggestions first (they're more relevant)
    dbSuggestions.forEach(sugg => {
      const desc = sugg.description.toLowerCase();
      if (!seenDescriptions.has(desc)) {
        seenDescriptions.add(desc);
        allSuggestions.push(sugg);
      }
    });

    // Add Google suggestions (they're comprehensive)
    googleSuggestions.forEach(sugg => {
      const desc = sugg.description.toLowerCase();
      if (!seenDescriptions.has(desc)) {
        seenDescriptions.add(desc);
        allSuggestions.push(sugg);
      }
    });

    // Update search count for matched database addresses (non-blocking)
    if (savedAddresses.length > 0) {
      Promise.all(
        savedAddresses.map(async (addr) => {
          try {
            const updates = {};
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
            // Ignore update errors
            console.log('⚠️  Could not update address stats:', updateError.message);
          }
        })
      ).catch(() => {
        // Ignore - non-critical
      });
    }

    // Return combined results (database first, then Google)
    return res.json({ 
      suggestions: allSuggestions, 
      fromDatabase: dbSuggestions.length > 0,
      hasGoogleResults: googleSuggestions.length > 0
    });
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
        
        // Extract address components for building a proper address
        const components = placeResult.address_components || [];
        const streetNumber = components.find(c => c.types.includes('street_number'))?.long_name || '';
        const route = components.find(c => c.types.includes('route'))?.long_name || '';
        const sublocality = components.find(c => c.types.includes('sublocality') || c.types.includes('sublocality_level_1'))?.long_name || '';
        const locality = components.find(c => c.types.includes('locality'))?.long_name || '';
        const administrativeArea = components.find(c => c.types.includes('administrative_area_level_1'))?.long_name || '';
        const country = components.find(c => c.types.includes('country'))?.long_name || '';
        
        // Check if this is an establishment (has name and is not just a general area)
        const isEstablishment = placeResult.name && (
          components.some(c => c.types.includes('establishment')) ||
          components.some(c => c.types.includes('point_of_interest'))
        );
        
        // Check if formatted_address is a Plus Code (e.g., "PP2X+58P, Nairobi, Kenya")
        const plusCodePattern = /^[A-Z0-9]{2,}\+[A-Z0-9]+/;
        const isPlusCode = placeResult.formatted_address && plusCodePattern.test(placeResult.formatted_address.split(',')[0].trim());
        
        // For establishments (like "Denali Apartments"), prioritize name + location over generic formatted_address
        if (isEstablishment && placeResult.name) {
          // Build address with name first, then location details
          const addressParts = [placeResult.name];
          
          // Add street address if available
          if (streetNumber || route) {
            addressParts.push(`${streetNumber} ${route}`.trim());
          }
          
          // Add sublocality/area if available
          if (sublocality && !addressParts.includes(sublocality)) {
            addressParts.push(sublocality);
          }
          
          // Add locality/city
          if (locality && !addressParts.includes(locality)) {
            addressParts.push(locality);
          }
          
          // Add administrative area (state/province)
          if (administrativeArea && !addressParts.includes(administrativeArea)) {
            addressParts.push(administrativeArea);
          }
          
          // Add country
          if (country && !addressParts.includes(country)) {
            addressParts.push(country);
          }
          
          // Use the constructed address (name + location) instead of generic formatted_address
          placeResult.formatted_address = addressParts.join(', ');
        } else if (isPlusCode) {
          // Build a proper address from address_components for Plus Codes
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
        } else if (placeResult.name && placeResult.formatted_address) {
          // For other places with names, check if formatted_address is too generic
          // If formatted_address doesn't contain the name, prefer name + location
          const formattedLower = placeResult.formatted_address.toLowerCase();
          const nameLower = placeResult.name.toLowerCase();
          
          if (!formattedLower.includes(nameLower)) {
            // formatted_address is generic (like "Riruta, Nairobi"), use name + location instead
            const addressParts = [placeResult.name];
            if (sublocality) addressParts.push(sublocality);
            if (locality && !addressParts.includes(locality)) addressParts.push(locality);
            if (administrativeArea && !addressParts.includes(administrativeArea)) addressParts.push(administrativeArea);
            if (country && !addressParts.includes(country)) addressParts.push(country);
            
            if (addressParts.length > 1) {
              placeResult.formatted_address = addressParts.join(', ');
            }
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

