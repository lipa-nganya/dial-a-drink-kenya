/* eslint-disable react-hooks/exhaustive-deps */
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
  IconButton,
  Tooltip
} from '@mui/material';
import {
  AddShoppingCart,
  Star,
  Cancel,
  LocalOffer,
  LocalBar,
  Share
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useTheme } from '../contexts/ThemeContext';
import { getBackendUrl } from '../utils/backendUrl';
import { shareProduct } from '../utils/generateShareImage';

const DrinkCard = ({ drink }) => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { colors } = useTheme();
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
      // Replace localhost URLs with backend URL
      if (imagePath.includes('localhost:5001')) {
        const backendUrl = getBackendUrl();
        return imagePath.replace('http://localhost:5001', backendUrl);
      }
      return imagePath;
    }
    
    // For relative paths, construct the full URL using backend URL utility
    const backendUrl = getBackendUrl();
    // Use encodeURI which preserves / characters but encodes spaces and special chars
    // Only encode if the path contains spaces or special characters
    const needsEncoding = /[\s%]/.test(imagePath);
    const finalPath = needsEncoding ? encodeURI(imagePath) : imagePath;
    
    return `${backendUrl}${finalPath}`;
  };

  // Get available capacities from capacityPricing or fallback to capacity array
  const availableCapacities = Array.isArray(drink.capacityPricing) && drink.capacityPricing.length > 0 
    ? drink.capacityPricing.map(pricing => pricing.capacity)
    : Array.isArray(drink.capacity) && drink.capacity.length > 0 
    ? drink.capacity 
    : [];

  // Auto-select capacity: if only one option, select it; if multiple, select most expensive
  useEffect(() => {
    if (availableCapacities.length === 1) {
      // Only one capacity - select it
      setSelectedCapacity(availableCapacities[0]);
    } else if (availableCapacities.length > 1 && !selectedCapacity) {
      // Multiple capacities - select the most expensive one
      const capacitiesWithPrices = availableCapacities.map(capacity => {
        let price = 0;
        if (Array.isArray(drink.capacityPricing) && drink.capacityPricing.length > 0) {
          const pricing = drink.capacityPricing.find(p => String(p.capacity) === String(capacity));
          price = pricing ? parseFloat(pricing.currentPrice) || 0 : parseFloat(drink.price) || 0;
        } else {
          price = parseFloat(drink.price) || 0;
        }
        return { capacity, price };
      });
      
      // Sort descending by price to get most expensive first
      capacitiesWithPrices.sort((a, b) => b.price - a.price);
      
      // Select the most expensive capacity
      const mostExpensive = capacitiesWithPrices[0];
      setSelectedCapacity(mostExpensive.capacity);
      console.log(`[DrinkCard] Auto-selected most expensive capacity for ${drink.name}: ${mostExpensive.capacity} (KES ${mostExpensive.price.toFixed(2)})`);
    } else if (availableCapacities.length === 0) {
      // No capacities - clear selection
      setSelectedCapacity('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableCapacities]);

  // Get price for selected capacity
  const getPriceForCapacity = (capacity) => {
    if (Array.isArray(drink.capacityPricing) && drink.capacityPricing.length > 0) {
      const pricing = drink.capacityPricing.find(p => p.capacity === capacity);
      return pricing ? parseFloat(pricing.currentPrice) || 0 : parseFloat(drink.price) || 0;
    }
    return parseFloat(drink.price) || 0;
  };

  const handleAddToCart = (e) => {
    e.stopPropagation(); // Prevent card click when clicking add to cart
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

  const handleCardClick = () => {
    navigate(`/product/${drink.id}`);
  };

  const handleShare = async (e) => {
    e.stopPropagation(); // Prevent card click when clicking share
    try {
      await shareProduct(drink);
    } catch (error) {
      console.error('Error sharing product:', error);
    }
  };

  return (
    <Card
      onClick={handleCardClick}
      sx={{
        width: '100%',
        maxWidth: '100%',
        height: '100%',
        minHeight: { xs: '350px', sm: '450px', md: '500px' },
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#fff',
        transition: 'transform 0.2s',
        cursor: 'pointer',
        boxSizing: 'border-box',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 2
        }
      }}
    >
      {getImageUrl(drink.image) && !imageError ? (
        <CardMedia
          component="img"
          height="240"
          image={getImageUrl(drink.image)}
          alt={drink.name}
          onClick={handleCardClick}
          sx={{ 
            objectFit: 'contain', 
            p: { xs: 1, sm: 1.5, md: 2 }, 
            backgroundColor: '#fff',
            height: { xs: 140, sm: 180, md: 240 },
            cursor: 'pointer'
          }}
          onError={() => {
            setImageError(true);
          }}
        />
      ) : (
        <Box
          onClick={handleCardClick}
          sx={{
            height: { xs: 140, sm: 180, md: 240 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fff',
            color: '#666',
            cursor: 'pointer'
          }}
        >
          <LocalBar sx={{ fontSize: { xs: 40, sm: 50, md: 60 } }} />
        </Box>
      )}
      <CardContent sx={{ 
        flexGrow: 1, 
        overflow: 'visible', 
        display: 'flex', 
        flexDirection: 'column', 
        backgroundColor: '#fff', 
        pb: availableCapacities.length >= 2 ? 1 : 0,
        px: { xs: 1, sm: 1.5, md: 2 },
        pt: { xs: 1, sm: 1.5, md: 2 }
      }}>
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
        <Typography variant="subtitle1" component="div" sx={{ fontSize: '0.9rem', fontWeight: 'bold', mb: 0.5, color: colors.textPrimary }}>
          {drink.name}
        </Typography>
        
        <Typography
          variant="body2"
          sx={{ 
            mb: { xs: 0.5, sm: 1 }, 
            minHeight: { xs: '20px', sm: '30px' }, 
            fontSize: { xs: '0.7rem', sm: '0.75rem' }, 
            color: colors.textPrimary 
          }}
        >
          {drink.description}
        </Typography>

        {/* Capacity Selection with Radio Buttons */}
        {availableCapacities.length > 0 ? (
          <Box sx={{ mb: availableCapacities.length >= 3 ? 2 : availableCapacities.length > 1 ? 1.5 : 1 }}>
            <FormControl component="fieldset" sx={{ width: '100%' }}>
              <RadioGroup
                value={selectedCapacity}
                onChange={(e) => {
                  e.stopPropagation();
                  setSelectedCapacity(e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                sx={{ gap: 0, width: '100%' }}
              >
                {availableCapacities.map((capacity) => {
                  const pricing = Array.isArray(drink.capacityPricing) 
                    ? drink.capacityPricing.find(p => p.capacity === capacity)
                    : null;
                  const price = pricing ? parseFloat(pricing.currentPrice) || 0 : parseFloat(drink.price) || 0;
                  const originalPrice = pricing ? parseFloat(pricing.originalPrice) || 0 : parseFloat(drink.originalPrice) || 0;
                  // const discount = originalPrice && originalPrice > price 
                  //   ? Math.round(((originalPrice - price) / originalPrice) * 100)
                  //   : 0; // Unused
                  
                  return (
                  <FormControlLabel
                    key={capacity}
                    value={capacity}
                      control={
                        <Radio
                          sx={{
                            color: colors.textPrimary,
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
                            <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.7rem', color: colors.accentText, wordBreak: 'break-word' }}>
                              {capacity}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, flexWrap: 'wrap' }}>
                            {originalPrice && originalPrice > price ? (
                              <>
                                <Typography variant="body2" sx={{ textDecoration: 'line-through', color: '#666', fontSize: '0.65rem' }}>
                                  KES {originalPrice.toFixed(2)}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#FF3366', fontWeight: 'bold', fontSize: '0.7rem' }}>
                                  KES {price.toFixed(2)}
                                </Typography>
                              </>
                            ) : (
                              <Typography variant="body2" sx={{ color: colors.accentText, fontWeight: 'bold', fontSize: '0.7rem' }}>
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
              sx={{ fontWeight: 'bold', fontSize: '0.9rem', color: colors.accentText }}
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

             <CardActions sx={{ p: 0, px: { xs: 0.5, sm: 1 }, pb: { xs: 0.5, sm: 1 }, pt: 0, display: 'flex', gap: 0.5 }}>
        <Tooltip title="Share on social media">
          <IconButton
            size="small"
            onClick={handleShare}
            sx={{
              color: colors.accentText || '#FF6B6B',
              '&:hover': {
                backgroundColor: 'rgba(255, 107, 107, 0.1)'
              }
            }}
          >
            <Share fontSize="small" />
          </IconButton>
        </Tooltip>
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
            flex: 1,
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
