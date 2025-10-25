import React, { useState } from 'react';
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
  FormControl
} from '@mui/material';
import { AddShoppingCart, Star } from '@mui/icons-material';
import { useCart } from '../contexts/CartContext';

const DrinkCard = ({ drink }) => {
  const { addToCart } = useCart();
  const [selectedCapacity, setSelectedCapacity] = useState('');

  // Get available capacities from capacityPricing or fallback to capacity array
  const availableCapacities = Array.isArray(drink.capacityPricing) && drink.capacityPricing.length > 0 
    ? drink.capacityPricing.map(pricing => pricing.capacity)
    : Array.isArray(drink.capacity) && drink.capacity.length > 0 
    ? drink.capacity 
    : [];

  // Get price for selected capacity
  const getPriceForCapacity = (capacity) => {
    if (Array.isArray(drink.capacityPricing) && drink.capacityPricing.length > 0) {
      const pricing = drink.capacityPricing.find(p => p.capacity === capacity);
      return pricing ? pricing.currentPrice : drink.price;
    }
    return drink.price;
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
        maxWidth: 300,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4
        }
      }}
    >
      <CardMedia
        component="img"
        height="200"
        image={drink.image}
        alt={drink.name}
        sx={{ objectFit: 'cover' }}
      />
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {drink.name}
          </Typography>
          {drink.isPopular && (
            <Chip
              icon={<Star />}
              label="Popular"
              size="small"
              color="secondary"
              sx={{ ml: 1 }}
            />
          )}
        </Box>
        
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2, minHeight: '40px' }}
        >
          {drink.description}
        </Typography>

        {/* Capacity Selection with Radio Buttons */}
        {availableCapacities.length > 0 ? (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ color: '#00E0B8', fontWeight: 'bold', mb: 1 }}>
              Select Capacity:
            </Typography>
            <FormControl component="fieldset">
              <RadioGroup
                value={selectedCapacity}
                onChange={(e) => setSelectedCapacity(e.target.value)}
                sx={{ gap: 1 }}
              >
                {availableCapacities.map((capacity) => {
                  const pricing = Array.isArray(drink.capacityPricing) 
                    ? drink.capacityPricing.find(p => p.capacity === capacity)
                    : null;
                  const price = pricing ? pricing.currentPrice : drink.price;
                  const originalPrice = pricing ? pricing.originalPrice : drink.originalPrice;
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
                            color: '#00E0B8',
                            '&.Mui-checked': { color: '#00E0B8' }
                          }} 
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', ml: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                              {capacity}
                            </Typography>
                            {discount > 0 && (
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
                            )}
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {originalPrice && originalPrice > price ? (
                              <>
                                <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.secondary', fontSize: '0.75rem' }}>
                                  KES {originalPrice.toFixed(2)}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#FF3366', fontWeight: 'bold' }}>
                                  KES {price.toFixed(2)}
                                </Typography>
                              </>
                            ) : (
                              <Typography variant="body2" sx={{ color: '#00E0B8', fontWeight: 'bold' }}>
                                KES {price.toFixed(2)}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      }
                      sx={{
                        border: selectedCapacity === capacity ? '1px solid #00E0B8' : '1px solid #333',
                        borderRadius: 1,
                        backgroundColor: selectedCapacity === capacity ? '#121212' : 'transparent',
                        p: 1,
                        m: 0,
                        '&:hover': {
                          backgroundColor: '#1a1a1a'
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
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="h6"
              color="primary"
              sx={{ fontWeight: 'bold' }}
            >
              KES {Number(drink.price).toFixed(2)}
            </Typography>
          </Box>
        )}

        {/* ABV Display */}
        {drink.abv && (
          <Box sx={{ mb: 2 }}>
            <Chip
              label={`${Number(drink.abv)}% ABV`}
              size="small"
              sx={{
                backgroundColor: '#FF3366',
                color: '#F5F5F5',
                fontSize: '0.75rem'
              }}
            />
          </Box>
        )}
      </CardContent>
      
      <CardActions>
        <Button
          fullWidth
          variant="contained"
          startIcon={<AddShoppingCart />}
          onClick={handleAddToCart}
          sx={{
            backgroundColor: '#FF6B6B',
            '&:hover': {
              backgroundColor: '#FF5252'
            }
          }}
        >
          {availableCapacities.length > 0 ? 'Add to Cart' : 'Add to Cart'}
        </Button>
      </CardActions>
    </Card>
  );
};

export default DrinkCard;
