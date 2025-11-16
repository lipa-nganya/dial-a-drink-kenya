import React, { useState, useEffect, useRef } from 'react';
import { TextField, Autocomplete, CircularProgress } from '@mui/material';
import { api } from '../services/api';

const AddressAutocomplete = ({
  value,
  onChange,
  onPlaceSelect,
  label,
  InputProps: externalInputProps = {},
  ...props
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Fetch suggestions from backend (which proxies Google Places API)
  const fetchSuggestions = async (input) => {
    if (!input || input.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.post('/places/autocomplete', {
        input: input
      });

      if (response.data && response.data.suggestions && response.data.suggestions.length > 0) {
        setSuggestions(response.data.suggestions);
        setOpen(true); // Open dropdown when suggestions are available
      } else {
        setSuggestions([]);
        setOpen(false);
      }
    } catch (error) {
      console.error('Error fetching address suggestions:', error);
      // Fallback: if API fails, just show empty suggestions (user can type manually)
      setSuggestions([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  const handleInputChange = (newValue) => {
    setInputValue(newValue);
    
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Update parent component immediately for typing
    if (onChange) {
      onChange({ target: { value: newValue } });
    }

    // Debounce API calls
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };
        
  // Handle selection from autocomplete
  const handleSelection = async (event, selectedOption) => {
    if (!selectedOption) {
      return;
    }
        
    const selectedText = typeof selectedOption === 'string' 
      ? selectedOption 
      : (selectedOption.description || '');
    
    setInputValue(selectedText);
    setOpen(false);
    setSuggestions([]);
        
    // Update parent component immediately with selected text
    if (onChange) {
      onChange({ target: { value: selectedText } });
    }
        
    // Check if description contains a Plus Code
    const plusCodePattern = /^[A-Z0-9]{2,}\+[A-Z0-9]+/;
    const descriptionIsPlusCode = selectedOption.description && 
      plusCodePattern.test(selectedOption.description.split(',')[0].trim());
    
    // If we have a placeId and the description is not a Plus Code, fetch full details
    // Otherwise, use the description directly (it's usually the best formatted address)
    if (selectedOption.placeId && descriptionIsPlusCode) {
      // Description is a Plus Code, fetch details to build proper address
      try {
        const response = await api.get(`/places/details/${selectedOption.placeId}`);

        if (response.data) {
          const placeData = response.data;
          
          // Use the formatted_address from backend (which handles Plus Code conversion)
          const fullAddress = placeData.formatted_address || selectedText;
          
          // Save address to database (if not already from database)
          if (!selectedOption.fromDatabase && fullAddress) {
            try {
              await api.post('/places/save', {
                address: fullAddress,
                placeId: selectedOption.placeId,
                formattedAddress: fullAddress
              });
            } catch (saveError) {
              console.error('Error saving address:', saveError);
              // Don't block user flow if save fails
            }
          }
          
          // Update with full address
          setInputValue(fullAddress);
          if (onChange) {
            onChange({ target: { value: fullAddress } });
          }

          // Call onPlaceSelect if provided
          if (onPlaceSelect) {
            onPlaceSelect(placeData);
          }
        }
      } catch (error) {
        console.error('Error fetching place details:', error);
        // Fallback to description even if it's a Plus Code
        setInputValue(selectedText);
        if (onChange) {
          onChange({ target: { value: selectedText } });
        }
        if (onPlaceSelect) {
          onPlaceSelect({
            formatted_address: selectedText,
            name: selectedText
          });
        }
      }
    } else {
      // Use the description directly - it's already well-formatted
      // The description from Google Autocomplete is usually the best address format
      setInputValue(selectedText);
      if (onChange) {
        onChange({ target: { value: selectedText } });
      }
            
      // Save address to database (if not already from database)
      if (!selectedOption.fromDatabase && selectedText) {
        api.post('/places/save', {
          address: selectedText,
          placeId: selectedOption.placeId || null,
          formattedAddress: selectedText
        }).catch(saveError => {
          console.error('Error saving address:', saveError);
          // Don't block user flow if save fails
        });
      }

      // Optionally fetch details for additional info (like coordinates) without blocking UI
      if (selectedOption.placeId && onPlaceSelect) {
        api.get(`/places/details/${selectedOption.placeId}`)
          .then(response => {
            if (response.data) {
              onPlaceSelect(response.data);
            }
          })
          .catch(error => {
            console.error('Error fetching place details:', error);
            onPlaceSelect({
              formatted_address: selectedText,
              name: selectedText
            });
          });
      } else if (onPlaceSelect) {
        onPlaceSelect({
          formatted_address: selectedText,
          name: selectedText
        });
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <Autocomplete
      freeSolo
      open={open}
      onOpen={() => {
        if (suggestions.length > 0) {
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
      value={inputValue}
      inputValue={inputValue}
      onInputChange={(event, newInputValue, reason) => {
        if (reason === 'input') {
          handleInputChange(newInputValue);
        }
      }}
      onChange={handleSelection}
      renderInput={(params) => (
        <TextField
          {...params}
          {...props}
          label={label || 'Address *'}
          placeholder={props.placeholder || "Start typing an address..."}
          fullWidth
          size="small"
          helperText={props.helperText}
          onFocus={(e) => {
            // If we have suggestions, open the dropdown when focused
            if (suggestions.length > 0) {
              setOpen(true);
            }
            if (props.onFocus) {
              props.onFocus(e);
            }
          }}
          InputProps={{
            ...params.InputProps,
            ...externalInputProps,
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
        <li {...props} key={option.placeId || option.description || option}>
          {option.description || option}
        </li>
      )}
    />
  );
};

export default AddressAutocomplete;

