import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './Login.css';

const PhoneNumberScreen = () => {
  const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatPhoneNumber = (phone) => {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If starts with 0, replace with 254
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    } else if (!cleaned.startsWith('254')) {
      // If doesn't start with 254 and is 9 digits, add 254
      if (cleaned.length === 9 && cleaned.startsWith('7')) {
        cleaned = '254' + cleaned;
      }
    }
    
    return cleaned;
  };

  const validatePhoneNumber = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 9 && (cleaned.startsWith('07') || cleaned.startsWith('2547') || (cleaned.startsWith('7') && cleaned.length === 9));
  };

  const handleContinue = async (e) => {
    e?.preventDefault();
    setError('');

    if (!phoneNumber.trim()) {
      setError('Please enter your phone number');
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      setError('Please enter a valid Safaricom phone number');
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      
      // Check if shop agent exists and has PIN set
      try {
        const response = await api.get(`/shop-agents/phone/${formattedPhone}`);
        
        if (response.data && response.data.hasPin) {
          // PIN is set, navigate to PIN login (no OTP needed)
          navigate('/pin-login', { state: { phoneNumber: formattedPhone } });
        } else {
          // PIN not set, send OTP first for verification before PIN setup
          try {
            const otpResponse = await api.post('/auth/send-otp', {
              phone: formattedPhone,
              userType: 'shop_agent'
            });

            if (otpResponse.data.success) {
              navigate('/otp-verification', { state: { phoneNumber: formattedPhone } });
            } else {
              // Check if error indicates PIN already exists
              if (otpResponse.data.shouldUsePinLogin) {
                navigate('/pin-login', { state: { phoneNumber: formattedPhone } });
              } else {
                setError(otpResponse.data.error || 'Failed to send OTP');
              }
            }
          } catch (otpError) {
            // Handle case where backend rejects OTP because PIN exists
            if (otpError.response?.data?.shouldUsePinLogin) {
              navigate('/pin-login', { state: { phoneNumber: formattedPhone } });
            } else {
              setError(otpError.response?.data?.error || 'Failed to send OTP. Please try again.');
            }
          }
        }
      } catch (agentError) {
        if (agentError.response?.status === 404) {
          setError('Shop agent account not found. Please contact administrator.');
        } else {
          setError(agentError.response?.data?.error || 'Failed to verify phone number. Please try again.');
        }
      }
    } catch (err) {
      console.error('Error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Enter Your Phone Number</h1>
        <p className="subtitle">
          Enter your phone number to continue. If you have a PIN set, you'll be asked to enter it. Otherwise, you'll be asked to create one.
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleContinue}>
          <div className="input-group">
            <label>Phone Number</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
                setError('');
              }}
              placeholder="0712345678"
              disabled={loading}
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !phoneNumber.trim()}
          >
            {loading ? 'Checking...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PhoneNumberScreen;

