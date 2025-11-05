import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider
} from '@mui/material';
import {
  CheckCircle,
  AccessTime,
  LocalShipping,
  ShoppingCart,
  Cancel,
  Visibility,
  ExpandMore
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useCustomer } from '../contexts/CustomerContext';
import io from 'socket.io-client';

const MyOrders = () => {
  const navigate = useNavigate();
  const { customer, isLoggedIn } = useCustomer();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedOrder, setExpandedOrder] = useState(null);

  useEffect(() => {
    // Check if customer is logged in
    if (!isLoggedIn && !localStorage.getItem('customerOrder')) {
      navigate('/login');
      return;
    }
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);
  
  // Set up Socket.IO for real-time order status updates
  useEffect(() => {
    if (orders.length === 0) return; // Don't set up socket if no orders yet
    
    const socketUrl = window.location.hostname.includes('onrender.com') 
      ? 'https://dialadrink-backend.onrender.com'
      : 'http://localhost:5001';
    
    const socket = io(socketUrl);
    
    // Join order-specific rooms for all orders
    socket.on('connect', () => {
      orders.forEach(order => {
        socket.emit('join-order', order.id);
      });
    });
    
    // Listen for order status updates
    socket.on('order-status-updated', (data) => {
      console.log('📦 Order status updated:', data);
      if (data.orderId) {
        setOrders(prevOrders => {
          const updated = prevOrders.map(order => 
            order.id === data.orderId 
              ? { 
                  ...order, 
                  status: data.status,
                  paymentStatus: data.paymentStatus || order.paymentStatus
                }
              : order
          );
          // Re-sort orders after update
          return updated.sort((a, b) => {
            return new Date(b.createdAt) - new Date(a.createdAt);
          });
        });
      }
    });
    
    return () => {
      socket.close();
    };
  }, [orders]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Get customer info from context or localStorage
      const customerData = customer || (localStorage.getItem('customerOrder') ? JSON.parse(localStorage.getItem('customerOrder')) : null);
      
      if (!customerData) {
        setError('Please log in to view your orders.');
        setLoading(false);
        navigate('/login');
        return;
      }

      const { email, phone } = customerData;
      
      if (!email && !phone) {
        setError('Please log in with your email or phone number.');
        setLoading(false);
        navigate('/login');
        return;
      }
      
      // Fetch orders by email or phone
      const response = await api.post('/orders/find-all', {
        email: email || null,
        phone: phone || null
      });

      if (response.data.success) {
        // Show all orders (sorted by most recent first)
        const sortedOrders = (response.data.orders || []).sort((a, b) => {
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
        setOrders(sortedOrders);
      } else {
        setError(response.data.message || 'No orders found.');
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err.response?.data?.error || 'Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'confirmed': return 'info';
      case 'preparing': return 'primary';
      case 'out_for_delivery': return 'secondary';
      case 'delivered': return 'success';
      case 'completed': return 'success';
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
      case 'completed': return <CheckCircle />;
      case 'cancelled': return <Cancel />;
      default: return <ShoppingCart />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'confirmed': return 'Confirmed';
      case 'preparing': return 'Preparing';
      case 'out_for_delivery': return 'On the Way';
      case 'delivered': return 'Delivered';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const getProgressSteps = (status) => {
    const steps = [
      { label: 'Order Placed', status: 'pending', completed: true },
      { label: 'Confirmed', status: 'confirmed', completed: ['confirmed', 'preparing', 'out_for_delivery', 'delivered', 'completed'].includes(status) },
      { label: 'Preparing', status: 'preparing', completed: ['preparing', 'out_for_delivery', 'delivered', 'completed'].includes(status) },
      { label: 'On the Way', status: 'out_for_delivery', completed: ['out_for_delivery', 'delivered', 'completed'].includes(status) },
      { label: 'Delivered', status: 'delivered', completed: ['delivered', 'completed'].includes(status) }
    ];
    return steps;
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading your orders...</Typography>
      </Container>
    );
  }

  if (error && !loading) {
    const isLoginError = error.includes('log in') || error.includes('Please log in');
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {isLoginError ? (
            <Button 
              variant="contained" 
              onClick={() => navigate('/login')}
              sx={{
                backgroundColor: '#00E0B8',
                color: '#0D0D0D',
                '&:hover': { backgroundColor: '#00C4A3' }
              }}
            >
              Log In
            </Button>
          ) : (
            <Button variant="contained" onClick={() => navigate('/order-tracking')}>
              Track Single Order
            </Button>
          )}
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ color: '#000000', fontWeight: 700, mb: 4 }}>
        My Orders
      </Typography>

      {orders.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <ShoppingCart sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No orders found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            You don't have any orders yet. Start shopping to place your first order!
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate('/menu')}
            sx={{
              backgroundColor: '#00E0B8',
              color: '#0D0D0D',
              '&:hover': { backgroundColor: '#00C4A3' }
            }}
          >
            Start Shopping
          </Button>
        </Paper>
      ) : (
        <>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Showing {orders.length} {orders.length === 1 ? 'order' : 'orders'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {orders.map((order) => (
            <Accordion
              key={order.id}
              expanded={expandedOrder === order.id}
              onChange={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
              sx={{
                '&:before': { display: 'none' },
                boxShadow: 1,
                borderRadius: '8px !important',
                overflow: 'hidden'
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMore />}
                sx={{
                  minHeight: 64,
                  '&.Mui-expanded': {
                    minHeight: 64
                  },
                  px: 2,
                  py: 1
                }}
              >
                <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', pr: 2 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ color: '#000000', fontWeight: 600, mb: 0.5 }}>
                      Order #{order.id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {new Date(order.createdAt).toLocaleDateString('en-US', { 
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#FF3366' }}>
                      KES {Number(order.totalAmount).toFixed(2)}
                    </Typography>
                    <Chip
                      icon={getStatusIcon(order.status)}
                      label={getStatusLabel(order.status)}
                      color={getStatusColor(order.status)}
                      size="small"
                      sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}
                    />
                  </Box>
                </Box>
              </AccordionSummary>
              <Divider />
              <AccordionDetails sx={{ px: 2, py: 2 }}>
                {/* Progress Steps */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ mb: 1, color: '#000000', fontWeight: 600, display: 'block' }}>
                    Order Progress
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {getProgressSteps(order.status).map((step, index) => (
                      <Chip
                        key={index}
                        label={step.label}
                        size="small"
                        color={step.completed ? 'success' : 'default'}
                        icon={step.completed ? <CheckCircle fontSize="small" /> : <AccessTime fontSize="small" />}
                        sx={{
                          opacity: step.completed ? 1 : 0.5,
                          fontSize: '0.7rem',
                          height: '24px'
                        }}
                      />
                    ))}
                  </Box>
                </Box>

                {/* Order Items Summary */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ mb: 1, color: '#000000', fontWeight: 600, display: 'block' }}>
                    Items ({order.items?.length || 0})
                  </Typography>
                  {order.items?.slice(0, 5).map((item, index) => (
                    <Typography key={index} variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                      {item.drink?.name} x{item.quantity} - KES {Number(item.price || 0).toFixed(2)}
                    </Typography>
                  ))}
                  {order.items?.length > 5 && (
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                      +{order.items.length - 5} more items
                    </Typography>
                  )}
                </Box>

                {/* Payment Status */}
                {order.paymentType && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                      Payment: {order.paymentType === 'pay_now' ? 'Paid' : 'Pay on Delivery'}
                    </Typography>
                  </Box>
                )}

                {/* View Details Button */}
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Visibility />}
                  onClick={() => navigate(`/order-tracking`, { state: { order } })}
                  fullWidth
                  sx={{
                    borderColor: '#00E0B8',
                    color: '#00E0B8',
                    mt: 1,
                    '&:hover': {
                      borderColor: '#00C4A3',
                      backgroundColor: 'rgba(0, 224, 184, 0.1)'
                    }
                  }}
                >
                  View Full Details
                </Button>
              </AccordionDetails>
            </Accordion>
          ))}
          </Box>
        </>
      )}
    </Container>
  );
};

export default MyOrders;

