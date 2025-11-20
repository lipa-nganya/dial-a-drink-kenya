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
  TablePagination,
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
  Cancel,
  ShoppingCart,
  Warning,
  Assignment,
  Edit,
  Person,
  Delete,
  Search,
  Clear,
  Store
} from '@mui/icons-material';
import { api } from '../services/api';
import io from 'socket.io-client';
import { useTheme } from '../contexts/ThemeContext';
import { getOrderStatusChipProps, getPaymentStatusChipProps, getPaymentMethodChipProps } from '../utils/chipStyles';

const Orders = () => {
  const { isDarkMode, colors } = useTheme();
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [transactionStatusFilter, setTransactionStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [drivers, setDrivers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [driverDialogOpen, setDriverDialogOpen] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [reassignDriver, setReassignDriver] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonError, setCancelReasonError] = useState('');
  const [cancelTargetOrder, setCancelTargetOrder] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    fetchOrders();
    fetchDrivers();
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const response = await api.get('/branches?activeOnly=true');
      setBranches(response.data || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

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
      
      // Fetch the full order details with items and transactions
      try {
        const response = await api.get(`/admin/orders`);
        const allOrders = response.data;
        
        // Find the new order (should be the most recent, so check first few)
        const newOrder = allOrders.find(o => o.id === data.order?.id) || allOrders[0];
        
        if (newOrder) {
          // Add or update order, then sort by status
          setOrders(prevOrders => {
            // Check if order already exists
            const existingIndex = prevOrders.findIndex(o => o.id === newOrder.id);
            let updated;
            
            if (existingIndex >= 0) {
              // Update existing order
              updated = [...prevOrders];
              updated[existingIndex] = newOrder;
            } else {
              // Add new order
              updated = [newOrder, ...prevOrders];
            }
            
            // Sort by status priority
            const sorted = sortOrdersByStatus(updated);
            // Apply filters after update
            applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery);
            return sorted;
          });
        }
      } catch (error) {
        console.error('Error fetching new order details:', error);
        // Fallback: if order data is in the event, use it
        if (data.order) {
          setOrders(prevOrders => {
            const exists = prevOrders.some(o => o.id === data.order.id);
            if (!exists) {
              return [data.order, ...prevOrders];
            }
            return prevOrders;
          });
        }
      }
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
        applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery);
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
          applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery);
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
      applyFilters(sortedOrders, orderStatusFilter, transactionStatusFilter, searchQuery);
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
  const applyFilters = (ordersList, orderStatus, transactionStatus, search) => {
    let filtered = [...ordersList];

    // Filter by search query (customer name or order number)
    if (search && search.trim()) {
      const searchLower = search.trim().toLowerCase();
      filtered = filtered.filter(order => {
        // Search by order number (ID)
        const orderNumberMatch = order.id.toString().includes(searchLower);
        
        // Search by customer name
        const customerNameMatch = order.customerName?.toLowerCase().includes(searchLower);
        
        return orderNumberMatch || customerNameMatch;
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
    applyFilters(orders, orderStatusFilter, transactionStatusFilter, searchQuery);
  }, [orderStatusFilter, transactionStatusFilter, searchQuery, orders]);

  const handleStatusUpdate = async (orderId, newStatus) => {
    if (newStatus === 'cancelled') {
      const targetOrder = orders.find(order => order.id === orderId) || null;
      setCancelTargetOrder(targetOrder);
      setCancelReason('');
      setCancelReasonError('');
      setCancelDialogOpen(true);
      return;
    }

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

  const handleCloseCancelDialog = () => {
    setCancelDialogOpen(false);
    setCancelReason('');
    setCancelReasonError('');
    setCancelTargetOrder(null);
  };

  const handleConfirmCancel = async () => {
    if (!cancelTargetOrder) {
      return;
    }

    const trimmedReason = cancelReason.trim();
    if (!trimmedReason) {
      setCancelReasonError('Cancellation reason is required');
      return;
    }

    if (trimmedReason.length > 100) {
      setCancelReasonError('Reason must be 100 characters or fewer');
      return;
    }

    try {
      const response = await api.patch(`/admin/orders/${cancelTargetOrder.id}/status`, {
        status: 'cancelled',
        reason: trimmedReason
      });

      setOrders((prevOrders) => {
        const updated = prevOrders.map((order) =>
          order.id === cancelTargetOrder.id ? { ...order, status: 'cancelled', ...response.data } : order
        );
        return sortOrdersByStatus(updated);
      });

      handleCloseCancelDialog();
    } catch (error) {
      console.error('Error cancelling order:', error);
      setCancelReasonError(error.response?.data?.error || 'Failed to cancel order');
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
        applyFilters(sorted, orderStatusFilter, transactionStatusFilter, searchQuery);
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

  const handleOpenBranchDialog = (order) => {
    // Prevent opening dialog for cancelled or completed orders
    if (order.status === 'cancelled') {
      setError('Cannot change branch assignment for cancelled orders.');
      return;
    }
    if (order.status === 'completed') {
      setError('Cannot change branch assignment for completed orders.');
      return;
    }
    setSelectedOrder(order);
    setSelectedBranchId(order.branchId || '');
    setReassignDriver(false); // Reset reassign driver option
    setBranchDialogOpen(true);
  };

  const handleCloseBranchDialog = () => {
    setBranchDialogOpen(false);
    setSelectedOrder(null);
    setSelectedBranchId('');
    setReassignDriver(false);
  };

  const handleAssignBranch = async () => {
    if (!selectedOrder) return;
    
    // Prevent branch assignment for cancelled or completed orders
    if (selectedOrder.status === 'cancelled') {
      setError('Cannot change branch assignment for cancelled orders.');
      return;
    }
    if (selectedOrder.status === 'completed') {
      setError('Cannot change branch assignment for completed orders.');
      return;
    }
    
    try {
      const branchId = selectedBranchId === '' ? null : parseInt(selectedBranchId);
      const oldBranchId = selectedOrder.branchId;
      
      // Only show driver reassignment option if branch is actually changing and new branch is set
      const shouldReassignDriver = reassignDriver && branchId !== oldBranchId && branchId !== null;
      
      await api.patch(`/admin/orders/${selectedOrder.id}/branch`, { 
        branchId,
        reassignDriver: shouldReassignDriver
      });
      
      // Refresh orders to get updated data
      await fetchOrders();
      handleCloseBranchDialog();
    } catch (error) {
      console.error('Error assigning branch:', error);
      setError(error.response?.data?.error || error.message);
    }
  };

  const handleRemoveDriver = async (order) => {
    if (!window.confirm(`Are you sure you want to remove ${order.driver?.name || 'the driver'} from Order #${order.id}?`)) {
      return;
    }
    
    try {
      await api.patch(`/admin/orders/${order.id}/driver`, { driverId: null });
      
      // Refresh orders to get updated data
      await fetchOrders();
    } catch (error) {
      console.error('Error removing driver:', error);
      setError(error.response?.data?.error || error.message);
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
          <Assignment sx={{ color: colors.accentText, fontSize: 40 }} />
          <Typography variant="h4" component="h1" gutterBottom sx={{ color: colors.accentText, fontWeight: 700 }}>
            Orders Management
          </Typography>
        </Box>
        <Typography variant="h6" color="text.secondary">
          Manage customer orders and track their status
        </Typography>
      </Box>

      {/* Filters */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search Input */}
        <TextField
          size="small"
          placeholder="Search by order number or customer name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: colors.accentText }} />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => setSearchQuery('')}
                  sx={{ color: 'text.secondary' }}
                >
                  <Clear fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
            sx={{
              minWidth: 300,
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: colors.accentText,
                },
                '&:hover fieldset': {
                  borderColor: '#00C4A3',
                },
                '&.Mui-focused fieldset': {
                  borderColor: colors.accentText,
                },
              },
              '& .MuiInputBase-input': {
                color: colors.textPrimary,
              },
              '& .MuiInputBase-input::placeholder': {
                color: colors.textSecondary,
                opacity: 1,
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
                borderColor: colors.accentText,
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: '#00C4A3',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: colors.accentText,
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
            <MenuItem value="pos_order">POS Order</MenuItem>
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
                borderColor: colors.accentText,
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: '#00C4A3',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: colors.accentText,
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

        {(orderStatusFilter !== 'all' || transactionStatusFilter !== 'all' || searchQuery) && (
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setOrderStatusFilter('all');
              setTransactionStatusFilter('all');
              setSearchQuery('');
            }}
            sx={{
              borderColor: colors.border,
              color: colors.textPrimary,
              '&:hover': { borderColor: colors.textSecondary }
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
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Order ID</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Customer</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Items</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Total Amount</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Payment Status</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Order Status</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Branch</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Driver</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((order) => {
                const isUnpaidDelivered = order.status === 'delivered' && order.paymentStatus === 'unpaid';
                const statusChip = getOrderStatusChipProps(order.status);
                const paymentStatusChip = getPaymentStatusChipProps(order.paymentStatus, order.status);
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
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                        {paymentStatusChip ? (
                          <Chip
                            size="small"
                            {...paymentStatusChip}
                          />
                        ) : (
                          <Chip size="small" label="—" />
                        )}
                        {order.paymentMethod && (() => {
                          const methodChip = getPaymentMethodChipProps(order.paymentMethod);
                          if (methodChip) {
                            return (
                              <Chip
                                size="small"
                                label={methodChip.label}
                                sx={{
                                  fontSize: '0.7rem',
                                  height: '20px',
                                  ...methodChip.sx
                                }}
                              />
                            );
                          }
                          return null;
                        })()}
                        {isUnpaidDelivered && (
                          <Tooltip title="This order has been delivered but payment is still unpaid">
                            <IconButton size="small" sx={{ color: 'error.main' }}>
                              <Warning />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Chip
                          size="small"
                          {...statusChip}
                        />
                        {order.deliveryAddress === 'In-Store Purchase' && (
                          <Chip
                            label="POS"
                            size="small"
                            sx={{
                              backgroundColor: '#00E0B8',
                              color: '#003B2F',
                              fontWeight: 600,
                              fontSize: '0.65rem',
                              height: '20px'
                            }}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {order.branch ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {order.branch.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                            {order.branch.address}
                          </Typography>
                          <Button
                            variant="text"
                            size="small"
                            startIcon={<Edit />}
                            onClick={() => handleOpenBranchDialog(order)}
                            disabled={order.status === 'cancelled' || order.status === 'completed'}
                            sx={{ 
                              alignSelf: 'flex-start',
                              p: 0, 
                              minWidth: 'auto', 
                              fontSize: '0.7rem',
                              color: (order.status === 'cancelled' || order.status === 'completed') ? colors.textSecondary : colors.accentText,
                              '&:hover': {
                                backgroundColor: (order.status === 'cancelled' || order.status === 'completed') ? 'transparent' : 'rgba(0, 224, 184, 0.1)',
                                color: (order.status === 'cancelled' || order.status === 'completed') ? colors.textSecondary : '#00C4A3'
                              },
                              '&.Mui-disabled': {
                                color: colors.textSecondary,
                                opacity: 0.5
                              }
                            }}
                          >
                            Change
                          </Button>
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Not assigned
                          </Typography>
                          <Button
                            variant="text"
                            size="small"
                            startIcon={<Edit />}
                            onClick={() => handleOpenBranchDialog(order)}
                            disabled={order.status === 'cancelled' || order.status === 'completed'}
                            sx={{ 
                              alignSelf: 'flex-start',
                              p: 0, 
                              minWidth: 'auto', 
                              fontSize: '0.7rem',
                              color: (order.status === 'cancelled' || order.status === 'completed') ? colors.textSecondary : colors.accentText,
                              '&:hover': {
                                backgroundColor: (order.status === 'cancelled' || order.status === 'completed') ? 'transparent' : 'rgba(0, 224, 184, 0.1)',
                                color: (order.status === 'cancelled' || order.status === 'completed') ? colors.textSecondary : '#00C4A3'
                              },
                              '&.Mui-disabled': {
                                color: colors.textSecondary,
                                opacity: 0.5
                              }
                            }}
                          >
                            Assign
                          </Button>
                        </Box>
                      )}
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
                          disabled={order.status === 'delivered' || order.status === 'completed' || order.status === 'cancelled'}
                          sx={{
                            borderColor: (order.status === 'delivered' || order.status === 'completed' || order.status === 'cancelled') ? colors.border : colors.accentText,
                            color: (order.status === 'delivered' || order.status === 'completed' || order.status === 'cancelled') ? colors.textSecondary : colors.accentText,
                            '&:hover': {
                              borderColor: (order.status === 'delivered' || order.status === 'completed' || order.status === 'cancelled') ? colors.border : '#00C4A3',
                              backgroundColor: (order.status === 'delivered' || order.status === 'completed' || order.status === 'cancelled') ? 'transparent' : 'rgba(0, 224, 184, 0.1)'
                            },
                            '&.Mui-disabled': {
                              borderColor: colors.border,
                              color: colors.textSecondary
                            }
                          }}
                        >
                          {order.driver ? 'Change Driver' : 'Assign Driver'}
                        </Button>
                        {order.driver && (
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Delete />}
                            onClick={() => handleRemoveDriver(order)}
                            disabled={order.status === 'delivered' || order.status === 'completed' || order.status === 'cancelled'}
                            sx={{
                            borderColor: (order.status === 'delivered' || order.status === 'completed' || order.status === 'cancelled') ? colors.border : '#FF3366',
                            color: (order.status === 'delivered' || order.status === 'completed' || order.status === 'cancelled') ? colors.textSecondary : '#FF3366',
                            '&:hover': {
                              borderColor: (order.status === 'delivered' || order.status === 'completed' || order.status === 'cancelled') ? colors.border : '#FF1744',
                              backgroundColor: (order.status === 'delivered' || order.status === 'completed' || order.status === 'cancelled') ? 'transparent' : 'rgba(255, 51, 102, 0.1)'
                            },
                            '&.Mui-disabled': {
                              borderColor: colors.border,
                              color: colors.textSecondary
                            }
                            }}
                          >
                            Remove Driver
                          </Button>
                        )}
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
                            sx={{ mt: 1, borderColor: colors.accentText, color: colors.accentText }}
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
          <TablePagination
            component="div"
            count={filteredOrders.length}
            page={page}
            onPageChange={(event, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(parseInt(event.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[10, 25, 50, 100]}
            sx={{
              backgroundColor: colors.paper,
              borderTop: `1px solid ${colors.border}`,
              '& .MuiTablePagination-toolbar': {
                color: colors.textPrimary
              },
              '& .MuiTablePagination-selectLabel': {
                color: colors.textPrimary
              },
              '& .MuiTablePagination-displayedRows': {
                color: colors.textPrimary
              },
              '& .MuiTablePagination-select': {
                color: colors.textPrimary,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: colors.border
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: colors.accentText
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: colors.accentText
                }
              },
              '& .MuiIconButton-root': {
                color: colors.textPrimary,
                '&:hover': {
                  backgroundColor: 'rgba(0, 224, 184, 0.1)',
                  color: colors.accentText
                },
                '&.Mui-disabled': {
                  color: colors.textSecondary
                }
              }
            }}
          />
        </TableContainer>
      )}

      {/* Branch Assignment Dialog */}
      <Dialog 
        open={branchDialogOpen} 
        onClose={handleCloseBranchDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>
          {selectedOrder?.branch ? 'Change Branch' : 'Assign Branch'}
        </DialogTitle>
        <DialogContent>
          {selectedOrder?.status === 'cancelled' && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              This order has been cancelled. Branch assignment cannot be changed.
            </Alert>
          )}
          {selectedOrder?.status === 'completed' && (
            <Alert severity="info" sx={{ mb: 2 }}>
              This order has been completed. Branch assignment cannot be changed.
            </Alert>
          )}
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Select Branch</InputLabel>
              <Select
                value={selectedBranchId}
                label="Select Branch"
                disabled={selectedOrder?.status === 'cancelled' || selectedOrder?.status === 'completed'}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  // Reset reassign driver option when branch changes
                  setReassignDriver(false);
                }}
              >
                <MenuItem value="">
                  <em>No Branch (Unassign)</em>
                </MenuItem>
                {branches.map((branch) => (
                  <MenuItem key={branch.id} value={branch.id}>
                    {branch.name} - {branch.address}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {selectedOrder && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Order #{selectedOrder.id} - {selectedOrder.customerName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Delivery: {selectedOrder.deliveryAddress}
                </Typography>
                {selectedOrder.driver && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Current Driver: {selectedOrder.driver.name}
                  </Typography>
                )}
              </Box>
            )}
            {/* Show driver reassignment option only if branch is changing and new branch is selected */}
            {selectedOrder && 
             selectedBranchId !== '' && 
             parseInt(selectedBranchId) !== selectedOrder.branchId && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                  Driver Assignment
                </Typography>
                <FormControl fullWidth>
                  <Select
                    value={reassignDriver ? 'reassign' : 'keep'}
                    onChange={(e) => setReassignDriver(e.target.value === 'reassign')}
                  >
                    <MenuItem value="keep">
                      Keep Current Driver ({selectedOrder.driver?.name || 'No Driver'})
                    </MenuItem>
                    <MenuItem value="reassign">
                      Auto-assign Nearest Active Driver to New Branch
                    </MenuItem>
                  </Select>
                </FormControl>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {reassignDriver 
                    ? 'A new active driver nearest to the selected branch will be assigned.'
                    : 'The current driver will remain assigned to this order.'}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCloseBranchDialog}
            sx={{ color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssignBranch}
            variant="contained"
            disabled={selectedOrder?.status === 'cancelled' || selectedOrder?.status === 'completed'}
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              '&:hover': {
                backgroundColor: '#00C4A3'
              },
              '&.Mui-disabled': {
                backgroundColor: colors.textSecondary,
                color: colors.paper
              }
            }}
          >
            {selectedOrder?.branch ? 'Update Branch' : 'Assign Branch'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Driver Assignment Dialog */}
      <Dialog 
        open={driverDialogOpen} 
        onClose={handleCloseDriverDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>
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
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              '&:hover': {
                backgroundColor: '#00C4A3'
              }
            }}
          >
            Assign Driver
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={cancelDialogOpen}
        onClose={handleCloseCancelDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Cancel Order</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Please provide a reason for cancelling Order #{cancelTargetOrder?.id}. This will be saved for audit purposes.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            label="Cancellation Reason"
            value={cancelReason}
            onChange={(e) => {
              setCancelReason(e.target.value);
              if (cancelReasonError) {
                setCancelReasonError('');
              }
            }}
            inputProps={{ maxLength: 100 }}
            helperText={`${cancelReason.length}/100`}
            error={Boolean(cancelReasonError)}
          />
          {cancelReasonError && (
            <Typography variant="caption" color="error">
              {cancelReasonError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCancelDialog}>Back</Button>
          <Button
            onClick={handleConfirmCancel}
            variant="contained"
            sx={{ backgroundColor: '#FF3366', color: isDarkMode ? '#0D0D0D' : '#FFFFFF', '&:hover': { backgroundColor: '#FF1744' } }}
          >
            Confirm Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Orders;
