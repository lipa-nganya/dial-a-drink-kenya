import React, { useState, useEffect, useCallback } from 'react';
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
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import { ShoppingCart, Menu as MenuIcon, Home, Restaurant, Person, Login, Lightbulb, ReportProblem, PrivacyTip, Description, Phone, Search } from '@mui/icons-material';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useTheme } from '../contexts/ThemeContext';
import { useCustomer } from '../contexts/CustomerContext';
import CategoriesBar from './CategoriesBar';
import { api } from '../services/api';
import { normalizeSlug } from '../utils/slugCanonical';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getTotalItems } = useCart();
  const { isLoggedIn } = useCustomer();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [allDrinks, setAllDrinks] = useState([]);
  const [drinksLoading, setDrinksLoading] = useState(false);
  const muiTheme = useMUITheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const { colors } = useTheme();

  const isOnMenu = location.pathname === '/menu';
  const searchFromUrl = isOnMenu ? (searchParams.get('search') || '') : '';

  useEffect(() => {
    let mounted = true;
    (async () => {
      setDrinksLoading(true);
      try {
        const res = await api.get('/drinks');
        const arr = Array.isArray(res.data) ? res.data : [];
        if (mounted) setAllDrinks(arr);
      } catch {
        if (mounted) setAllDrinks([]);
      } finally {
        if (mounted) setDrinksLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const navigateToDrink = useCallback((drink) => {
    if (!drink) return;
    if (drink.category?.slug && drink.slug) {
      navigate(`/${normalizeSlug(drink.category.slug)}/${normalizeSlug(drink.slug)}`, { state: { drink } });
    } else {
      navigate(`/product/${drink.id}`, { state: { drink } });
    }
  }, [navigate]);

  const searchInputValue = isOnMenu ? searchFromUrl : searchInput;

  const handleSearchInputChange = useCallback((event, newInputValue, reason) => {
    if (reason === 'reset') return;
    const v = newInputValue ?? '';
    if (!isOnMenu) {
      setSearchInput(v);
    }
    if (isOnMenu) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (v.trim()) next.set('search', v);
        else next.delete('search');
        return next;
      });
    }
  }, [isOnMenu, setSearchParams]);

  const handleSearchSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const q = searchInputValue;
    if (q.trim()) {
      navigate(`/menu?search=${encodeURIComponent(q.trim())}`);
      if (!isOnMenu) setSearchInput('');
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
            primary="My Orders" 
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
            <Box sx={{ display: 'flex', gap: { md: 0.25, lg: 0.5 }, alignItems: 'center', flexWrap: 'nowrap' }}>
              {/* Search in main nav - desktop (wider + live drink name suggestions) */}
              <Box
                component="form"
                onSubmit={handleSearchSubmit}
                sx={{
                  display: { md: 'none', lg: 'flex' },
                  alignItems: 'center',
                  mr: 0.5,
                  minWidth: { lg: 220, xl: 260 },
                  maxWidth: { lg: 320, xl: 380 },
                  flex: { lg: '0 1 300px', xl: '0 1 340px' }
                }}
              >
                <Autocomplete
                  freeSolo
                  fullWidth
                  options={allDrinks}
                  loading={drinksLoading}
                  filterOptions={(options, { inputValue }) => {
                    const q = inputValue.trim().toLowerCase();
                    if (!q) return [];
                    return options
                      .filter((o) => o && o.name && o.name.toLowerCase().includes(q))
                      .slice(0, 20);
                  }}
                  getOptionLabel={(option) => (typeof option === 'string' ? option : option?.name || '')}
                  isOptionEqualToValue={(a, b) => a?.id === b?.id}
                  inputValue={searchInputValue}
                  onInputChange={handleSearchInputChange}
                  onChange={(e, newValue) => {
                    if (newValue && typeof newValue === 'object') {
                      navigateToDrink(newValue);
                    }
                  }}
                  noOptionsText="No matching drink names"
                  ListboxProps={{ style: { maxHeight: 280 } }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      name="drink-search-desktop"
                      size="small"
                      placeholder="Search drinks..."
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: colors.background || 'rgba(0,0,0,0.04)',
                          borderRadius: 2,
                          fontSize: '0.85rem',
                          '& fieldset': { borderColor: 'rgba(0,0,0,0.12)' },
                        },
                      }}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <>
                            <InputAdornment position="start">
                              <Search sx={{ color: colors.textSecondary || '#666', fontSize: '1.2rem' }} />
                            </InputAdornment>
                            {params.InputProps.startAdornment}
                          </>
                        ),
                        endAdornment: (
                          <>
                            {drinksLoading ? <CircularProgress color="inherit" size={16} sx={{ mr: 0.5 }} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
              </Box>
              <Button
                color="inherit"
                onClick={() => navigate('/')}
                sx={{ textTransform: 'none', fontSize: '0.85rem', py: 0.5, px: 0.8, whiteSpace: 'nowrap' }}
              >
                Home
              </Button>
              <Button
                color="inherit"
                onClick={() => navigate('/menu')}
                sx={{ textTransform: 'none', fontSize: '0.85rem', py: 0.5, px: 0.8, whiteSpace: 'nowrap' }}
              >
                Menu
              </Button>
              <Button
                color="inherit"
                onClick={() => navigate(isLoggedIn ? '/orders' : '/login')}
                sx={{ textTransform: 'none', fontSize: '0.85rem', py: 0.5, px: 0.8, whiteSpace: 'nowrap' }}
              >
                My Orders
              </Button>
              {isLoggedIn ? (
                <Button
                  color="inherit"
                  onClick={() => navigate('/profile')}
                  sx={{ textTransform: 'none', fontSize: '0.85rem', py: 0.5, px: 0.8, whiteSpace: 'nowrap' }}
                  startIcon={<Person />}
                >
                  Profile
                </Button>
              ) : (
                <Button
                  color="inherit"
                  onClick={() => navigate('/login')}
                  sx={{ textTransform: 'none', fontSize: '0.85rem', py: 0.5, px: 0.8, whiteSpace: 'nowrap' }}
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
                sx={{ textTransform: 'none', fontSize: '0.85rem', py: 0.5, px: 0.8, color: colors.textPrimary, whiteSpace: 'nowrap' }}
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
                  fontSize: { md: '0.75rem', lg: '0.8rem' },
                  py: 0.5, 
                  color: colors.textPrimary,
                  ml: 0.5,
                  px: 0.6,
                  whiteSpace: 'nowrap',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.05)'
                  }
                }}
              >
                <Box component="span" sx={{ display: { md: 'none', xl: 'inline' } }}>
                  +254 723 688 108
                </Box>
                <Box component="span" sx={{ display: { md: 'inline', xl: 'none' } }}>
                  0723 688 108
                </Box>
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

        {/* Mobile: full-width search above category chips (not inside hamburger menu) */}
        {isMobile && (
          <Box
            sx={{
              px: 2,
              py: 1,
              width: '100%',
              boxSizing: 'border-box',
              borderTop: '1px solid rgba(0, 0, 0, 0.06)',
              backgroundColor: colors.paper,
            }}
          >
            <Box component="form" onSubmit={handleSearchSubmit} sx={{ width: '100%' }}>
              <Autocomplete
                freeSolo
                fullWidth
                options={allDrinks}
                loading={drinksLoading}
                filterOptions={(options, { inputValue }) => {
                  const q = inputValue.trim().toLowerCase();
                  if (!q) return [];
                  return options
                    .filter((o) => o && o.name && o.name.toLowerCase().includes(q))
                    .slice(0, 20);
                }}
                getOptionLabel={(option) => (typeof option === 'string' ? option : option?.name || '')}
                isOptionEqualToValue={(a, b) => a?.id === b?.id}
                inputValue={searchInputValue}
                onInputChange={handleSearchInputChange}
                onChange={(e, newValue) => {
                  if (newValue && typeof newValue === 'object') {
                    navigateToDrink(newValue);
                  }
                }}
                noOptionsText="No matching drink names"
                ListboxProps={{ style: { maxHeight: 280 } }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    name="drink-search-mobile"
                    size="small"
                    placeholder="Search drinks..."
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: colors.background || 'rgba(0,0,0,0.06)',
                        borderRadius: 2,
                        fontSize: '0.95rem',
                      },
                    }}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <InputAdornment position="start">
                            <Search sx={{ color: colors.textSecondary || '#666', fontSize: '1.25rem' }} />
                          </InputAdornment>
                          {params.InputProps.startAdornment}
                        </>
                      ),
                      endAdornment: (
                        <>
                          {drinksLoading ? <CircularProgress color="inherit" size={18} sx={{ mr: 0.5 }} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Box>
          </Box>
        )}

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

