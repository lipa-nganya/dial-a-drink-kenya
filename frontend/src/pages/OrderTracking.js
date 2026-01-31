import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Chip,
  Divider,
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tabs,
  Tab
} from '@mui/material';
import {
  CheckCircle,
  AccessTime,
  LocalShipping,
  ShoppingCart,
  Person,
  Phone,
  Email,
  LocationOn,
  AttachMoney,
  Payment,
  CreditCard,
  PhoneAndroid,
  Receipt,
  Restaurant,
  Inventory
} from '@mui/icons-material';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import io from 'socket.io-client';
import { getBackendUrl } from '../utils/backendUrl';
import { useCustomer } from '../contexts/CustomerContext';

const OrderTracking = ({ order: orderProp }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { customer } = useCustomer();
  // Get order from prop, navigation state, or null
  const orderFromState = location.state?.order;
  const initialOrder = orderProp || orderFromState;
  const [orderDetails, setOrderDetails] = useState(initialOrder);
  const [loading, setLoading] = useState(!initialOrder);
  const [error, setError] = useState('');
  
  // Payment dialog state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('mobile_money'); // 'mobile_money' or 'card'
  const [paymentPhone, setPaymentPhone] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    const trackingToken = searchParams.get('token');
    
    if (initialOrder) {
      // If order is passed but doesn't have items loaded, fetch full details
      if (!initialOrder.items || initialOrder.items.length === 0 || !initialOrder.items[0]?.drink) {
        console.log('[OrderTracking] Order passed but missing items/drink details, fetching full order...');
        fetchOrder(initialOrder.id);
      } else {
        setOrderDetails(initialOrder);
        setLoading(false);
      }
    } else if (trackingToken) {
      // Fetch order by tracking token from URL
      fetchOrderByToken(trackingToken);
    } else {
      // Try to get order from localStorage
      const savedOrder = localStorage.getItem('customerOrder');
      if (savedOrder) {
        const { orderId } = JSON.parse(savedOrder);
        fetchOrder(orderId);
      } else {
        setError('No order found. Please use the tracking link from your SMS or log in again.');
        setLoading(false);
      }
    }
  }, [initialOrder, searchParams]);

  // Set up Socket.IO for real-time order status updates
  useEffect(() => {
    const orderId = orderDetails?.id;
    
    if (orderId) {
      const socketUrl = getBackendUrl();
      const socket = io(socketUrl);
      
      // Join order-specific room
      socket.emit('join-order', orderId);
      
      // Listen for order status updates
      socket.on('order-status-updated', (data) => {
        console.log('📦 Order status updated on tracking page:', data);
        if (data.orderId === orderId) {
          setOrderDetails(prevOrder => ({
            ...prevOrder,
            ...data.order,
            status: data.status,
            paymentStatus: data.paymentStatus || prevOrder?.paymentStatus
          }));
        }
      });
      
      // Listen for payment confirmation
      socket.on('payment-confirmed', (data) => {
        console.log('💰 Payment confirmed on tracking page:', data);
        if (data.orderId === orderId) {
          setOrderDetails(prevOrder => ({
            ...prevOrder,
            paymentStatus: 'paid',
            status: data.status || prevOrder?.status,
            paymentMethod: data.paymentMethod || prevOrder?.paymentMethod,
            paymentProvider: data.paymentProvider || prevOrder?.paymentProvider
          }));
          setPaymentDialogOpen(false);
          setPaymentError('');
          setPaymentSuccess(false);
          setProcessingPayment(false);
          // Refresh order to get latest data
          fetchOrder(orderId);
        }
      });
      
      return () => {
        socket.close();
      };
    }
  }, [orderDetails?.id]);

  const fetchOrder = async (orderId) => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/orders/${orderId}`);
      // Check if response has data property (wrapped in success response) or is direct order
      const orderData = response.data?.data || response.data;
      if (orderData) {
        setOrderDetails(orderData);
        console.log('[OrderTracking] Order fetched successfully:', {
          id: orderData.id,
          itemsCount: orderData.items?.length || 0,
          hasItems: !!orderData.items,
          totalAmount: orderData.totalAmount
        });
      } else {
        setError('Order data not found in response.');
      }
    } catch (err) {
      console.error('Error fetching order:', err);
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to load order details.');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderByToken = async (token) => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/orders/track/${token}`);
      // Check if response has data property (wrapped in success response) or is direct order
      const orderData = response.data?.data || response.data;
      if (orderData) {
        setOrderDetails(orderData);
        console.log('[OrderTracking] Order fetched by token successfully:', {
          id: orderData.id,
          itemsCount: orderData.items?.length || 0,
          hasItems: !!orderData.items,
          totalAmount: orderData.totalAmount
        });
      } else {
        setError('Order data not found in response.');
      }
    } catch (err) {
      console.error('Error fetching order by token:', err);
      setError(err.response?.data?.error || err.response?.data?.message || 'Invalid tracking link. Please check your SMS or contact support.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'confirmed': return 'success';
      case 'out_for_delivery': return 'primary';
      case 'delivered': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <AccessTime />;
      case 'confirmed': return <CheckCircle />;
      case 'out_for_delivery': return <LocalShipping />;
      case 'delivered': return <CheckCircle />;
      default: return <ShoppingCart />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'confirmed': return 'Confirmed';
      case 'out_for_delivery': return 'Out for Delivery';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  // Get timeline steps based on order status
  const getTimelineSteps = () => {
    const steps = [];
    const status = orderDetails.status;
    const paymentStatus = orderDetails.paymentStatus;
    const paymentType = orderDetails.paymentType;
    const createdAt = orderDetails.createdAt;
    const paymentConfirmedAt = orderDetails.paymentConfirmedAt;
    const confirmedAt = orderDetails.confirmedAt;
    const outForDeliveryAt = orderDetails.outForDeliveryAt;
    const deliveredAt = orderDetails.deliveredAt;

    // Helper to format time
    const formatTime = (dateString) => {
      if (!dateString) return '';
      try {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      } catch {
        return '';
      }
    };

    // Determine if payment step should be shown
    const needsPayment = paymentType === 'pay_now';
    const paymentPaid = paymentStatus === 'paid';

    // Step 1: Order Placed (always shown, always completed unless cancelled)
    const orderPlacedCompleted = status !== 'cancelled';
    steps.push({
      id: 'order_placed',
      title: 'Order Placed',
      description: `Order#${orderDetails.id} from ${orderDetails.branch?.name || 'Dial A Drink'}.`,
      icon: <Receipt />,
      completed: orderPlacedCompleted,
      isCurrent: false,
      timestamp: formatTime(createdAt) || 'N/A'
    });

    // Step 2: Payment Confirmed (only if payment is required)
    if (needsPayment) {
      steps.push({
        id: 'payment_confirmed',
        title: 'Payment Confirmed',
        description: paymentPaid ? 'Payment received successfully.' : 'Awaiting confirmation...',
        icon: <Payment />,
        completed: paymentPaid,
        isCurrent: !paymentPaid && status !== 'cancelled',
        timestamp: formatTime(paymentConfirmedAt) || (paymentPaid ? formatTime(createdAt) : '')
      });
    }

    // Step 3: Order Processed / Confirmed (only shown if order is confirmed or beyond)
    const orderProcessed = status === 'confirmed' || status === 'out_for_delivery' || status === 'delivered' || status === 'completed';
    if (orderProcessed || (needsPayment && paymentPaid)) {
      steps.push({
        id: 'order_processed',
        title: 'Order Processed',
        description: 'We are preparing your order.',
        icon: <Restaurant />,
        completed: orderProcessed,
        isCurrent: status === 'confirmed' && (!needsPayment || paymentPaid),
        timestamp: formatTime(confirmedAt) || (orderProcessed ? formatTime(createdAt) : '')
      });
    }

    // Step 4: Ready to Pickup / Out for Delivery
    const isOutForDelivery = status === 'out_for_delivery';
    const isDelivered = status === 'delivered' || status === 'completed';
    if (isOutForDelivery || isDelivered) {
      steps.push({
        id: 'ready_to_pickup',
        title: 'Out for Delivery',
        description: orderDetails.driver 
          ? `Order#${orderDetails.id} from ${orderDetails.branch?.name || 'Dial A Drink'}.`
          : 'Your order is on the way.',
        icon: <LocalShipping />,
        completed: isDelivered,
        isCurrent: isOutForDelivery,
        timestamp: formatTime(outForDeliveryAt) || (isOutForDelivery ? 'N/A' : '')
      });
    }

    // Step 5: Delivered (if delivered)
    if (isDelivered) {
      steps.push({
        id: 'delivered',
        title: 'Delivered',
        description: 'Your order has been delivered.',
        icon: <CheckCircle />,
        completed: true,
        isCurrent: false,
        timestamp: formatTime(deliveredAt) || 'N/A'
      });
    }

    return steps;
  };

  // Payment helper functions
  const formatMpesaPhoneNumber = (phone) => {
    if (!phone) return '';
    
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

  const validateSafaricomPhone = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 9 && (cleaned.startsWith('07') || cleaned.startsWith('2547') || (cleaned.startsWith('7') && cleaned.length === 9));
  };

  const handleOpenPaymentDialog = () => {
    // Prepopulate phone number from customer context or order
    const phoneNumber = customer?.phone || orderDetails.customerPhone || '';
    setPaymentPhone(phoneNumber);
    setPaymentMethod('mobile_money');
    setPaymentError('');
    setPaymentSuccess(false);
    setPaymentDialogOpen(true);
  };

  const handleClosePaymentDialog = () => {
    setPaymentDialogOpen(false);
    setPaymentPhone('');
    setPaymentError('');
    setPaymentSuccess(false);
    setProcessingPayment(false);
  };

  const handleInitiateMobileMoneyPayment = async () => {
    if (!paymentPhone || !validateSafaricomPhone(paymentPhone)) {
      setPaymentError('Please enter a valid Safaricom phone number (e.g., 0712345678)');
      return;
    }

    setProcessingPayment(true);
    setPaymentError('');

    try {
      const formattedPhone = formatMpesaPhoneNumber(paymentPhone);
      
      console.log('Initiating M-Pesa STK Push for order:', {
        phoneNumber: formattedPhone,
        amount: orderDetails.totalAmount,
        orderId: orderDetails.id
      });
      
      const paymentResponse = await api.post('/mpesa/stk-push', {
        phoneNumber: formattedPhone,
        amount: parseFloat(orderDetails.totalAmount),
        orderId: orderDetails.id,
        accountReference: `ORDER-${orderDetails.id}`
      });

      if (paymentResponse.data.success) {
        setPaymentError('');
        setPaymentSuccess(true);
        setProcessingPayment(false);
        // Dialog will close automatically when payment-confirmed event is received
      } else {
        setPaymentError(paymentResponse.data.error || paymentResponse.data.message || 'Failed to initiate payment. Please try again.');
        setProcessingPayment(false);
      }
    } catch (paymentError) {
      console.error('Payment error:', paymentError);
      const errorMessage = paymentError.response?.data?.error || 
                          paymentError.response?.data?.message || 
                          paymentError.message || 
                          'Failed to initiate payment. Please try again.';
      setPaymentError(errorMessage);
      setProcessingPayment(false);
    }
  };

  const handleInitiateCardPayment = async () => {
    setProcessingPayment(true);
    setPaymentError('');

    try {
      // Get current URL for callbacks
      const currentUrl = window.location.origin;
      const callbackUrl = `${currentUrl}/payment-success?orderId=${orderDetails.id}`;
      const cancellationUrl = `${currentUrl}/payment-cancelled?orderId=${orderDetails.id}`;
      
      console.log('Initiating PesaPal card payment:', {
        orderId: orderDetails.id,
        amount: orderDetails.totalAmount,
        callbackUrl,
        cancellationUrl
      });
      
      const paymentResponse = await api.post('/pesapal/initiate-payment', {
        orderId: orderDetails.id,
        callbackUrl: callbackUrl,
        cancellationUrl: cancellationUrl
      });

      if (paymentResponse.data.success && paymentResponse.data.redirectUrl) {
        setPaymentError('');
        setProcessingPayment(false);
        // Redirect to PesaPal payment page
        window.location.href = paymentResponse.data.redirectUrl;
      } else {
        setPaymentError(paymentResponse.data.error || paymentResponse.data.message || 'Failed to initiate card payment. Please try again.');
        setProcessingPayment(false);
      }
    } catch (paymentError) {
      console.error('Card payment error:', paymentError);
      const errorMessage = paymentError.response?.data?.error || 
                          paymentError.response?.data?.message || 
                          paymentError.message || 
                          'Failed to initiate card payment. Please try again.';
      setPaymentError(errorMessage);
      setProcessingPayment(false);
    }
  };

  const handlePaymentMethodChange = (event, newValue) => {
    setPaymentMethod(newValue);
    setPaymentError('');
    setPaymentSuccess(false);
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading order details...</Typography>
      </Container>
    );
  }

  if (error || !orderDetails) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error || 'Order not found'}
        </Alert>
        <Button variant="contained" onClick={() => navigate('/')}>
          Back to Home
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
        Order Tracking
      </Typography>

      <Paper sx={{ p: 4, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">
            Order #{orderDetails.id}
          </Typography>
          <Chip
            icon={getStatusIcon(orderDetails.status)}
            label={getStatusLabel(orderDetails.status)}
            color={getStatusColor(orderDetails.status)}
            sx={{ fontWeight: 'bold' }}
          />
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Order Timeline */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
            Order Status
          </Typography>
          <Box sx={{ position: 'relative', pl: 5 }}>
            {/* Vertical dotted line */}
            <Box
              sx={{
                position: 'absolute',
                left: '20px',
                top: 0,
                bottom: 0,
                width: '2px',
                borderLeft: '2px dashed #E0E0E0',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  left: '-1px',
                  top: 0,
                  width: '2px',
                  borderLeft: '2px dashed #4CAF50',
                  height: (() => {
                    const steps = getTimelineSteps();
                    const completedCount = steps.filter(s => s.completed || s.isCurrent).length;
                    const totalSteps = steps.length;
                    if (totalSteps === 0) return '0%';
                    // Calculate height based on completed steps
                    const stepHeight = 100 / totalSteps;
                    return `${Math.min(completedCount * stepHeight, 100)}%`;
                  })()
                }
              }}
            />
            
            {getTimelineSteps().map((step, index) => {
              const isLast = index === getTimelineSteps().length - 1;
              const stepColor = step.completed ? '#4CAF50' : step.isCurrent ? '#4CAF50' : '#9E9E9E';
              const stepBg = step.isCurrent ? '#4CAF50' : step.completed ? '#E8F5E9' : '#F5F5F5';
              const iconColor = step.completed || step.isCurrent ? '#4CAF50' : '#9E9E9E';
              
              return (
                <Box
                  key={step.id}
                  sx={{
                    position: 'relative',
                    mb: isLast ? 0 : 4,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 2
                  }}
                >
                  {/* Status indicator circle */}
                  <Box
                    sx={{
                      position: 'absolute',
                      left: '-36px',
                      top: '2px',
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: stepBg,
                      border: step.isCurrent ? `2px solid ${stepColor}` : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1,
                      boxShadow: step.isCurrent ? `0 0 0 4px ${stepBg}` : 'none'
                    }}
                  >
                    {step.completed ? (
                      <CheckCircle sx={{ color: '#4CAF50', fontSize: '24px' }} />
                    ) : step.isCurrent ? (
                      <Box
                        sx={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          backgroundColor: '#4CAF50'
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: '#9E9E9E'
                        }}
                      />
                    )}
                  </Box>

                  {/* Step content */}
                  <Box sx={{ flex: 1, pt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                      <Box
                        sx={{
                          color: iconColor,
                          display: 'flex',
                          alignItems: 'center',
                          opacity: step.completed || step.isCurrent ? 1 : 0.6
                        }}
                      >
                        {React.cloneElement(step.icon, { sx: { fontSize: '20px' } })}
                      </Box>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 600,
                          color: '#424242',
                          fontSize: '1rem',
                          flex: 1
                        }}
                      >
                        {step.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: '#757575',
                          fontSize: '0.875rem',
                          fontWeight: 500
                        }}
                      >
                        {step.timestamp}
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        color: '#757575',
                        fontSize: '0.875rem',
                        ml: 4.5
                      }}
                    >
                      {step.description}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Customer Information */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Person /> Customer Information
          </Typography>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography sx={{ textAlign: 'left' }}><strong>Name:</strong> {orderDetails.customerName || 'N/A'}</Typography>
            {orderDetails.customerPhone && (
              <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, textAlign: 'left' }}>
                <Phone fontSize="small" /> {orderDetails.customerPhone}
              </Typography>
            )}
            {orderDetails.customerEmail && (
              <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, textAlign: 'left' }}>
                <Email fontSize="small" /> {orderDetails.customerEmail}
              </Typography>
            )}
            {orderDetails.deliveryAddress && (
              <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1, textAlign: 'left' }}>
                <LocationOn fontSize="small" /> {orderDetails.deliveryAddress}
              </Typography>
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Order Items */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Order Items
          </Typography>
          {orderDetails.items && orderDetails.items.length > 0 ? (
            <Box sx={{ mt: 2 }}>
              {orderDetails.items.map((item, index) => (
                <Box key={item.id || index} sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                  <Typography>
                    {item.drink?.name || item.drinkName || 'Unknown Item'} x {item.quantity || 0}
                    {item.selectedCapacity && ` (${item.selectedCapacity})`}
                  </Typography>
                  <Typography>
                    KES {Number((item.price || 0) * (item.quantity || 0)).toFixed(2)}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : orderDetails.orderItems && orderDetails.orderItems.length > 0 ? (
            <Box sx={{ mt: 2 }}>
              {orderDetails.orderItems.map((item, index) => (
                <Box key={item.id || index} sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                  <Typography>
                    {item.drink?.name || item.drinkName || 'Unknown Item'} x {item.quantity || 0}
                    {item.selectedCapacity && ` (${item.selectedCapacity})`}
                  </Typography>
                  <Typography>
                    KES {Number((item.price || 0) * (item.quantity || 0)).toFixed(2)}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <Typography color="text.secondary">No items found</Typography>
          )}
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Order Summary */}
        <Box>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AttachMoney /> Order Summary
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* Items Subtotal */}
            {((orderDetails.items && orderDetails.items.length > 0) || (orderDetails.orderItems && orderDetails.orderItems.length > 0)) && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body1">
                  Items Subtotal:
                </Typography>
                <Typography variant="body1">
                  KES {(() => {
                    const items = orderDetails.items || orderDetails.orderItems || [];
                    const itemsTotal = orderDetails.itemsTotal || 
                      items.reduce((sum, item) => 
                        sum + (parseFloat(item.price || 0) * parseFloat(item.quantity || 0)), 0
                      );
                    return Number(itemsTotal).toFixed(2);
                  })()}
                </Typography>
              </Box>
            )}
            {/* Delivery Fee */}
            {orderDetails.deliveryFee !== undefined && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body1">
                  Delivery Fee:
                </Typography>
                <Typography variant="body1">
                  KES {Number(orderDetails.deliveryFee || 0).toFixed(2)}
                </Typography>
              </Box>
            )}
            {/* Tip Amount */}
            {orderDetails.tipAmount && parseFloat(orderDetails.tipAmount) > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body1">
                  Tip:
                </Typography>
                <Typography variant="body1">
                  KES {Number(orderDetails.tipAmount).toFixed(2)}
                </Typography>
              </Box>
            )}
            <Divider sx={{ my: 1 }} />
            {/* Total Amount */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Total Amount:
              </Typography>
              <Typography variant="h5" color="primary" sx={{ fontWeight: 600 }}>
                KES {orderDetails.totalAmount ? Number(orderDetails.totalAmount).toFixed(2) : '0.00'}
              </Typography>
            </Box>
          </Box>
        </Box>

        {orderDetails.paymentType && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Payment: {orderDetails.paymentStatus === 'paid' ? 'Paid' : orderDetails.paymentType === 'pay_now' ? 'Unpaid' : 'Pay on Delivery'}
            </Typography>
            {orderDetails.paymentMethod && (
              <Typography variant="body2" color="text.secondary">
                Method: {orderDetails.paymentMethod === 'mobile_money' ? 'Mobile Money' : 'Card'}
              </Typography>
            )}
          </Box>
        )}

        {/* Make Payment Button - Show for unpaid orders with pay_now payment type */}
        {orderDetails.paymentStatus !== 'paid' && orderDetails.paymentType === 'pay_now' && orderDetails.status !== 'cancelled' && (
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<Payment />}
              onClick={handleOpenPaymentDialog}
              sx={{
                backgroundColor: '#00E0B8',
                color: '#0D0D0D',
                fontWeight: 600,
                px: 4,
                py: 1.5,
                '&:hover': {
                  backgroundColor: '#00C4A3'
                }
              }}
            >
              Make Payment
            </Button>
          </Box>
        )}

        {orderDetails.notes && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Notes:</strong> {orderDetails.notes}
            </Typography>
          </Box>
        )}
      </Paper>

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
        <Button variant="outlined" onClick={() => navigate('/menu')}>
          Continue Shopping
        </Button>
        <Button variant="contained" onClick={() => navigate('/')}>
          Back to Home
        </Button>
      </Box>

      {/* Payment Dialog */}
      <Dialog 
        open={paymentDialogOpen} 
        onClose={handleClosePaymentDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Make Payment - Order #{orderDetails.id}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Total Amount: KES {orderDetails.totalAmount ? Number(orderDetails.totalAmount).toFixed(2) : '0.00'}
          </Typography>

          {/* Payment Method Selection */}
          <Box sx={{ mb: 3 }}>
            <Tabs
              value={paymentMethod}
              onChange={handlePaymentMethodChange}
              sx={{
                mb: 2,
                '& .MuiTab-root': {
                  minWidth: '50%'
                }
              }}
            >
              <Tab 
                icon={<PhoneAndroid />} 
                iconPosition="start"
                label="Mobile Money" 
                value="mobile_money"
                sx={{ textTransform: 'none' }}
              />
              <Tab 
                icon={<CreditCard />} 
                iconPosition="start"
                label="Card" 
                value="card"
                sx={{ textTransform: 'none' }}
              />
            </Tabs>
          </Box>

          {/* Mobile Money Payment Form */}
          {paymentMethod === 'mobile_money' && (
            <Box>
              <TextField
                label="Phone Number *"
                value={paymentPhone}
                onChange={(e) => setPaymentPhone(e.target.value)}
                fullWidth
                placeholder="0712345678"
                margin="normal"
                disabled={processingPayment}
                helperText="Enter your Safaricom phone number to receive payment prompt"
              />
            </Box>
          )}

          {/* Card Payment Info */}
          {paymentMethod === 'card' && (
            <Box>
              <Alert severity="info" sx={{ mt: 2 }}>
                You will be redirected to PesaPal to complete your card payment securely.
              </Alert>
            </Box>
          )}

          {paymentSuccess && paymentMethod === 'mobile_money' && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Payment request sent. Please check your phone to enter your M-Pesa PIN.
            </Alert>
          )}
          {paymentError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {paymentError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePaymentDialog} disabled={processingPayment}>
            Cancel
          </Button>
          <Button
            onClick={paymentMethod === 'mobile_money' ? handleInitiateMobileMoneyPayment : handleInitiateCardPayment}
            variant="contained"
            disabled={processingPayment || (paymentMethod === 'mobile_money' && !paymentPhone)}
            sx={{
              backgroundColor: '#00E0B8',
              color: '#0D0D0D',
              '&:hover': {
                backgroundColor: '#00C4A3'
              }
            }}
          >
            {processingPayment ? (
              <>
                <CircularProgress size={16} sx={{ mr: 1 }} />
                Processing...
              </>
            ) : paymentMethod === 'mobile_money' ? (
              'Send Payment Prompt'
            ) : (
              'Proceed to Card Payment'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default OrderTracking;

