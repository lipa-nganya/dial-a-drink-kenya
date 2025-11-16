import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Badge
} from '@mui/material';
import {
  Dashboard,
  Assignment,
  Inventory,
  Logout,
  Receipt,
  Notifications,
  LocalShipping,
  Home
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdmin } from '../contexts/AdminContext';
import { useTheme } from '../contexts/ThemeContext';
import ThemeSwitcher from './ThemeSwitcher';

const AdminHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { pendingOrdersCount } = useAdmin();
  const { isDarkMode, colors } = useTheme();

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    navigate('/admin/login');
  };

  const isActive = (path) => {
    if (path === '/admin' && location.pathname === '/admin') return true;
    if (path !== '/admin' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const buttonStyle = (path) => ({
    textTransform: 'none', 
    fontSize: '0.85rem', 
    py: 0.5,
    backgroundColor: isActive(path) ? (isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 0, 0, 0.1)') : 'transparent',
    color: isActive(path) ? (isDarkMode ? colors.accentText : colors.textPrimary) : colors.textPrimary,
    '&:hover': {
      backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.2)' : 'rgba(0, 0, 0, 0.1)'
    }
  });

  return (
    <AppBar position="sticky" sx={{ backgroundColor: colors.paper, borderBottom: `1px solid ${isDarkMode ? '#333' : '#E0E0E0'}`, boxShadow: `0 2px 8px ${isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }}>
      <Toolbar>
        <Dashboard sx={{ mr: 1, color: isDarkMode ? colors.accentText : colors.textPrimary }} />
        <Typography 
          variant="h6" 
          component="div" 
          sx={{ flexGrow: 1, color: isDarkMode ? colors.accentText : colors.textPrimary, fontWeight: 700, cursor: 'pointer' }}
          onClick={() => navigate('/admin')}
        >
          LiquorOS Admin
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            color="inherit"
            onClick={() => navigate('/admin')}
            startIcon={<Dashboard />}
            sx={buttonStyle('/admin')}
          >
            Dashboard
          </Button>
          <Button
            color="inherit"
            onClick={() => navigate('/admin/orders')}
            startIcon={<Assignment />}
            sx={buttonStyle('/admin/orders')}
          >
            <Badge badgeContent={pendingOrdersCount} color="error" max={99}>
              Orders
            </Badge>
          </Button>
          <Button
            color="inherit"
            onClick={() => navigate('/admin/transactions')}
            startIcon={<Receipt />}
            sx={buttonStyle('/admin/transactions')}
          >
            Transactions
          </Button>
          <Button
            color="inherit"
            onClick={() => navigate('/admin/inventory')}
            startIcon={<Inventory />}
            sx={buttonStyle('/admin/inventory')}
          >
            Inventory
          </Button>
          <Button
            color="inherit"
            onClick={() => navigate('/admin/notifications')}
            startIcon={<Notifications />}
            sx={buttonStyle('/admin/notifications')}
          >
            Notifications
          </Button>
          <Button
            color="inherit"
            onClick={() => navigate('/admin/drivers')}
            startIcon={<LocalShipping />}
            sx={buttonStyle('/admin/drivers')}
          >
            Drivers
          </Button>
          <Button
            color="inherit"
            onClick={() => navigate('/')}
            startIcon={<Home />}
            sx={{ 
              textTransform: 'none', 
              fontSize: '0.85rem', 
              py: 0.5,
              ml: 1,
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)'
              }
            }}
          >
            Customer Site
          </Button>
          <Button
            color="inherit"
            startIcon={<Logout />}
            onClick={handleLogout}
            sx={{ 
              textTransform: 'none', 
              fontSize: '0.85rem', 
              py: 0.5,
              ml: 1,
              color: colors.textPrimary,
              '&:hover': {
                backgroundColor: 'rgba(255, 51, 102, 0.2)',
                color: colors.error
              }
            }}
          >
            Logout
          </Button>
          <ThemeSwitcher />
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default AdminHeader;
