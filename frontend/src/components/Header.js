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
  Divider,
  useMediaQuery,
  useTheme as useMUITheme,
  TextField,
  InputAdornment,
} from '@mui/material';
import { ShoppingCart, Menu as MenuIcon, Home, Restaurant, Person, Login, Lightbulb, ReportProblem, PrivacyTip, Description, Phone, Search } from '@mui/icons-material';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useTheme } from '../contexts/ThemeContext';
import { useCustomer } from '../contexts/CustomerContext';
import CategoriesBar from './CategoriesBar';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getTotalItems } = useCart();
  const { isLoggedIn } = useCustomer();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const muiTheme = useMUITheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const { colors } = useTheme();

  const isOnMenu = location.pathname === '/menu';
  const searchFromUrl = isOnMenu ? (searchParams.get('search') || '') : '';

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    if (isOnMenu) {
      const next = new URLSearchParams(searchParams);
      if (value.trim()) next.set('search', value.trim()); else next.delete('search');
      setSearchParams(next);
    }
  };

  const handleSearchSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const q = (isOnMenu ? searchFromUrl : searchInput) || searchInput;
    if (q.trim()) {
      navigate(`/menu?search=${encodeURIComponent(q.trim())}`);
      setSearchInput('');
    } else {
      navigate('/menu');
    }
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavigation = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const drawer = (
    <Box sx={{ 
      width: 280,
      height: '100%',
      minHeight: '100vh',
      backgroundColor: colors.paper,
      color: colors.textPrimary,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <Box sx={{
        padding: 3,
        paddingBottom: 2,
        borderBottom: `1px solid ${colors.textSecondary ? `${colors.textSecondary}20` : 'rgba(0, 0, 0, 0.1)'}`,
      }}>
        <Typography variant="h6" component="div" sx={{ 
          fontWeight: 600,
          fontSize: '1.25rem',
          letterSpacing: '0.5px',
          whiteSpace: 'nowrap',
          color: colors.textPrimary,
        }}>
          Dial a Drink Kenya
        </Typography>
        <Box component="form" onSubmit={(e) => { e.preventDefault(); handleSearchSubmit(e); handleDrawerToggle(); }} sx={{ mt: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search..."
            value={isOnMenu ? searchFromUrl : searchInput}
            onChange={(e) => { setSearchInput(e.target.value); if (location.pathname === '/menu') { const next = new URLSearchParams(searchParams); if (e.target.value.trim()) next.set('search', e.target.value.trim()); else next.delete('search'); setSearchParams(next); } }}
            sx={{
              '& .MuiOutlinedInput-root': { backgroundColor: colors.background || 'rgba(0,0,0,0.06)', borderRadius: 2 },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><Search sx={{ color: colors.textSecondary, fontSize: '1.2rem' }} /></InputAdornment>
              ),
            }}
          />
        </Box>
      </Box>

      {/* Main Navigation */}
      <List sx={{ 
        flex: 1,
        padding: 2,
        '& .MuiListItem-root': {
          borderRadius: 2,
          marginBottom: 1,
          paddingLeft: 2,
          paddingRight: 2,
          minHeight: 48,
          border: 'none',
          boxShadow: 'none',
        }
      }}>
        <ListItem 
          component="button" 
          onClick={() => handleNavigation('/')}
          sx={{ 
            backgroundColor: 'transparent',
            color: colors.textPrimary,
            py: 1.5,
            transition: 'all 0.2s ease',
            '&:hover': { 
              backgroundColor: colors.accent ? `${colors.accent}15` : 'rgba(32, 178, 170, 0.1)',
              transform: 'translateX(4px)',
            }
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <Home sx={{ color: colors.accent || '#20B2AA', fontSize: '1.5rem' }} />
          </ListItemIcon>
          <ListItemText 
            primary="Home" 
            primaryTypographyProps={{
              fontSize: '1rem',
              fontWeight: 500,
            }}
          />
        </ListItem>
        <ListItem 
          component="button" 
          onClick={() => handleNavigation('/menu')}
          sx={{ 
            backgroundColor: 'transparent',
            color: colors.textPrimary,
            py: 1.5,
            transition: 'all 0.2s ease',
            '&:hover': { 
              backgroundColor: colors.accent ? `${colors.accent}15` : 'rgba(32, 178, 170, 0.1)',
              transform: 'translateX(4px)',
            }
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <Restaurant sx={{ color: colors.accent || '#20B2AA', fontSize: '1.5rem' }} />
          </ListItemIcon>
          <ListItemText 
            primary="Menu" 
            primaryTypographyProps={{
              fontSize: '1rem',
              fontWeight: 500,
            }}
          />
        </ListItem>
        <ListItem 
          component="button" 
          onClick={() => handleNavigation('/cart')}
          sx={{ 
            backgroundColor: 'transparent',
            color: colors.textPrimary,
            py: 1.5,
            transition: 'all 0.2s ease',
            '&:hover': { 
              backgroundColor: colors.accent ? `${colors.accent}15` : 'rgba(32, 178, 170, 0.1)',
              transform: 'translateX(4px)',
            }
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <Badge badgeContent={getTotalItems()} color="secondary">
              <ShoppingCart sx={{ color: colors.accent || '#20B2AA', fontSize: '1.5rem' }} />
            </Badge>
          </ListItemIcon>
          <ListItemText 
            primary="Cart" 
            primaryTypographyProps={{
              fontSize: '1rem',
              fontWeight: 500,
            }}
          />
        </ListItem>
        <ListItem 
          component="button" 
          onClick={() => {
            handleNavigation(isLoggedIn ? '/orders' : '/login');
          }}
          sx={{ 
            backgroundColor: 'transparent',
            color: colors.textPrimary,
            py: 1.5,
            transition: 'all 0.2s ease',
            '&:hover': { 
              backgroundColor: colors.accent ? `${colors.accent}15` : 'rgba(32, 178, 170, 0.1)',
              transform: 'translateX(4px)',
            }
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <ShoppingCart sx={{ color: colors.accent || '#20B2AA', fontSize: '1.5rem' }} />
          </ListItemIcon>
          <ListItemText 
            primary="Track My Orders" 
            primaryTypographyProps={{
              fontSize: '1rem',
              fontWeight: 500,
            }}
          />
        </ListItem>

        <Divider sx={{ my: 2, opacity: 0.2 }} />

        {isLoggedIn ? (
          <ListItem 
            component="button" 
            onClick={() => handleNavigation('/profile')}
            sx={{ 
              backgroundColor: 'transparent',
              color: colors.textPrimary,
              py: 1.5,
              transition: 'all 0.2s ease',
              '&:hover': { 
                backgroundColor: colors.accent ? `${colors.accent}15` : 'rgba(32, 178, 170, 0.1)',
                transform: 'translateX(4px)',
              }
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <Person sx={{ color: colors.accent || '#20B2AA', fontSize: '1.5rem' }} />
            </ListItemIcon>
            <ListItemText 
              primary="Profile" 
              primaryTypographyProps={{
                fontSize: '1rem',
                fontWeight: 500,
              }}
            />
          </ListItem>
        ) : (
          <ListItem 
            component="button" 
            onClick={() => handleNavigation('/login')}
            sx={{ 
              backgroundColor: 'transparent',
              color: colors.textPrimary,
              py: 1.5,
              transition: 'all 0.2s ease',
              '&:hover': { 
                backgroundColor: colors.accent ? `${colors.accent}15` : 'rgba(32, 178, 170, 0.1)',
                transform: 'translateX(4px)',
              }
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <Login sx={{ color: colors.accent || '#20B2AA', fontSize: '1.5rem' }} />
            </ListItemIcon>
            <ListItemText 
              primary="Login" 
              primaryTypographyProps={{
                fontSize: '1rem',
                fontWeight: 500,
              }}
            />
          </ListItem>
        )}

        <Divider sx={{ my: 2, opacity: 0.2 }} />

        <ListItem 
          component="button" 
          onClick={() => handleNavigation('/suggest-drink')}
          sx={{ 
            backgroundColor: 'transparent',
            color: colors.textPrimary,
            py: 1.5,
            transition: 'all 0.2s ease',
            '&:hover': { 
              backgroundColor: colors.accent ? `${colors.accent}15` : 'rgba(32, 178, 170, 0.1)',
              transform: 'translateX(4px)',
            }
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <Lightbulb sx={{ color: colors.accent || '#20B2AA', fontSize: '1.5rem' }} />
          </ListItemIcon>
          <ListItemText 
            primary="Suggest a Drink" 
            primaryTypographyProps={{
              fontSize: '0.95rem',
              fontWeight: 400,
            }}
          />
        </ListItem>
        <ListItem 
          component="button" 
          onClick={() => handleNavigation('/report-problem')}
          sx={{ 
            backgroundColor: 'transparent',
            color: colors.textPrimary,
            py: 1.5,
            transition: 'all 0.2s ease',
            '&:hover': { 
              backgroundColor: colors.accent ? `${colors.accent}15` : 'rgba(32, 178, 170, 0.1)',
              transform: 'translateX(4px)',
            }
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <ReportProblem sx={{ color: colors.accent || '#20B2AA', fontSize: '1.5rem' }} />
          </ListItemIcon>
          <ListItemText 
            primary="Report a Problem" 
            primaryTypographyProps={{
              fontSize: '0.95rem',
              fontWeight: 400,
            }}
          />
        </ListItem>

        <Divider sx={{ my: 2, opacity: 0.2 }} />

        <ListItem 
          component="button" 
          onClick={() => handleNavigation('/privacy-policy')}
          sx={{ 
            backgroundColor: 'transparent',
            color: colors.textSecondary || colors.textPrimary,
            py: 1,
            transition: 'all 0.2s ease',
            '&:hover': { 
              backgroundColor: colors.accent ? `${colors.accent}15` : 'rgba(32, 178, 170, 0.1)',
              transform: 'translateX(4px)',
            }
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <PrivacyTip sx={{ color: colors.textSecondary || colors.textPrimary, fontSize: '1.25rem' }} />
          </ListItemIcon>
          <ListItemText 
            primary="Privacy Policy" 
            primaryTypographyProps={{
              fontSize: '0.9rem',
              fontWeight: 400,
            }}
          />
        </ListItem>
        <ListItem 
          component="button" 
          onClick={() => handleNavigation('/terms-of-service')}
          sx={{ 
            backgroundColor: 'transparent',
            color: colors.textSecondary || colors.textPrimary,
            py: 1,
            transition: 'all 0.2s ease',
            '&:hover': { 
              backgroundColor: colors.accent ? `${colors.accent}15` : 'rgba(32, 178, 170, 0.1)',
              transform: 'translateX(4px)',
            }
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <Description sx={{ color: colors.textSecondary || colors.textPrimary, fontSize: '1.25rem' }} />
          </ListItemIcon>
          <ListItemText 
            primary="Terms of Service" 
            primaryTypographyProps={{
              fontSize: '0.9rem',
              fontWeight: 400,
            }}
          />
        </ListItem>
      </List>
    </Box>
  );

  return (
    <>
      <AppBar
        position={isMobile ? 'sticky' : 'fixed'}
        sx={{
          backgroundColor: colors.paper,
          boxShadow: `0 2px 8px rgba(0, 0, 0, 0.1)`,
          top: 0,
          left: 0,
          right: 0
        }}
      >
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
                    color: colors.textPrimary
                  }}
                  onClick={() => navigate('/')}
                >
                  Dial a Drink Kenya
                </Typography>
              </Box>
          
          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {/* Search in main nav - desktop */}
              <Box
                component="form"
                onSubmit={handleSearchSubmit}
                sx={{ display: 'flex', alignItems: 'center', mr: 1 }}
              >
                <TextField
                  size="small"
                  placeholder="Search..."
                  value={isOnMenu ? searchFromUrl : searchInput}
                  onChange={handleSearchChange}
                  onBlur={() => !isOnMenu && setSearchInput((p) => p)}
                  sx={{
                    width: 180,
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: colors.background || 'rgba(0,0,0,0.04)',
                      borderRadius: 2,
                      fontSize: '0.85rem',
                      '& fieldset': { borderColor: 'rgba(0,0,0,0.12)' },
                    },
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ color: colors.textSecondary || '#666', fontSize: '1.2rem' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
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
                onClick={() => navigate(isLoggedIn ? '/orders' : '/login')}
                sx={{ textTransform: 'none', fontSize: '0.85rem', py: 0.5 }}
              >
                Track My Orders
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
              {/* Business Phone Number - Desktop Only */}
              <Button
                component="a"
                href="tel:+254723688108"
                startIcon={<Phone />}
                sx={{ 
                  textTransform: 'none', 
                  fontSize: '0.85rem', 
                  py: 0.5, 
                  color: colors.textPrimary,
                  ml: 1,
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.05)'
                  }
                }}
              >
                +254 723 688 108
              </Button>
            </Box>
          )}
          
          {isMobile && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
        <CategoriesBar />
      </AppBar>
      
      <Drawer
        variant="temporary"
        anchor="left"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true,
          BackdropProps: {
            sx: {
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(4px)',
            }
          }
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { 
            boxSizing: 'border-box', 
            width: 280,
            backgroundColor: colors.paper,
            color: colors.textPrimary,
            backgroundImage: 'none !important',
            background: colors.paper,
            boxShadow: '4px 0 20px rgba(0, 0, 0, 0.15)',
          },
        }}
        PaperProps={{
          sx: {
            backgroundColor: colors.paper,
            color: colors.textPrimary,
            background: colors.paper,
            backgroundImage: 'none !important',
          },
          style: {
            backgroundColor: colors.paper,
            color: colors.textPrimary,
            background: colors.paper,
          },
          className: 'light-drawer',
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
};

export default Header;

