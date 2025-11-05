const express = require('express');
const router = express.Router();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

// Get autocomplete suggestions
router.post('/autocomplete', async (req, res) => {
  try {
    const { input } = req.body;

    if (!input || input.length < 2) {
      return res.json({ suggestions: [] });
    }

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
          structuredFormat: pred.structured_formatting
        }));

        return res.json({ suggestions: formattedSuggestions });
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

// Get place details by placeId
router.get('/details/:placeId', async (req, res) => {
  try {
    const { placeId } = req.params;

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

