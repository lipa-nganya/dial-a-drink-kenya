import React from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Tabs,
  Tab,
  Paper
} from '@mui/material';
import {
  Search,
  Inventory
} from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';
import SEO from './copilot/SEO';
import InventoryAnalytics from './copilot/Inventory';

const Copilot = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { colors } = useTheme();

  // Determine current tab based on pathname
  const getCurrentTab = () => {
    const path = location.pathname;
    if (path.includes('/inventory')) return 1;
    return 0; // Default to SEO
  };

  const handleTabChange = (event, newValue) => {
    const routes = [
      '/copilot/seo',
      '/copilot/inventory'
    ];
    navigate(routes[newValue]);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1, color: colors.textPrimary }}>
          Copilot
        </Typography>
        <Typography variant="body1" sx={{ color: colors.textSecondary }}>
          AI-powered insights and analytics for your business
        </Typography>
      </Box>

      <Paper sx={{ mb: 3, backgroundColor: colors.paper }}>
        <Tabs
          value={getCurrentTab()}
          onChange={handleTabChange}
          sx={{
            borderBottom: `1px solid ${colors.border}`,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: '0.95rem',
              fontWeight: 500,
              minHeight: 64,
              color: colors.textSecondary,
              '&.Mui-selected': {
                color: colors.accentText,
                fontWeight: 600
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: colors.accentText,
              height: 3
            }
          }}
        >
          <Tab icon={<Search />} iconPosition="start" label="SEO" />
          <Tab icon={<Inventory />} iconPosition="start" label="Inventory" />
        </Tabs>
      </Paper>

      <Box>
        <Routes>
          <Route path="seo" element={<SEO />} />
          <Route path="inventory" element={<InventoryAnalytics />} />
          <Route path="reports" element={<Navigate to="/copilot/seo" replace />} />
          <Route path="analysis" element={<Navigate to="/copilot/seo" replace />} />
          <Route path="predictions" element={<Navigate to="/copilot/seo" replace />} />
          <Route path="cash-submissions" element={<Navigate to="/copilot/seo" replace />} />
          <Route path="sales" element={<Navigate to="/copilot/seo" replace />} />
          <Route index element={<Navigate to="seo" replace />} />
        </Routes>
      </Box>
    </Container>
  );
};

export default Copilot;

