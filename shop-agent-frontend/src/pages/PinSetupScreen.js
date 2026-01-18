import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Login.css';

const PinSetupScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const phoneNumber = location.state?.phoneNumber || '';
  const otpCode = location.state?.otpCode;
  const isResetPin = location.state?.isResetPin || false;
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!phoneNumber) {
      navigate('/');
    }
  }, [phoneNumber, navigate]);

  const handleContinue = (e) => {
    e?.preventDefault();
    setError('');

    if (pin.length !== 4) {
      setError('PIN must be 4 digits');
      return;
    }

    // Navigate to PIN confirmation with OTP code
    navigate('/pin-confirm', { 
      state: { 
        phoneNumber, 
        pin,
        otpCode,
        isResetPin 
      } 
    });
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>{isResetPin ? 'Reset Your PIN' : 'Set Your PIN'}</h1>
        <p className="subtitle">
          {isResetPin ? 'Create a new 4-digit PIN' : 'Create a 4-digit PIN for secure login'}
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleContinue}>
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
            Continue
          </button>
        </form>
      </div>
    </div>
  );
};

export default PinSetupScreen;


