import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Container, Paper, Typography, CircularProgress, Alert } from '@mui/material';
import { CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import { api } from '../services/api';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [status, setStatus] = useState('checking'); // 'checking', 'success', 'error'
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (!orderId) {
        setError('Order ID not found');
        setStatus('error');
        return;
      }

      try {
        // CRITICAL: Immediately check and finalize payment status with PesaPal
        // This ensures payment is marked as completed as soon as backend confirms success
        try {
          const transactionStatusResponse = await api.get(`/pesapal/transaction-status/${orderId}`);
          console.log('💳 PesaPal transaction status check:', transactionStatusResponse.data);
          
          // If transaction status is completed, payment is confirmed
          if (transactionStatusResponse.data && transactionStatusResponse.data.status === 'completed') {
            // Payment confirmed - redirect to order success page
            setStatus('success');
            
            setTimeout(() => {
              navigate('/order-success', {
                state: {
                  orderId: orderId,
                  paymentPending: false,
                  paymentMethod: 'card',
                  paymentProvider: 'pesapal'
                }
              });
            }, 1500);
            return; // Exit early
          }
        } catch (statusError) {
          console.error('Error checking transaction status:', statusError);
          // Continue to order check below
        }
        
        // Fallback: Check order status
        const orderResponse = await api.get(`/orders/${orderId}`);
        const order = orderResponse.data;

        if (order.paymentStatus === 'paid') {
          // Payment successful - redirect to order success page
          setStatus('success');
          
          // Small delay to show success message, then redirect
          setTimeout(() => {
            navigate('/order-success', {
              state: {
                orderId: orderId,
                paymentPending: false,
                paymentMethod: 'card',
                paymentProvider: 'pesapal'
              }
            });
          }, 1500);
        } else {
          // Payment not confirmed yet - redirect to order success page with pending status
          // The OrderSuccess page will poll for payment confirmation
          navigate('/order-success', {
            state: {
              orderId: orderId,
              paymentPending: true,
              paymentMessage: 'Payment is being processed. Please wait...',
              paymentMethod: 'card',
              paymentProvider: 'pesapal'
            }
          });
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
        setError('Failed to verify payment status. Please check your orders.');
        setStatus('error');
        
        // Still redirect to order success page after delay
        setTimeout(() => {
          navigate('/order-success', {
            state: {
              orderId: orderId,
              paymentPending: true,
              paymentMethod: 'card',
              paymentProvider: 'pesapal'
            }
          });
        }, 3000);
      }
    };

    checkPaymentStatus();
  }, [orderId, navigate]);

  if (status === 'checking') {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Verifying Payment...
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Please wait while we confirm your payment
          </Typography>
        </Paper>
      </Container>
    );
  }

  if (status === 'success') {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircle sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            Payment Successful!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Redirecting to order confirmation...
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <ErrorIcon sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />
        <Typography variant="h4" gutterBottom>
          Payment Verification
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Typography variant="body1" color="text.secondary">
          Redirecting to order page...
        </Typography>
      </Paper>
    </Container>
  );
};

export default PaymentSuccess;
