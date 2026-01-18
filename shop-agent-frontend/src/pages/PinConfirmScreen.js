import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import './Login.css';

const PinConfirmScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { phoneNumber, pin } = location.state || {};
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!phoneNumber || !pin) {
      navigate('/');
    }
  }, [phoneNumber, pin, navigate]);

  const handleConfirm = async (e) => {
    e?.preventDefault();
    setError('');

    if (confirmPin.length !== 4) {
      setError('PIN must be 4 digits');
      return;
    }

    if (confirmPin !== pin) {
      setError('PINs do not match. Please try again.');
      setConfirmPin('');
      return;
    }

    setLoading(true);
    try {
      // Set PIN using phone number with OTP verification
      const otpCode = location.state?.otpCode;
      const response = await api.post('/shop-agents/set-pin', {
        mobileNumber: phoneNumber,
        pin: confirmPin,
        otpCode: otpCode // Include OTP code for verification
      });

      if (response.data.success) {
        localStorage.setItem('shopAgentToken', response.data.token);
        localStorage.setItem('shopAgentUser', JSON.stringify(response.data.user));
        navigate('/dashboard');
      } else {
        setError(response.data.error || 'Failed to set PIN');
        setConfirmPin('');
      }
    } catch (err) {
      console.error('Error confirming PIN:', err);
      setError(err.response?.data?.error || 'Failed to set PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Confirm Your PIN</h1>
        <p className="subtitle">
          Enter your PIN again to confirm
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleConfirm}>
          <div className="input-group">
            <label>Confirm PIN</label>
            <input
              type="password"
              value={confirmPin}
              onChange={(e) => {
                const numericText = e.target.value.replace(/\D/g, '').slice(0, 4);
                setConfirmPin(numericText);
                setError('');
              }}
              placeholder="0000"
              maxLength={4}
              disabled={loading}
              autoFocus
              autoComplete="new-password"
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
            disabled={loading || confirmPin.length !== 4}
          >
            {loading ? 'Setting PIN...' : 'Confirm PIN'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PinConfirmScreen;

