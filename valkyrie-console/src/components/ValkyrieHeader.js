import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box
} from '@mui/material';
import {
  Dashboard,
  LocalShipping,
  People,
  Map,
  AccountBalance,
  Code,
  MenuBook,
  Logout
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const ValkyrieHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Get logged-in user email
  const getUserEmail = () => {
    try {
      const userStr = localStorage.getItem('valkyrieUser');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.email || null;
      }
    } catch (err) {
      console.error('Error parsing user data:', err);
    }
    return null;
  };

  // Get partner information
  const getPartnerInfo = () => {
    try {
      const partnerStr = localStorage.getItem('valkyriePartner');
      if (partnerStr) {
        const partner = JSON.parse(partnerStr);
        return {
          name: partner.name || null,
          id: partner.id || null
        };
      }
    } catch (err) {
      console.error('Error parsing partner data:', err);
    }
    return { name: null, id: null };
  };

  const userEmail = getUserEmail();
  const partnerInfo = getPartnerInfo();

  const handleLogout = () => {
    localStorage.removeItem('valkyrieToken');
    localStorage.removeItem('valkyrieUser');
    localStorage.removeItem('valkyriePartner');
    navigate('/login');
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const navItems = [
    { path: '/', label: 'Overview', icon: <Dashboard /> },
    { path: '/guide', label: 'Guide', icon: <MenuBook /> },
    { path: '/orders', label: 'Orders', icon: <LocalShipping /> },
    { path: '/drivers', label: 'Drivers', icon: <People /> },
    { path: '/zones', label: 'Delivery Zones', icon: <Map /> },
    { path: '/billing', label: 'Billing', icon: <AccountBalance /> },
    { path: '/api', label: 'API', icon: <Code /> }
  ];

  return (
    <AppBar position="static" sx={{ mb: 3 }}>
      <Toolbar>
        <Box sx={{ flexGrow: 0, mr: 4 }}>
          <Typography variant="h6" component="div" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
            Valkyrie Console
          </Typography>
          {(partnerInfo.name || partnerInfo.id) && (
            <Typography 
              variant="caption" 
              component="div" 
              sx={{ 
                fontSize: '0.7rem', 
                opacity: 0.8,
                lineHeight: 1.2,
                mt: 0.5
              }}
            >
              {partnerInfo.name && `${partnerInfo.name}`}
              {partnerInfo.name && partnerInfo.id && ' • '}
              {partnerInfo.id && `Partner ID: ${partnerInfo.id}`}
            </Typography>
          )}
        </Box>
        <Box sx={{ flexGrow: 1, display: 'flex', gap: 1 }}>
          {navItems.map((item) => (
            <Button
              key={item.path}
              color="inherit"
              startIcon={item.icon}
              onClick={() => navigate(item.path)}
              sx={{
                backgroundColor: isActive(item.path) ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)'
                }
              }}
            >
              {item.label}
            </Button>
          ))}
        </Box>
        {userEmail && (
          <Typography 
            variant="body2" 
            sx={{ 
              mr: 2, 
              display: { xs: 'none', sm: 'block' },
              opacity: 0.9
            }}
          >
            Logged in as <strong>{userEmail}</strong>
          </Typography>
        )}
        <Button
          color="inherit"
          startIcon={<Logout />}
          onClick={handleLogout}
        >
          Logout
        </Button>
      </Toolbar>
    </AppBar>
  );
};

export default ValkyrieHeader;

