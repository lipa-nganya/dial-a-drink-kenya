import React, { useState } from 'react';
import { Box } from '@mui/material';
import AdminSidebar from './AdminSidebar';
import AdminTopBar from './AdminTopBar';
import QuickActionsMenu from './QuickActionsMenu';
import { useTheme } from '../contexts/ThemeContext';
import { useMobileView } from '../contexts/MobileViewContext';

const DRAWER_WIDTH = 260;

const AdminLayout = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { colors } = useTheme();
  const { isMobileView } = useMobileView();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleMobileClose = () => {
    setMobileOpen(false);
  };

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        minHeight: '100vh', 
        backgroundColor: colors.background,
        overflowX: isMobileView ? 'hidden' : 'auto',
        maxWidth: isMobileView ? '100vw' : 'none',
        width: isMobileView ? '100vw' : '100%',
      }}
    >
      <AdminTopBar 
        onMenuClick={handleDrawerToggle}
        onSidebarToggle={handleSidebarToggle}
        sidebarOpen={sidebarOpen}
      />
      <AdminSidebar
        open={sidebarOpen}
        onClose={handleSidebarToggle}
        mobileOpen={mobileOpen}
        onMobileClose={handleMobileClose}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: isMobileView ? 1.5 : 3, sm: 3 },
          width: { sm: `calc(100% - ${sidebarOpen ? DRAWER_WIDTH : 0}px)` },
          marginTop: { xs: '56px', sm: '64px' },
          backgroundColor: colors.background,
          minHeight: 'calc(100vh - 64px)',
          transition: 'margin 0.3s ease, width 0.3s ease',
          overflowX: isMobileView ? 'hidden' : 'auto',
          maxWidth: isMobileView ? '100vw' : 'none',
        }}
      >
        {children}
      </Box>
      <QuickActionsMenu />
    </Box>
  );
};

export default AdminLayout;

