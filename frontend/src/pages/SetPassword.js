import React, { useState } from 'react';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Paper,
  InputAdornment,
  IconButton
} from '@mui/material';
import { Visibility, VisibilityOff, Lock } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useCustomer } from '../contexts/CustomerContext';

const SetPassword = ({ customer, onSuccess }) => {
  const navigate = useNavigate();
  const { login } = useCustomer();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!password || !confirmPassword) {
      setError('Please enter both password fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // Determine username (prefer email, fallback to phone)
      const username = customer.email || customer.phone;

      const response = await api.post('/auth/set-password', {
        customerId: customer.id,
        username: username,
        password: password
      });

      if (response.data.success) {
        // Update customer context
        const customerData = {
          id: customer.id,
          email: customer.email,
          phone: customer.phone,
          customerName: customer.customerName,
          username: username,
          loggedInAt: new Date().toISOString()
        };

        localStorage.setItem('customerOrder', JSON.stringify(customerData));
        localStorage.setItem('customerLoggedIn', 'true');

        login(customerData);

        // Call success callback if provided
        if (onSuccess) {
          onSuccess(customerData);
        } else {
          // Navigate to orders page
          navigate('/orders');
        }
      } else {
        setError(response.data.error || 'Failed to set password. Please try again.');
      }
    } catch (err) {
      console.error('Set password error:', err);
      setError(err.response?.data?.error || 'Failed to set password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Lock sx={{ fontSize: 64, color: '#00E0B8', mb: 2 }} />
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: '#00E0B8' }}>
            Set Your Password
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create a password to log in faster next time
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Username: <strong>{customer.email || customer.phone}</strong>
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            fullWidth
            sx={{ mb: 2 }}
            placeholder="Enter password (min 6 characters)"
            disabled={loading}
            autoComplete="new-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          <TextField
            label="Confirm Password"
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError('');
            }}
            fullWidth
            sx={{ mb: 3 }}
            placeholder="Confirm your password"
            disabled={loading}
            autoComplete="new-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    edge="end"
                  >
                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading || !password || !confirmPassword}
            sx={{
              backgroundColor: '#00E0B8',
              color: '#0D0D0D',
              mb: 2,
              '&:hover': {
                backgroundColor: '#00C4A3'
              }
            }}
          >
            {loading ? 'Setting Password...' : 'Set Password'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default SetPassword;






