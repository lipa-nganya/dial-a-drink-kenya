import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Paper
} from '@mui/material';
import { PhoneIphone as LoginIcon } from '@mui/icons-material';
import { api } from '../services/api';
import { useCustomer } from '../contexts/CustomerContext';

const CustomerLogin = ({ onLoginSuccess, orderId }) => {
  const { login } = useCustomer();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sanitizePhoneInput = (value) => value.replace(/[^\d+]/g, '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!phone) {
        setError('Please enter your phone number');
        setLoading(false);
        return;
      }

      // Find order by phone number
      const response = await api.post('/orders/find', {
        phone: phone,
        orderId: orderId || null
      });

      if (response.data.success && response.data.order) {
        // Store order info in localStorage for tracking
        const customerData = {
          orderId: response.data.order.id,
          phone: phone,
          customerName: response.data.order.customerName,
          loggedInAt: new Date().toISOString()
        };
        
        // Update CustomerContext
        login(customerData);
        
        // Also call the onLoginSuccess callback if provided
        if (onLoginSuccess) {
          onLoginSuccess(response.data.order);
        }
      } else {
        setError(response.data.message || 'Order not found. Please check your phone number.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to find order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 4, mt: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <LoginIcon />
        Track Your Order
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter your phone number to track your order status
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit}>
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
          disabled={loading}
          autoComplete="tel"
        />

        <Button
          type="submit"
          variant="contained"
          fullWidth
          size="large"
          disabled={loading || !phone}
          sx={{
            backgroundColor: '#00E0B8',
            color: '#0D0D0D',
            '&:hover': {
              backgroundColor: '#00C4A3'
            }
          }}
        >
          {loading ? 'Logging in...' : 'Track Order'}
        </Button>
      </Box>
    </Paper>
  );
};

export default CustomerLogin;






