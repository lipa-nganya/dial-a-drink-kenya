import React, { useState, useEffect, useCallback } from 'react';
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
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Pagination
} from '@mui/material';
import {
  CheckCircle,
  AccessTime,
  LocalShipping,
  ShoppingCart,
  Cancel,
  Visibility,
  ExpandMore,
  Payment
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
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentPhone, setPaymentPhone] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(orders.length / rowsPerPage));
    if (page > 0 && page >= totalPages) {
      setPage(totalPages - 1);
    }
  }, [orders.length, page, rowsPerPage]);
  
  // Set up Socket.IO for real-time order status updates
  useEffect(() => {
    if (orders.length === 0) return; // Don't set up socket if no orders yet
    
    const isHosted =
      window.location.hostname.includes('onrender.com') ||
      window.location.hostname.includes('run.app');
    const socketUrl = isHosted
      ? 'https://dialadrink-backend-910510650031.us-central1.run.app'
      : 'http://localhost:5001';
    
    const socket = io(socketUrl);
    
    // Join order-specific rooms for all orders
    socket.on('connect', () => {
      orders.forEach(order => {
        socket.emit('join-order', order.id);
      });
    });
    
    // Listen for order status updates (from admin or driver)
    socket.on('order-status-updated', (data) => {
      console.log('📦 Order status updated:', data);
      if (data.orderId) {
        setOrders(prevOrders => {
          const updated = prevOrders.map(order => 
            order.id === data.orderId 
              ? { 
                  ...order, 
                  status: data.status || order.status,
                  paymentStatus: data.paymentStatus || order.paymentStatus,
                  // Merge full order object if provided (includes driver info)
                  ...(data.order || {}),
                  // Ensure driver info is preserved
                  driver: data.order?.driver || data.driver || order.driver,
                  driverId: data.order?.driverId || data.driverId || order.driverId
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
    
    // Listen for driver assignment events
    socket.on('driver-order-response', (data) => {
      console.log('🚗 Driver assigned to order:', data);
      if (data.orderId || data.order?.id) {
        const orderId = data.orderId || data.order?.id;
        setOrders(prevOrders => {
          const updated = prevOrders.map(order => 
            order.id === orderId 
              ? { 
                  ...order, 
                  driver: data.order?.driver || data.driver || order.driver,
                  driverId: data.order?.driverId || data.driverId || order.driverId,
                  driverAccepted: data.accepted !== undefined ? data.accepted : order.driverAccepted
                }
              : order
          );
          return updated.sort((a, b) => {
            return new Date(b.createdAt) - new Date(a.createdAt);
          });
        });
      }
    });
    
    // Listen for payment confirmation
    socket.on('payment-confirmed', (data) => {
      console.log('💰 Payment confirmed:', data);
      if (data.orderId) {
        setOrders(prevOrders => {
          const updated = prevOrders.map(order => 
            order.id === data.orderId 
              ? { 
                  ...order, 
                  paymentStatus: 'paid',
                  status: data.status || order.status
                }
              : order
          );
          return updated.sort((a, b) => {
            return new Date(b.createdAt) - new Date(a.createdAt);
          });
        });
        setPaymentDialogOpen(false);
        setPaymentError('');
        setPaymentSuccess(false);
      }
    });
    
    return () => {
      socket.close();
    };
  }, [orders]);

  const fetchOrders = useCallback(async () => {
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
        setPage(0);
      } else {
        setError(response.data.message || 'No orders found.');
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError(err.response?.data?.error || 'Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [customer, navigate]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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

  const handleOpenPaymentDialog = (order) => {
    setSelectedOrder(order);
    // Prepopulate phone number from customer context, order, or localStorage
    const phoneNumber = customer?.phone || order.customerPhone || '';
    setPaymentPhone(phoneNumber);
    setPaymentError('');
    setPaymentSuccess(false);
    setPaymentDialogOpen(true);
  };

  const handleClosePaymentDialog = () => {
    setPaymentDialogOpen(false);
    setSelectedOrder(null);
    setPaymentPhone('');
    setPaymentError('');
    setPaymentSuccess(false);
    setProcessingPayment(false);
  };

  const handleInitiatePayment = async () => {
    if (!paymentPhone || !validateSafaricomPhone(paymentPhone)) {
      setPaymentError('Please enter a valid Safaricom phone number (e.g., 0712345678)');
      return;
    }

    if (!selectedOrder) {
      setPaymentError('Order not found');
      return;
    }

    setProcessingPayment(true);
    setPaymentError('');

    try {
      const formattedPhone = formatMpesaPhoneNumber(paymentPhone);
      
      console.log('Initiating M-Pesa STK Push for order:', {
        phoneNumber: formattedPhone,
        amount: selectedOrder.totalAmount,
        orderId: selectedOrder.id
      });
      
      const paymentResponse = await api.post('/mpesa/stk-push', {
        phoneNumber: formattedPhone,
        amount: parseFloat(selectedOrder.totalAmount),
        orderId: selectedOrder.id,
        accountReference: `ORDER-${selectedOrder.id}`
      });

      if (paymentResponse.data.success) {
        setPaymentError('');
        setPaymentSuccess(true);
        // Don't close dialog yet - wait for payment confirmation via socket
        // The dialog will close automatically when payment-confirmed event is received
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

  const totalOrders = orders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / rowsPerPage));
  const startIndex = totalOrders === 0 ? 0 : page * rowsPerPage;
  const endIndex = totalOrders === 0 ? 0 : Math.min(startIndex + rowsPerPage, totalOrders);
  const displayStart = totalOrders === 0 ? 0 : startIndex + 1;
  const displayEnd = totalOrders === 0 ? 0 : endIndex;
  const paginatedOrders = orders.slice(startIndex, endIndex);

  const handlePageChange = (_event, value) => {
    setPage(value - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
              Showing {displayStart}-{displayEnd} of {totalOrders} {totalOrders === 1 ? 'order' : 'orders'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {paginatedOrders.map((order) => (
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
                  minHeight: 'auto',
                  '&.Mui-expanded': {
                    minHeight: 'auto'
                  },
                  px: 2,
                  py: 1.5
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', pr: 2 }}>
                  {/* First Row: Order Info and Amount */}
                  <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1" sx={{ color: '#00E0B8', fontWeight: 600, mb: 0.5 }}>
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
                  
                  {/* Second Row: Order Progress Steps */}
                  <Box sx={{ mb: 1 }}>
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
                  
                  {/* Third Row: Make Payment Button for Unpaid Orders */}
                  {order.paymentStatus !== 'paid' && order.paymentType === 'pay_now' && order.status !== 'cancelled' && (
                    <Box sx={{ mt: 0.5 }}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<Payment />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenPaymentDialog(order);
                        }}
                        sx={{
                          backgroundColor: '#00E0B8',
                          color: '#0D0D0D',
                          '&:hover': {
                            backgroundColor: '#00C4A3'
                          }
                        }}
                      >
                        Make Payment
                      </Button>
                    </Box>
                  )}
                </Box>
              </AccordionSummary>
              <Divider />
              <AccordionDetails sx={{ px: 2, py: 2 }}>
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
                      Payment: {order.paymentStatus === 'paid' ? 'Paid' : order.paymentType === 'pay_now' ? 'Unpaid' : 'Pay on Delivery'}
                    </Typography>
                  </Box>
                )}

                {/* Driver Information */}
                {order.driver && (
                  <Box sx={{ mb: 2, p: 1.5, backgroundColor: 'rgba(0, 224, 184, 0.1)', borderRadius: 1 }}>
                    <Typography variant="caption" sx={{ color: '#000000', fontWeight: 600, display: 'block', mb: 0.5 }}>
                      Delivery Driver
                    </Typography>
                    <Typography variant="body2" color="text.primary" sx={{ fontSize: '0.85rem', fontWeight: 500 }}>
                      {order.driver.name || 'Driver Assigned'}
                    </Typography>
                    {order.driver.phoneNumber && (
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', mt: 0.5 }}>
                        Phone: {order.driver.phoneNumber}
                      </Typography>
                    )}
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
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={totalPages}
                page={page + 1}
                onChange={handlePageChange}
                color="primary"
                shape="rounded"
              />
            </Box>
          )}
        </>
      )}

      {/* Payment Dialog */}
      <Dialog 
        open={paymentDialogOpen} 
        onClose={handleClosePaymentDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Make Payment - Order #{selectedOrder?.id}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Total Amount: KES {selectedOrder?.totalAmount ? Number(selectedOrder.totalAmount).toFixed(2) : '0.00'}
          </Typography>
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
          {paymentSuccess && (
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
            onClick={handleInitiatePayment}
            variant="contained"
            disabled={processingPayment || !paymentPhone}
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
            ) : (
              'Send Payment Prompt'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default MyOrders;

