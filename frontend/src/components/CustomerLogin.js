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
import OtpVerification from '../pages/OtpVerification';

const CustomerLogin = ({ onLoginSuccess, orderId }) => {
  const [phone, setPhone] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otpPhone, setOtpPhone] = useState('');
  const [otpMessage, setOtpMessage] = useState('');

  const sanitizePhoneInput = (value) => value.replace(/[^\d+]/g, '');

  // Normalize phone number: convert leading 0 to 254, or if starts with 7 and is 9 digits, add 254
  const normalizePhoneNumber = (phone) => {
    if (!phone) return phone;
    const digits = phone.replace(/\D/g, '');
    if (!digits) return phone;
    
    // If starts with 0 and is 10 digits, convert to 254 format
    if (digits.startsWith('0') && digits.length === 10) {
      return `254${digits.slice(1)}`;
    }
    
    // If starts with 7 and is 9 digits, add 254 prefix
    if (digits.startsWith('7') && digits.length === 9) {
      return `254${digits}`;
    }
    
    // If already starts with 254, return as is
    if (digits.startsWith('254') && digits.length === 12) {
      return digits;
    }
    
    // Otherwise return the digits as entered
    return digits;
  };

  const handleSendOtp = async () => {
    setError('');

    if (!phone) {
      setError('Please enter your phone number');
      return;
    }

    setOtpLoading(true);

    try {
      const normalizedPhone = normalizePhoneNumber(phone);
      const response = await api.post('/auth/send-otp', {
        phone: normalizedPhone,
        userType: 'customer'
      });

      const { success, error: responseError, note, message, smsFailed } = response.data || {};
      setOtpPhone(normalizedPhone);
      
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
        const normalizedPhone = normalizePhoneNumber(phone);
        setOtpPhone(normalizedPhone);
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
          placeholder="712345678"
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






