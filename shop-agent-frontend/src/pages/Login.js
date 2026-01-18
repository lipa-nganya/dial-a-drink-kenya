import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const [mobileNumber, setMobileNumber] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!mobileNumber.trim()) {
      setError('Mobile number is required');
      return;
    }

    if (pin.length !== 4) {
      setError('PIN must be 4 digits');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/shop-agents/login', {
        mobileNumber: mobileNumber.trim(),
        pin
      });

      if (response.data.success) {
        localStorage.setItem('shopAgentToken', response.data.token);
        localStorage.setItem('shopAgentUser', JSON.stringify(response.data.user));
        navigate('/dashboard');
      } else {
        setError(response.data.error || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Shop Agent Login</h1>
        <p className="subtitle">Enter your mobile number and PIN</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label>Mobile Number</label>
            <input
              type="tel"
              value={mobileNumber}
              onChange={(e) => {
                setMobileNumber(e.target.value);
                setError('');
              }}
              placeholder="e.g., +254712345678"
              disabled={loading}
              required
            />
          </div>

          <div className="input-group">
            <label>PIN</label>
            <input
              type="text"
              value={pin}
              onChange={(e) => {
                const numericText = e.target.value.replace(/\D/g, '').slice(0, 4);
                setPin(numericText);
                setError('');
              }}
              placeholder="0000"
              maxLength={4}
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !mobileNumber.trim() || pin.length !== 4}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;


