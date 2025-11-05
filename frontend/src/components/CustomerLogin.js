import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Paper
} from '@mui/material';
import { Login as LoginIcon } from '@mui/icons-material';
import { api } from '../services/api';

const CustomerLogin = ({ onLoginSuccess, orderId }) => {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email && !phone) {
        setError('Please enter either email or phone number');
        setLoading(false);
        return;
      }

      // Find order by email or phone
      const response = await api.post('/orders/find', {
        email: email || null,
        phone: phone || null,
        orderId: orderId || null
      });

      if (response.data.success && response.data.order) {
        // Store order info in localStorage for tracking
        localStorage.setItem('customerOrder', JSON.stringify({
          orderId: response.data.order.id,
          email: email,
          phone: phone
        }));
        
        onLoginSuccess(response.data.order);
      } else {
        setError(response.data.message || 'Order not found. Please check your email or phone number.');
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
        Enter your email or phone number to track your order status
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError('');
          }}
          fullWidth
          sx={{ mb: 2 }}
          placeholder="your.email@example.com"
          disabled={loading}
        />

        <Typography variant="body2" sx={{ textAlign: 'center', my: 2, color: 'text.secondary' }}>
          OR
        </Typography>

        <TextField
          label="Phone Number"
          type="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value.replace(/[^\d+]/g, ''));
            setError('');
          }}
          fullWidth
          sx={{ mb: 3 }}
          placeholder="0712345678 or 254712345678"
          disabled={loading}
        />

        <Button
          type="submit"
          variant="contained"
          fullWidth
          size="large"
          disabled={loading || (!email && !phone)}
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





