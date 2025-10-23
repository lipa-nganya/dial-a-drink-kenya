import React from 'react';
import { AppBar, Toolbar, Typography, Button, Badge, Box } from '@mui/material';
import { ShoppingCart, LocalBar } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';

const Header = () => {
  const navigate = useNavigate();
  const { getTotalItems } = useCart();

  return (
    <AppBar position="sticky" sx={{ backgroundColor: '#FF6B6B' }}>
      <Toolbar>
        <LocalBar sx={{ mr: 2 }} />
        <Typography
          variant="h6"
          component="div"
          sx={{ flexGrow: 1, cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          Dial A Drink Kenya
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            color="inherit"
            onClick={() => navigate('/')}
            sx={{ textTransform: 'none' }}
          >
            Home
          </Button>
          <Button
            color="inherit"
            onClick={() => navigate('/menu')}
            sx={{ textTransform: 'none' }}
          >
            Menu
          </Button>
          <Button
            color="inherit"
            onClick={() => navigate('/cart')}
            startIcon={
              <Badge badgeContent={getTotalItems()} color="secondary">
                <ShoppingCart />
              </Badge>
            }
            sx={{ textTransform: 'none' }}
          >
            Cart
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
