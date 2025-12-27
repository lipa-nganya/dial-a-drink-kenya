import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider as MUIThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AdminProvider } from './contexts/AdminContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { EasterEggProvider, useEasterEgg } from './contexts/EasterEggContext';
import AdminHeader from './components/AdminHeader';
import AdminLayout from './components/AdminLayout';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import SetupPassword from './pages/SetupPassword';
import AdminOverview from './pages/AdminOverview';
import Orders from './pages/Orders';
import Inventory from './pages/Inventory';
import Transactions from './pages/Transactions';
import OrderNotifications from './pages/OrderNotifications';
import Drivers from './pages/Drivers';
import Branches from './pages/Branches';
import Territories from './pages/Territories';
import Settings from './pages/Settings';
import SupplierDetail from './pages/SupplierDetail';
import SaveTheFishes from './pages/SaveTheFishes';
import Customers from './pages/Customers';
import POS from './pages/POS';
import Payables from './pages/Payables';
import './App.css';

const getMUITheme = (isDarkMode) => {
  const colors = isDarkMode ? {
    background: '#0D0D0D',
    paper: '#121212',
    textPrimary: '#F5F5F5',
    textSecondary: '#B0B0B0',
    accent: '#00E0B8',
    accentText: '#00E0B8',
    error: '#FF3366',
    errorText: '#F5F5F5',
    border: '#333',
  } : {
    background: '#FFFFFF',
    paper: '#F5F5F5',
    textPrimary: '#000000',
    textSecondary: '#666666',
    accent: '#00E0B8',
    accentText: '#000000',
    error: '#FF3366',
    errorText: '#000000',
    border: '#E0E0E0',
  };

  return createTheme({
    palette: {
      mode: isDarkMode ? 'dark' : 'light',
      primary: {
        main: colors.accent,
      },
      secondary: {
        main: colors.error,
      },
      background: {
        default: colors.background,
        paper: colors.paper,
      },
      text: {
        primary: colors.textPrimary,
        secondary: colors.textSecondary,
      },
      error: {
        main: colors.error,
        contrastText: colors.errorText,
      },
    },
    typography: {
      fontFamily: '"Lato", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: {
        fontFamily: '"Montserrat", "Roboto", "Helvetica", "Arial", sans-serif',
        fontWeight: 700,
        color: colors.textPrimary,
      },
      h2: {
        fontFamily: '"Montserrat", "Roboto", "Helvetica", "Arial", sans-serif',
        fontWeight: 600,
        color: colors.textPrimary,
      },
      h3: {
        fontFamily: '"Montserrat", "Roboto", "Helvetica", "Arial", sans-serif',
        fontWeight: 600,
        color: colors.textPrimary,
      },
      h4: {
        fontFamily: '"Montserrat", "Roboto", "Helvetica", "Arial", sans-serif',
        fontWeight: 500,
        color: colors.textPrimary,
      },
      h5: {
        fontFamily: '"Montserrat", "Roboto", "Helvetica", "Arial", sans-serif',
        fontWeight: 500,
        color: colors.textPrimary,
      },
      h6: {
        fontFamily: '"Montserrat", "Roboto", "Helvetica", "Arial", sans-serif',
        fontWeight: 500,
        color: colors.textPrimary,
      },
      body1: {
        fontFamily: '"Lato", "Roboto", "Helvetica", "Arial", sans-serif',
        color: colors.textPrimary,
      },
      body2: {
        fontFamily: '"Lato", "Roboto", "Helvetica", "Arial", sans-serif',
        color: colors.textSecondary,
      },
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: colors.paper,
            color: colors.textPrimary,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: colors.paper,
            color: colors.textPrimary,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            fontFamily: '"Montserrat", "Roboto", "Helvetica", "Arial", sans-serif',
            fontWeight: 600,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontFamily: '"Montserrat", "Roboto", "Helvetica", "Arial", sans-serif',
            fontWeight: 800,
            fontSize: '0.75rem',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: colors.accent,
            backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : 'rgba(0, 224, 184, 0.2)',
            borderBottom: `2px solid ${colors.accent}`,
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-head': {
              paddingTop: 14,
              paddingBottom: 14,
            },
          },
        },
      },
    },
  });
};

function AppContent() {
  const { isDarkMode } = useTheme();
  const { isEasterEggActive } = useEasterEgg();
  const muiTheme = getMUITheme(isDarkMode);

  return (
    <MUIThemeProvider theme={muiTheme}>
      <CssBaseline />
      <div className="App" style={{ backgroundColor: isDarkMode ? '#0D0D0D' : '#FFFFFF', minHeight: '100vh' }}>
        <AdminProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/setup-password" element={<SetupPassword />} />
              <Route
                path="/dashboard"
                element={
                  <PrivateRoute>
                    <AdminLayout>
                      <AdminOverview />
                    </AdminLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/orders"
                element={
                  <PrivateRoute>
                    <AdminLayout>
                      <Orders />
                    </AdminLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/inventory"
                element={
                  <PrivateRoute>
                    <AdminLayout>
                      <Inventory />
                    </AdminLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/transactions"
                element={
                  <PrivateRoute>
                    <AdminLayout>
                      <Transactions />
                    </AdminLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/drivers"
                element={
                  <PrivateRoute>
                    <AdminLayout>
                      <Drivers />
                    </AdminLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/payables"
                element={
                  <PrivateRoute>
                    <AdminLayout>
                      <Payables />
                    </AdminLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/branches"
                element={
                  <PrivateRoute>
                    <AdminLayout>
                      <Branches />
                    </AdminLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/territories"
                element={
                  <PrivateRoute>
                    <AdminLayout>
                      <Territories />
                    </AdminLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <PrivateRoute>
                    <AdminLayout>
                      <Settings />
                    </AdminLayout>
                  </PrivateRoute>
                }
              />
              {isEasterEggActive && (
                <Route
                  path="/save-the-fishes"
                  element={
                    <PrivateRoute>
                      <AdminLayout>
                        <SaveTheFishes />
                      </AdminLayout>
                    </PrivateRoute>
                  }
                />
              )}
              <Route
                path="/admin/customers"
                element={
                  <PrivateRoute>
                    <AdminLayout>
                      <Customers />
                    </AdminLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/pos"
                element={
                  <PrivateRoute>
                    <AdminLayout>
                      <POS />
                    </AdminLayout>
                  </PrivateRoute>
                }
              />
              <Route
                path="/suppliers/:id"
                element={
                  <PrivateRoute>
                    <AdminLayout>
                      <SupplierDetail />
                    </AdminLayout>
                  </PrivateRoute>
                }
              />
              <Route path="/customers" element={<Navigate to="/admin/customers" replace />} />
              <Route path="/admin/notifications" element={<PrivateRoute><OrderNotifications /></PrivateRoute>} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Router>
        </AdminProvider>
      </div>
    </MUIThemeProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <EasterEggProvider>
        <AppContent />
      </EasterEggProvider>
    </ThemeProvider>
  );
}

export default App;

