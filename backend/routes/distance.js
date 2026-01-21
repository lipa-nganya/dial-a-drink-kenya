const express = require('express');
const router = express.Router();

// Ensure dotenv is loaded
if (!process.env.GOOGLE_MAPS_API_KEY && !process.env.REACT_APP_GOOGLE_MAPS_API_KEY) {
  try {
    require('dotenv').config();
  } catch (e) {
    // dotenv might already be loaded
  }
}

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

/**
 * POST /api/distance/calculate
 * Calculate road distance between two addresses using Google Distance Matrix API
 */
router.post('/calculate', async (req, res) => {
  try {
    const { origin, destination } = req.body;

    if (!origin || !destination) {
      return res.status(400).json({
        error: 'Origin and destination are required'
      });
    }

    if (!GOOGLE_MAPS_API_KEY) {
      console.warn('⚠️ Google Maps API key not configured. Using Haversine formula as fallback.');
      // Fallback: return null to let caller handle it
      return res.status(503).json({
        error: 'Distance calculation service not configured',
        message: 'Google Maps API key is required for road distance calculation'
      });
    }

    // Use Google Distance Matrix API
    const distanceMatrixUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${GOOGLE_MAPS_API_KEY}&units=metric`;

    try {
      const response = await fetch(distanceMatrixUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'OK') {
        console.error('Google Distance Matrix API error:', data.status, data.error_message);
        return res.status(500).json({
          error: 'Distance calculation failed',
          message: data.error_message || `API returned status: ${data.status}`
        });
      }

      if (data.rows && data.rows[0] && data.rows[0].elements && data.rows[0].elements[0]) {
        const element = data.rows[0].elements[0];
        
        if (element.status === 'OK' && element.distance) {
          const distanceKm = element.distance.value / 1000; // Convert meters to kilometers
          const durationMinutes = element.duration ? Math.round(element.duration.value / 60) : null;

          return res.json({
            success: true,
            distance: parseFloat(distanceKm.toFixed(2)),
            distanceMeters: element.distance.value,
            durationMinutes: durationMinutes,
            durationText: element.duration ? element.duration.text : null
          });
        } else {
          return res.status(500).json({
            error: 'Distance calculation failed',
            message: element.status === 'ZERO_RESULTS' 
              ? 'No route found between origin and destination'
              : `Distance calculation error: ${element.status}`
          });
        }
      }

      return res.status(500).json({
        error: 'Invalid response from Distance Matrix API'
      });

    } catch (apiError) {
      console.error('Error calling Google Distance Matrix API:', apiError);
      return res.status(500).json({
        error: 'Failed to calculate distance',
        message: apiError.message
      });
    }

  } catch (error) {
    console.error('Error in distance calculation endpoint:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;
