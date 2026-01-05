import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Partners from './pages/Partners';
import Geofences from './pages/Geofences';
import Usage from './pages/Usage';
import Billing from './pages/Billing';
import PrivateRoute from './components/PrivateRoute';
import ZeusHeader from './components/ZeusHeader';

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
          <Route
            path="/"
            element={
              <PrivateRoute>
                <>
                  <ZeusHeader />
                  <Dashboard />
                </>
              </PrivateRoute>
            }
          />
          <Route
            path="/partners"
            element={
              <PrivateRoute>
                <>
                  <ZeusHeader />
                  <Partners />
                </>
              </PrivateRoute>
            }
          />
          <Route
            path="/geofences"
            element={
              <PrivateRoute>
                <>
                  <ZeusHeader />
                  <Geofences />
                </>
              </PrivateRoute>
            }
          />
          <Route
            path="/usage"
            element={
              <PrivateRoute>
                <>
                  <ZeusHeader />
                  <Usage />
                </>
              </PrivateRoute>
            }
          />
          <Route
            path="/billing"
            element={
              <PrivateRoute>
                <>
                  <ZeusHeader />
                  <Billing />
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














