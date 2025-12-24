import React, { useState, useRef, useEffect } from 'react';
import {
  TextField,
  Autocomplete,
  CircularProgress,
  Box,
  Chip,
  Typography,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Alert
} from '@mui/material';
import {
  LocationOn,
  Delete,
  Add
} from '@mui/icons-material';
import axios from 'axios';

// Create a separate API instance for places (not under /valkyrie/v1)
// Determine API URL based on hostname (same logic as valkyrieApi)
const resolvePlacesApiUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:5001/api';
  }
  
  const hostname = window.location.hostname;
  const isLocalHost = ['localhost', '127.0.0.1'].includes(hostname) || hostname.endsWith('.local');
  const isLanHost = /^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])/.test(hostname || '');
  
  if (isLocalHost || isLanHost) {
    return 'http://localhost:5001/api';
  }
  
  const explicitUrl = process.env.REACT_APP_VALKYRIE_API_URL;
  if (explicitUrl) {
    return explicitUrl.replace('/valkyrie/v1', '');
  }
  
  return 'https://dialadrink-backend-910510650031.us-central1.run.app/api';
};

const placesApi = axios.create({
  baseURL: resolvePlacesApiUrl(),
  headers: {
    'Content-Type': 'application/json'
  }
});

const LocationSelector = ({ onLocationsChange, selectedLocations = [] }) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceTimerRef = useRef(null);
  const selectedLocationsRef = useRef(selectedLocations);
  
  // Keep ref in sync with prop
  useEffect(() => {
    selectedLocationsRef.current = selectedLocations;
  }, [selectedLocations]);

  // Fetch suggestions from backend
  const fetchSuggestions = async (input) => {
    if (!input || input.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    
    setLoading(true);
    try {
      const response = await placesApi.post('/places/autocomplete', {
        input: input
      });

      if (response.data && response.data.suggestions && response.data.suggestions.length > 0) {
        setSuggestions(response.data.suggestions);
        // Only open if we have suggestions and input is still valid
        if (input && input.length >= 2) {
          setOpen(true);
        }
      } else {
        setSuggestions([]);
        setOpen(false);
      }
    } catch (error) {
      console.error('Error fetching address suggestions:', error);
      setSuggestions([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  const handleInputChange = (newValue) => {
    setInputValue(newValue);
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (newValue && newValue.length >= 2) {
        fetchSuggestions(newValue);
      } else {
        setSuggestions([]);
        setOpen(false);
      }
    }, 300);
  };

  const handleSelection = async (event, selectedOption) => {
    if (!selectedOption || typeof selectedOption === 'string') {
      return;
    }

    // Fetch place details to get coordinates
    try {
      const detailsResponse = await placesApi.get(`/places/details/${selectedOption.placeId}`);
      const placeData = detailsResponse.data;

      // Handle different response formats and extract coordinates
      let lat, lng;
      
      if (placeData && placeData.geometry) {
        // Standard Google Places API format
        if (placeData.geometry.location) {
          lat = placeData.geometry.location.lat;
          lng = placeData.geometry.location.lng;
        } else if (placeData.geometry.lat && placeData.geometry.lng) {
          lat = placeData.geometry.lat;
          lng = placeData.geometry.lng;
        }
      }
      
      // Fallback to direct properties
      if (!lat || !lng) {
        if (placeData.latitude && placeData.longitude) {
          lat = placeData.latitude;
          lng = placeData.longitude;
        } else if (placeData.lat && placeData.lng) {
          lat = placeData.lat;
          lng = placeData.lng;
        }
      }

      if (lat && lng) {
        const newLocation = {
          placeId: selectedOption.placeId,
          description: selectedOption.description || placeData.formatted_address || placeData.name,
          coordinates: {
            lat: lat,
            lng: lng
          },
          formattedAddress: placeData.formatted_address || placeData.name || selectedOption.description
        };

        if (onLocationsChange) {
          // Use ref to get the latest selectedLocations value
          const currentLocations = selectedLocationsRef.current;
          
          // Check if location is already selected
          const isDuplicate = currentLocations.some(
            loc => loc.placeId === selectedOption.placeId
          );

          if (isDuplicate) {
            setInputValue('');
            setSuggestions([]);
            setOpen(false);
            return;
          }

          // Add new location to the list using the latest state
          onLocationsChange([...currentLocations, newLocation]);
        }
      } else {
        console.error('Could not extract coordinates from place data:', placeData);
        console.error('Place data structure:', JSON.stringify(placeData, null, 2));
        alert('Failed to get location coordinates. Please try selecting the location again.');
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
    }

    setInputValue('');
    setSuggestions([]);
    setOpen(false);
  };

  const handleRemoveLocation = (placeId) => {
    const updated = selectedLocations.filter(loc => loc.placeId !== placeId);
    if (onLocationsChange) {
      onLocationsChange(updated);
    }
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <Box>
      <Autocomplete
        freeSolo
        open={open && suggestions.length > 0}
        onOpen={() => {
          if (suggestions.length > 0 && inputValue.length >= 2) {
            setOpen(true);
          }
        }}
        onClose={() => setOpen(false)}
        options={suggestions}
        getOptionLabel={(option) => {
          if (typeof option === 'string') return option;
          return option.description || '';
        }}
        loading={loading}
        value={null}
        inputValue={inputValue}
        onInputChange={(event, newInputValue, reason) => {
          // Handle all input changes, not just 'input' reason
          // This ensures the search works when user types
          if (reason === 'input' || reason === 'clear') {
            handleInputChange(newInputValue);
          }
        }}
        onChange={handleSelection}
        filterOptions={(x) => x} // Disable client-side filtering since we're using server-side search
        renderInput={(params) => (
          <TextField
            {...params}
            label="Search for locations"
            placeholder="Start typing an area or location..."
            fullWidth
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props} key={option.placeId}>
            <LocationOn sx={{ mr: 2, color: 'text.secondary' }} />
            <Box>
              <Typography variant="body2">
                {option.structuredFormat?.main_text || option.description}
              </Typography>
              {option.structuredFormat?.secondary_text && (
                <Typography variant="caption" color="text.secondary">
                  {option.structuredFormat.secondary_text}
                </Typography>
              )}
            </Box>
          </Box>
        )}
      />

      {selectedLocations.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Selected Locations ({selectedLocations.length})
          </Typography>
          <Paper variant="outlined" sx={{ p: 1, maxHeight: 200, overflow: 'auto' }}>
            <List dense>
              {selectedLocations.map((location) => (
                <ListItem
                  key={location.placeId}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleRemoveLocation(location.placeId)}
                    >
                      <Delete />
                    </IconButton>
                  }
                >
                  <ListItemIcon>
                    <LocationOn color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={location.description}
                    secondary={location.formattedAddress}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Box>
      )}

      {selectedLocations.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Search and select multiple locations to create your delivery zone. The system will generate a GeoJSON polygon that encompasses all selected areas.
        </Alert>
      )}
    </Box>
  );
};

export default LocationSelector;

