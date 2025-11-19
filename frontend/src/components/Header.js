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
  useTheme as useMUITheme
} from '@mui/material';
import { ShoppingCart, LocalBar, Menu as MenuIcon, Home, Restaurant, LocalOffer, Person, Login } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useTheme } from '../contexts/ThemeContext';
import { useCustomer } from '../contexts/CustomerContext';
import ThemeSwitcher from './ThemeSwitcher';

const Header = () => {
  const navigate = useNavigate();
  const { getTotalItems } = useCart();
  const { isLoggedIn } = useCustomer();
  const [mobileOpen, setMobileOpen] = useState(false);
  const muiTheme = useMUITheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const { isDarkMode, colors } = useTheme();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavigation = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const drawer = (
    <Box sx={{ 
      width: 220, 
      backgroundColor: isDarkMode ? '#121212' : colors.paper,
      height: '100%',
      minHeight: '100vh',
      color: colors.textPrimary,
    }}>
      <Toolbar sx={{ 
        minHeight: '48px !important',
        backgroundColor: isDarkMode ? '#121212' : colors.paper,
        borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
      }}>
        <LocalBar sx={{ mr: 1, fontSize: '1.2rem', color: colors.textPrimary }} />
        <Typography variant="subtitle1" component="div" sx={{ 
          fontSize: '0.9rem',
          color: colors.textPrimary
        }}>
          LiquorOS
        </Typography>
      </Toolbar>
      <List sx={{ 
        backgroundColor: isDarkMode ? '#121212' : colors.paper,
        color: colors.textPrimary
      }}>
        <ListItem 
          component="button" 
          onClick={() => handleNavigation('/')}
          sx={{ 
            backgroundColor: isDarkMode ? '#121212' : 'transparent',
            color: colors.textPrimary,
            '&:hover': { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }
          }}
        >
          <ListItemIcon>
            <Home sx={{ color: colors.textPrimary }} />
          </ListItemIcon>
          <ListItemText primary="Home" sx={{ color: colors.textPrimary }} />
        </ListItem>
        <ListItem 
          component="button" 
          onClick={() => handleNavigation('/menu')}
          sx={{ 
            backgroundColor: isDarkMode ? '#121212' : 'transparent',
            color: colors.textPrimary,
            '&:hover': { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }
          }}
        >
          <ListItemIcon>
            <Restaurant sx={{ color: colors.textPrimary }} />
          </ListItemIcon>
          <ListItemText primary="Menu" sx={{ color: colors.textPrimary }} />
        </ListItem>
        <ListItem 
          component="button" 
          onClick={() => handleNavigation('/offers')}
          sx={{ 
            backgroundColor: isDarkMode ? '#121212' : 'transparent',
            color: colors.textPrimary,
            '&:hover': { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }
          }}
        >
          <ListItemIcon>
            <LocalOffer sx={{ color: colors.textPrimary }} />
          </ListItemIcon>
          <ListItemText primary="Offers" sx={{ color: colors.textPrimary }} />
        </ListItem>
        <ListItem 
          component="button" 
          onClick={() => handleNavigation('/cart')}
          sx={{ 
            backgroundColor: isDarkMode ? '#121212' : 'transparent',
            color: colors.textPrimary,
            '&:hover': { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }
          }}
        >
          <ListItemIcon>
            <Badge badgeContent={getTotalItems()} color="secondary">
              <ShoppingCart sx={{ color: colors.textPrimary }} />
            </Badge>
          </ListItemIcon>
          <ListItemText primary="Cart" sx={{ color: colors.textPrimary }} />
        </ListItem>
        <ListItem 
          component="button" 
          onClick={() => {
            handleNavigation(isLoggedIn ? '/orders' : '/login');
          }}
          sx={{ 
            backgroundColor: isDarkMode ? '#121212' : 'transparent',
            color: colors.textPrimary,
            '&:hover': { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }
          }}
        >
          <ListItemIcon>
            <ShoppingCart sx={{ color: colors.textPrimary }} />
          </ListItemIcon>
          <ListItemText primary="My Orders" sx={{ color: colors.textPrimary }} />
        </ListItem>
        {isLoggedIn ? (
          <ListItem 
            component="button" 
            onClick={() => handleNavigation('/profile')}
            sx={{ 
              backgroundColor: isDarkMode ? '#121212' : 'transparent',
              color: colors.textPrimary,
              '&:hover': { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }
            }}
          >
            <ListItemIcon>
              <Person sx={{ color: colors.textPrimary }} />
            </ListItemIcon>
            <ListItemText primary="Profile" sx={{ color: colors.textPrimary }} />
          </ListItem>
        ) : (
          <ListItem 
            component="button" 
            onClick={() => handleNavigation('/login')}
            sx={{ 
              backgroundColor: isDarkMode ? '#121212' : 'transparent',
              color: colors.textPrimary,
              '&:hover': { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }
            }}
          >
            <ListItemIcon>
              <Login sx={{ color: colors.textPrimary }} />
            </ListItemIcon>
            <ListItemText primary="Login" sx={{ color: colors.textPrimary }} />
          </ListItem>
        )}
      </List>
    </Box>
  );

  return (
    <>
      <AppBar position="sticky" sx={{ backgroundColor: colors.paper, boxShadow: `0 2px 8px ${isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }}>
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, color: colors.textPrimary }}
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
                    fontSize: isMobile ? '0.9rem' : '1.1rem',
                    color: isDarkMode ? colors.accentText : colors.textPrimary
                  }}
                  onClick={() => navigate('/')}
                >
                  LiquorOS
                </Typography>
              </Box>
          
          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                color="inherit"
                onClick={() => navigate('/')}
                sx={{ textTransform: 'none', fontSize: '0.85rem', py: 0.5 }}
              >
                Home
              </Button>
              <Button
                color="inherit"
                onClick={() => navigate('/menu')}
                sx={{ textTransform: 'none', fontSize: '0.85rem', py: 0.5 }}
              >
                Menu
              </Button>
              <Button
                color="inherit"
                onClick={() => navigate('/offers')}
                sx={{ textTransform: 'none', fontSize: '0.85rem', py: 0.5 }}
              >
                Offers
              </Button>
              <Button
                color="inherit"
                onClick={() => navigate(isLoggedIn ? '/orders' : '/login')}
                sx={{ textTransform: 'none', fontSize: '0.85rem', py: 0.5 }}
              >
                My Orders
              </Button>
              {isLoggedIn ? (
                <Button
                  color="inherit"
                  onClick={() => navigate('/profile')}
                  sx={{ textTransform: 'none', fontSize: '0.85rem', py: 0.5 }}
                  startIcon={<Person />}
                >
                  Profile
                </Button>
              ) : (
                <Button
                  color="inherit"
                  onClick={() => navigate('/login')}
                  sx={{ textTransform: 'none', fontSize: '0.85rem', py: 0.5 }}
                  startIcon={<Login />}
                >
                  Login
                </Button>
              )}
              <Button
                color="inherit"
                onClick={() => navigate('/cart')}
                startIcon={
                  <Badge badgeContent={getTotalItems()} color="secondary">
                    <ShoppingCart />
                  </Badge>
                }
                sx={{ textTransform: 'none', fontSize: '0.85rem', py: 0.5, color: colors.textPrimary }}
              >
                Cart
              </Button>
              <ThemeSwitcher />
            </Box>
          )}
          
          {isMobile && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ThemeSwitcher />
              <IconButton
                color="inherit"
                onClick={() => navigate('/cart')}
                sx={{ color: colors.textPrimary }}
              >
                <Badge badgeContent={getTotalItems()} color="secondary">
                  <ShoppingCart />
                </Badge>
              </IconButton>
            </Box>
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
          '& .MuiDrawer-paper': { 
            boxSizing: 'border-box', 
            width: 250,
            backgroundColor: isDarkMode ? '#121212' : colors.paper,
            color: isDarkMode ? '#F5F5F5' : colors.textPrimary,
            backgroundImage: 'none !important',
            background: isDarkMode ? '#121212' : colors.paper,
          },
        }}
        PaperProps={{
          sx: {
            backgroundColor: isDarkMode ? '#121212' : colors.paper,
            color: isDarkMode ? '#F5F5F5' : colors.textPrimary,
            background: isDarkMode ? '#121212' : colors.paper,
            backgroundImage: 'none !important',
          },
          style: {
            backgroundColor: isDarkMode ? '#121212' : colors.paper,
            color: isDarkMode ? '#F5F5F5' : colors.textPrimary,
            background: isDarkMode ? '#121212' : colors.paper,
          },
          className: isDarkMode ? 'dark-drawer' : 'light-drawer',
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
};

export default Header;

