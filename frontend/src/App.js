import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider as MUIThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Snackbar, Alert, Box } from '@mui/material';
import { CartProvider, useCart } from './contexts/CartContext';
import { CustomerProvider } from './contexts/CustomerContext';
import { AdminProvider } from './contexts/AdminContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Header from './components/Header';
import AdminHeader from './components/AdminHeader';
import Footer from './components/Footer';
import FloatingHelpButton from './components/FloatingHelpButton';
import FloatingCallButton from './components/FloatingCallButton';
import Home from './pages/Home';
import Menu from './pages/Menu';
import TestOffers from './pages/TestOffers';
import Offers from './pages/Offers';
import Cart from './pages/Cart';
import OrderSuccess from './pages/OrderSuccess';
import OrderTracking from './pages/OrderTracking';
import PaymentSuccess from './pages/PaymentSuccess';
import Profile from './pages/Profile';
import MyOrders from './pages/MyOrders';
import CustomerLogin from './pages/CustomerLogin';
import VerifyEmail from './pages/VerifyEmail';
import ProductPage from './pages/ProductPage';
import Brands from './pages/Brands';
import BrandDetail from './pages/BrandDetail';
import SuggestDrink from './pages/SuggestDrink';
import ReportProblem from './pages/ReportProblem';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import DeliveryLocations from './pages/DeliveryLocations';
import LocationDetails from './pages/LocationDetails';
import Pricelist from './pages/Pricelist';
import Sitemap from './pages/Sitemap';
import AdminOverview from './pages/admin/AdminOverview';
import Orders from './pages/admin/Orders';
import Inventory from './pages/admin/Inventory';
import Transactions from './pages/admin/Transactions';
import Notifications from './pages/admin/Notifications';
import Drivers from './pages/admin/Drivers';
import Payables from './pages/admin/Payables';
import AdminLogin from './pages/admin/AdminLogin';
import PrivateRoute from './components/PrivateRoute';
import CustomerPrivateRoute from './components/CustomerPrivateRoute';
import './App.css';

const getMUITheme = () => {
  // Always use light mode for customer site
  const colors = {
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
      mode: 'light',
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
              backgroundColor: 'rgba(0, 0, 0, 0.05)',
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
  const { snackbarOpen, setSnackbarOpen, snackbarMessage } = useCart();
  const muiTheme = getMUITheme();
  
  return (
    <MUIThemeProvider theme={muiTheme}>
      <CssBaseline />
      <div
        className="App"
        style={{
          backgroundColor: '#FFFFFF',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {isAdminRoute && !isAdminLogin && <AdminHeader />}
        {!isAdminRoute && <Header />}
        {!isAdminRoute && <FloatingHelpButton />}
        {!isAdminRoute && <FloatingCallButton />}
        <Box
          component="main"
          sx={{
            flex: '1 0 auto',
            // Reserve space for fixed header on desktop (64px); mobile uses sticky so no offset
            pt: { xs: 0, md: '64px' },
          }}
        >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/menu" element={<Menu />} />
          {/* Old product route - kept for backward compatibility and redirects */}
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/brands" element={<Brands />} />
          <Route path="/brand/:id" element={<BrandDetail />} />
          <Route path="/offers" element={<Offers />} />
          <Route path="/test-offers" element={<TestOffers />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/order-success" element={<OrderSuccess />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/order-tracking" element={<OrderTracking />} />
          <Route path="/profile" element={<CustomerPrivateRoute><Profile /></CustomerPrivateRoute>} />
          <Route path="/orders" element={<MyOrders />} />
          <Route path="/login" element={<CustomerLogin />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/suggest-drink" element={<SuggestDrink />} />
          <Route path="/report-problem" element={<ReportProblem />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/delivery-locations" element={<DeliveryLocations />} />
          <Route path="/delivery-location/:locationName" element={<LocationDetails />} />
          <Route path="/pricelist" element={<Pricelist />} />
          <Route path="/sitemap" element={<Sitemap />} />
          <Route path="/debug" element={<div style={{padding: '20px', color: 'white'}}>DEBUG: React Router is working!</div>} />
          {/* New category-based product route: /:categorySlug/:productSlug - MUST be last to avoid conflicts */}
          <Route path="/:categorySlug/:productSlug" element={<ProductPage />} />
          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<PrivateRoute><AdminOverview /></PrivateRoute>} />
          <Route path="/admin/orders" element={<PrivateRoute><Orders /></PrivateRoute>} />
          <Route path="/admin/inventory" element={<PrivateRoute><Inventory /></PrivateRoute>} />
          <Route path="/admin/transactions" element={<PrivateRoute><Transactions /></PrivateRoute>} />
          <Route path="/admin/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
          <Route path="/admin/drivers" element={<PrivateRoute><Drivers /></PrivateRoute>} />
          <Route path="/admin/payables" element={<PrivateRoute><Payables /></PrivateRoute>} />
        </Routes>
        </Box>
        {!isAdminRoute && location.pathname !== '/cart' && location.pathname !== '/order-tracking' && <Footer />}
        
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