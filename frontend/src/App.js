import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider as MUIThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Snackbar, Alert } from '@mui/material';
import { CartProvider, useCart } from './contexts/CartContext';
import { CustomerProvider } from './contexts/CustomerContext';
import { AdminProvider } from './contexts/AdminContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import Header from './components/Header';
import AdminHeader from './components/AdminHeader';
import Home from './pages/Home';
import Menu from './pages/Menu';
import TestOffers from './pages/TestOffers';
import Offers from './pages/Offers';
import Cart from './pages/Cart';
import OrderSuccess from './pages/OrderSuccess';
import OrderTracking from './pages/OrderTracking';
import Profile from './pages/Profile';
import MyOrders from './pages/MyOrders';
import CustomerLogin from './pages/CustomerLogin';
import VerifyEmail from './pages/VerifyEmail';
import AdminOverview from './pages/admin/AdminOverview';
import Orders from './pages/admin/Orders';
import Inventory from './pages/admin/Inventory';
import Transactions from './pages/admin/Transactions';
import Notifications from './pages/admin/Notifications';
import Drivers from './pages/admin/Drivers';
import AdminLogin from './pages/admin/AdminLogin';
import PrivateRoute from './components/PrivateRoute';
import CustomerPrivateRoute from './components/CustomerPrivateRoute';
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
  } : {
    background: '#FFFFFF',
    paper: '#F5F5F5',
    textPrimary: '#000000',
    textSecondary: '#666666',
    accent: '#00E0B8',
    accentText: '#000000',
    error: '#FF3366',
    errorText: '#000000',
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
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: `${colors.paper} !important`,
            color: `${colors.textPrimary} !important`,
            background: `${colors.paper} !important`,
            backgroundImage: 'none !important',
          },
        },
      },
      MuiList: {
        styleOverrides: {
          root: {
            backgroundColor: colors.paper,
            color: colors.textPrimary,
          },
        },
      },
      MuiListItem: {
        styleOverrides: {
          root: {
            color: colors.textPrimary,
            '&:hover': {
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
            },
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
    },
  });
};

function AppContent() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isAdminLogin = location.pathname === '/admin/login';
  const { isDarkMode } = useTheme();
  const { snackbarOpen, setSnackbarOpen, snackbarMessage } = useCart();
  const muiTheme = getMUITheme(isDarkMode);
  
  return (
    <MUIThemeProvider theme={muiTheme}>
      <CssBaseline />
      <div className="App" style={{ backgroundColor: isDarkMode ? '#0D0D0D' : '#FFFFFF', minHeight: '100vh' }}>
        {isAdminRoute && !isAdminLogin && <AdminHeader />}
        {!isAdminRoute && <Header />}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/offers" element={<Offers />} />
          <Route path="/test-offers" element={<TestOffers />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/order-success" element={<OrderSuccess />} />
          <Route path="/order-tracking" element={<OrderTracking />} />
          <Route path="/profile" element={<CustomerPrivateRoute><Profile /></CustomerPrivateRoute>} />
          <Route path="/orders" element={<MyOrders />} />
          <Route path="/login" element={<CustomerLogin />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/debug" element={<div style={{padding: '20px', color: 'white'}}>DEBUG: React Router is working!</div>} />
          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<PrivateRoute><AdminOverview /></PrivateRoute>} />
          <Route path="/admin/orders" element={<PrivateRoute><Orders /></PrivateRoute>} />
          <Route path="/admin/inventory" element={<PrivateRoute><Inventory /></PrivateRoute>} />
          <Route path="/admin/transactions" element={<PrivateRoute><Transactions /></PrivateRoute>} />
          <Route path="/admin/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
          <Route path="/admin/drivers" element={<PrivateRoute><Drivers /></PrivateRoute>} />
        </Routes>
        
        {/* Cart Snackbar */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={5000}
          onClose={() => setSnackbarOpen(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setSnackbarOpen(false)}
            severity="success"
            sx={{ width: '100%' }}
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </div>
    </MUIThemeProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <CartProvider>
        <CustomerProvider>
          <AdminProvider>
            <Router>
              <AppContent />
            </Router>
          </AdminProvider>
        </CustomerProvider>
      </CartProvider>
    </ThemeProvider>
  );
}

export default App;