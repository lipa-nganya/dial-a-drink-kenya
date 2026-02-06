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
} from '@mui/material';
import { ShoppingCart, LocalBar, Menu as MenuIcon, Home, Restaurant, LocalOffer, Person, Login, Lightbulb, ReportProblem, PrivacyTip, Description, Phone, Close } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useTheme } from '../contexts/ThemeContext';
import { useCustomer } from '../contexts/CustomerContext';

const Header = () => {
  const navigate = useNavigate();
  const { getTotalItems } = useCart();
  const { isLoggedIn } = useCustomer();
  const [mobileOpen, setMobileOpen] = useState(false);
  const muiTheme = useMUITheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const { colors } = useTheme();

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
      {/* Elegant Header */}
      <Box sx={{
        background: `linear-gradient(135deg, ${colors.accent || '#20B2AA'} 0%, ${colors.accent || '#20B2AA'}dd 100%)`,
        padding: 3,
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <Box sx={{
          position: 'absolute',
          top: -50,
          right: -50,
          width: 150,
          height: 150,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.1)',
        }} />
        <Box sx={{
          position: 'absolute',
          bottom: -30,
          left: -30,
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.1)',
        }} />
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <LocalBar sx={{ fontSize: '2rem', mr: 1.5 }} />
            <Typography variant="h6" component="div" sx={{ 
              fontWeight: 700,
              fontSize: '1.25rem',
              letterSpacing: '0.5px'
            }}>
              Dial a Drink
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ 
            opacity: 0.9,
            fontSize: '0.85rem',
            ml: 5.5
          }}>
            Kenya
          </Typography>
        </Box>
      </Box>

      {/* Main Navigation */}
      <List sx={{ 
        flex: 1,
        padding: 2,
        '& .MuiListItem-root': {
          borderRadius: 2,
          marginBottom: 0.5,
          paddingLeft: 2,
          paddingRight: 2,
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
          onClick={() => handleNavigation('/offers')}
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
            <LocalOffer sx={{ color: colors.accent || '#20B2AA', fontSize: '1.5rem' }} />
          </ListItemIcon>
          <ListItemText 
            primary="Offers" 
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

