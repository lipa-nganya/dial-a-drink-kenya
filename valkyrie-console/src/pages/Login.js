import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  Visibility,
  VisibilityOff
} from '@mui/icons-material';
import { api } from '../services/valkyrieApi';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [useApiKey, setUseApiKey] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Trim email to remove any whitespace
      const trimmedEmail = useApiKey ? undefined : email.trim();
      const trimmedPassword = useApiKey ? undefined : password;
      const trimmedApiKey = useApiKey ? apiKey.trim() : undefined;

      const response = await api.post('/auth/token', {
        email: trimmedEmail,
        password: trimmedPassword,
        apiKey: trimmedApiKey
      });

      if (response.data.success) {
        localStorage.setItem('valkyrieToken', response.data.token);
        localStorage.setItem('valkyrieUser', JSON.stringify(response.data.user || {}));
        localStorage.setItem('valkyriePartner', JSON.stringify(response.data.partner || {}));
        navigate('/');
      }
    } catch (err) {
      console.error('Login error:', err);
      
      // Check if password needs to be set
      if (err.response?.data?.requiresPasswordSetup && err.response?.data?.inviteToken) {
        // Redirect to password setup page with token
        navigate(`/setup-password?token=${err.response.data.inviteToken}&email=${encodeURIComponent(email.trim())}`);
        return;
      }
      
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      
      // Log more details for debugging
      if (err.response) {
        console.error('Response status:', err.response.status);
        console.error('Response data:', err.response.data);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 3 }}>
          Valkyrie Console
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
          Partner Login
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
          <Button
            variant={!useApiKey ? 'contained' : 'outlined'}
            onClick={() => setUseApiKey(false)}
            fullWidth
          >
            Email/Password
          </Button>
          <Button
            variant={useApiKey ? 'contained' : 'outlined'}
            onClick={() => setUseApiKey(true)}
            fullWidth
          >
            API Key
          </Button>
        </Box>

        <form onSubmit={handleSubmit}>
          {useApiKey ? (
            <TextField
              fullWidth
              label="API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              margin="normal"
              required
              autoComplete="off"
            />
          ) : (
            <>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                margin="normal"
                required
                autoComplete="email"
              />
              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                required
                autoComplete="current-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </>
          )}

          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </Paper>
    </Container>
  );
};

export default Login;

