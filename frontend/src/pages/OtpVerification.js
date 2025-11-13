import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Paper,
  CircularProgress
} from '@mui/material';
import { VerifiedUser, ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useCustomer } from '../contexts/CustomerContext';
import SetPin from './SetPin';

const OtpVerification = ({ phone, onBack, infoMessage, onLoginSuccess }) => {
  const navigate = useNavigate();
  const { login } = useCustomer();
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60); // 60 seconds cooldown for resend
  const [verifiedCustomer, setVerifiedCustomer] = useState(null);
  const [requiresPinSetup, setRequiresPinSetup] = useState(false);

  useEffect(() => {
    // Countdown timer for resend button
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!otpCode || otpCode.length !== 6) {
      setError('Please enter a valid 6-digit OTP code');
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/auth/verify-otp', {
        phone: phone,
        otpCode: otpCode,
        userType: 'customer'
      });

      if (response.data.success && response.data.customer) {
        const needsPinSetup =
          response.data.requiresPinSetup ?? response.data.requiresPasswordSetup;

        if (needsPinSetup) {
          setVerifiedCustomer(response.data.customer);
          setRequiresPinSetup(true);
          return;
        }

        // Password already set, log in directly
        const customerData = {
          id: response.data.customer.id,
          phone: response.data.customer.phone,
          email: response.data.customer.email || null,
          customerName: response.data.customer.customerName,
          username: response.data.customer.username,
          loggedInAt: new Date().toISOString()
        };
        
        localStorage.setItem('customerOrder', JSON.stringify(customerData));
        localStorage.setItem('customerLoggedIn', 'true');
        
        login(customerData);
        
        // If callback provided, call it instead of navigating
        if (onLoginSuccess) {
          onLoginSuccess(customerData);
        } else {
          navigate('/orders');
        }
      } else {
        setError(response.data.error || 'Failed to verify OTP. Please try again.');
      }
    } catch (err) {
      console.error('OTP verification error:', err);
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.message || 
                          'Failed to verify OTP. Please try again.';
      setError(errorMessage);
      
      // Show remaining attempts if available
      if (err.response?.data?.remainingAttempts !== undefined) {
        setError(`${errorMessage} (${err.response.data.remainingAttempts} attempts remaining)`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    
    setResending(true);
    setError('');
    
    try {
      const response = await api.post('/auth/send-otp', {
        phone: phone,
        userType: 'customer'
      });

      if (response.data.success) {
        setOtpCode('');
        setCountdown(60); // Reset countdown
        setError('');
        alert('OTP sent successfully. Please check your phone.');
      } else {
        setError(response.data.error || 'Failed to resend OTP. Please try again.');
      }
    } catch (err) {
      console.error('Resend OTP error:', err);
      setError(err.response?.data?.error || 'Failed to resend OTP. Please try again.');
    } finally {
      setResending(false);
    }
  };

  // Show password setup if required
  if (requiresPinSetup && verifiedCustomer) {
    return (
      <SetPin
        customer={verifiedCustomer}
        onSuccess={(customerData) => {
          // If callback provided, call it instead of navigating
          if (onLoginSuccess) {
            onLoginSuccess(customerData);
          } else {
            navigate('/orders');
          }
        }}
      />
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <VerifiedUser sx={{ fontSize: 64, color: '#00E0B8', mb: 2 }} />
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: '#00E0B8' }}>
            Verify OTP
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enter the 6-digit code sent to {phone}
          </Typography>
        </Box>

        {infoMessage && (
          <Alert severity="info" sx={{ mb: 3 }}>
            {infoMessage}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleVerify}>
          <TextField
            label="OTP Code"
            type="text"
            value={otpCode}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 6);
              setOtpCode(value);
              setError('');
            }}
            fullWidth
            sx={{ mb: 2 }}
            placeholder="000000"
            disabled={loading}
            autoComplete="one-time-code"
            inputProps={{
              maxLength: 6,
              style: { textAlign: 'center', fontSize: '24px', letterSpacing: '8px' }
            }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading || otpCode.length !== 6}
            sx={{
              backgroundColor: '#00E0B8',
              color: '#0D0D0D',
              mb: 2,
              '&:hover': {
                backgroundColor: '#00C4A3'
              }
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Verify OTP'}
          </Button>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
            <Button
              variant="text"
              startIcon={<ArrowBack />}
              onClick={onBack}
              disabled={loading}
            >
              Back
            </Button>
            <Button
              variant="text"
              onClick={handleResendOtp}
              disabled={resending || countdown > 0 || loading}
            >
              {resending ? 'Sending...' : countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default OtpVerification;

