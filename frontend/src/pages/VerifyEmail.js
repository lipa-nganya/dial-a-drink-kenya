import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Alert,
  Paper,
  CircularProgress,
  Button
} from '@mui/material';
import { CheckCircle, Error, Person } from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useCustomer } from '../contexts/CustomerContext';
import SetPin from './SetPin';

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useCustomer();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [customerData, setCustomerData] = useState(null);
  const [requiresPinSetup, setRequiresPinSetup] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setError('Verification token is missing');
      setLoading(false);
      return;
    }

    verifyEmail(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const verifyEmail = async (token) => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get(`/auth/verify-email?token=${token}`);

      if (response.data.success && response.data.customer) {
        // Check if password setup is required
        const needsPinSetup =
          response.data.requiresPinSetup ?? response.data.requiresPasswordSetup;

        if (needsPinSetup) {
          setCustomerData(response.data.customer);
          setRequiresPinSetup(true);
          setLoading(false);
          return;
        }

        // Password already set, log in directly
        const customer = {
          id: response.data.customer.id,
          email: response.data.customer.email,
          phone: response.data.customer.phone || null,
          customerName: response.data.customer.customerName,
          username: response.data.customer.username,
          loggedInAt: new Date().toISOString()
        };

        localStorage.setItem('customerOrder', JSON.stringify(customer));
        localStorage.setItem('customerLoggedIn', 'true');
        
        login(customer);
        setCustomerData(customer);
        setSuccess(true);

        // Auto-navigate to orders page after 2 seconds
        setTimeout(() => {
          navigate('/orders');
        }, 2000);
      } else {
        setError(response.data.error || 'Failed to verify email. Please try again.');
      }
    } catch (err) {
      console.error('Email verification error:', err);
      setError(err.response?.data?.error || 
              err.response?.data?.message || 
              'Failed to verify email. The link may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  // Show password setup if required
  if (requiresPinSetup && customerData) {
    return (
      <SetPin
        customer={customerData}
        onSuccess={(customerData) => {
          navigate('/orders');
        }}
      />
    );
  }

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            Verifying your email...
          </Typography>
        </Paper>
      </Container>
    );
  }

  if (success) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircle sx={{ fontSize: 64, color: '#00E0B8', mb: 2 }} />
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: '#00E0B8', mb: 2 }}>
            Email Verified Successfully!
          </Typography>
          {customerData && (
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Welcome back, {customerData.customerName}!
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Redirecting to your orders...
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate('/orders')}
            sx={{
              backgroundColor: '#00E0B8',
              color: '#0D0D0D',
              '&:hover': {
                backgroundColor: '#00C4A3'
              }
            }}
          >
            Go to My Orders
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Error sx={{ fontSize: 64, color: '#FF3366', mb: 2 }} />
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: '#FF3366', mb: 2 }}>
          Verification Failed
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 3 }}>
          <Button
            variant="outlined"
            startIcon={<Person />}
            onClick={() => navigate('/login')}
            sx={{
              borderColor: '#00E0B8',
              color: '#00E0B8',
              '&:hover': {
                borderColor: '#00C4A3',
                backgroundColor: 'rgba(0, 224, 184, 0.1)'
              }
            }}
          >
            Back to Login
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default VerifyEmail;

