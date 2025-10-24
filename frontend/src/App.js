import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { CartProvider } from './contexts/CartContext';
import Header from './components/Header';
import Home from './pages/Home';
import Menu from './pages/Menu';
import Offers from './pages/Offers';
import TestOffers from './pages/TestOffers';
import Cart from './pages/Cart';
import OrderSuccess from './pages/OrderSuccess';
import AdminDashboard from './pages/AdminDashboard';
import './App.css';

const theme = createTheme({
  palette: {
    primary: {
      main: '#00E0B8', // Neon teal accent
    },
    secondary: {
      main: '#FF3366', // Vibrant pink accent
    },
    background: {
      default: '#0D0D0D', // Rich near-black
      paper: '#121212', // Dark gray for cards
    },
    text: {
      primary: '#F5F5F5', // Off-white text
      secondary: '#B0B0B0', // Light gray for secondary text
    },
    mode: 'dark',
  },
  typography: {
    fontFamily: '"Lato", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontFamily: '"Montserrat", "Roboto", "Helvetica", "Arial", sans-serif',
      fontWeight: 700,
      color: '#F5F5F5',
    },
    h2: {
      fontFamily: '"Montserrat", "Roboto", "Helvetica", "Arial", sans-serif',
      fontWeight: 600,
      color: '#F5F5F5',
    },
    h3: {
      fontFamily: '"Montserrat", "Roboto", "Helvetica", "Arial", sans-serif',
      fontWeight: 600,
      color: '#F5F5F5',
    },
    h4: {
      fontFamily: '"Montserrat", "Roboto", "Helvetica", "Arial", sans-serif',
      fontWeight: 500,
      color: '#F5F5F5',
    },
    h5: {
      fontFamily: '"Montserrat", "Roboto", "Helvetica", "Arial", sans-serif',
      fontWeight: 500,
      color: '#F5F5F5',
    },
    h6: {
      fontFamily: '"Montserrat", "Roboto", "Helvetica", "Arial", sans-serif',
      fontWeight: 500,
      color: '#F5F5F5',
    },
    body1: {
      fontFamily: '"Lato", "Roboto", "Helvetica", "Arial", sans-serif',
      color: '#F5F5F5',
    },
    body2: {
      fontFamily: '"Lato", "Roboto", "Helvetica", "Arial", sans-serif',
      color: '#B0B0B0',
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#121212',
          color: '#F5F5F5',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#121212',
          color: '#F5F5F5',
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

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <CartProvider>
        <Router>
          <div className="App">
            <Header />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/menu" element={<Menu />} />
              <Route path="/offers" element={<Offers />} />
              <Route path="/test-offers" element={<TestOffers />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/order-success" element={<OrderSuccess />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/debug" element={<div style={{padding: '20px', color: 'white'}}>DEBUG: React Router is working!</div>} />
            </Routes>
          </div>
        </Router>
      </CartProvider>
    </ThemeProvider>
  );
}

export default App;