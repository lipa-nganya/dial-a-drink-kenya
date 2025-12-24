import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Login from './pages/Login';
import SetupPassword from './pages/SetupPassword';
import Overview from './pages/Overview';
import Orders from './pages/Orders';
import Drivers from './pages/Drivers';
import DeliveryZones from './pages/DeliveryZones';
import Billing from './pages/Billing';
import API from './pages/API';
import Guide from './pages/Guide';
import PrivateRoute from './components/PrivateRoute';
import ValkyrieHeader from './components/ValkyrieHeader';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/setup-password" element={<SetupPassword />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <>
                  <ValkyrieHeader />
                  <Overview />
                </>
              </PrivateRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <PrivateRoute>
                <>
                  <ValkyrieHeader />
                  <Orders />
                </>
              </PrivateRoute>
            }
          />
          <Route
            path="/drivers"
            element={
              <PrivateRoute>
                <>
                  <ValkyrieHeader />
                  <Drivers />
                </>
              </PrivateRoute>
            }
          />
          <Route
            path="/zones"
            element={
              <PrivateRoute>
                <>
                  <ValkyrieHeader />
                  <DeliveryZones />
                </>
              </PrivateRoute>
            }
          />
          <Route
            path="/billing"
            element={
              <PrivateRoute>
                <>
                  <ValkyrieHeader />
                  <Billing />
                </>
              </PrivateRoute>
            }
          />
          <Route
            path="/api"
            element={
              <PrivateRoute>
                <>
                  <ValkyrieHeader />
                  <API />
                </>
              </PrivateRoute>
            }
          />
          <Route
            path="/guide"
            element={
              <PrivateRoute>
                <>
                  <ValkyrieHeader />
                  <Guide />
                </>
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
