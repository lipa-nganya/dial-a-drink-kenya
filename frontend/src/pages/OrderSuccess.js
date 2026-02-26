/* eslint-disable react-hooks/exhaustive-deps, no-use-before-define */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Container, Typography, Box, Button, Paper, CircularProgress, Alert } from '@mui/material';
import { CheckCircle, PhoneAndroid, Assignment, Login } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { useCart } from '../contexts/CartContext';
import { useCustomer } from '../contexts/CustomerContext';
import OrderTracking from './OrderTracking';
import io from 'socket.io-client';
import { getBackendUrl } from '../utils/backendUrl';

const OrderSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCart } = useCart();
  // Always use light mode
  const { isLoggedIn, login: loginCustomer } = useCustomer();
  const orderId = location.state?.orderId;
  const paymentPending = location.state?.paymentPending || false;
  const paymentMessage = location.state?.paymentMessage;
  const paymentMethod = location.state?.paymentMethod || 'mobile_money'; // 'mobile_money' or 'card'
  const paymentProvider = location.state?.paymentProvider || 'mpesa'; // 'mpesa' or 'pesapal'
  const [, setOrderStatus] = useState(null);
  const [, setIsPolling] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [autoLoggingIn, setAutoLoggingIn] = useState(false);
  const [transactionData, setTransactionData] = useState(null);
  const [currentTransactionStatus, setCurrentTransactionStatus] = useState('pending'); // Track current transaction status for display
  const [pollingTimedOut, setPollingTimedOut] = useState(false);
  const hasAutoLoggedInRef = useRef(false); // Use ref to prevent re-renders
  const isProcessingRef = useRef(false); // Use ref for processing flag
  const pollStartRef = useRef(null);

  // Auto-login function
  const autoLoginCustomer = useCallback(async (orderId) => {
    // Prevent multiple auto-login attempts
    if (hasAutoLoggedInRef.current || autoLoggingIn) {
      console.log('Auto-login already completed or in progress, skipping...');
      return;
    }
    try {
      hasAutoLoggedInRef.current = true; // Mark as in progress immediately
      setAutoLoggingIn(true);
      
      // First, fetch the order to get customer details
      const orderResponse = await api.get(`/orders/${orderId}`);
      const order = orderResponse.data;
      
      if (!order) {
        console.error('Order not found for auto-login');
        setShowLogin(true); // Fallback to manual login
        setAutoLoggingIn(false);
        hasAutoLoggedInRef.current = false; // Reset flag on error
        return;
      }

      // Use order's phone to log in (phone-only login)
      const loginResponse = await api.post('/orders/find', {
        phone: order.customerPhone || null,
        orderId: orderId
      });

      if (loginResponse.data.success && loginResponse.data.order) {
        // Store order info in localStorage for tracking
        const customerOrderData = {
          orderId: loginResponse.data.order.id,
          email: order.customerEmail,
          phone: order.customerPhone,
          customerName: order.customerName,
          loggedInAt: new Date().toISOString()
        };
        
        // Update CustomerContext
        loginCustomer(customerOrderData);
        
        // Set logged in state and order data
        setLoggedIn(true);
        setOrderData(loginResponse.data.order);
        setAutoLoggingIn(false);
        console.log('✅✅✅ Customer automatically logged in after payment confirmation');
        console.log('   Order ID:', loginResponse.data.order.id);
        console.log('   Customer:', order.customerName);
        console.log('   Phone:', order.customerPhone);
        console.log('   Email:', order.customerEmail || 'N/A');
      } else {
        // If auto-login fails, show login form
        console.log('⚠️  Auto-login failed, showing login form');
        setShowLogin(true);
        setAutoLoggingIn(false);
        hasAutoLoggedInRef.current = false; // Reset flag on failure
      }
    } catch (error) {
      console.error('Error during auto-login:', error);
      // If auto-login fails, show login form
      setShowLogin(true);
      setAutoLoggingIn(false);
      hasAutoLoggedInRef.current = false; // Reset flag on error
    }
  }, [autoLoggingIn, loginCustomer]);

  // Auto-login if payment is already confirmed (e.g., from PaymentSuccess redirect)
  useEffect(() => {
    if (!paymentPending && orderId && !paymentConfirmed && !hasAutoLoggedInRef.current && !autoLoggingIn) {
      // Payment is already confirmed, auto-login immediately
      const checkAndAutoLogin = async () => {
        try {
          console.log('🔍 Checking order status for auto-login...', { orderId, paymentPending });
          const orderResponse = await api.get(`/orders/${orderId}`);
          const order = orderResponse.data;
          
          console.log('📦 Order data:', {
            orderId: order.id,
            paymentStatus: order.paymentStatus,
            status: order.status
          });
          
          if (order && order.paymentStatus === 'paid') {
            console.log('✅ Payment already confirmed, auto-logging in customer...');
            isProcessingRef.current = true;
            setPaymentConfirmed(true);
            setOrderStatus(order.status || 'confirmed');
            setCurrentTransactionStatus('completed');
            
            // Try to get transaction data
            try {
              if (paymentProvider === 'pesapal') {
                const transactionResponse = await api.get(`/pesapal/transaction-status/${orderId}`);
                if (transactionResponse.data && transactionResponse.data.status === 'completed') {
                  setTransactionData({
                    transactionId: transactionResponse.data.transactionId,
                    orderId: orderId,
                    status: 'completed',
                    receiptNumber: transactionResponse.data.receiptNumber,
                    amount: transactionResponse.data.amount || order.totalAmount,
                    paymentProvider: 'pesapal',
                    paymentMethod: 'card'
                  });
                }
              } else {
                const transactionResponse = await api.get(`/mpesa/transaction-status/${orderId}`);
                if (transactionResponse.data && transactionResponse.data.status === 'completed') {
                  setTransactionData(transactionResponse.data);
                }
              }
            } catch (error) {
              console.log('Could not fetch transaction details, using order data');
            }
            
            clearCart();
            await autoLoginCustomer(orderId);
            console.log('✅ Auto-login completed for confirmed payment');
          } else {
            console.log('⚠️  Payment not confirmed yet, will wait for confirmation');
            // If payment is not confirmed, set paymentPending to true to trigger polling
            // This shouldn't happen if PaymentSuccess checked correctly, but handle it anyway
          }
        } catch (error) {
          console.error('❌ Error checking order status for auto-login:', error);
          // If error, still try to show login form
          setShowLogin(true);
        }
      };
      
      checkAndAutoLogin();
    }
  }, [paymentPending, orderId, paymentConfirmed, autoLoginCustomer, clearCart, autoLoggingIn, paymentProvider]);

  useEffect(() => {
    if (paymentPending && orderId) {
      // Set up Socket.IO listener for real-time payment confirmation
      const socketUrl = getBackendUrl();
      const socket = io(socketUrl);
      
      // Join the order-specific room to listen for payment confirmation
      socket.emit('join-order', orderId);
      
      // Listen for payment confirmation event
      socket.on('payment-confirmed', async (data) => {
        console.log('✅ Payment confirmed via Socket.IO:', data);
        if (data.orderId === orderId && !paymentConfirmed && !hasAutoLoggedInRef.current && !isProcessingRef.current) {
          isProcessingRef.current = true;
          setPaymentConfirmed(true);
          setOrderStatus('confirmed');
          setIsPolling(false);
          clearCart();
          
          // Store transaction data from Socket.IO event if available
          if (data.transactionStatus === 'completed' || data.receiptNumber) {
            // Update transaction status display
            setCurrentTransactionStatus('completed');
            
            setTransactionData({
              transactionId: data.transactionId,
              orderId: data.orderId,
              status: 'completed',
              receiptNumber: data.receiptNumber,
              amount: data.amount,
              paymentProvider: data.paymentProvider || paymentProvider,
              paymentMethod: data.paymentMethod || paymentMethod
            });
          } else {
            // Update status even if not completed
            if (data.transactionStatus) {
              setCurrentTransactionStatus(data.transactionStatus);
            }
            
            // Fetch transaction details
            try {
              const transactionResponse = await api.get(`/mpesa/transaction-status/${orderId}`);
              if (transactionResponse.data && transactionResponse.data.status === 'completed') {
                setTransactionData(transactionResponse.data);
                setCurrentTransactionStatus('completed');
              } else if (transactionResponse.data?.status) {
                setCurrentTransactionStatus(transactionResponse.data.status);
              }
            } catch (error) {
              console.error('Error fetching transaction details:', error);
            }
          }
          
          socket.disconnect();
          
          // Automatically log in the customer (only once)
          await autoLoginCustomer(orderId);
        }
      });
      
      // Start polling for payment status as backup
      setIsPolling(true);
      pollStartRef.current = Date.now();
      setPollingTimedOut(false);
      const MAX_POLL_DURATION_MS = 180000; // 3 minutes
      let pollInterval = null;

      const pollForPayment = async () => {
        // Check if already confirmed/logged in before polling
        if (isProcessingRef.current || hasAutoLoggedInRef.current) {
          // Stop polling if already processing or logged in
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          return;
        }
        
        try {
          if (
            !pollingTimedOut &&
            pollStartRef.current &&
            Date.now() - pollStartRef.current > MAX_POLL_DURATION_MS
          ) {
            setPollingTimedOut(true);
            setIsPolling(false);
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
            return;
          }

          // Check payment status based on payment provider
          if (paymentProvider === 'pesapal') {
            // For PesaPal card payments, check transaction status
            const transactionResponse = await api.get(`/pesapal/transaction-status/${orderId}`).catch(() => {
              return { data: { status: 'pending', transactionId: null } };
            });
            
            const orderResponse = await api.get(`/orders/${orderId}`).catch(() => null);
            const orderStatus = orderResponse?.data?.status;
            const transactionStatus = transactionResponse?.data?.status || 'pending';
            const hasReceiptNumber = transactionResponse?.data?.receiptNumber;
            
            setCurrentTransactionStatus(transactionStatus);
            
            // Check if payment is completed - be more lenient with the check
            const isPaymentCompleted = orderResponse?.data?.paymentStatus === 'paid' || 
                                     transactionStatus === 'completed' ||
                                     (transactionStatus === 'completed' && hasReceiptNumber);
            
            if (isPaymentCompleted) {
              console.log('✅✅✅ PesaPal payment completed detected!');
              console.log('   Transaction status:', transactionStatus);
              console.log('   Order paymentStatus:', orderResponse?.data?.paymentStatus);
              console.log('   Order status:', orderStatus);
              console.log('   Receipt number:', hasReceiptNumber || 'N/A');
              
              if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
              }
              setIsPolling(false);
              socket.disconnect();
              
              if (!isProcessingRef.current && !hasAutoLoggedInRef.current) {
                isProcessingRef.current = true;
                setPaymentConfirmed(true);
                setOrderStatus(orderStatus || 'confirmed');
                setCurrentTransactionStatus('completed');
                
                setTransactionData({
                  transactionId: transactionResponse.data.transactionId,
                  orderId: orderId,
                  status: 'completed',
                  receiptNumber: transactionResponse.data.receiptNumber || `PESAPAL-${orderId}`,
                  amount: transactionResponse.data.amount || orderResponse.data.totalAmount,
                  paymentProvider: 'pesapal',
                  paymentMethod: 'card'
                });
                
                clearCart();
                console.log('🔐 Starting automatic customer login for PesaPal payment...');
                await autoLoginCustomer(orderId);
                console.log('✅✅✅ PesaPal payment flow completed - customer should be logged in and see OrderTracking');
              }
            } else if (transactionStatus === 'pending') {
              setOrderStatus('pending');
            } else {
              setOrderStatus(orderStatus || 'pending');
            }
            return; // Exit early for PesaPal payments
          }

          // M-Pesa payment polling (existing logic)
          // Get transaction first to get checkoutRequestID
          const transactionResponse = await api.get(`/mpesa/transaction-status/${orderId}`).catch((error) => {
            console.log('Transaction status check failed (will retry):', error.response?.status || error.message);
            return { data: { status: 'pending', transactionId: null } };
          });
          
          // Only poll M-Pesa API directly every 30 seconds to avoid rate limits
          // The backend background job handles automatic syncing every 30 seconds, so we don't need frequent polling
          let mpesaPollResponse = null;
          const timeSinceStart = pollStartRef.current ? Date.now() - pollStartRef.current : 0;
          const shouldPollMpesa = transactionResponse?.data?.checkoutRequestID && 
                                   transactionResponse.data.status === 'pending' &&
                                   timeSinceStart > 0 && 
                                   timeSinceStart % 30000 < 10000; // Only poll M-Pesa every 30 seconds
          
          if (shouldPollMpesa) {
            try {
              console.log('🔍 Polling M-Pesa API directly (every 30s to avoid rate limits)...');
              mpesaPollResponse = await api.get(`/mpesa/poll-transaction/${transactionResponse.data.checkoutRequestID}`);
              console.log('📊 M-Pesa API poll response:', mpesaPollResponse?.data);
              
              // If M-Pesa says completed (has receipt number), refresh transaction status
              // Check both status and receiptNumber to confirm completion
              if (mpesaPollResponse?.data?.status === 'completed' || mpesaPollResponse?.data?.receiptNumber) {
                console.log('✅ M-Pesa API confirmed payment completion. Refreshing transaction status...');
                // Re-fetch transaction status to get updated data
                const updatedTransactionResponse = await api.get(`/mpesa/transaction-status/${orderId}`).catch(() => null);
                if (updatedTransactionResponse?.data) {
                  transactionResponse.data = updatedTransactionResponse.data;
                  // Also update payment check response if available
                  if (updatedTransactionResponse.data.receiptNumber) {
                    paymentCheckResponse = { data: { paymentCompleted: true, receiptNumber: updatedTransactionResponse.data.receiptNumber } };
                  }
                }
              }
            } catch (pollError) {
              // Don't log 429 errors - they're expected when polling too frequently
              if (!pollError.message?.includes('429') && !pollError.response?.status === 429) {
                console.log('M-Pesa API poll failed (will continue with regular polling):', pollError.message);
              }
              // Continue with regular polling if M-Pesa API poll fails
            }
          }
          
          // SIMPLE CHECK: Use the new simplified payment check endpoint
          // This directly checks for receipt numbers - most reliable indicator
          // eslint-disable-next-line no-use-before-define
          let paymentCheckResponse = null;
          try {
            paymentCheckResponse = await api.get(`/mpesa/check-payment/${orderId}`);
          } catch (checkError) {
            console.log('Payment check endpoint error:', checkError.message);
          }
          
          // Check both order status and transaction status
          const [orderResponse] = await Promise.all([
            api.get(`/mpesa/status/${orderId}`).catch(() => null)
          ]);
          
          const orderStatus = orderResponse?.data?.status;
          
          // Use the simple payment check first (most reliable)
          const paymentCompleted = paymentCheckResponse?.data?.paymentCompleted === true;
          const receiptNumber = paymentCheckResponse?.data?.receiptNumber;
          
          // Use transaction status as fallback
          const transactionStatus = transactionResponse?.data?.status || 'pending';
          const hasReceiptNumber = transactionResponse?.data?.receiptNumber || receiptNumber;
          
          // Update UI with current transaction status
          const displayStatus = paymentCompleted ? 'completed' : transactionStatus;
          setCurrentTransactionStatus(displayStatus);
          
          // Log full response for debugging
          console.log('🔍 Payment check - Completed:', paymentCompleted, 'Receipt:', receiptNumber || 'none');
          console.log('Polling status - Order:', orderStatus, 'Transaction:', transactionStatus);
          
          // Payment is completed if the simple check says so OR receipt number exists
          const isPaymentCompleted = paymentCompleted || (hasReceiptNumber && transactionStatus === 'completed');
          
          if (isPaymentCompleted) {
            console.log('✅✅✅ Payment completed detected!');
            console.log('   Transaction status:', transactionStatus);
            console.log('   Order status:', orderStatus);
            console.log('   Receipt number:', receiptNumber || 'N/A');
            
            // Payment confirmed! Stop polling immediately
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
            setIsPolling(false);
            socket.disconnect();
            
            // Only process once
            if (!isProcessingRef.current && !hasAutoLoggedInRef.current) {
              isProcessingRef.current = true;
              setPaymentConfirmed(true);
              setOrderStatus('confirmed');
              
              // Store transaction data if available
              if (paymentCheckResponse?.data?.paymentCompleted) {
                // Use data from payment check endpoint (most reliable)
                setTransactionData({
                  transactionId: paymentCheckResponse.data.transactionId,
                  orderId: orderId,
                  status: 'completed',
                  receiptNumber: paymentCheckResponse.data.receiptNumber,
                  amount: paymentCheckResponse.data.amount,
                  phoneNumber: paymentCheckResponse.data.phoneNumber,
                  transactionDate: paymentCheckResponse.data.transactionDate,
                  paymentProvider: 'mpesa',
                  paymentMethod: 'mobile_money'
                });
              } else if (transactionResponse?.data && transactionResponse.data.status === 'completed') {
                setTransactionData(transactionResponse.data);
              } else {
                // If transaction status is still pending but order is confirmed, try to fetch transaction again
                try {
                  const txResponse = await api.get(`/mpesa/transaction-status/${orderId}`);
                  if (txResponse.data && txResponse.data.status === 'completed') {
                    setTransactionData(txResponse.data);
                  } else if (orderResponse?.data) {
                    // Use order data as fallback
                    setTransactionData({
                      orderId: orderId,
                      status: 'completed',
                      amount: orderResponse.data.totalAmount || null,
                      receiptNumber: orderResponse.data.receiptNumber || null,
                      paymentMethod: orderResponse.data.paymentMethod,
                      paymentProvider: 'mpesa'
                    });
                  }
                } catch (error) {
                  console.log('Could not fetch transaction details, using order data');
                }
              }
              
              // Clear cart only after payment is confirmed
              clearCart();
              
              // CRITICAL: Automatically log in the customer (only once)
              // This ensures they can track their order
              console.log('🔐 Starting automatic customer login...');
              await autoLoginCustomer(orderId);
              console.log('🔐 Auto-login completed');
            }
          } else if (transactionStatus === 'pending') {
            // Still pending, continue polling
            setOrderStatus('pending');
          } else {
            // Other transaction status (failed, cancelled, etc.)
            setOrderStatus(orderStatus || 'pending');
          }
        } catch (error) {
          console.error('Error checking payment status:', error);
          // Continue polling on error (unless already processing)
          if (isProcessingRef.current || hasAutoLoggedInRef.current) {
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
          }
        }
      };
      
      pollInterval = setInterval(pollForPayment, 10000); // Poll every 10 seconds (reduced frequency to avoid rate limits - backend handles auto-sync)

      return () => {
        if (pollInterval) {
          clearInterval(pollInterval);
        }
        pollStartRef.current = null;
        socket.disconnect();
        // Reset refs on cleanup
        isProcessingRef.current = false;
      };
    }
  }, [paymentPending, orderId, paymentConfirmed, autoLoginCustomer, clearCart]);

  // If auto-logging in, show loading state
  if (autoLoggingIn) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircle sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
          
          <Typography variant="h4" gutterBottom>
            Payment Confirmed!
          </Typography>
          
          <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
            Your payment has been confirmed
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 4 }}>
            <CircularProgress size={24} />
            <Typography variant="body1" color="text.secondary">
              Logging you in...
            </Typography>
          </Box>
        </Paper>
      </Container>
    );
  }

  // If payment is pending and not yet confirmed, show waiting message
  if (paymentPending && !paymentConfirmed) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          {paymentProvider === 'pesapal' ? (
            <CheckCircle sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
          ) : (
            <PhoneAndroid sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
          )}
          
          <Typography variant="h4" gutterBottom>
            {paymentProvider === 'pesapal' ? 'Payment Processing' : 'Waiting for Payment Confirmation'}
          </Typography>
          
          <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
            {paymentMessage || (paymentProvider === 'pesapal' 
              ? 'Your card payment is being processed. Please wait...' 
              : 'Please complete the payment on your phone')}
          </Typography>
          
          {orderId && (
            <Typography variant="body1" sx={{ mb: 3 }}>
              Order ID: #{orderId}
            </Typography>
          )}
          
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 4 }}>
            <CircularProgress size={24} />
            <Typography variant="body1" color="text.secondary">
              Verifying payment...
            </Typography>
          </Box>
          
          {/* Display current transaction status */}
          <Box sx={{ mb: 3, p: 2, backgroundColor: 'rgba(0, 0, 0, 0.05)', borderRadius: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Payment Status
            </Typography>
            <Typography variant="h6" sx={{ 
              fontWeight: 600,
              color: currentTransactionStatus === 'completed' ? 'success.main' :
                     currentTransactionStatus === 'failed' || currentTransactionStatus === 'cancelled' ? 'error.main' :
                     'warning.main'
            }}>
              {currentTransactionStatus === 'completed' ? '✅ Completed' :
               currentTransactionStatus === 'failed' ? '❌ Failed' :
               currentTransactionStatus === 'cancelled' ? '❌ Cancelled' :
               '⏳ Pending'}
            </Typography>
            {currentTransactionStatus === 'pending' && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Waiting for payment confirmation...
              </Typography>
            )}
          </Box>
          
          <Alert severity="info" sx={{ mb: 3 }}>
            {paymentProvider === 'pesapal' 
              ? 'Your card payment is being verified. This page will automatically update once payment is confirmed.'
              : 'Please check your phone and enter your M-Pesa PIN to complete the payment. This page will automatically update once payment is confirmed.'}
          </Alert>

          {pollingTimedOut && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              We’ve been waiting a little longer than usual. If you already completed the payment, it should reflect shortly.
              Keep this page open or use the confirmation button below after entering your M-Pesa receipt number.
            </Alert>
          )}
          
          {window.location.hostname === 'localhost' && (
            <Alert severity="info" sx={{ mb: 3 }}>
              <strong>Local Development:</strong> M-Pesa callbacks are configured to reach the production server, not your local server. 
              If you've completed payment on your phone, use the button below to manually confirm. Receipt number is optional in local development.
            </Alert>
          )}
          
          {/* Manual confirmation button - visible when payment is taking too long */}
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={async () => {
              // In local dev, receipt is optional
              const isLocalDev = window.location.hostname === 'localhost';
              let receiptNumber = '';
              
              if (!isLocalDev) {
                receiptNumber = window.prompt('If you have completed payment, enter your M-Pesa receipt number (required):') || '';
                if (!receiptNumber) {
                  alert('Receipt number is required to confirm payment.');
                  return;
                }
              } else {
                // Local dev: receipt is optional
                receiptNumber = window.prompt('If you have completed payment, enter your M-Pesa receipt number (optional, press Cancel to skip):') || '';
              }
              
              try {
                const response = await api.post(`/mpesa/manual-confirm/${orderId}`, { receiptNumber });
                if (response.data.success) {
                  setPaymentConfirmed(true);
                  setOrderStatus('confirmed');
                  setCurrentTransactionStatus('completed');
                  clearCart();
                  await autoLoginCustomer(orderId);
                } else {
                  alert(response.data.message || 'Manual confirmation failed. Please try again or wait for automatic confirmation.');
                }
              } catch (error) {
                console.error('Manual confirmation failed:', error);
                const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Manual confirmation failed. Please contact support or wait for automatic confirmation.';
                alert(errorMessage);
              }
            }}
            sx={{ mt: 2 }}
          >
            ✅ I've Completed Payment - Confirm Now
          </Button>
        </Paper>
      </Container>
    );
  }

  // If logged in, show order tracking
  if (loggedIn && orderData) {
    return <OrderTracking order={orderData} />;
  }

  // If payment confirmed, show login form
  if (paymentConfirmed && showLogin) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircle sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
          
          <Typography variant="h4" gutterBottom>
            Payment Confirmed!
          </Typography>
          
          <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
            Your payment has been successfully processed
          </Typography>
          
          {transactionData && (
            <Box sx={{ mb: 3, p: 2, backgroundColor: 'rgba(0, 224, 184, 0.1)', borderRadius: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Transaction Details
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
                Amount: KES {Math.round(Number(transactionData.amount || 0))}
              </Typography>
              {transactionData.receiptNumber && (
                <Typography variant="body2" color="text.secondary">
                  Receipt: {transactionData.receiptNumber}
                </Typography>
              )}
              {transactionData.paymentProvider && (
                <Typography variant="body2" color="text.secondary">
                  Payment Method: {transactionData.paymentProvider.toUpperCase()}
                </Typography>
              )}
            </Box>
          )}
          
          {orderId && (
            <Typography variant="body1" sx={{ mb: 3 }}>
              Order ID: #{orderId}
            </Typography>
          )}
          
          <Alert severity="success" sx={{ mb: 4 }}>
            <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
              ✅ Payment Received Successfully!
            </Typography>
            <Typography variant="body2">
              We've received your order and will start preparing it shortly. 
              Log in to track your order status in real-time.
            </Typography>
          </Alert>
          
          <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="contained"
              startIcon={isLoggedIn ? <Assignment /> : <Login />}
              onClick={() => {
                if (isLoggedIn) {
                  navigate('/orders');
                } else {
                  navigate('/login');
                }
              }}
              sx={{
                backgroundColor: '#000000',
                color: '#FFFFFF',
                border: '1px solid',
                borderColor: '#000000',
                '&:hover': {
                  backgroundColor: '#1A1A1A',
                  borderColor: '#1A1A1A',
                }
              }}
            >
              {isLoggedIn ? 'Track My Orders' : 'Log in'}
            </Button>
          </Box>
        </Paper>
      </Container>
    );
  }

  // Payment confirmed or order placed (non-payment orders)
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <CheckCircle sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
        
        <Typography variant="h4" gutterBottom>
          Order Placed Successfully!
        </Typography>
        
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Thank you for your order
        </Typography>
        
        {orderId && (
          <Typography variant="body1" sx={{ mb: 3 }}>
            Order ID: #{orderId}
          </Typography>
        )}
        
        <Typography variant="body1" sx={{ mb: 4 }}>
          {paymentConfirmed 
            ? 'Your payment has been confirmed! We\'ve received your order and will start preparing it shortly.'
            : 'We\'ve received your order and will start preparing it shortly. You\'ll receive a confirmation call within the next few minutes.'
          }
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="contained"
            startIcon={isLoggedIn ? <Assignment /> : <Login />}
            onClick={() => {
              if (isLoggedIn) {
                navigate('/orders');
              } else {
                navigate('/login');
              }
            }}
            sx={{
              backgroundColor: '#000000',
              color: '#FFFFFF',
              border: '1px solid',
              borderColor: '#000000',
              '&:hover': {
                backgroundColor: '#1A1A1A',
                borderColor: '#1A1A1A',
              }
            }}
          >
            {isLoggedIn ? 'My Orders' : 'Log in'}
          </Button>
          
          <Button
            variant="outlined"
            onClick={() => navigate('/')}
            sx={{
              backgroundColor: '#FFFFFF',
              color: '#000000',
              border: '1px solid',
              borderColor: '#000000',
              '&:hover': {
                backgroundColor: '#F5F5F5',
                borderColor: '#000000',
              }
            }}
          >
            Back to Home
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default OrderSuccess;

