import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Paper
} from '@mui/material';
import { PhoneIphone as LoginIcon, Sms } from '@mui/icons-material';
import { api } from '../services/api';
import { useCustomer } from '../contexts/CustomerContext';
import OtpVerification from '../pages/OtpVerification';

const CustomerLogin = ({ onLoginSuccess, orderId }) => {
  const { login } = useCustomer();
  const [phone, setPhone] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otpPhone, setOtpPhone] = useState('');
  const [otpMessage, setOtpMessage] = useState('');

  const sanitizePhoneInput = (value) => value.replace(/[^\d+]/g, '');

  const handleSendOtp = async () => {
    setError('');

    if (!phone) {
      setError('Please enter your phone number');
      return;
    }

    setOtpLoading(true);

    try {
      const response = await api.post('/auth/send-otp', {
        phone,
        userType: 'customer'
      });

      const { success, error: responseError, note, message, smsFailed, smsError } = response.data || {};
      setOtpPhone(phone);
      
      // Always proceed to OTP entry if OTP was generated (success: true)
      // Even if SMS failed, admin can provide the code
      if (success) {
        setError('');
        const info = smsFailed
          ? (note || message || 'SMS delivery failed. Please contact administrator for the OTP code.')
          : (message || 'OTP sent successfully. Enter the code you received.');
        setOtpMessage(info);
        setShowOtpVerification(true);
      } else {
        // Only show error if OTP generation itself failed
        setError(responseError || 'Failed to generate OTP. Please try again.');
      }
    } catch (err) {
      console.error('Send OTP error:', err);
      const status = err.response?.status;
      const responseData = err.response?.data || {};
      const apiError = responseData.error || responseData.message || 'Failed to send OTP. Please try again.';
      
      // If OTP code is present in error response, still allow OTP entry
      // Admin can provide the code from dashboard
      if (responseData.otpCode || status === 402) {
        setError('');
        setOtpPhone(phone);
        setOtpMessage(
          responseData.note || 
          `${apiError} Enter the OTP shared with you by support to continue.`
        );
        setShowOtpVerification(true);
      } else {
        setError(apiError);
      }
    } finally {
      setOtpLoading(false);
    }
  };

  // Handle OTP verification success - check if order exists and call callback
  const handleOtpSuccess = async (customerData) => {
    // If orderId is provided, verify the order belongs to this customer
    if (orderId) {
      try {
        const orderResponse = await api.get(`/orders/${orderId}`);
        const order = orderResponse.data;
        
        if (order && order.customerPhone === customerData.phone) {
          // Order matches customer, call success callback
          if (onLoginSuccess) {
            onLoginSuccess(order);
          }
        }
      } catch (err) {
        console.error('Error fetching order:', err);
        // Still proceed with login even if order fetch fails
        if (onLoginSuccess) {
          onLoginSuccess(null);
        }
      }
    } else {
      // No orderId, just call success callback
      if (onLoginSuccess) {
        onLoginSuccess(null);
      }
    }
  };

  if (showOtpVerification) {
    return (
      <OtpVerification
        phone={otpPhone}
        infoMessage={otpMessage}
        onBack={() => {
          setShowOtpVerification(false);
          setOtpPhone('');
          setOtpMessage('');
          setError('');
        }}
        onLoginSuccess={handleOtpSuccess}
      />
    );
  }

  return (
    <Paper sx={{ p: 4, mt: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <LoginIcon />
        Track Your Order
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter your phone number to log in and track your order status. First-time users will receive an OTP to create a PIN.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={(e) => { e.preventDefault(); handleSendOtp(); }}>
        <TextField
          label="Phone Number"
          type="tel"
          value={phone}
          onChange={(e) => {
            setPhone(sanitizePhoneInput(e.target.value));
            setError('');
          }}
          fullWidth
          sx={{ mb: 3 }}
          placeholder="0712345678 or 254712345678"
          disabled={otpLoading}
          autoComplete="tel"
        />

        <Button
          type="submit"
          variant="contained"
          fullWidth
          size="large"
          startIcon={<Sms />}
          disabled={otpLoading || !phone}
          sx={{
            backgroundColor: '#00E0B8',
            color: '#0D0D0D',
            '&:hover': {
              backgroundColor: '#00C4A3'
            }
          }}
        >
          {otpLoading ? 'Sending OTP...' : 'Send OTP to Login'}
        </Button>
      </Box>
    </Paper>
  );
};

export default CustomerLogin;






