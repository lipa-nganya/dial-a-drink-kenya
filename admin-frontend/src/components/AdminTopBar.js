import React from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Tooltip
} from '@mui/material';
import {
  Menu as MenuIcon,
  DesktopWindows,
  PhoneAndroid
} from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';
import { useMobileView } from '../contexts/MobileViewContext';

const AdminTopBar = ({ onMenuClick, onSidebarToggle, sidebarOpen }) => {
  const { isDarkMode, colors } = useTheme();
  const { isMobileView, toggleMobileView, enableMobileView, isMobileDevice } = useMobileView();

  const handleMenuClick = () => {
    // Enable mobile view when hamburger menu is clicked on mobile
    if (isMobileDevice && !isMobileView) {
      enableMobileView();
    }
    onMenuClick();
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        backgroundColor: colors.paper,
        borderBottom: `1px solid ${colors.border}`,
        boxShadow: `0 2px 8px ${isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
        zIndex: (theme) => theme.zIndex.drawer + 1,
        ml: { sm: sidebarOpen ? '260px' : 0 },
        width: { sm: sidebarOpen ? 'calc(100% - 260px)' : '100%' },
        transition: 'margin 0.3s ease, width 0.3s ease'
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={handleMenuClick}
          sx={{ 
            mr: 2, 
            color: colors.textPrimary,
            display: { xs: 'block', sm: 'none' }
          }}
        >
          <MenuIcon />
        </IconButton>
        <IconButton
          color="inherit"
          aria-label="toggle sidebar"
          edge="start"
          onClick={onSidebarToggle}
          sx={{ 
            mr: 2, 
            color: colors.textPrimary,
            display: { xs: 'none', sm: 'block' }
          }}
        >
          <MenuIcon />
        </IconButton>
        <Typography
          variant="h6"
          noWrap
          component="div"
          sx={{
            flexGrow: 1,
            color: colors.textPrimary,
            fontWeight: 600,
            fontSize: '1.1rem'
          }}
        >
          Admin Panel
        </Typography>
        
        {/* Mobile/Desktop View Toggle - Only show in mobile view */}
        {isMobileView && (
          <Tooltip title={isMobileView ? "Switch to Desktop View" : "Switch to Mobile View"}>
            <IconButton
              color="inherit"
              aria-label="toggle view"
              onClick={toggleMobileView}
              sx={{ 
                color: colors.textPrimary,
                ml: 1
              }}
            >
              <DesktopWindows />
            </IconButton>
          </Tooltip>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default AdminTopBar;

