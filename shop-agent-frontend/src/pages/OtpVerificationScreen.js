import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import './Login.css';

const OtpVerificationScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const phoneNumber = location.state?.phoneNumber || '';
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!phoneNumber) {
      navigate('/');
    }
  }, [phoneNumber, navigate]);

  const handleVerify = async (e) => {
    e?.preventDefault();
    setError('');

    // Shop agents use 4-digit OTP
    if (otp.length !== 4) {
      setError('Please enter the complete 4-digit OTP code');
      return;
    }

    setLoading(true);
    try {
      // Verify OTP - we'll need to add this endpoint or use the existing auth verify-otp
      const response = await api.post('/auth/verify-otp', {
        phone: phoneNumber,
        otpCode: otp,
        userType: 'shop_agent'
      });

      if (response.data.success) {
        // OTP verified, navigate to PIN setup with OTP code for verification
        const isResetPin = location.state?.isResetPin || false;
        navigate('/pin-setup', { 
          state: { 
            phoneNumber,
            otpCode: otp,
            isResetPin 
          } 
        });
      } else {
        setError(response.data.error || 'Invalid OTP code');
        setOtp('');
      }
    } catch (err) {
      console.error('OTP verification error:', err);
      setError(err.response?.data?.error || 'Invalid OTP code. Please try again.');
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    setError('');
    try {
      const isResetPin = location.state?.isResetPin || false;
      const response = await api.post('/auth/send-otp', {
        phone: phoneNumber,
        userType: 'shop_agent',
        resetPin: isResetPin
      });

      if (response.data.success) {
        setError('');
        alert('OTP sent successfully');
      } else {
        setError(response.data.error || 'Failed to resend OTP');
      }
    } catch (err) {
      console.error('Resend OTP error:', err);
      setError(err.response?.data?.error || 'Failed to resend OTP. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Verify OTP</h1>
        <p className="subtitle">
          Enter the OTP code sent to {phoneNumber}
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleVerify}>
          <div className="input-group">
            <label>OTP Code</label>
            <input
              type="text"
              value={otp}
              onChange={(e) => {
                const numericText = e.target.value.replace(/\D/g, '').slice(0, 4);
                setOtp(numericText);
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
            disabled={loading || otp.length !== 4}
          >
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>

          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resending}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#00E0B8',
              marginTop: '20px',
              cursor: resending ? 'not-allowed' : 'pointer',
              textDecoration: 'underline',
              opacity: resending ? 0.6 : 1
            }}
          >
            {resending ? 'Resending...' : 'Resend OTP'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default OtpVerificationScreen;


