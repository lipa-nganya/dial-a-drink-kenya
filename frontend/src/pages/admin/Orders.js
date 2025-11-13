import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  LocalShipping,
  ShoppingCart,
  AccessTime,
  DoneAll,
  Warning,
  Assignment,
  Edit,
  Person,
  Search
} from '@mui/icons-material';
import { api } from '../../services/api';
import io from 'socket.io-client';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [transactionStatusFilter, setTransactionStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [drivers, setDrivers] = useState([]);
  const [driverDialogOpen, setDriverDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');

  useEffect(() => {
    fetchOrders();
    fetchDrivers();
  }, []);
  
  const fetchDrivers = async () => {
    try {
      const response = await api.get('/drivers');
      setDrivers(response.data || []);
    } catch (error) {
      console.error('Error fetching drivers:', error);
    }
  };

  // Set up Socket.IO for real-time order updates
  useEffect(() => {
    const isHosted =
      window.location.hostname.includes('onrender.com') ||
      window.location.hostname.includes('run.app');
    const socketUrl = isHosted
      ? 'https://dialadrink-backend-910510650031.us-central1.run.app'
      : 'http://localhost:5001';
    
    const socket = io(socketUrl);
    
    // Join admin room to receive order notifications
    socket.emit('join-admin');
    
    // Listen for new orders
    socket.on('new-order', async (data) => {
      console.log('✅ New order received via Socket.IO:', data);
      await fetchOrders(); // Refresh orders list
    });

    // Listen for order updates (including driver assignment)
    socket.on('order-updated', async (data) => {
      console.log('✅ Order updated via Socket.IO:', data);
      await fetchOrders(); // Refresh orders list
    });

    // Listen for driver order response
    socket.on('driver-order-response', async (data) => {
      console.log('✅ Driver responded to order:', data);
      // Update the specific order in the list
      setOrders(prevOrders => {
        const updated = prevOrders.map(order => 
          order.id === data.orderId 
            ? { ...order, driverAccepted: data.accepted, driver: data.order?.driver }
            : order
        );
        const sorted = sortOrdersByStatus(updated);
        applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchTerm);
        return sorted;
      });
    });

    // Listen for order status updates from driver app
    socket.on('order-status-updated', async (data) => {
      console.log('✅ Order status updated via Socket.IO:', data);
      if (data.orderId) {
        // Update order immediately with status from event
        setOrders(prevOrders => {
          const updated = prevOrders.map(order => 
            order.id === data.orderId 
              ? { 
                  ...order, 
                  status: data.status || order.status,
                  paymentStatus: data.paymentStatus || order.paymentStatus,
                  ...(data.order || {}) // Merge full order object if provided
                }
              : order
          );
          const sorted = sortOrdersByStatus(updated);
          applyFilters(sorted, orderStatusFilter, transactionStatusFilter);
          return sorted;
        });
      }
    });

    // Listen for order updates (status changes, payment confirmations, etc.)
    socket.on('payment-confirmed', async (data) => {
      console.log('✅ Payment confirmed for order:', data);
      if (data.orderId) {
        // Update order immediately with payment status from event - merge full order object if provided
        setOrders(prevOrders => {
          const updated = prevOrders.map(order => {
            if (order.id === data.orderId) {
              // Merge order object if provided, otherwise just update status fields
              const updatedOrder = data.order 
                ? { ...order, ...data.order, status: data.status || 'confirmed', paymentStatus: 'paid', paymentConfirmedAt: data.paymentConfirmedAt }
                : { 
                    ...order, 
                    status: data.status || 'confirmed',
                    paymentStatus: 'paid',
                    paymentConfirmedAt: data.paymentConfirmedAt,
                    transactions: order.transactions?.map(tx => 
                      tx.id === data.transactionId 
                        ? { ...tx, status: 'completed', receiptNumber: data.receiptNumber }
                        : tx
                    ) || []
                  };
              console.log(`✅ Updated order #${data.orderId}: paymentStatus → paid, status → ${data.status || 'confirmed'}`);
              return updatedOrder;
            }
            return order;
          });
          // Re-sort after update (filtering will be handled by the useEffect that watches orders)
          return sortOrdersByStatus(updated);
        });
      }
    });

    return () => {
      socket.close();
    };
  }, []);

  // Order status priority for sorting
  const getStatusPriority = (status) => {
    const priorityMap = {
      'pending': 1,
      'confirmed': 2,
      'preparing': 3,
      'out_for_delivery': 4,
      'delivered': 5,
      'completed': 6,
      'cancelled': 7
    };
    return priorityMap[status] || 999;
  };

  // Sort orders by status priority, then by creation date (newest first within same status)
  const sortOrdersByStatus = (ordersList) => {
    return [...ordersList].sort((a, b) => {
      const priorityA = getStatusPriority(a.status);
      const priorityB = getStatusPriority(b.status);
      
      // First sort by status priority
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // If same status, sort by creation date (newest first)
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/orders');
      let orders = response.data;
      
      // Additional sync: Check each order and ensure paymentStatus matches transaction status
      orders = orders.map(order => {
        if (order.transactions && order.transactions.length > 0) {
          const hasCompletedTransaction = order.transactions.some(tx => tx.status === 'completed');
          // If transaction is completed but paymentStatus is not 'paid', update it
          if (hasCompletedTransaction && order.paymentStatus !== 'paid') {
            console.log(`🔧 Frontend sync: Updating Order #${order.id} paymentStatus from ${order.paymentStatus} to 'paid'`);
            return { ...order, paymentStatus: 'paid' };
          }
        }
        return order;
      });
      
      const sortedOrders = sortOrdersByStatus(orders);
      setOrders(sortedOrders);
      setError(null);
      // Apply filters after fetching
      applyFilters(sortedOrders, orderStatusFilter, transactionStatusFilter, searchTerm);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  // Get transaction status for an order
  const getOrderTransactionStatus = (order) => {
    if (!order.transactions || order.transactions.length === 0) {
      return 'pending'; // No transaction created yet
    }
    // Get the most recent transaction
    const latestTransaction = order.transactions.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    )[0];
    return latestTransaction.status || 'pending';
  };

  // Apply filters to orders
  const applyFilters = (ordersList, orderStatus, transactionStatus, search = '') => {
    let filtered = [...ordersList];

    // Filter by search term (customer name or order number)
    if (search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filtered = filtered.filter(order => {
        const orderNumber = order.id.toString().toLowerCase();
        const customerName = (order.customerName || '').toLowerCase();
        return orderNumber.includes(searchLower) || customerName.includes(searchLower);
      });
    }

    // Filter by order status
    if (orderStatus !== 'all') {
      filtered = filtered.filter(order => order.status === orderStatus);
    }

    // Filter by transaction status
    if (transactionStatus !== 'all') {
      filtered = filtered.filter(order => {
        const txStatus = getOrderTransactionStatus(order);
        return txStatus === transactionStatus;
      });
    }

    // Sort filtered results
    const sorted = sortOrdersByStatus(filtered);
    setFilteredOrders(sorted);
  };

  // Update filters when filter values change
  useEffect(() => {
    applyFilters(orders, orderStatusFilter, transactionStatusFilter, searchTerm);
  }, [orderStatusFilter, transactionStatusFilter, searchTerm, orders]);

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      const response = await api.patch(`/admin/orders/${orderId}/status`, { status: newStatus });
      setOrders(prevOrders => {
        const updated = prevOrders.map(order => 
          order.id === orderId ? { ...order, status: newStatus, paymentStatus: response.data.paymentStatus } : order
        );
        // Re-sort after status update
        return sortOrdersByStatus(updated);
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      setError(error.response?.data?.error || error.message);
    }
  };

  const handlePaymentStatusUpdate = async (orderId, paymentStatus) => {
    try {
      const response = await api.patch(`/admin/orders/${orderId}/payment-status`, { paymentStatus });
      setOrders(prevOrders => {
        const updated = prevOrders.map(order => 
          order.id === orderId ? { ...order, paymentStatus, status: response.data.status } : order
        );
        // Re-sort after payment status update (status might have changed to completed)
        const sorted = sortOrdersByStatus(updated);
        // Apply filters to updated orders
        applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchTerm);
        return sorted;
      });
    } catch (error) {
      console.error('Error updating payment status:', error);
      setError(error.response?.data?.error || error.message);
    }
  };

  const handleOpenDriverDialog = (order) => {
    setSelectedOrder(order);
    setSelectedDriverId(order.driverId || '');
    setDriverDialogOpen(true);
  };

  const handleCloseDriverDialog = () => {
    setDriverDialogOpen(false);
    setSelectedOrder(null);
    setSelectedDriverId('');
  };

  const handleAssignDriver = async () => {
    if (!selectedOrder) return;
    
    try {
      const driverId = selectedDriverId === '' ? null : parseInt(selectedDriverId);
      await api.patch(`/admin/orders/${selectedOrder.id}/driver`, { driverId });
      
      // Refresh orders to get updated data
      await fetchOrders();
      handleCloseDriverDialog();
    } catch (error) {
      console.error('Error assigning driver:', error);
      setError(error.response?.data?.error || error.message);
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
      case 'delivered': return <DoneAll />;
      case 'completed': return <DoneAll />;
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

  const getPaymentStatusColor = (paymentStatus, orderStatus) => {
    if (orderStatus === 'delivered' && paymentStatus === 'unpaid') {
      return 'error'; // Highlight unpaid delivered orders
    }
    switch (paymentStatus) {
      case 'paid': return 'success';
      case 'unpaid': return 'warning';
      case 'pending': return 'default';
      default: return 'default';
    }
  };

  const getNextStatusOptions = (currentStatus, paymentType, paymentStatus) => {
    const options = [];
    
    if (currentStatus === 'pending') {
      // For Pay Later orders, admin confirms manually
      // For Pay Now orders, they should already be confirmed automatically when payment completes
      // But if still pending, allow manual confirmation
      if (paymentType === 'pay_on_delivery') {
        options.push({ value: 'confirmed', label: 'Confirm Order (Manual)' });
      } else {
        // Pay Now but still pending - allow confirmation
        options.push({ value: 'confirmed', label: 'Confirm Order' });
      }
      options.push({ value: 'cancelled', label: 'Cancel' });
    } else if (currentStatus === 'confirmed') {
      options.push({ value: 'preparing', label: 'Start Preparing' });
      options.push({ value: 'cancelled', label: 'Cancel' });
    } else if (currentStatus === 'preparing') {
      options.push({ value: 'out_for_delivery', label: 'On the Way' });
    } else if (currentStatus === 'out_for_delivery') {
      options.push({ value: 'delivered', label: 'Mark as Delivered' });
    } else if (currentStatus === 'delivered') {
      // If payment is paid, can mark as completed
      if (paymentStatus === 'paid') {
        options.push({ value: 'completed', label: 'Mark as Completed' });
      }
      // If unpaid, show button to mark payment received
    }
    
    return options;
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading orders...</Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">Error loading orders: {error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Assignment sx={{ color: '#00E0B8', fontSize: 40 }} />
          <Typography variant="h4" component="h1" gutterBottom sx={{ color: '#00E0B8', fontWeight: 700 }}>
            Orders Management
          </Typography>
        </Box>
        <Typography variant="h6" color="text.secondary">
          Manage customer orders and track their status
        </Typography>
      </Box>

      {/* Filters */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search by customer name or order number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            )
          }}
          sx={{
            minWidth: 300,
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: '#00E0B8',
              },
              '&:hover fieldset': {
                borderColor: '#00C4A3',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#00E0B8',
              },
            },
            '& .MuiInputBase-input': {
              color: '#F5F5F5',
            },
          }}
        />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Filter by Order Status</InputLabel>
          <Select
            value={orderStatusFilter}
            label="Filter by Order Status"
            onChange={(e) => setOrderStatusFilter(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: '#00E0B8',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: '#00C4A3',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: '#00E0B8',
              },
            }}
          >
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="confirmed">Confirmed</MenuItem>
            <MenuItem value="preparing">Preparing</MenuItem>
            <MenuItem value="out_for_delivery">On the Way</MenuItem>
            <MenuItem value="delivered">Delivered</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Filter by Transaction Status</InputLabel>
          <Select
            value={transactionStatusFilter}
            label="Filter by Transaction Status"
            onChange={(e) => setTransactionStatusFilter(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: '#00E0B8',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: '#00C4A3',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: '#00E0B8',
              },
            }}
          >
            <MenuItem value="all">All Transactions</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </Select>
        </FormControl>

        {(orderStatusFilter !== 'all' || transactionStatusFilter !== 'all' || searchTerm.trim()) && (
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setOrderStatusFilter('all');
              setTransactionStatusFilter('all');
              setSearchTerm('');
            }}
            sx={{
              borderColor: '#666',
              color: '#F5F5F5',
              '&:hover': { borderColor: '#888' }
            }}
          >
            Clear Filters
          </Button>
        )}

        <Box sx={{ ml: 'auto' }}>
          <Typography variant="body2" color="text.secondary">
            Showing {filteredOrders.length} of {orders.length} orders
          </Typography>
        </Box>
      </Box>

      {filteredOrders.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <ShoppingCart sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            No orders found
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }}>Order ID</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }}>Customer</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }}>Items</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }}>Total Amount</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }}>Payment Status</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }}>Order Status</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }}>Driver</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders.map((order) => {
                const isUnpaidDelivered = order.status === 'delivered' && order.paymentStatus === 'unpaid';
                const nextStatusOptions = getNextStatusOptions(order.status, order.paymentType, order.paymentStatus);
                
                return (
                  <TableRow
                    key={order.id}
                    sx={{
                      backgroundColor: isUnpaidDelivered ? 'rgba(255, 51, 102, 0.1)' : 'transparent',
                      '&:hover': {
                        backgroundColor: isUnpaidDelivered ? 'rgba(255, 51, 102, 0.15)' : 'rgba(0, 224, 184, 0.05)'
                      }
                    }}
                  >
                    <TableCell>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        #{order.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {order.customerName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {order.customerPhone}
                        </Typography>
                        {order.customerEmail && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {order.customerEmail}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {order.items?.length || 0} item(s)
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {order.items?.slice(0, 2).map(item => item.drink?.name).join(', ')}
                        {order.items?.length > 2 && '...'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: '#FF3366' }}>
                        KES {Number(order.totalAmount).toFixed(2)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {order.paymentType === 'pay_now' ? 'Paid Now' : 'Pay on Delivery'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={order.paymentStatus === 'paid' ? 'Paid' : order.paymentStatus === 'unpaid' ? 'Unpaid' : 'Pending'}
                        color={getPaymentStatusColor(order.paymentStatus, order.status)}
                        size="small"
                        icon={order.paymentStatus === 'paid' ? <CheckCircle /> : order.paymentStatus === 'unpaid' ? <Warning /> : <AccessTime />}
                      />
                      {isUnpaidDelivered && (
                        <Tooltip title="This order has been delivered but payment is still unpaid">
                          <IconButton size="small" sx={{ ml: 1, color: 'error.main' }}>
                            <Warning />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(order.status)}
                        label={getStatusLabel(order.status)}
                        color={getStatusColor(order.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {order.driver ? (
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Person fontSize="small" color="text.secondary" />
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {order.driver.name}
                            </Typography>
                          </Box>
                          {order.driverAccepted === true && (
                            <Chip 
                              label="Accepted" 
                              color="success" 
                              size="small" 
                              sx={{ mt: 0.5 }}
                            />
                          )}
                          {order.driverAccepted === false && (
                            <Chip 
                              label="Rejected" 
                              color="error" 
                              size="small" 
                              sx={{ mt: 0.5 }}
                            />
                          )}
                          {order.driverAccepted === null && order.driverId && (
                            <Chip 
                              label="Pending Response" 
                              color="warning" 
                              size="small" 
                              sx={{ mt: 0.5 }}
                            />
                          )}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Not assigned
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(order.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Edit />}
                          onClick={() => handleOpenDriverDialog(order)}
                          sx={{
                            borderColor: '#00E0B8',
                            color: '#00E0B8',
                            '&:hover': {
                              borderColor: '#00C4A3',
                              backgroundColor: 'rgba(0, 224, 184, 0.1)'
                            }
                          }}
                        >
                          Assign Driver
                        </Button>
                        {nextStatusOptions.length > 0 && (
                          <FormControl size="small" sx={{ minWidth: 150 }}>
                            <InputLabel>Update Status</InputLabel>
                            <Select
                              value=""
                              label="Update Status"
                              onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                            >
                              {nextStatusOptions.map(option => (
                                <MenuItem key={option.value} value={option.value}>
                                  {option.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}
                        
                        {order.status === 'delivered' && order.paymentStatus === 'unpaid' && (
                          <Button
                            variant="contained"
                            size="small"
                            color="success"
                            onClick={async () => {
                              await handlePaymentStatusUpdate(order.id, 'paid');
                              // This will automatically update order to completed
                            }}
                            sx={{ mt: 1 }}
                          >
                            Mark Payment Received
                          </Button>
                        )}
                        
                        {/* Manual payment verification for M-Pesa orders that are still pending */}
                        {order.paymentMethod === 'mobile_money' && 
                         order.paymentStatus === 'pending' && 
                         order.status === 'pending' &&
                         getOrderTransactionStatus(order) !== 'completed' && (
                          <Button
                            variant="outlined"
                            size="small"
                            color="primary"
                            onClick={async () => {
                              if (window.confirm(`Verify payment for Order #${order.id}?\n\nThis will mark the order as paid and confirmed.`)) {
                                try {
                                  const response = await api.post(`/admin/orders/${order.id}/verify-payment`, {
                                    receiptNumber: prompt('Enter M-Pesa receipt number (optional):') || null
                                  });
                                  if (response.data.success) {
                                    // Refresh orders to show updated status
                                    await fetchOrders();
                                    alert('Payment verified successfully!');
                                  }
                                } catch (error) {
                                  console.error('Error verifying payment:', error);
                                  alert('Failed to verify payment: ' + (error.response?.data?.error || error.message));
                                }
                              }
                            }}
                            sx={{ mt: 1, borderColor: '#00E0B8', color: '#00E0B8' }}
                          >
                            Verify Payment
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Driver Assignment Dialog */}
      <Dialog 
        open={driverDialogOpen} 
        onClose={handleCloseDriverDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: '#00E0B8', fontWeight: 700 }}>
          Assign Driver to Order #{selectedOrder?.id}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Select Driver</InputLabel>
              <Select
                value={selectedDriverId}
                label="Select Driver"
                onChange={(e) => setSelectedDriverId(e.target.value)}
              >
                <MenuItem value="">
                  <em>No Driver (Unassign)</em>
                </MenuItem>
                {drivers.map((driver) => (
                  <MenuItem key={driver.id} value={driver.id}>
                    {driver.name} - {driver.phoneNumber} ({driver.status})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {selectedOrder && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Customer: {selectedOrder.customerName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Amount: KES {Number(selectedOrder.totalAmount).toFixed(2)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Address: {selectedOrder.deliveryAddress}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={handleCloseDriverDialog}
            sx={{ color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssignDriver}
            variant="contained"
            sx={{
              backgroundColor: '#00E0B8',
              color: '#0D0D0D',
              '&:hover': {
                backgroundColor: '#00C4A3'
              }
            }}
          >
            Assign Driver
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Orders;
