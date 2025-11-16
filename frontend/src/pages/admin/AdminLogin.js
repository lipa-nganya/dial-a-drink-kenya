import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress
} from '@mui/material';
import { Lock, Dashboard } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/admin/login', {
        username,
        password
      });

      if (response.data.success && response.data.token) {
        // Store token
        localStorage.setItem('adminToken', response.data.token);
        localStorage.setItem('adminUser', JSON.stringify(response.data.user));
        
        // Redirect to admin dashboard
        navigate('/admin');
      } else {
        setError(response.data.message || 'Invalid credentials');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0D0D0D 0%, #1a1a1a 100%)'
    }}>
      <Paper sx={{ 
        p: 4, 
        width: '100%',
        backgroundColor: '#121212',
        border: '1px solid #333'
      }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Dashboard sx={{ fontSize: 60, color: '#00E0B8', mb: 2 }} />
          <Typography variant="h4" sx={{ color: '#00E0B8', fontWeight: 700, mb: 1 }}>
            Admin Login
          </Typography>
          <Typography variant="body2" color="text.secondary">
            LiquorOS
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            label="Username"
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError('');
            }}
            fullWidth
            required
            autoComplete="username"
            sx={{ mb: 2 }}
            autoFocus
            disabled={loading}
          />

          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            fullWidth
            required
            autoComplete="current-password"
            sx={{ mb: 3 }}
            disabled={loading}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading || !username || !password}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Lock />}
            sx={{
              backgroundColor: '#00E0B8',
              color: '#0D0D0D',
              py: 1.5,
              '&:hover': {
                backgroundColor: '#00C4A3'
              },
              '&:disabled': {
                backgroundColor: '#555'
              }
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default AdminLogin;

