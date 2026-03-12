import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Paper,
  Link,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import { PhoneIphone, Lock, Sms } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useCustomer } from '../contexts/CustomerContext';
import OtpVerification from './OtpVerification';

const CustomerLogin = () => {
  const navigate = useNavigate();
  const { login } = useCustomer();

  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+254');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [hasPin, setHasPin] = useState(false);
  const [checkingPin, setCheckingPin] = useState(false);
  const [pinLoginLoading, setPinLoginLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otpPhone, setOtpPhone] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpMessage, setOtpMessage] = useState('');
  
  // Check if country code is Kenyan (+254)
  const isKenyanNumber = countryCode === '+254';

  // Build full international phone (digits only) for API calls
  const getFullInternationalPhone = () => {
    const ccDigits = (countryCode || '').replace(/\D/g, '');
    const phoneDigits = (phone || '').replace(/\D/g, '');
    if (!phoneDigits) return '';
    if (isKenyanNumber) return normalizePhoneNumber(phone);
    return ccDigits + phoneDigits;
  };

  useEffect(() => {
    if (!phone) {
      setHasPin(false);
      return;
    }

    const digits = phone.replace(/\D/g, '');
    if (isKenyanNumber && digits.length < 9) {
      setHasPin(false);
      return;
    }
    if (!isKenyanNumber && digits.length < 6) {
      setHasPin(false);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingPin(true);
      try {
        const normalizedPhone = getFullInternationalPhone();
        if (!normalizedPhone) {
          setHasPin(false);
          return;
        }
        console.log('🔍 Checking PIN status for phone:', phone, 'country:', countryCode, '-> normalized:', normalizedPhone);
        const response = await api.post('/auth/check-pin-status', { phone: normalizedPhone });
        console.log('📱 PIN status response:', response.data);
        if (response.data.success) {
          const hasPinValue = response.data.hasPin || false;
          console.log('✅ PIN status:', hasPinValue ? 'HAS PIN' : 'NO PIN');
          setHasPin(hasPinValue);
        } else {
          console.log('❌ PIN status check failed:', response.data.error);
          setHasPin(false);
        }
      } catch (err) {
        console.error('❌ PIN status check error:', err);
        console.error('   Error details:', err.response?.data);
        setHasPin(false);
      } finally {
        setCheckingPin(false);
      }
    }, 600); // debounce to avoid excessive requests

    return () => clearTimeout(timer);
  }, [phone, countryCode, isKenyanNumber]);

  const sanitizePhoneInput = (value) => value.replace(/[^\d+]/g, '');

  // Normalize phone number: convert leading 0 to 254, or if starts with 7 and is 9 digits, add 254
  const normalizePhoneNumber = (phone) => {
    if (!phone) return phone;
    const digits = phone.replace(/\D/g, '');
    if (!digits) return phone;
    
    // If starts with 0 and is 10 digits, convert to 254 format
    if (digits.startsWith('0') && digits.length === 10) {
      return `254${digits.slice(1)}`;
    }
    
    // If starts with 7 and is 9 digits, add 254 prefix
    if (digits.startsWith('7') && digits.length === 9) {
      return `254${digits}`;
    }
    
    // If already starts with 254, return as is
    if (digits.startsWith('254') && digits.length === 12) {
      return digits;
    }
    
    // Otherwise return the digits as entered
    return digits;
  };

  const handleLoginWithPin = async (e) => {
    e.preventDefault();
    setError('');

    if (!phone) {
      setError('Please enter your phone number');
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setError('Please enter your 4-digit PIN');
      return;
    }

    setPinLoginLoading(true);

    try {
      const normalizedPhone = getFullInternationalPhone();
      if (!normalizedPhone) {
        setError('Please enter your phone number');
        setPinLoginLoading(false);
        return;
      }
      const response = await api.post('/auth/login', {
        phone: normalizedPhone,
        pin
      });

      if (response.data.success && response.data.customer) {
        const customerData = {
          id: response.data.customer.id,
          email: response.data.customer.email || null,
          phone: response.data.customer.phone || phone,
          customerName: response.data.customer.customerName,
          username: response.data.customer.username,
          loggedInAt: new Date().toISOString()
        };

        localStorage.setItem('customerOrder', JSON.stringify(customerData));
        localStorage.setItem('customerLoggedIn', 'true');

        login(customerData);
        navigate('/orders');
      } else {
        setError(response.data.error || 'Failed to log in with PIN. Please try again.');
      }
    } catch (err) {
      console.error('PIN login error:', err);
      const message =
        err.response?.data?.error ||
        'Failed to log in with PIN. Please try again or request an OTP to reset your PIN.';
      setError(message);
    } finally {
      setPinLoginLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setError('');

    if (isKenyanNumber) {
      if (!phone) {
        setError('Please enter your phone number');
        return;
      }
    } else {
    if (!phone) {
      setError('Please enter your phone number');
      return;
      }
      if (!email) {
        setError('Please enter your email address');
        return;
      }
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError('Please enter a valid email address');
        return;
      }
    }

    setOtpLoading(true);

    try {
      // Normalize phone number for Kenyan numbers (convert 0 to 254)
      const normalizedPhone = isKenyanNumber ? normalizePhoneNumber(phone) : `${countryCode}${phone}`;
      const requestData = {
        phone: normalizedPhone,
        userType: 'customer'
      };
      
      if (!isKenyanNumber) {
        requestData.email = email;
        requestData.countryCode = countryCode;
      }

      const response = await api.post('/auth/send-otp', requestData);

      const { success, error: responseError, note, message, smsFailed, emailSent } = response.data || {};
      setOtpPhone(normalizedPhone);
      if (!isKenyanNumber) {
        setOtpEmail(email);
      }
      
      // Always proceed to OTP entry if OTP was generated (success: true)
      // Even if SMS/email failed, admin can provide the code
      if (success) {
        setError('');
        let info = '';
        if (isKenyanNumber) {
          info = smsFailed
          ? (note || message || 'SMS delivery failed. Please contact administrator for the OTP code.')
          : (message || 'OTP sent successfully. Enter the code you received.');
        } else {
          info = emailSent
            ? (message || 'OTP sent successfully to your email. Enter the code you received.')
            : (note || message || 'Email delivery failed. Please contact administrator for the OTP code.');
        }
        setOtpMessage(info);
        setShowOtpVerification(true);
      } else {
        // Only show error if OTP generation itself failed
        setError(responseError || 'Failed to generate OTP. Please try again.');
      }
    } catch (err) {
      console.error('Send OTP error:', err);
      const status = err.response?.status;
      const responseData = err.response?.data || {};
      const apiError = responseData.error || responseData.message || 'Failed to send OTP. Please try again.';
      
      // If OTP code is present in error response, still allow OTP entry
      // Admin can provide the code from dashboard
      if (responseData.otpCode || status === 402) {
        setError('');
        const normalizedPhone = isKenyanNumber ? normalizePhoneNumber(phone) : `${countryCode}${phone}`;
        setOtpPhone(normalizedPhone);
        if (!isKenyanNumber) {
          setOtpEmail(email);
        }
        setOtpMessage(
          responseData.note || 
          `${apiError} Enter the OTP shared with you by support to continue.`
        );
        setShowOtpVerification(true);
      } else {
        setError(apiError);
      }
    } finally {
      setOtpLoading(false);
    }
  };

  if (showOtpVerification) {
    return (
      <OtpVerification
        phone={otpPhone}
        email={otpEmail}
        infoMessage={otpMessage}
        onBack={() => {
          setShowOtpVerification(false);
          setOtpPhone('');
          setOtpEmail('');
          setOtpMessage('');
          setError('');
        }}
      />
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <PhoneIphone sx={{ fontSize: 64, color: '#00E0B8', mb: 2 }} />
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: '#00E0B8' }}>
            Customer Login
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Log in with your phone number. First-time users will receive an OTP to create a PIN.
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleLoginWithPin}>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Country</InputLabel>
              <Select
                value={countryCode}
                label="Country"
                onChange={(e) => {
                  setCountryCode(e.target.value);
                  setError('');
                  // Clear email when switching to Kenyan number
                  if (e.target.value === '+254') {
                    setEmail('');
                  }
                }}
                disabled={pinLoginLoading || otpLoading || checkingPin}
              >
                <MenuItem value="+254">+254 (KE)</MenuItem>
                <MenuItem value="+1">+1 (US/CA)</MenuItem>
                <MenuItem value="+44">+44 (UK)</MenuItem>
                <MenuItem value="+27">+27 (ZA)</MenuItem>
                <MenuItem value="+234">+234 (NG)</MenuItem>
                <MenuItem value="+255">+255 (TZ)</MenuItem>
                <MenuItem value="+256">+256 (UG)</MenuItem>
                <MenuItem value="+250">+250 (RW)</MenuItem>
                <MenuItem value="+233">+233 (GH)</MenuItem>
              </Select>
            </FormControl>
          <TextField
            label="Phone Number"
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(sanitizePhoneInput(e.target.value));
              setError('');
            }}
            fullWidth
              placeholder={isKenyanNumber ? "712345678" : "Enter phone number"}
            disabled={pinLoginLoading || otpLoading || checkingPin}
            autoComplete="tel"
          />
          </Box>
          
          {!isKenyanNumber && !hasPin && (
            <TextField
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value.trim());
                setError('');
              }}
              fullWidth
              sx={{ mb: 2 }}
              placeholder="your.email@example.com"
              disabled={pinLoginLoading || otpLoading || checkingPin}
              autoComplete="email"
              required
            />
          )}

          {hasPin && (
            <>
              <TextField
                label="4-Digit PIN"
                type="password"
                value={pin}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPin(digitsOnly);
                  setError('');
                }}
                fullWidth
                sx={{ mb: 2 }}
                placeholder="Enter PIN"
                disabled={pinLoginLoading || otpLoading}
                inputProps={{
                  maxLength: 4,
                  inputMode: 'numeric',
                  style: { textAlign: 'center', letterSpacing: '8px', fontSize: '24px' }
                }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
                Forgot your PIN? Request an OTP to reset it.
              </Typography>
            </>
          )}

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            startIcon={<Lock />}
            disabled={
              !hasPin ||
              pinLoginLoading ||
              otpLoading ||
              checkingPin ||
              pin.length !== 4 ||
              !phone
            }
            sx={{
              backgroundColor: '#00E0B8',
              color: '#0D0D0D',
              mb: 2,
              '&:hover': {
                backgroundColor: '#00C4A3'
              }
            }}
          >
            {pinLoginLoading ? 'Logging in...' : 'Log In with PIN'}
          </Button>

          <Button
            type="button"
            variant="outlined"
            fullWidth
            size="large"
            startIcon={<Sms />}
            disabled={otpLoading || pinLoginLoading || !phone || (!isKenyanNumber && !email)}
            onClick={handleSendOtp}
            sx={{
              borderColor: '#00E0B8',
              color: '#00E0B8',
              '&:hover': {
                borderColor: '#00C4A3',
                backgroundColor: 'rgba(0, 224, 184, 0.1)'
              }
            }}
          >
            {otpLoading ? 'Sending OTP...' : 'Send OTP'}
          </Button>
        </Box>

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
      </Paper>
    </Container>
  );
};

export default CustomerLogin;

