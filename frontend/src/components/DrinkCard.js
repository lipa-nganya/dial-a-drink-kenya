import React, { useState, useEffect } from 'react';
import {
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  Chip,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  Alert
} from '@mui/material';
import {
  AddShoppingCart,
  Star,
  Cancel,
  LocalOffer,
  LocalBar
} from '@mui/icons-material';
import { useCart } from '../contexts/CartContext';
import { useTheme } from '../contexts/ThemeContext';

const DrinkCard = ({ drink }) => {
  const { addToCart } = useCart();
  const { colors, isDarkMode } = useTheme();
  const [selectedCapacity, setSelectedCapacity] = useState('');
  const [imageError, setImageError] = useState(false);

  // Helper function to get full image URL
  const getImageUrl = (imagePath) => {
    if (!imagePath) return '';
    
    // If it's a base64 data URL, return as is
    if (imagePath.startsWith('data:')) {
      return imagePath;
    }
    
    // If it's already a full URL, check if it's localhost and replace
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      // Replace localhost URLs with production backend URL
      if (imagePath.includes('localhost:5001')) {
        const isHosted =
          window.location.hostname.includes('onrender.com') ||
          window.location.hostname.includes('run.app');
        const backendUrl = isHosted
          ? 'https://dialadrink-backend-910510650031.us-central1.run.app'
          : 'http://localhost:5001';
        return imagePath.replace('http://localhost:5001', backendUrl);
      }
      return imagePath;
    }
    
    // For relative paths, construct the full URL
    const isHosted =
      window.location.hostname.includes('onrender.com') ||
      window.location.hostname.includes('run.app');
    const baseUrl = isHosted
      ? 'https://dialadrink-backend-910510650031.us-central1.run.app'
      : 'http://localhost:5001';
    
    // Use encodeURI which preserves / characters but encodes spaces and special chars
    // Only encode if the path contains spaces or special characters
    const needsEncoding = /[\s%]/.test(imagePath);
    const finalPath = needsEncoding ? encodeURI(imagePath) : imagePath;
    
    return `${baseUrl}${finalPath}`;
  };

  // Get available capacities from capacityPricing or fallback to capacity array
  const availableCapacities = Array.isArray(drink.capacityPricing) && drink.capacityPricing.length > 0 
    ? drink.capacityPricing.map(pricing => pricing.capacity)
    : Array.isArray(drink.capacity) && drink.capacity.length > 0 
    ? drink.capacity 
    : [];

  // Auto-select capacity if there's only one option
  useEffect(() => {
    if (availableCapacities.length === 1 && !selectedCapacity) {
      setSelectedCapacity(availableCapacities[0]);
    }
  }, [availableCapacities, selectedCapacity]);

  // Get price for selected capacity
  const getPriceForCapacity = (capacity) => {
    if (Array.isArray(drink.capacityPricing) && drink.capacityPricing.length > 0) {
      const pricing = drink.capacityPricing.find(p => p.capacity === capacity);
      return pricing ? parseFloat(pricing.currentPrice) || 0 : parseFloat(drink.price) || 0;
    }
    return parseFloat(drink.price) || 0;
  };

  const handleAddToCart = () => {
    if (availableCapacities.length > 0 && !selectedCapacity) {
      alert('Please select a capacity first');
      return;
    }
    
    const drinkToAdd = {
      ...drink,
      selectedCapacity: selectedCapacity,
      selectedPrice: selectedCapacity ? getPriceForCapacity(selectedCapacity) : drink.price
    };
    
    addToCart(drinkToAdd, 1);
  };

  return (
    <Card
      sx={{
        width: '100%',
        height: '100%',
        minHeight: '380px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#fff',
        transition: 'transform 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 2
        }
      }}
    >
      {getImageUrl(drink.image) && !imageError ? (
        <CardMedia
          component="img"
          height="120"
          image={getImageUrl(drink.image)}
          alt={drink.name}
          sx={{ objectFit: 'contain', p: 1, backgroundColor: '#fff' }}
          onError={() => {
            setImageError(true);
          }}
        />
      ) : (
        <Box
          sx={{
            height: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fff',
            color: '#666'
          }}
        >
          <LocalBar sx={{ fontSize: 40 }} />
        </Box>
      )}
      <CardContent sx={{ flexGrow: 1, overflow: 'visible', display: 'flex', flexDirection: 'column', backgroundColor: '#fff', pb: availableCapacities.length >= 2 ? 1 : 0 }}>
        {/* Status Label Above Name */}
        <Box sx={{ mb: 0.5, display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
          {!drink.isAvailable && (
            <Chip
              icon={<Cancel />}
              label="Out of Stock"
              size="small"
              sx={{ 
                fontSize: '0.65rem', 
                height: '20px',
                backgroundColor: '#666',
                color: '#F5F5F5'
              }}
            />
          )}
          {drink.isAvailable && drink.isPopular && (
            <Chip
              icon={<Star />}
              label="Popular"
              size="small"
              color="secondary"
              sx={{ fontSize: '0.65rem', height: '20px' }}
            />
          )}
          {drink.limitedTimeOffer && (
            <Chip
              icon={<LocalOffer />}
              label="Limited Time"
              size="small"
              sx={{ 
                fontSize: '0.65rem', 
                height: '20px',
                backgroundColor: '#00E0B8',
                color: '#0D0D0D'
              }}
            />
          )}
        </Box>
        
        {/* Drink Name */}
        <Typography variant="subtitle1" component="div" sx={{ fontSize: '0.9rem', fontWeight: 'bold', mb: 0.5, color: isDarkMode ? '#000000' : colors.textPrimary }}>
          {drink.name}
        </Typography>
        
        <Typography
          variant="body2"
          sx={{ mb: 1, minHeight: '30px', fontSize: '0.75rem', color: isDarkMode ? '#000000' : colors.textPrimary }}
        >
          {drink.description}
        </Typography>

        {/* Capacity Selection with Radio Buttons */}
        {availableCapacities.length > 0 ? (
          <Box sx={{ mb: availableCapacities.length >= 3 ? 2 : availableCapacities.length > 1 ? 1.5 : 1 }}>
            <FormControl component="fieldset" sx={{ width: '100%' }}>
              <RadioGroup
                value={selectedCapacity}
                onChange={(e) => setSelectedCapacity(e.target.value)}
                sx={{ gap: 0, width: '100%' }}
              >
                {availableCapacities.map((capacity) => {
                  const pricing = Array.isArray(drink.capacityPricing) 
                    ? drink.capacityPricing.find(p => p.capacity === capacity)
                    : null;
                  const price = pricing ? parseFloat(pricing.currentPrice) || 0 : parseFloat(drink.price) || 0;
                  const originalPrice = pricing ? parseFloat(pricing.originalPrice) || 0 : parseFloat(drink.originalPrice) || 0;
                  const discount = originalPrice && originalPrice > price 
                    ? Math.round(((originalPrice - price) / originalPrice) * 100)
                    : 0;
                  
                  return (
                  <FormControlLabel
                    key={capacity}
                    value={capacity}
                      control={
                        <Radio
                          sx={{
                            color: isDarkMode ? '#000000' : colors.textPrimary,
                            padding: '4px',
                            marginRight: '4px',
                            '&.Mui-checked': { color: colors.accentText }
                          }}
                        />
                      }
                    label={
                      <Box sx={{ width: '100%', minWidth: 0, flex: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: 0.5, flexWrap: 'wrap' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, flex: 1, flexWrap: 'wrap' }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.7rem', color: isDarkMode ? '#000000' : colors.accentText, wordBreak: 'break-word' }}>
                              {capacity}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, flexWrap: 'wrap' }}>
                            {originalPrice && originalPrice > price ? (
                              <>
                                <Typography variant="body2" sx={{ textDecoration: 'line-through', color: isDarkMode ? '#666666' : '#666', fontSize: '0.65rem' }}>
                                  KES {originalPrice.toFixed(2)}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#FF3366', fontWeight: 'bold', fontSize: '0.7rem' }}>
                                  KES {price.toFixed(2)}
                                </Typography>
                              </>
                            ) : (
                              <Typography variant="body2" sx={{ color: isDarkMode ? '#000000' : colors.accentText, fontWeight: 'bold', fontSize: '0.7rem' }}>
                                KES {price.toFixed(2)}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    }
                    sx={{
                      border: 'none',
                      borderRadius: 1,
                      backgroundColor: selectedCapacity === capacity ? '#f5f5f5' : 'transparent',
                      p: 0.1,
                      m: 0,
                      width: '100%',
                      marginLeft: 0,
                      marginRight: 0,
                      alignItems: 'center',
                      '& .MuiFormControlLabel-label': {
                        marginLeft: '4px',
                        width: '100%'
                      },
                      '&:hover': {
                        backgroundColor: '#f0f0f0'
                      }
                    }}
                  />
                  );
                })}
              </RadioGroup>
            </FormControl>
          </Box>
        ) : (
          /* Fallback to old pricing display */
          <Box sx={{ mb: 1 }}>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 'bold', fontSize: '0.9rem', color: isDarkMode ? '#000000' : colors.accentText }}
            >
              KES {(Number(drink.price) || 0).toFixed(2)}
            </Typography>
          </Box>
        )}

               {/* Discount Badge - Centered above ABV */}
               {(() => {
                 let discount = 0;
                 if (availableCapacities.length > 0 && selectedCapacity) {
                   // Calculate discount for selected capacity
                   const pricing = Array.isArray(drink.capacityPricing) 
                     ? drink.capacityPricing.find(p => p.capacity === selectedCapacity)
                     : null;
                   if (pricing) {
                     const price = parseFloat(pricing.currentPrice) || 0;
                     const originalPrice = parseFloat(pricing.originalPrice) || 0;
                     if (originalPrice && originalPrice > price) {
                       discount = Math.round(((originalPrice - price) / originalPrice) * 100);
                     }
                   }
                 } else {
                   // Calculate discount for overall drink (no capacity selection or no capacities)
                   const originalPrice = parseFloat(drink.originalPrice) || 0;
                   const currentPrice = parseFloat(drink.price) || 0;
                   if (originalPrice && originalPrice > currentPrice) {
                     discount = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
                   }
                 }
                 
                 return discount > 0 ? (
                   <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', mb: drink.abv ? 0.5 : (availableCapacities.length >= 2 ? 1 : 0), mt: 0 }}>
                     <Chip
                       label={`${discount}% OFF`}
                       size="small"
                       sx={{
                         backgroundColor: '#FF3366',
                         color: '#F5F5F5',
                         fontSize: '0.65rem',
                         height: '20px'
                       }}
                     />
                   </Box>
                 ) : null;
               })()}

               {/* ABV Display */}
               {drink.abv && (
                 <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', mb: availableCapacities.length >= 2 ? 1 : 0, mt: 0 }}>
                   <Chip
                     label={`${Number(drink.abv)}% ABV`}
                     size="small"
                     sx={{
                       backgroundColor: '#FF3366',
                       color: '#F5F5F5',
                       fontSize: '0.65rem',
                       height: '20px'
                     }}
                   />
                 </Box>
               )}
             </CardContent>

             <CardActions sx={{ p: 0, px: 1, pb: 1, pt: 0 }}>
        <Button
          fullWidth
          variant="contained"
          size="small"
          startIcon={<AddShoppingCart />}
          onClick={handleAddToCart}
          disabled={!drink.isAvailable}
          sx={{
            backgroundColor: '#FF6B6B',
            fontSize: '0.75rem',
            py: 0.5,
            '&:hover': {
              backgroundColor: '#FF5252'
            },
            '&.Mui-disabled': {
              backgroundColor: '#ccc',
              color: '#666'
            }
          }}
        >
          Add to Cart
        </Button>
      </CardActions>
    </Card>
  );
};

export default DrinkCard;
