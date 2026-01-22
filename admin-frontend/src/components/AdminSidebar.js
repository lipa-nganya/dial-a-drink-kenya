import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Divider,
  Badge,
  IconButton
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
  AccountBalance,
  ChevronLeft,
  Psychology,
  AttachMoney
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdmin } from '../contexts/AdminContext';
import { useTheme } from '../contexts/ThemeContext';
import { useEasterEgg } from '../contexts/EasterEggContext';
import ThemeSwitcher from './ThemeSwitcher';

const DRAWER_WIDTH = 260;

const AdminSidebar = ({ open, onClose, mobileOpen, onMobileClose }) => {
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

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Dashboard },
    { path: '/orders', label: 'Orders', icon: Receipt, badge: pendingOrdersCount },
    { path: '/transactions', label: 'Transactions', icon: Receipt },
    { path: '/inventory', label: 'Inventory', icon: Inventory },
    { path: '/payables', label: 'Payables', icon: AccountBalance },
    { path: '/cash-at-hand', label: 'Cash at Hand', icon: AttachMoney },
    // { path: '/pos', label: 'POS', icon: PointOfSale }, // Removed
    { path: '/admin/customers', label: 'Customers', icon: People },
    { path: '/drivers', label: 'Riders', icon: LocalShipping },
    { path: '/branches', label: 'Branches', icon: Store },
    // { path: '/territories', label: 'Territories', icon: Map }, // Hidden
    { path: '/copilot', label: 'Copilot', icon: Psychology },
    ...(isEasterEggActive ? [{ path: '/save-the-fishes', label: 'Save the Fishes', icon: LocalFlorist }] : []),
    { path: '/settings', label: 'Settings', icon: SettingsIcon }
  ];

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${colors.border}`,
          minHeight: 64
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Dashboard sx={{ color: colors.accentText, fontSize: 28 }} />
          <Typography
            variant="h6"
            sx={{
              color: colors.accentText,
              fontWeight: 700,
              fontSize: '1.1rem',
              cursor: 'pointer'
            }}
            onClick={() => navigate('/dashboard')}
          >
            Dial a Drink
          </Typography>
        </Box>
        {onClose && open && (
          <IconButton
            onClick={onClose}
            sx={{
              color: colors.textSecondary,
              display: { xs: 'none', sm: 'flex' }
            }}
          >
            <ChevronLeft />
          </IconButton>
        )}
      </Box>

      {/* Menu Items */}
      <List sx={{ flexGrow: 1, pt: 1, px: 1 }}>
        {menuItems.map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  if (onMobileClose) onMobileClose();
                }}
                sx={{
                  borderRadius: 1,
                  backgroundColor: active
                    ? isDarkMode
                      ? 'rgba(0, 224, 184, 0.15)'
                      : 'rgba(0, 224, 184, 0.1)'
                    : 'transparent',
                  color: active
                    ? colors.accentText
                    : colors.textPrimary,
                  borderLeft: active ? `3px solid ${colors.accentText}` : '3px solid transparent',
                  '&:hover': {
                    backgroundColor: isDarkMode
                      ? 'rgba(0, 224, 184, 0.1)'
                      : 'rgba(0, 224, 184, 0.05)',
                    borderLeft: `3px solid ${colors.accentText}`
                  },
                  py: 1.5,
                  px: 2
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: active ? colors.accentText : colors.textSecondary
                  }}
                >
                  {item.badge ? (
                    <Badge badgeContent={item.badge} color="error" max={99}>
                      <Icon />
                    </Badge>
                  ) : (
                    <Icon />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.9rem',
                    fontWeight: active ? 600 : 400
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: colors.border }} />

      {/* Footer - User Info and Actions */}
      <Box sx={{ p: 2 }}>
        <Box sx={{ mb: 2, pb: 2, borderBottom: `1px solid ${colors.border}` }}>
          <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
            Logged in as
          </Typography>
          <Typography variant="body2" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
            {user?.username || 'User'}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <ThemeSwitcher />
        </Box>

        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: 1,
            color: colors.error,
            py: 1.5,
            px: 2,
            '&:hover': {
              backgroundColor: 'rgba(255, 51, 102, 0.1)'
            }
          }}
        >
          <ListItemIcon sx={{ minWidth: 40, color: colors.error }}>
            <Logout />
          </ListItemIcon>
          <ListItemText
            primary="Logout"
            primaryTypographyProps={{
              fontSize: '0.9rem',
              fontWeight: 500
            }}
          />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{
          keepMounted: true // Better open performance on mobile
        }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: DRAWER_WIDTH,
            backgroundColor: colors.paper,
            borderRight: `1px solid ${colors.border}`,
            color: colors.textPrimary
          }
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop Drawer */}
      <Drawer
        variant="persistent"
        open={open}
        sx={{
          display: { xs: 'none', sm: 'block' },
          width: open ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            backgroundColor: colors.paper,
            borderRight: `1px solid ${colors.border}`,
            color: colors.textPrimary,
            transition: 'width 0.3s ease'
          }
        }}
      >
        {drawerContent}
      </Drawer>
    </>
  );
};

export default AdminSidebar;

