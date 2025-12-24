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
  Business,
  Map,
  Analytics,
  AccountBalance,
  Logout
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const ZeusHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('zeusToken');
    localStorage.removeItem('zeusAdmin');
    navigate('/login');
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: <Dashboard /> },
    { path: '/partners', label: 'Partners', icon: <Business /> },
    { path: '/geofences', label: 'Geofences', icon: <Map /> },
    { path: '/usage', label: 'Usage', icon: <Analytics /> },
    { path: '/billing', label: 'Billing', icon: <AccountBalance /> }
  ];

  const admin = JSON.parse(localStorage.getItem('zeusAdmin') || '{}');

  return (
    <AppBar position="static" sx={{ mb: 3 }}>
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 4, fontWeight: 'bold' }}>
          ⚡ Zeus Console
        </Typography>
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
        <Typography variant="body2" sx={{ mr: 2 }}>
          {admin.email}
        </Typography>
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

export default ZeusHeader;






