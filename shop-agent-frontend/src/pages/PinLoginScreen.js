import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import './Login.css';

const PinLoginScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const phoneNumber = location.state?.phoneNumber || '';
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!phoneNumber) {
      navigate('/');
    }
  }, [phoneNumber, navigate]);

  const handleLogin = async (e) => {
    e?.preventDefault();
    setError('');

    if (pin.length !== 4) {
      setError('Please enter your 4-digit PIN');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/shop-agents/login', {
        mobileNumber: phoneNumber,
        pin: pin
      });

      if (response.data.success) {
        localStorage.setItem('shopAgentToken', response.data.token);
        localStorage.setItem('shopAgentUser', JSON.stringify(response.data.user));
        navigate('/dashboard');
      } else {
        setError(response.data.error || 'Login failed');
        setPin('');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || 'Incorrect PIN. Please try again.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPin = async () => {
    // Request OTP for PIN reset
    setLoading(true);
    setError('');
    
    try {
      const response = await api.post('/auth/send-otp', {
        phone: phoneNumber,
        userType: 'shop_agent',
        resetPin: true
      });

      if (response.data.success) {
        // Navigate to OTP verification for PIN reset
        navigate('/otp-verification', { 
          state: { 
            phoneNumber: phoneNumber,
            isResetPin: true 
          } 
        });
      } else {
        setError(response.data.error || 'Failed to send OTP for PIN reset');
      }
    } catch (err) {
      console.error('Forgot PIN error:', err);
      setError(err.response?.data?.error || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Enter Your PIN</h1>
        <p className="subtitle">
          Enter your 4-digit PIN to continue
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label>PIN</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => {
                const numericText = e.target.value.replace(/\D/g, '').slice(0, 4);
                setPin(numericText);
                setError('');
              }}
              placeholder="0000"
              maxLength={4}
              disabled={loading}
              autoFocus
              required
              style={{
                textAlign: 'center',
                fontSize: '32px',
                letterSpacing: '20px',
                fontWeight: 'bold',
                color: '#00E0B8'
              }}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || pin.length !== 4}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <button
            type="button"
            onClick={handleForgotPin}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#00E0B8',
              marginTop: '20px',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Forgot PIN?
          </button>
        </form>
      </div>
    </div>
  );
};

export default PinLoginScreen;


