import React from 'react';
import {
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  Chip
} from '@mui/material';
import { AddShoppingCart, Star } from '@mui/icons-material';
import { useCart } from '../contexts/CartContext';

const DrinkCard = ({ drink }) => {
  const { addToCart } = useCart();

  const handleAddToCart = () => {
    addToCart(drink, 1);
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

        {/* Capacity Pricing Display */}
        {Array.isArray(drink.capacityPricing) && drink.capacityPricing.length > 0 ? (
          <Box sx={{ mb: 2 }}>
            {drink.capacityPricing.map((pricing, index) => (
              <Box key={index} sx={{ mb: 1, p: 1, backgroundColor: '#121212', borderRadius: 1, border: '1px solid #333' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Chip
                    label={pricing.capacity}
                    size="small"
                    sx={{
                      backgroundColor: '#00E0B8',
                      color: '#0D0D0D',
                      fontSize: '0.7rem',
                      fontWeight: 'bold'
                    }}
                  />
                  {pricing.originalPrice > pricing.currentPrice && (
                    <Chip
                      label={`${Math.round(((pricing.originalPrice - pricing.currentPrice) / pricing.originalPrice) * 100)}% OFF`}
                      size="small"
                      sx={{
                        backgroundColor: '#FF3366',
                        color: '#F5F5F5',
                        fontSize: '0.65rem'
                      }}
                    />
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {pricing.originalPrice > pricing.currentPrice ? (
                    <>
                      <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.secondary', fontSize: '0.75rem' }}>
                        KES {pricing.originalPrice.toFixed(2)}
                      </Typography>
                      <Typography variant="body1" sx={{ color: '#FF3366', fontWeight: 'bold', fontSize: '0.9rem' }}>
                        KES {pricing.currentPrice.toFixed(2)}
                      </Typography>
                    </>
                  ) : (
                    <Typography variant="body1" sx={{ color: '#00E0B8', fontWeight: 'bold', fontSize: '0.9rem' }}>
                      KES {pricing.currentPrice.toFixed(2)}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
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
          Add to Cart
        </Button>
      </CardActions>
    </Card>
  );
};

export default DrinkCard;
