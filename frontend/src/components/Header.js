import React, { useState } from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Badge, 
  Box, 
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { ShoppingCart, LocalBar, Menu as MenuIcon, Home, Restaurant, LocalOffer, Assignment, Inventory, Dashboard } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';

const Header = () => {
  const navigate = useNavigate();
  const { getTotalItems } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavigation = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const drawer = (
    <Box sx={{ width: 250 }}>
      <Toolbar>
        <LocalBar sx={{ mr: 2 }} />
        <Typography variant="h6" component="div">
          Dial A Drink Kenya
        </Typography>
      </Toolbar>
      <List>
        <ListItem button onClick={() => handleNavigation('/')}>
          <ListItemIcon>
            <Home />
          </ListItemIcon>
          <ListItemText primary="Home" />
        </ListItem>
        <ListItem button onClick={() => handleNavigation('/menu')}>
          <ListItemIcon>
            <Restaurant />
          </ListItemIcon>
          <ListItemText primary="Menu" />
        </ListItem>
        <ListItem button onClick={() => handleNavigation('/offers')}>
          <ListItemIcon>
            <LocalOffer />
          </ListItemIcon>
          <ListItemText primary="Offers" />
        </ListItem>
        <ListItem button onClick={() => handleNavigation('/cart')}>
          <ListItemIcon>
            <Badge badgeContent={getTotalItems()} color="secondary">
              <ShoppingCart />
            </Badge>
          </ListItemIcon>
          <ListItemText primary="Cart" />
        </ListItem>
        <ListItem button onClick={() => handleNavigation('/admin')}>
          <ListItemIcon>
            <Dashboard />
          </ListItemIcon>
          <ListItemText primary="Admin Dashboard" />
        </ListItem>
        <ListItem button onClick={() => handleNavigation('/admin/orders')}>
          <ListItemIcon>
            <Assignment />
          </ListItemIcon>
          <ListItemText primary="Orders" />
        </ListItem>
        <ListItem button onClick={() => handleNavigation('/admin/inventory')}>
          <ListItemIcon>
            <Inventory />
          </ListItemIcon>
          <ListItemText primary="Inventory" />
        </ListItem>
      </List>
    </Box>
  );

  return (
    <>
      <AppBar position="sticky" sx={{ backgroundColor: '#121212', boxShadow: '0 2px 8px rgba(0, 224, 184, 0.1)' }}>
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          
              <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                <Typography
                  variant="h6"
                  component="div"
                  sx={{ 
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: isMobile ? '1rem' : '1.25rem'
                  }}
                  onClick={() => navigate('/')}
                >
                  {isMobile ? 'Dial A Drink' : 'Dial A Drink Kenya'}
                </Typography>
              </Box>
          
          {!isMobile && (
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
                onClick={() => navigate('/offers')}
                sx={{ textTransform: 'none' }}
              >
                Offers
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
              <Button
                color="inherit"
                onClick={() => navigate('/admin')}
                sx={{ textTransform: 'none' }}
              >
                Admin Dashboard
              </Button>
              <Button
                color="inherit"
                onClick={() => navigate('/admin/orders')}
                sx={{ textTransform: 'none' }}
              >
                Orders
              </Button>
              <Button
                color="inherit"
                onClick={() => navigate('/admin/inventory')}
                sx={{ textTransform: 'none' }}
              >
                Inventory
              </Button>
            </Box>
          )}
          
          {isMobile && (
            <IconButton
              color="inherit"
              onClick={() => navigate('/cart')}
              sx={{ ml: 2 }}
            >
              <Badge badgeContent={getTotalItems()} color="secondary">
                <ShoppingCart />
              </Badge>
            </IconButton>
          )}
        </Toolbar>
      </AppBar>
      
      <Drawer
        variant="temporary"
        anchor="left"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 250 },
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
};

export default Header;

