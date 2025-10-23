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
        
        <Typography
          variant="h6"
          color="primary"
          sx={{ fontWeight: 'bold' }}
        >
          KES {Number(drink.price).toFixed(2)}
        </Typography>
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
