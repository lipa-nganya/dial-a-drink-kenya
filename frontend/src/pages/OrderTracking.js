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
  Alert
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
  AttachMoney
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import io from 'socket.io-client';

const OrderTracking = ({ order }) => {
  const navigate = useNavigate();
  const [orderDetails, setOrderDetails] = useState(order);
  const [loading, setLoading] = useState(!order);
  const [error, setError] = useState('');

  useEffect(() => {
    if (order) {
      setOrderDetails(order);
      setLoading(false);
    } else {
      // Try to get order from localStorage
      const savedOrder = localStorage.getItem('customerOrder');
      if (savedOrder) {
        const { orderId } = JSON.parse(savedOrder);
        fetchOrder(orderId);
      } else {
        setError('No order found. Please log in again.');
        setLoading(false);
      }
    }
    
    // Set up Socket.IO for real-time order status updates
    const orderId = order?.id || (() => {
      const savedOrder = localStorage.getItem('customerOrder');
      if (savedOrder) {
        const parsed = JSON.parse(savedOrder);
        return parsed.orderId;
      }
      return null;
    })();
    
    if (orderId) {
      const isHosted =
        window.location.hostname.includes('onrender.com') ||
        window.location.hostname.includes('run.app');
      const socketUrl = isHosted
        ? 'https://dialadrink-backend-910510650031.us-central1.run.app'
        : 'http://localhost:5001';
      
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
      
      return () => {
        socket.close();
      };
    }
  }, [order]);

  const fetchOrder = async (orderId) => {
    try {
      setLoading(true);
      const response = await api.get(`/orders/${orderId}`);
      setOrderDetails(response.data);
      setError('');
    } catch (err) {
      console.error('Error fetching order:', err);
      setError(err.response?.data?.error || 'Failed to load order details.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'confirmed': return 'success';
      case 'preparing': return 'info';
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
      case 'preparing': return <ShoppingCart />;
      case 'out_for_delivery': return <LocalShipping />;
      case 'delivered': return <CheckCircle />;
      default: return <ShoppingCart />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'confirmed': return 'Confirmed';
      case 'preparing': return 'Preparing';
      case 'out_for_delivery': return 'Out for Delivery';
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
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

        {/* Customer Information */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Person /> Customer Information
          </Typography>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography><strong>Name:</strong> {orderDetails.customerName}</Typography>
            {orderDetails.customerPhone && (
              <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Phone fontSize="small" /> {orderDetails.customerPhone}
              </Typography>
            )}
            {orderDetails.customerEmail && (
              <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Email fontSize="small" /> {orderDetails.customerEmail}
              </Typography>
            )}
            <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocationOn fontSize="small" /> {orderDetails.deliveryAddress}
            </Typography>
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
                <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                  <Typography>
                    {item.drink?.name || 'Unknown Item'} x {item.quantity}
                  </Typography>
                  <Typography>
                    KES {Number(item.price * item.quantity).toFixed(2)}
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AttachMoney /> Total Amount
          </Typography>
          <Typography variant="h5" color="primary">
            KES {Number(orderDetails.totalAmount).toFixed(2)}
          </Typography>
        </Box>

        {orderDetails.paymentType && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Payment: {orderDetails.paymentType === 'pay_now' ? 'Paid' : 'Pay on Delivery'}
            </Typography>
            {orderDetails.paymentMethod && (
              <Typography variant="body2" color="text.secondary">
                Method: {orderDetails.paymentMethod === 'mobile_money' ? 'Mobile Money' : 'Card'}
              </Typography>
            )}
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
    </Container>
  );
};

export default OrderTracking;

