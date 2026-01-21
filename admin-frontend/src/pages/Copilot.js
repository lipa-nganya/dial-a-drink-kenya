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
  Assessment,
  Analytics,
  TrendingUp,
  Search,
  AccountBalanceWallet,
  Inventory,
  ShoppingCart
} from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';
import Reports from './copilot/Reports';
import Analysis from './copilot/Analysis';
import Predictions from './copilot/Predictions';
import SEO from './copilot/SEO';
import CashSubmissions from './copilot/CashSubmissions';
import InventoryAnalytics from './copilot/Inventory';
import Sales from './copilot/Sales';

const Copilot = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { colors } = useTheme();

  // Determine current tab based on pathname
  const getCurrentTab = () => {
    const path = location.pathname;
    if (path.includes('/reports')) return 0;
    if (path.includes('/analysis')) return 1;
    if (path.includes('/predictions')) return 2;
    if (path.includes('/seo')) return 3;
    if (path.includes('/cash-submissions')) return 4;
    if (path.includes('/inventory')) return 5;
    if (path.includes('/sales')) return 6;
    return 0; // Default to reports
  };

  const handleTabChange = (event, newValue) => {
    const routes = [
      '/copilot/reports',
      '/copilot/analysis',
      '/copilot/predictions',
      '/copilot/seo',
      '/copilot/cash-submissions',
      '/copilot/inventory',
      '/copilot/sales'
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
          <Tab icon={<Assessment />} iconPosition="start" label="Reports" />
          <Tab icon={<Analytics />} iconPosition="start" label="Analysis" />
          <Tab icon={<TrendingUp />} iconPosition="start" label="Predictions" />
          <Tab icon={<Search />} iconPosition="start" label="SEO" />
          <Tab icon={<AccountBalanceWallet />} iconPosition="start" label="Cash Submissions" />
          <Tab icon={<Inventory />} iconPosition="start" label="Inventory" />
          <Tab icon={<ShoppingCart />} iconPosition="start" label="Sales" />
        </Tabs>
      </Paper>

      <Box>
        <Routes>
          <Route path="reports" element={<Reports />} />
          <Route path="analysis" element={<Analysis />} />
          <Route path="predictions" element={<Predictions />} />
          <Route path="seo" element={<SEO />} />
          <Route path="cash-submissions" element={<CashSubmissions />} />
          <Route path="inventory" element={<InventoryAnalytics />} />
          <Route path="sales" element={<Sales />} />
          <Route index element={<Navigate to="reports" replace />} />
        </Routes>
      </Box>
    </Container>
  );
};

export default Copilot;

