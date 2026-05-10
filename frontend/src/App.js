import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ThemeProvider as MUIThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Snackbar, Alert, Box } from '@mui/material';
import { CartProvider, useCart } from './contexts/CartContext';
import { CustomerProvider } from './contexts/CustomerContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Header from './components/Header';
import Footer from './components/Footer';
import FloatingHelpButton from './components/FloatingHelpButton';
import FloatingCallButton from './components/FloatingCallButton';
import CustomerPrivateRoute from './components/CustomerPrivateRoute';
import RedirectToAdminApp from './components/RedirectToAdminApp';
import CanonicalHead from './components/CanonicalHead';
import SEOHead from './components/SEOHead';
import RoutePageSkeleton from './components/RoutePageSkeleton';
import './App.css';

const Home = lazy(() => import('./pages/Home'));
const Menu = lazy(() => import('./pages/Menu'));
const TestOffers = lazy(() => import('./pages/TestOffers'));
const Offers = lazy(() => import('./pages/Offers'));
const Cart = lazy(() => import('./pages/Cart'));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess'));
const OrderTracking = lazy(() => import('./pages/OrderTracking'));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess'));
const Profile = lazy(() => import('./pages/Profile'));
const MyOrders = lazy(() => import('./pages/MyOrders'));
const CustomerLogin = lazy(() => import('./pages/CustomerLogin'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const Brands = lazy(() => import('./pages/Brands'));
const BrandDetail = lazy(() => import('./pages/BrandDetail'));
const SuggestDrink = lazy(() => import('./pages/SuggestDrink'));
const ReportProblem = lazy(() => import('./pages/ReportProblem'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const DeliveryLocations = lazy(() => import('./pages/DeliveryLocations'));
const LocationDetails = lazy(() => import('./pages/LocationDetails'));
const Pricelist = lazy(() => import('./pages/Pricelist'));
const Sitemap = lazy(() => import('./pages/Sitemap'));
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
  const isAdminRedirectRoute = location.pathname.startsWith('/admin');
  const { snackbarOpen, setSnackbarOpen, snackbarMessage } = useCart();
  const muiTheme = getMUITheme();

  return (
    <MUIThemeProvider theme={muiTheme}>
      <SEOHead />
      <CanonicalHead />
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
        {!isAdminRedirectRoute && <Header />}
        {!isAdminRedirectRoute && <FloatingHelpButton />}
        {!isAdminRedirectRoute && <FloatingCallButton />}
        <Box
          component="main"
          sx={{
            flex: '1 0 auto',
            // Reserve space for fixed header + categories bar on desktop (not on /admin → redirect)
            pt: { xs: 0, md: isAdminRedirectRoute ? 0 : '104px' },
          }}
        >
        <Suspense fallback={<RoutePageSkeleton />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/menu" element={<Menu />} />
          {/* Standalone admin (admin-frontend). Must be before /:categorySlug or "admin" is treated as a category. */}
          <Route path="/admin/*" element={<RedirectToAdminApp />} />
          <Route path="/:categorySlug" element={<Menu />} />
          <Route path="/menu/category/:categorySlug" element={<Menu />} />
          {/* Old product route - kept for backward compatibility and redirects */}
          <Route path="/product/:id" element={<ProductPage />} />
          {/* Legacy URLs indexed as /products/:slug (must be before /:categorySlug/:productSlug or "products" is mistaken for category) */}
          <Route path="/products/:productSlug" element={<ProductPage />} />
          <Route path="/brands" element={<Brands />} />
          <Route path="/brands/:identifier" element={<BrandDetail />} />
          <Route path="/offers" element={<Offers />} />
          <Route path="/test-offers" element={<TestOffers />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/order-success" element={<OrderSuccess />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/order-tracking" element={<OrderTracking />} />
          <Route path="/profile" element={<CustomerPrivateRoute><Profile /></CustomerPrivateRoute>} />
          <Route path="/orders" element={<CustomerPrivateRoute><MyOrders /></CustomerPrivateRoute>} />
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
        </Routes>
        </Suspense>
        </Box>
        {!isAdminRedirectRoute &&
          location.pathname !== '/cart' &&
          location.pathname !== '/order-tracking' && <Footer />}
        
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
          <Router>
            <AppContent />
          </Router>
        </CustomerProvider>
      </CartProvider>
    </ThemeProvider>
  );
}

export default App;