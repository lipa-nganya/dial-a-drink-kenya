import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './SetupPin.css';

const SetupPin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState(1); // 1: Enter PIN, 2: Confirm PIN
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing invitation token');
    }
  }, [token]);

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pin.length !== 4) {
      setError('PIN must be 4 digits');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleConfirmPin = async (e) => {
    e.preventDefault();
    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    if (!token) {
      setError('Invalid invitation token');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/shop-agents/setup-pin', {
        token,
        pin
      });

      if (response.data.success) {
        // Save token and user info
        localStorage.setItem('shopAgentToken', response.data.token);
        localStorage.setItem('shopAgentUser', JSON.stringify(response.data.user));
        
        // Navigate to dashboard
        navigate('/dashboard');
      } else {
        setError(response.data.error || 'Failed to set PIN');
      }
    } catch (err) {
      console.error('Error setting PIN:', err);
      setError(err.response?.data?.error || 'Failed to set PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="setup-pin-container">
        <div className="setup-pin-card">
          <h1>Invalid Invitation</h1>
          <p>The invitation link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-pin-container">
      <div className="setup-pin-card">
        <h1>Set Your PIN</h1>
        <p className="subtitle">Create a 4-digit PIN for secure login</p>

        {error && <div className="error-message">{error}</div>}

        {step === 1 ? (
          <form onSubmit={handlePinSubmit}>
            <div className="pin-input-container">
              <input
                type="text"
                className="pin-input"
                value={pin}
                onChange={(e) => {
                  const numericText = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPin(numericText);
                  setError('');
                }}
                placeholder="0000"
                maxLength={4}
                autoFocus
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={pin.length !== 4 || loading}
            >
              Continue
            </button>
          </form>
        ) : (
          <form onSubmit={handleConfirmPin}>
            <div className="pin-input-container">
              <input
                type="text"
                className="pin-input"
                value={confirmPin}
                onChange={(e) => {
                  const numericText = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setConfirmPin(numericText);
                  setError('');
                }}
                placeholder="0000"
                maxLength={4}
                autoFocus
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={confirmPin.length !== 4 || loading}
            >
              {loading ? 'Setting PIN...' : 'Confirm PIN'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setStep(1);
                setConfirmPin('');
                setError('');
              }}
              disabled={loading}
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default SetupPin;


