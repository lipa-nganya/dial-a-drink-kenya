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
  Inventory,
  Logout,
  Receipt,
  Settings as SettingsIcon,
  LocalShipping,
  LocalFlorist,
  People,
  Store,
  PointOfSale
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdmin } from '../contexts/AdminContext';
import { useTheme } from '../contexts/ThemeContext';
import { useEasterEgg } from '../contexts/EasterEggContext';
import ThemeSwitcher from './ThemeSwitcher';

const AdminHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { pendingOrdersCount, logout, user } = useAdmin();
  const { isDarkMode, colors } = useTheme();
  const { isEasterEggActive } = useEasterEgg();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => {
    if (path === '/dashboard' && location.pathname === '/dashboard') return true;
    if (path !== '/dashboard' && location.pathname.startsWith(path)) return true;
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
    <AppBar position="sticky" sx={{ backgroundColor: colors.paper, borderBottom: `1px solid ${colors.border}`, boxShadow: `0 2px 8px ${isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 0, 0, 0.1)'}` }}>
      <Toolbar>
        <Dashboard sx={{ mr: 1, color: isDarkMode ? colors.accentText : colors.textPrimary }} />
        <Typography 
          variant="h6" 
          component="div" 
          sx={{ flexGrow: 1, color: isDarkMode ? colors.accentText : colors.textPrimary, fontWeight: 700, cursor: 'pointer' }}
          onClick={() => navigate('/dashboard')}
        >
          LiquorOS Admin
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            color="inherit"
            onClick={() => navigate('/dashboard')}
            sx={buttonStyle('/dashboard')}
          >
            Dashboard
          </Button>
          <Button
            color="inherit"
            onClick={() => navigate('/orders')}
            sx={{ ...buttonStyle('/orders'), position: 'relative' }}
          >
            <Badge badgeContent={pendingOrdersCount} color="error" max={99} sx={{ '& .MuiBadge-badge': { right: -8, top: -8 } }}>
              Orders
            </Badge>
          </Button>
          <Button
            color="inherit"
            onClick={() => navigate('/transactions')}
            startIcon={<Receipt />}
            sx={buttonStyle('/transactions')}
          >
            Transactions
          </Button>
          <Button
            color="inherit"
            onClick={() => navigate('/inventory')}
            sx={buttonStyle('/inventory')}
          >
            Inventory
          </Button>
          <Button
            color="inherit"
            onClick={() => navigate('/pos')}
            startIcon={<PointOfSale />}
            sx={buttonStyle('/pos')}
          >
            POS
          </Button>
          <Button
            color="inherit"
            onClick={() => navigate('/admin/customers')}
            startIcon={<People />}
            sx={buttonStyle('/admin/customers')}
          >
            Customers
          </Button>
          <Button
            color="inherit"
            onClick={() => navigate('/drivers')}
            startIcon={<LocalShipping />}
            sx={buttonStyle('/drivers')}
          >
            Drivers
          </Button>
          <Button
            color="inherit"
            onClick={() => navigate('/branches')}
            startIcon={<Store />}
            sx={buttonStyle('/branches')}
          >
            Branches
          </Button>
          {isEasterEggActive && (
            <Button
              color="inherit"
              onClick={() => navigate('/save-the-fishes')}
              startIcon={<LocalFlorist />}
              sx={buttonStyle('/save-the-fishes')}
            >
              Save the Fishes
            </Button>
          )}
          <Button
            color="inherit"
            onClick={() => navigate('/settings')}
            startIcon={<SettingsIcon />}
            sx={buttonStyle('/settings')}
          >
            Settings
          </Button>
          <ThemeSwitcher />
        </Box>
      </Toolbar>
      {/* User Info and Logout Section */}
      <Box sx={{ 
        px: 2, 
        py: 1, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        backgroundColor: colors.paper,
        borderTop: `1px solid ${colors.border}`
      }}>
        <Typography variant="body2" sx={{ color: colors.textSecondary }}>
          Logged in as <strong style={{ color: colors.textPrimary }}>{user?.username || 'User'}</strong>
        </Typography>
        <Button
          color="inherit"
          startIcon={<Logout />}
          onClick={handleLogout}
          size="small"
          sx={{ 
            textTransform: 'none', 
            fontSize: '0.85rem',
            color: colors.textPrimary,
            '&:hover': {
              backgroundColor: 'rgba(255, 51, 102, 0.2)',
              color: colors.error
            }
          }}
        >
          Logout
        </Button>
      </Box>
    </AppBar>
  );
};

export default AdminHeader;

