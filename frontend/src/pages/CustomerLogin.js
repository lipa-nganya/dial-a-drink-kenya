import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Paper,
  Link
} from '@mui/material';
import { PhoneIphone, Lock, Sms } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useCustomer } from '../contexts/CustomerContext';
import OtpVerification from './OtpVerification';

const CustomerLogin = () => {
  const navigate = useNavigate();
  const { login } = useCustomer();

  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [hasPin, setHasPin] = useState(false);
  const [checkingPin, setCheckingPin] = useState(false);
  const [pinLoginLoading, setPinLoginLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otpPhone, setOtpPhone] = useState('');
  const [otpMessage, setOtpMessage] = useState('');

  useEffect(() => {
    if (!phone) {
      setHasPin(false);
      return;
    }

    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) {
      setHasPin(false);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingPin(true);
      try {
        const response = await api.post('/auth/check-pin-status', { phone });
        if (response.data.success) {
          setHasPin(response.data.hasPin || false);
        } else {
          setHasPin(false);
        }
      } catch (err) {
        console.error('PIN status check error:', err);
        setHasPin(false);
      } finally {
        setCheckingPin(false);
      }
    }, 600); // debounce to avoid excessive requests

    return () => clearTimeout(timer);
  }, [phone]);

  const sanitizePhoneInput = (value) => value.replace(/[^\d+]/g, '');

  const handleLoginWithPin = async (e) => {
    e.preventDefault();
    setError('');

    if (!phone) {
      setError('Please enter your phone number');
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setError('Please enter your 4-digit PIN');
      return;
    }

    setPinLoginLoading(true);

    try {
      const response = await api.post('/auth/login', {
        phone,
        pin
      });

      if (response.data.success && response.data.customer) {
        const customerData = {
          id: response.data.customer.id,
          email: response.data.customer.email || null,
          phone: response.data.customer.phone || phone,
          customerName: response.data.customer.customerName,
          username: response.data.customer.username,
          loggedInAt: new Date().toISOString()
        };

        localStorage.setItem('customerOrder', JSON.stringify(customerData));
        localStorage.setItem('customerLoggedIn', 'true');

        login(customerData);
        navigate('/orders');
      } else {
        setError(response.data.error || 'Failed to log in with PIN. Please try again.');
      }
    } catch (err) {
      console.error('PIN login error:', err);
      const message =
        err.response?.data?.error ||
        'Failed to log in with PIN. Please try again or request an OTP to reset your PIN.';
      setError(message);
    } finally {
      setPinLoginLoading(false);
    }
  };

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
      />
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <PhoneIphone sx={{ fontSize: 64, color: '#00E0B8', mb: 2 }} />
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: '#00E0B8' }}>
            Customer Login
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Log in with your phone number. First-time users will receive an OTP to create a PIN.
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleLoginWithPin}>
          <TextField
            label="Phone Number"
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(sanitizePhoneInput(e.target.value));
              setError('');
            }}
            fullWidth
            sx={{ mb: 2 }}
            placeholder="0712345678 or 254712345678"
            disabled={pinLoginLoading || otpLoading || checkingPin}
            autoComplete="tel"
          />

          {hasPin && (
            <>
              <TextField
                label="4-Digit PIN"
                type="password"
                value={pin}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPin(digitsOnly);
                  setError('');
                }}
                fullWidth
                sx={{ mb: 2 }}
                placeholder="Enter PIN"
                disabled={pinLoginLoading || otpLoading}
                inputProps={{
                  maxLength: 4,
                  inputMode: 'numeric',
                  style: { textAlign: 'center', letterSpacing: '8px', fontSize: '24px' }
                }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
                Forgot your PIN? Request an OTP to reset it.
              </Typography>
            </>
          )}

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            startIcon={<Lock />}
            disabled={
              !hasPin ||
              pinLoginLoading ||
              otpLoading ||
              checkingPin ||
              pin.length !== 4 ||
              !phone
            }
            sx={{
              backgroundColor: '#00E0B8',
              color: '#0D0D0D',
              mb: 2,
              '&:hover': {
                backgroundColor: '#00C4A3'
              }
            }}
          >
            {pinLoginLoading ? 'Logging in...' : 'Log In with PIN'}
          </Button>

          <Button
            type="button"
            variant="outlined"
            fullWidth
            size="large"
            startIcon={<Sms />}
            disabled={otpLoading || pinLoginLoading || !phone}
            onClick={handleSendOtp}
            sx={{
              borderColor: '#00E0B8',
              color: '#00E0B8',
              '&:hover': {
                borderColor: '#00C4A3',
                backgroundColor: 'rgba(0, 224, 184, 0.1)'
              }
            }}
          >
            {otpLoading ? 'Sending OTP...' : 'Send OTP'}
          </Button>
        </Box>

        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Don't have an account?{' '}
            <Link
              component="button"
              type="button"
              onClick={() => navigate('/menu')}
              sx={{ color: '#00E0B8', cursor: 'pointer' }}
            >
              Start Shopping
            </Link>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Login is optional – you can place orders without logging in.
          </Typography>
          <Button
            variant="outlined"
            fullWidth
            onClick={() => navigate('/menu')}
            sx={{
              mt: 2,
              borderColor: '#00E0B8',
              color: '#00E0B8',
              '&:hover': {
                borderColor: '#00C4A3',
                backgroundColor: 'rgba(0, 224, 184, 0.1)'
              }
            }}
          >
            Continue Without Login
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default CustomerLogin;

