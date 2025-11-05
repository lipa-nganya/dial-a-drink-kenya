import React, { useState } from 'react';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Paper,
  Link,
  InputAdornment,
  IconButton,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel
} from '@mui/material';
import { Login as LoginIcon, Person, Visibility, VisibilityOff, Email, Phone } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useCustomer } from '../contexts/CustomerContext';
import OtpVerification from './OtpVerification';

const CustomerLogin = () => {
  const navigate = useNavigate();
  const { login } = useCustomer();
  const [loginMethod, setLoginMethod] = useState('email'); // 'email' or 'phone'
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [emailConfirmationSent, setEmailConfirmationSent] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [checkingPassword, setCheckingPassword] = useState(false);

  // Check password status when email/phone changes (only check if value is complete)
  React.useEffect(() => {
    const checkPasswordStatus = async () => {
      const value = loginMethod === 'email' ? email : phone;
      
      // Only check if we have a reasonable value (at least 3 characters for email, 7 for phone)
      const minLength = loginMethod === 'email' ? 3 : 7;
      if (!value || value.length < minLength || checkingPassword) {
        setHasPassword(false);
        return;
      }

      // For email, check if it looks like a valid email format before checking
      if (loginMethod === 'email' && !value.includes('@')) {
        setHasPassword(false);
        return;
      }

      setCheckingPassword(true);
      try {
        const response = await api.post('/auth/check-password-status', {
          email: loginMethod === 'email' ? email : null,
          phone: loginMethod === 'phone' ? phone : null
        });

        if (response.data.success) {
          setHasPassword(response.data.hasPassword || false);
        }
      } catch (err) {
        // If check fails, assume no password (don't block user)
        setHasPassword(false);
      } finally {
        setCheckingPassword(false);
      }
    };

    // Debounce the check - only check after user stops typing
    const timer = setTimeout(() => {
      checkPasswordStatus();
    }, 800); // Increased debounce to 800ms to avoid interfering with typing

    return () => clearTimeout(timer);
  }, [email, phone, loginMethod]);

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const value = loginMethod === 'email' ? email : phone;
      
      if (!value) {
        setError(`Please enter your ${loginMethod === 'email' ? 'email address' : 'phone number'}`);
        setLoading(false);
        return;
      }

      if (!password) {
        setError('Please enter your password');
        setLoading(false);
        return;
      }

      // Use email or phone as username
      const username = value;

      const response = await api.post('/auth/login', {
        username: username,
        password: password
      });

      if (response.data.success && response.data.customer) {
        const customerData = {
          id: response.data.customer.id,
          email: response.data.customer.email,
          phone: response.data.customer.phone,
          customerName: response.data.customer.customerName,
          username: response.data.customer.username,
          loggedInAt: new Date().toISOString()
        };

        localStorage.setItem('customerOrder', JSON.stringify(customerData));
        localStorage.setItem('customerLoggedIn', 'true');

        login(customerData);
        navigate('/orders');
      } else {
        setError(response.data.error || 'Invalid username or password');
      }
    } catch (err) {
      console.error('Password login error:', err);
      setError(err.response?.data?.error || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // If password login is available, use that instead
    if (hasPassword && password) {
      handlePasswordLogin(e);
      return;
    }

    setLoading(true);

    try {
      const value = loginMethod === 'email' ? email : phone;
      
      if (!value) {
        setError(`Please enter your ${loginMethod === 'email' ? 'email address' : 'phone number'}`);
        setLoading(false);
        return;
      }

      // If phone number is selected, send OTP
      if (loginMethod === 'phone') {
        try {
          const otpResponse = await api.post('/auth/send-otp', {
            phone: phone
          });

          if (otpResponse.data.success) {
            setShowOtpVerification(true);
            setLoading(false);
            return;
          } else {
            setError(otpResponse.data.error || 'Failed to send OTP. Please try again.');
            setLoading(false);
            return;
          }
        } catch (otpError) {
          console.error('OTP send error:', otpError);
          // Don't block the user - allow them to continue without login
          const errorMessage = otpError.response?.data?.error || 'Failed to send OTP. You can continue without logging in to place orders.';
          setError(errorMessage);
          // Don't return - allow them to continue
          setLoading(false);
          // Show option to continue without login
          setTimeout(() => {
            if (window.confirm('Unable to send OTP. Would you like to continue shopping without logging in?')) {
              navigate('/menu');
            }
          }, 2000);
          return;
        }
      }

      // If email is selected, send confirmation email
      if (loginMethod === 'email') {
        try {
          const emailResponse = await api.post('/auth/send-email-confirmation', {
            email: email
          });

          if (emailResponse.data.success) {
            setEmailConfirmationSent(true);
            setLoading(false);
            return;
          } else {
            setError(emailResponse.data.error || 'Failed to send confirmation email. Please try again.');
            setLoading(false);
            return;
          }
        } catch (emailError) {
          console.error('Email confirmation error:', emailError);
          // Check if the response allows continuing
          const responseData = emailError.response?.data;
          
          if (responseData?.allowContinue) {
            // Backend allows continuing without email
            setError(responseData.message || 'Email confirmation could not be sent. You can continue without logging in.');
            setLoading(false);
            // Offer to continue shopping
            setTimeout(() => {
              if (window.confirm('Unable to send confirmation email. Would you like to continue shopping without logging in?')) {
                navigate('/menu');
              }
            }, 2000);
            return;
          }
          
          // Don't block the user - allow them to continue without login
          const errorMessage = emailError.response?.data?.error || emailError.response?.data?.message || 'Failed to send confirmation email. You can continue without logging in to place orders.';
          setError(errorMessage);
          setLoading(false);
          // Show option to continue without login
          setTimeout(() => {
            if (window.confirm('Unable to send confirmation email. Would you like to continue shopping without logging in?')) {
              navigate('/menu');
            }
          }, 2000);
          return;
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to log in. Please try again.');
      setLoading(false);
    }
  };

  // Reset fields when login method changes
  const handleLoginMethodChange = (event) => {
    const newMethod = event.target.value;
    setLoginMethod(newMethod);
    setEmail('');
    setPhone('');
    setPassword('');
    setError('');
    setHasPassword(false);
  };

  // Show OTP verification if phone login was initiated
  if (showOtpVerification) {
    return (
      <OtpVerification
        phone={phone}
        onBack={() => {
          setShowOtpVerification(false);
          setPhone('');
          setError('');
        }}
      />
    );
  }

  // Show email confirmation message if email was sent
  if (emailConfirmationSent) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: '#00E0B8', mb: 2 }}>
            Check Your Email
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            We've sent a confirmation link to <strong>{email}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Click the link in the email to complete your login. The link will expire in 3 hours.
          </Typography>
          <Button
            variant="outlined"
            onClick={() => {
              setEmailConfirmationSent(false);
              setEmail('');
              setError('');
            }}
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
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Person sx={{ fontSize: 64, color: '#00E0B8', mb: 2 }} />
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: '#00E0B8' }}>
            Customer Login
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enter your email or phone number to track your orders
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <FormControl component="fieldset" fullWidth sx={{ mb: 3 }}>
            <FormLabel component="legend" sx={{ mb: 2, color: 'text.primary' }}>
              Login Method
            </FormLabel>
            <RadioGroup
              row
              value={loginMethod}
              onChange={handleLoginMethodChange}
              sx={{ justifyContent: 'center', gap: 4 }}
            >
              <FormControlLabel
                value="email"
                control={<Radio />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Email />
                    <Typography>Email</Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="phone"
                control={<Radio />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Phone />
                    <Typography>Phone</Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>

          {loginMethod === 'email' ? (
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
              autoComplete="email"
              inputProps={{
                autoComplete: 'email',
                autoCorrect: 'off',
                autoCapitalize: 'off',
                spellCheck: 'false'
              }}
            />
          ) : (
            <TextField
              label="Phone Number"
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value.replace(/[^\d+]/g, ''));
                setError('');
              }}
              fullWidth
              sx={{ mb: 2 }}
              placeholder="0712345678 or 254712345678"
              disabled={loading || checkingPassword}
              autoComplete="tel"
            />
          )}

          {hasPassword && (
            <>
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
                placeholder="Enter your password"
                disabled={loading}
                autoComplete="current-password"
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
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center', fontStyle: 'italic' }}>
                OR use OTP/Email verification below
              </Typography>
            </>
          )}

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading || (loginMethod === 'email' && !email) || (loginMethod === 'phone' && !phone) || (hasPassword && !password)}
            startIcon={<LoginIcon />}
            sx={{
              backgroundColor: '#00E0B8',
              color: '#0D0D0D',
              mb: 2,
              '&:hover': {
                backgroundColor: '#00C4A3'
              }
            }}
          >
            {loading ? 'Logging in...' : hasPassword ? 'Log In with Password' : 'Log In'}
          </Button>

          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Don't have an account?{' '}
              <Link
                component="button"
                type="button"
                onClick={() => navigate('/menu')}
                sx={{ color: '#00E0B8', cursor: 'pointer' }}
              >
                Start Shopping
              </Link>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Login is optional - you can place orders without logging in
            </Typography>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => navigate('/menu')}
              sx={{
                mt: 2,
                borderColor: '#00E0B8',
                color: '#00E0B8',
                '&:hover': {
                  borderColor: '#00C4A3',
                  backgroundColor: 'rgba(0, 224, 184, 0.1)'
                }
              }}
            >
              Continue Without Login
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default CustomerLogin;

