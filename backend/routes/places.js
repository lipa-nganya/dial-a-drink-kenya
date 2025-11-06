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
    const savedAddresses = await db.SavedAddress.findAll({
      where: {
        address: {
          [Op.iLike]: `%${normalizedInput}%`
        }
      },
      order: [['searchCount', 'DESC'], ['createdAt', 'DESC']],
      limit: 5
    });

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

      // Update search count for all matched addresses
      await Promise.all(
        savedAddresses.map(addr => 
          addr.update({
            searchCount: (addr.searchCount || 0) + 1,
            apiCallsSaved: (addr.apiCallsSaved || 0) + 1,
            costSaved: parseFloat(addr.costSaved || 0) + (GOOGLE_AUTOCOMPLETE_COST_USD * USD_TO_KES_RATE)
          })
        )
      );

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

    // First check if we have this address in database
    const savedAddress = await db.SavedAddress.findOne({
      where: { placeId: placeId }
    });

    if (savedAddress && savedAddress.formattedAddress) {
      // Update cost saved
      await savedAddress.update({
        apiCallsSaved: (savedAddress.apiCallsSaved || 0) + 1,
        costSaved: parseFloat(savedAddress.costSaved || 0) + (GOOGLE_DETAILS_COST_USD * USD_TO_KES_RATE)
      });

      console.log(`✅ Found address details in database, saved API call (KES ${(GOOGLE_DETAILS_COST_USD * USD_TO_KES_RATE).toFixed(4)})`);

      // Return saved address details
      return res.json({
        place_id: savedAddress.placeId,
        formatted_address: savedAddress.formattedAddress,
        name: savedAddress.formattedAddress,
        fromDatabase: true
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

      if (detailsData && detailsData.result) {
        const placeResult = detailsData.result;
        
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
        
        // Save address to database for future use (if not already from database)
        if (placeResult.formatted_address && !placeResult.fromDatabase) {
          const normalizedAddress = placeResult.formatted_address.toLowerCase().trim();
          
          // Check if already exists
          const existingAddress = await db.SavedAddress.findOne({
            where: { address: normalizedAddress }
          });

          if (!existingAddress) {
            await db.SavedAddress.create({
              address: normalizedAddress,
              placeId: placeId,
              formattedAddress: placeResult.formatted_address
            });
            console.log(`✅ Saved new address from Google API: ${normalizedAddress}`);
          }
        }
        
        return res.json(placeResult);
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

module.exports = router;

