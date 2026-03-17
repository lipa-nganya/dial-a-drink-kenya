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
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';

const ResetPasswordRequest = () => {
  const navigate = useNavigate();
  const { colors, isDarkMode } = useTheme();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await api.post('/admin/auth/request-password-reset', { usernameOrEmail });
      if (res.data?.success) {
        setSuccess('If an account exists, a reset link has been sent to the email address on file.');
      } else {
        setError(res.data?.error || 'Failed to request password reset');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to request password reset');
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
      background: isDarkMode
        ? 'linear-gradient(135deg, #0D0D0D 0%, #1a1a1a 100%)'
        : 'linear-gradient(135deg, #FFFFFF 0%, #F5F5F5 100%)'
    }}>
      <Paper sx={{
        p: 4,
        width: '100%',
        backgroundColor: colors.paper,
        border: `1px solid ${colors.border}`
      }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: isDarkMode ? colors.accentText : colors.textPrimary, mb: 1 }}>
            Reset Password
          </Typography>
          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
            Enter your admin username or email. We’ll email you a link to set a new password.
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            label="Username or Email"
            value={usernameOrEmail}
            onChange={(e) => setUsernameOrEmail(e.target.value)}
            fullWidth
            required
            autoFocus
            disabled={loading}
            sx={{ mb: 2 }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading || !usernameOrEmail.trim()}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
            sx={{
              backgroundColor: colors.accent,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              py: 1.5,
              '&:hover': { backgroundColor: '#00C4A3' }
            }}
          >
            Send reset link
          </Button>

          <Button
            type="button"
            fullWidth
            onClick={() => navigate('/login')}
            disabled={loading}
            sx={{ mt: 1.5, color: colors.textSecondary }}
          >
            Back to login
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default ResetPasswordRequest;

