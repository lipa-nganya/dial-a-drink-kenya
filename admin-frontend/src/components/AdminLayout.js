import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import AdminSidebar from './AdminSidebar';
import AdminAccessPaywallScreen from './AdminAccessPaywallScreen';
import AdminTopBar from './AdminTopBar';
import QuickActionsMenu from './QuickActionsMenu';
import { useTheme } from '../contexts/ThemeContext';
import { useMobileView } from '../contexts/MobileViewContext';
import { api } from '../services/api';

function getStoredAdminRole() {
  try {
    const raw = localStorage.getItem('adminUser');
    if (!raw) return null;
    const u = JSON.parse(raw);
    return u?.role || null;
  } catch {
    return null;
  }
}

const DRAWER_WIDTH = 220;

const AdminLayout = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paywallBlocked, setPaywallBlocked] = useState(false);
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

  /** @returns {Promise<boolean>} true if paywall is still active for this user */
  const refreshPaywall = async () => {
    const role = getStoredAdminRole();
    if (role === 'super_super_admin') {
      setPaywallBlocked(false);
      return false;
    }
    try {
      const res = await api.get('/settings/adminAccessPaywall');
      const on = String(res.data?.value || '').toLowerCase() === 'true';
      setPaywallBlocked(on);
      return on;
    } catch {
      setPaywallBlocked(false);
      return false;
    }
  };

  useEffect(() => {
    refreshPaywall();
    const id = setInterval(refreshPaywall, 20000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onPaywall = () => setPaywallBlocked(true);
    window.addEventListener('admin-access-paywall', onPaywall);
    return () => window.removeEventListener('admin-access-paywall', onPaywall);
  }, []);

  useEffect(() => {
    const cleanupStaleBackdrop = () => {
      if (typeof document === 'undefined') return;

      const visibleBackdropExists = Array.from(document.querySelectorAll('.MuiBackdrop-root'))
        .some((el) => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0;
        });

      if (!visibleBackdropExists) return;

      const visibleModalContentExists = Array.from(
        document.querySelectorAll('.MuiDialog-paper, .MuiMenu-paper, .MuiPopover-paper')
      ).some((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0;
      });

      if (visibleBackdropExists && !visibleModalContentExists) {
        document.querySelectorAll('.MuiBackdrop-root').forEach((el) => el.remove());
        document.body.classList.remove('MuiModal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      }
    };

    const intervalId = setInterval(cleanupStaleBackdrop, 1000);
    cleanupStaleBackdrop();
    return () => clearInterval(intervalId);
  }, []);

  return (
    <>
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
      {paywallBlocked && <AdminAccessPaywallScreen onRetry={refreshPaywall} />}
    </>
  );
};

export default AdminLayout;

