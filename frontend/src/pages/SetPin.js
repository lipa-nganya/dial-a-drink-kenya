import React, { useState } from 'react';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Paper
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Lock } from '@mui/icons-material';
import { api } from '../services/api';
import { useCustomer } from '../contexts/CustomerContext';

const SetPin = ({ customer, onSuccess }) => {
  const navigate = useNavigate();
  const { login } = useCustomer();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!pin || !confirmPin) {
      setError('Please enter and confirm your PIN');
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    if (pin !== confirmPin) {
      setError('PIN entries do not match');
      return;
    }

    setLoading(true);

    try {
      const phone = customer.phone || customer.username;
      console.log('Setting PIN for customer:', { customerId: customer.id, phone });

      const response = await api.post('/auth/set-pin', {
        customerId: customer.id,
        phone,
        pin,
        confirmPin
      });

      console.log('Set PIN response:', response.data);

      if (response.data && response.data.success) {
        const customerData = {
          id: customer.id,
          email: customer.email || null,
          phone,
          customerName: customer.customerName,
          username: phone,
          loggedInAt: new Date().toISOString()
        };

        console.log('PIN set successfully, saving customer data:', customerData);

        localStorage.setItem('customerOrder', JSON.stringify(customerData));
        localStorage.setItem('customerLoggedIn', 'true');

        login(customerData);

        console.log('Customer logged in, calling onSuccess callback');

        // Use setTimeout to ensure state updates complete before navigation
        setTimeout(() => {
          if (onSuccess) {
            console.log('Calling onSuccess with customerData');
            onSuccess(customerData);
          } else {
            console.log('No onSuccess callback, navigating to /orders');
            navigate('/orders');
          }
        }, 100);
      } else {
        const errorMsg = response.data?.error || response.data?.message || 'Failed to set PIN. Please try again.';
        console.error('Set PIN failed:', errorMsg);
        setError(errorMsg);
        setLoading(false);
      }
    } catch (err) {
      console.error('Set PIN error:', err);
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.message || 
                          'Failed to set PIN. Please try again.';
      console.error('Error message:', errorMessage);
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Lock sx={{ fontSize: 64, color: '#00E0B8', mb: 2 }} />
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: '#00E0B8' }}>
            Set Your 4-Digit PIN
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This PIN will let you log in quickly next time with your phone number.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Phone: <strong>{customer.phone || customer.username}</strong>
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            label="PIN"
            type="password"
            value={pin}
            onChange={(e) => {
              const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 4);
              setPin(digitsOnly);
              setError('');
            }}
            fullWidth
            sx={{ mb: 2 }}
            placeholder="Enter 4-digit PIN"
            disabled={loading}
            inputProps={{
              maxLength: 4,
              inputMode: 'numeric',
              style: { textAlign: 'center', letterSpacing: '8px', fontSize: '24px' }
            }}
          />

          <TextField
            label="Confirm PIN"
            type="password"
            value={confirmPin}
            onChange={(e) => {
              const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 4);
              setConfirmPin(digitsOnly);
              setError('');
            }}
            fullWidth
            sx={{ mb: 3 }}
            placeholder="Confirm the 4-digit PIN"
            disabled={loading}
            inputProps={{
              maxLength: 4,
              inputMode: 'numeric',
              style: { textAlign: 'center', letterSpacing: '8px', fontSize: '24px' }
            }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading || pin.length !== 4 || confirmPin.length !== 4}
            sx={{
              backgroundColor: '#00E0B8',
              color: '#0D0D0D',
              mb: 2,
              '&:hover': {
                backgroundColor: '#00C4A3'
              }
            }}
          >
            {loading ? 'Saving PIN...' : 'Save PIN'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default SetPin;


