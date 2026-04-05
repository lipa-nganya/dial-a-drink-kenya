import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Link
} from '@mui/material';
import { Lock, Dashboard, Visibility, VisibilityOff } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAdmin } from '../contexts/AdminContext';
import { api } from '../services/api';
import AdminAccessPaywallScreen from '../components/AdminAccessPaywallScreen';
import {
  ADMIN_PAYWALL_SESSION_KEYS,
  clearPaywallSession,
  hasPaywallSession,
  startPaywallCooldownSession,
} from '../utils/adminPaywallSessionStorage';

const LOGIN_PAYWALL_KEY = ADMIN_PAYWALL_SESSION_KEYS.login;

const Login = () => {
  const navigate = useNavigate();
  const { colors, isDarkMode } = useTheme();
  const { setUserInfo } = useAdmin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paywallLocked, setPaywallLocked] = useState(
    () => typeof window !== 'undefined' && hasPaywallSession(LOGIN_PAYWALL_KEY)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/admin/auth/login', {
        username,
        password
      });

      if (response.data.success && response.data.token) {
        clearPaywallSession(LOGIN_PAYWALL_KEY);
        // Store token and user info
        localStorage.setItem('adminToken', response.data.token);
        localStorage.setItem('adminUser', JSON.stringify(response.data.user));
        
        // Update context
        setUserInfo(response.data.user);
        
        // Redirect to dashboard
        navigate('/dashboard');
      } else {
        setError(response.data.message || 'Invalid credentials');
      }
    } catch (err) {
      console.error('Login error:', err);
      if (err.response?.status === 403 && err.response?.data?.code === 'ADMIN_PAYWALL') {
        startPaywallCooldownSession(LOGIN_PAYWALL_KEY);
        setPaywallLocked(true);
        return;
      }
      setError(err.response?.data?.error || err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (paywallLocked) {
    return (
      <AdminAccessPaywallScreen
        sessionStorageKey={LOGIN_PAYWALL_KEY}
        onRetry={() => setPaywallLocked(false)}
      />
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
          <Dashboard sx={{ fontSize: 60, color: isDarkMode ? colors.accentText : colors.textPrimary, mb: 2 }} />
          <Typography variant="h4" sx={{ color: isDarkMode ? colors.accentText : colors.textPrimary, fontWeight: 700, mb: 1 }}>
            Admin Login
          </Typography>
          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
            Dial a Drink Kenya
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
            type={showPassword ? 'text' : 'password'}
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
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    disabled={loading}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
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
            disabled={loading || !username || !password}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Lock />}
            sx={{
              backgroundColor: colors.accent,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              py: 1.5,
              '&:hover': {
                backgroundColor: isDarkMode ? '#00C4A3' : '#00C4A3',
                color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              },
              '&:disabled': {
                backgroundColor: colors.textSecondary,
                opacity: 0.5
              }
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>

          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Link
              component="button"
              type="button"
              onClick={() => navigate('/reset-password')}
              sx={{ color: colors.accentText, fontWeight: 600, textDecoration: 'none' }}
              disabled={loading}
            >
              Forgot password?
            </Link>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default Login;

