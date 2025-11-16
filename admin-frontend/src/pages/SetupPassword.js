import React, { useState, useEffect } from 'react';
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
import { Lock, CheckCircle } from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAdmin } from '../contexts/AdminContext';
import { api } from '../services/api';

const SetupPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { colors, isDarkMode } = useTheme();
  const { setUserInfo } = useAdmin();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Invalid invite link. Please check your email for the correct link.');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid invite link');
      return;
    }

    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/admin/setup-password', {
        token,
        password
      });

      if (response.data.success) {
        // Store token and user info
        localStorage.setItem('adminToken', response.data.token);
        localStorage.setItem('adminUser', JSON.stringify(response.data.user));
        
        // Update context
        setUserInfo(response.data.user);
        
        setSuccess(true);
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } else {
        setError(response.data.error || 'Failed to set password');
      }
    } catch (err) {
      console.error('Setup password error:', err);
      setError(err.response?.data?.error || 'Failed to set password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Container maxWidth="sm" sx={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: isDarkMode ? 'linear-gradient(135deg, #0D0D0D 0%, #1a1a1a 100%)' : 'linear-gradient(135deg, #FFFFFF 0%, #F5F5F5 100%)'
      }}>
        <Paper sx={{ 
          p: 4, 
          width: '100%',
          backgroundColor: colors.paper,
          border: `1px solid ${colors.border}`,
          textAlign: 'center'
        }}>
          <CheckCircle sx={{ fontSize: 60, color: '#00E0B8', mb: 2 }} />
          <Typography variant="h5" sx={{ color: colors.textPrimary, fontWeight: 700, mb: 2 }}>
            Password Set Successfully!
          </Typography>
          <Typography variant="body1" sx={{ color: colors.textSecondary, mb: 3 }}>
            You are now logged in. Redirecting to dashboard...
          </Typography>
          <CircularProgress size={24} />
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: isDarkMode ? 'linear-gradient(135deg, #0D0D0D 0%, #1a1a1a 100%)' : 'linear-gradient(135deg, #FFFFFF 0%, #F5F5F5 100%)'
    }}>
      <Paper sx={{ 
        p: 4, 
        width: '100%',
        backgroundColor: colors.paper,
        border: `1px solid ${colors.border}`
      }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Lock sx={{ fontSize: 60, color: isDarkMode ? colors.accentText : colors.textPrimary, mb: 2 }} />
          <Typography variant="h4" sx={{ color: isDarkMode ? colors.accentText : colors.textPrimary, fontWeight: 700, mb: 1 }}>
            Set Your Password
          </Typography>
          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
            You've been invited to join the LiquorOS admin team. Please set your password to continue.
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
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            fullWidth
            required
            autoComplete="new-password"
            sx={{ mb: 2 }}
            disabled={loading}
            helperText="Must be at least 6 characters"
          />

          <TextField
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError('');
            }}
            fullWidth
            required
            autoComplete="new-password"
            sx={{ mb: 3 }}
            disabled={loading}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading || !token}
            startIcon={loading ? <CircularProgress size={20} sx={{ color: isDarkMode ? '#0D0D0D' : colors.textPrimary }} /> : <Lock />}
            sx={{
              backgroundColor: colors.accent,
              color: isDarkMode ? '#0D0D0D' : colors.textPrimary,
              py: 1.5,
              '&:hover': {
                backgroundColor: isDarkMode ? '#00C4A3' : colors.accentText,
              },
              '&:disabled': {
                backgroundColor: colors.textSecondary,
                opacity: 0.5
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

export default SetupPassword;

