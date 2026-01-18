import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SetupPin from './pages/SetupPin';
import Login from './pages/Login';
import PhoneNumberScreen from './pages/PhoneNumberScreen';
import OtpVerificationScreen from './pages/OtpVerificationScreen';
import PinLoginScreen from './pages/PinLoginScreen';
import PinSetupScreen from './pages/PinSetupScreen';
import PinConfirmScreen from './pages/PinConfirmScreen';
import Dashboard from './pages/Dashboard';
import InventoryCheck from './pages/InventoryCheck';
import InventoryCheckHistory from './pages/InventoryCheckHistory';
import PrivateRoute from './components/PrivateRoute';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/setup-pin" element={<SetupPin />} />
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PhoneNumberScreen />} />
        <Route path="/otp-verification" element={<OtpVerificationScreen />} />
        <Route path="/pin-login" element={<PinLoginScreen />} />
        <Route path="/pin-setup" element={<PinSetupScreen />} />
        <Route path="/pin-confirm" element={<PinConfirmScreen />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/inventory-check"
          element={
            <PrivateRoute>
              <InventoryCheck />
            </PrivateRoute>
          }
        />
        <Route
          path="/inventory-check-history"
          element={
            <PrivateRoute>
              <InventoryCheckHistory />
            </PrivateRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
