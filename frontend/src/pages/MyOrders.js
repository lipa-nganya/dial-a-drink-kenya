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
  Pagination,
  Tabs,
  Tab
} from '@mui/material';
import {
  CheckCircle,
  AccessTime,
  LocalShipping,
  ShoppingCart,
  Cancel,
  Visibility,
  ExpandMore,
  Payment,
  Refresh,
  Phone,
  Download,
  CreditCard,
  PhoneAndroid
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useCustomer } from '../contexts/CustomerContext';
import { useCart } from '../contexts/CartContext';
import io from 'socket.io-client';
import { getBackendUrl } from '../utils/backendUrl';

const MyOrders = () => {
  const navigate = useNavigate();
  const { customer, isLoggedIn, login } = useCustomer();
  const { clearCart, addToCart } = useCart();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('mobile_money'); // 'mobile_money' or 'card'
  const [paymentPhone, setPaymentPhone] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

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
      
      console.log('🔍 Fetching orders with:', { email, phone, customerId: customerData.id });
      console.log('🔍 Customer data:', JSON.stringify(customerData, null, 2));
      console.log('🔍 Request payload:', JSON.stringify({ email: email || null, phone: phone || null }, null, 2));
      
      // Fetch orders by email or phone
      const response = await api.post('/orders/find-all', {
        email: email || null,
        phone: phone || null
      });
      
      const orderIds = response.data.orders?.map(o => o.id) || [];
      console.log('📦 Orders response:', {
        success: response.data.success,
        orderCount: response.data.orders?.length || 0,
        orderIds: orderIds
      });
      console.log('📋 Order IDs found:', orderIds.join(', '));
      console.log('🔍 Checking for specific orders:', {
        has293: orderIds.includes(293),
        has304: orderIds.includes(304),
        allOrderIds: orderIds.sort((a, b) => a - b)
      });

      if (response.data.success) {
        // Show all orders (sorted by most recent first)
        const sortedOrders = (response.data.orders || []).sort((a, b) => {
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
        
        // Debug: Log delivery addresses to help identify the issue
        console.log('Fetched orders with delivery addresses:', sortedOrders.map(o => ({
          id: o.id,
          deliveryAddress: o.deliveryAddress,
          status: o.status
        })));
        
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

  // Restore customer from localStorage if context is lost
  useEffect(() => {
    if (!customer && !isLoggedIn) {
      const customerData = localStorage.getItem('customerOrder');
      if (customerData) {
        try {
          const parsed = JSON.parse(customerData);
          if (parsed.id || parsed.phone || parsed.email) {
            // Customer data exists, restore it to context
            login(parsed);
            console.log('✅ Restored customer from localStorage in MyOrders');
          }
        } catch (error) {
          console.error('Error restoring customer data:', error);
        }
      }
    }
  }, [customer, isLoggedIn, login]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(orders.length / rowsPerPage));
    if (page > 0 && page >= totalPages) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [orders.length, page, rowsPerPage]);
  
  // Set up Socket.IO for real-time order status updates
  useEffect(() => {
    if (orders.length === 0) return; // Don't set up socket if no orders yet
    
    const socketUrl = getBackendUrl();
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
                  status: data.status || order.status,
                  paymentMethod: data.paymentMethod || order.paymentMethod,
                  paymentProvider: data.paymentProvider || order.paymentProvider
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
        setProcessingPayment(false);
        // Refresh orders to get latest data
        fetchOrders();
      }
    });
    
    return () => {
      socket.close();
    };
  }, [orders, fetchOrders]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleDownloadReceipt = async (orderId) => {
    try {
      // Fetch the PDF as a blob
      const response = await api.get(`/orders/${orderId}/receipt`, {
        responseType: 'blob'
      });
      
      // Create a blob URL and trigger download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-order-${orderId}.pdf`;
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading receipt:', error);
      setError(error.response?.data?.error || 'Failed to download receipt. Please try again.');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'confirmed': return 'info';
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
    setPaymentMethod('mobile_money');
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

  const handlePaymentMethodChange = (event, newValue) => {
    setPaymentMethod(newValue);
    setPaymentError('');
    setPaymentSuccess(false);
  };

  const handleInitiateMobileMoneyPayment = async () => {
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
        setProcessingPayment(false);
        // Dialog will close automatically when payment-confirmed event is received
        // Also refresh orders after a short delay to get updated payment status
        setTimeout(() => {
          fetchOrders();
        }, 2000);
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
    if (!selectedOrder) {
      setPaymentError('Order not found');
      return;
    }

    setProcessingPayment(true);
    setPaymentError('');

    try {
      // Get current URL for callbacks
      const currentUrl = window.location.origin;
      const callbackUrl = `${currentUrl}/payment-success?orderId=${selectedOrder.id}`;
      const cancellationUrl = `${currentUrl}/payment-cancelled?orderId=${selectedOrder.id}`;
      
      console.log('Initiating PesaPal card payment:', {
        orderId: selectedOrder.id,
        amount: selectedOrder.totalAmount,
        callbackUrl,
        cancellationUrl
      });
      
      const paymentResponse = await api.post('/pesapal/initiate-payment', {
        orderId: selectedOrder.id,
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

  const formatPhoneForDisplay = (phone) => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');

    if (!digits) return '';

    if (digits.startsWith('254') && digits.length === 12) {
      return `0${digits.slice(3)}`;
    }

    if (digits.startsWith('0') && digits.length === 10) {
      return digits;
    }

    if (digits.length === 9 && digits.startsWith('7')) {
      return `0${digits}`;
    }

    return digits;
  };

  const handleReorder = (order) => {
    try {
      // Clear current cart
      clearCart();

      // Add all items from the order to the cart
      if (order.items && order.items.length > 0) {
        order.items.forEach((item) => {
          if (item.drink) {
            // Prepare drink object for cart
            const drinkForCart = {
              ...item.drink,
              selectedPrice: item.price,
              selectedCapacity: item.selectedCapacity || null // Use selectedCapacity if available
            };
            
            // Add item to cart with the original quantity
            addToCart(drinkForCart, item.quantity);
          }
        });
      }

      // Pre-populate customer delivery information using THIS SPECIFIC ORDER's address
      // Store delivery info in localStorage so Cart page can load it
      // Note: order.deliveryAddress is a combined string that includes address, apartment, and floor
      // We use the order's specific deliveryAddress to ensure each order uses its own address
      // Skip "In-Store Purchase" addresses - those are POS orders that shouldn't be reordered for delivery
      const deliveryAddress = order.deliveryAddress || '';
      
      console.log('Reorder - Order ID:', order.id, 'Delivery Address:', deliveryAddress);
      
      // Only use the order's delivery address if it's not "In-Store Purchase"
      // If it is "In-Store Purchase", we'll use an empty address and let the user enter a new one
      const addressToUse = deliveryAddress && deliveryAddress !== 'In-Store Purchase' 
        ? deliveryAddress 
        : '';
      
      const deliveryInfo = {
        name: order.customerName || customer?.name || '',
        phone: formatPhoneForDisplay(order.customerPhone || customer?.phone || ''),
        email: order.customerEmail || customer?.email || '',
        address: addressToUse, // Use this specific order's delivery address (skip "In-Store Purchase")
        apartmentHouseNumber: '', // Address components are combined in deliveryAddress, user can add if needed
        floorNumber: '', // Address components are combined in deliveryAddress, user can add if needed
        notes: '' // User can add new notes
      };

      // Store this order's specific delivery info (overwrites any previous reorder's address)
      localStorage.setItem('customerDeliveryInfo', JSON.stringify(deliveryInfo));

      // Navigate to cart page
      navigate('/cart');
    } catch (error) {
      console.error('Error reordering:', error);
      setError('Failed to reorder. Please try again.');
    }
  };

  const getProgressSteps = (status) => {
    const steps = [
      { label: 'Order Placed', status: 'pending', completed: true },
      { label: 'Confirmed', status: 'confirmed', completed: ['confirmed', 'out_for_delivery', 'delivered', 'completed'].includes(status) },
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
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Showing {displayStart}-{displayEnd} of {totalOrders} {totalOrders === 1 ? 'order' : 'orders'}
            </Typography>
            {totalOrders > 10 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Rows per page:
                </Typography>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setPage(0);
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    backgroundColor: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </Box>
            )}
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
                  
                  {/* Second Row: Order Progress Steps and Action Buttons */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
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
                    <Box 
                      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flexShrink: 0, ml: 2 }}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {/* Reorder Button for Completed/Delivered Orders */}
                      {(order.status === 'completed' || order.status === 'delivered') && (
                        <Button
                          component="div"
                          variant="contained"
                          size="small"
                          startIcon={<Refresh />}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleReorder(order);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          sx={{
                            backgroundColor: '#00E0B8',
                            color: '#0D0D0D',
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: '#00C4A3'
                            }
                          }}
                        >
                          Reorder
                        </Button>
                      )}
                      {/* Download Receipt Button for Paid or Completed Orders */}
                      {(order.paymentStatus === 'paid' || order.status === 'completed' || order.status === 'delivered') && (
                        <Button
                          component="div"
                          variant="contained"
                          size="small"
                          startIcon={<Download />}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleDownloadReceipt(order.id);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          sx={{
                            backgroundColor: '#00E0B8',
                            color: '#0D0D0D',
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: '#00C4A3'
                            }
                          }}
                        >
                          Download Receipt
                        </Button>
                      )}
                      {/* Make Payment Button for Unpaid Orders - Show for all unpaid orders */}
                      {order.paymentStatus !== 'paid' && 
                       order.status !== 'cancelled' && (
                        <Button
                          component="div"
                          variant="contained"
                          size="small"
                          startIcon={<Payment />}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleOpenPaymentDialog(order);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          sx={{
                            backgroundColor: '#00E0B8',
                            color: '#0D0D0D',
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: '#00C4A3'
                            }
                          }}
                        >
                          Make Payment
                        </Button>
                      )}
                    </Box>
                  </Box>
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
                      Payment: {order.paymentStatus === 'paid' 
                        ? 'Paid' 
                        : order.paymentType === 'pay_now' 
                          ? 'Unpaid' 
                          : order.paymentType === 'pay_on_delivery'
                            ? order.paymentStatus === 'unpaid' 
                              ? 'Pay on Delivery (Unpaid)' 
                              : 'Pay on Delivery'
                            : 'Pending'}
                    </Typography>
                  </Box>
                )}

                {/* Driver Information - Only show after order is confirmed */}
                {order.driver && order.status !== 'pending' && (
                  <Box sx={{ mb: 2, p: 1.5, backgroundColor: 'rgba(0, 224, 184, 0.1)', borderRadius: 1 }}>
                    <Typography variant="caption" sx={{ color: '#000000', fontWeight: 600, display: 'block', mb: 0.5 }}>
                      Delivery Rider
                    </Typography>
                    <Typography variant="body2" color="text.primary" sx={{ fontSize: '0.85rem', fontWeight: 500, mb: 1 }}>
                      {order.driver.name || 'Rider Assigned'}
                    </Typography>
                    {order.driver.phoneNumber && (
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<Phone />}
                        component="a"
                        href={`tel:${order.driver.phoneNumber}`}
                        sx={{
                          backgroundColor: '#00E0B8',
                          color: '#0D0D0D',
                          fontSize: '0.85rem',
                          '&:hover': {
                            backgroundColor: '#00C4A3'
                          }
                        }}
                      >
                        Call Rider
                      </Button>
                    )}
                  </Box>
                )}

                {/* View Details Button */}
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Visibility />}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/order-tracking`, { state: { order } });
                  }}
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
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Total Amount: KES {selectedOrder?.totalAmount ? Number(selectedOrder.totalAmount).toFixed(2) : '0.00'}
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

export default MyOrders;

