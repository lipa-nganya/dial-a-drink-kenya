import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Alert,
  AppBar,
  Toolbar,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  LocalShipping,
  LocationOn,
  Phone as PhoneIcon,
  ShoppingCart,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';

const OrdersWithoutDriver = () => {
  const { isDarkMode, colors } = useTheme();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [drivers, setDrivers] = useState([]);
  const [updating, setUpdating] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  useEffect(() => {
    fetchOrders();
    fetchDrivers();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/orders');
      const allOrders = response.data || [];
      // Filter orders without driver or with HOLD Driver, excluding cancelled and completed orders
      const ordersWithoutDriver = allOrders.filter(order => 
        order.status !== 'cancelled' && 
        order.status !== 'completed' && 
        (!order.driverId || order.driver?.name === 'HOLD Driver')
      );
      setOrders(ordersWithoutDriver);
      setError(null);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDrivers = async () => {
    try {
      const response = await api.get('/drivers');
      setDrivers(response.data || []);
    } catch (err) {
      console.error('Error fetching drivers:', err);
    }
  };

  const handleUpdateClick = (order) => {
    setSelectedOrder(order);
    setSelectedDriverId(order.driverId || '');
    setUpdateDialogOpen(true);
  };

  const handleUpdateOrder = async () => {
    if (!selectedOrder) return;

    try {
      setUpdating(true);
      setError(null);
      
      // Check if order is delivered or completed - backend doesn't allow driver changes
      if (selectedOrder.status === 'delivered' || selectedOrder.status === 'completed') {
        setError('Cannot modify driver assignment for delivered or completed orders.');
        setUpdating(false);
        return;
      }

      // Parse driverId - handle empty string case
      let parsedDriverId = null;
      if (selectedDriverId && selectedDriverId !== '') {
        parsedDriverId = parseInt(selectedDriverId);
        if (isNaN(parsedDriverId)) {
          setError('Invalid driver ID. Please select a valid driver.');
          setUpdating(false);
          return;
        }
      }

      // Use the correct endpoint: PATCH /admin/orders/:id/driver
      await api.patch(`/admin/orders/${selectedOrder.id}/driver`, {
        driverId: parsedDriverId
      });

      // Refresh orders
      await fetchOrders();
      setUpdateDialogOpen(false);
      setSelectedOrder(null);
      setSelectedDriverId('');
      setError(null);
    } catch (err) {
      console.error('Error updating order:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update order. Please try again.';
      setError(errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const getPaymentStatusColor = (paymentStatus) => {
    if (paymentStatus === 'paid') return 'success';
    if (paymentStatus === 'unpaid') return 'error';
    return 'default';
  };

  const toggleItemsExpand = (orderId) => {
    setExpandedOrderId((prev) => (prev === orderId ? null : orderId));
  };

  const getOrderItems = (order) => {
    const items = order.orderItems || order.items || [];
    return Array.isArray(items) ? items : [];
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      backgroundColor: colors.background,
      pb: 4
    }}>
      <AppBar 
        position="sticky" 
        sx={{ 
          backgroundColor: colors.paper, 
          borderBottom: `1px solid ${colors.border}`,
          boxShadow: `0 2px 8px ${isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
        }}
      >
        <Toolbar sx={{ 
          justifyContent: 'center'
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2
          }}>
            <IconButton
              onClick={() => navigate(-1)}
              sx={{ 
                color: colors.textPrimary,
                backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                '&:hover': {
                  backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.2)' : 'rgba(0, 0, 0, 0.1)',
                },
                width: { xs: 48, sm: 56 },
                height: { xs: 48, sm: 56 },
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                '& svg': {
                  fontSize: { xs: '2rem', sm: '2.25rem' }
                }
              }}
            >
              <ArrowBack />
            </IconButton>
            <Typography
              variant="h6"
              sx={{
                color: colors.textPrimary,
                fontWeight: 600,
                fontSize: { xs: '1.08rem', sm: '1.2rem' }
              }}
            >
              Orders Without Driver
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ 
        p: 2,
        display: 'flex',
        justifyContent: 'center'
      }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2, width: { xs: '90%', sm: '100%' } }}>{error}</Alert>
        ) : orders.length === 0 ? (
          <Alert severity="info" sx={{ width: { xs: '90%', sm: '100%' } }}>No orders without driver assigned.</Alert>
        ) : (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 2,
            width: { xs: '90%', sm: '100%' } // 10% narrower on mobile
          }}>
            {orders.map((order) => (
              <Paper
                key={order.id}
                sx={{
                  p: 2,
                  backgroundColor: colors.paper,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 2
                }}
              >
                {/* Customer Name - Full Row */}
                <Box sx={{ mb: 1.5 }}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: colors.textSecondary,
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    Customer Name
                  </Typography>
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      fontWeight: 600,
                      color: colors.textPrimary,
                      fontSize: '1rem',
                      mt: 0.5
                    }}
                  >
                    {order.customerName || 'Unknown Customer'}
                  </Typography>
                </Box>

                {/* Order Number - Full Row */}
                <Box sx={{ mb: 1.5 }}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: colors.textSecondary,
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    Order Number
                  </Typography>
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      fontWeight: 600,
                      color: colors.textPrimary,
                      fontSize: '1rem',
                      mt: 0.5
                    }}
                  >
                    #{order.id}
                  </Typography>
                </Box>

                {/* Delivery location - Full Row */}
                <Box sx={{ mb: 1.5 }}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: colors.textSecondary,
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    Delivery location
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: colors.textPrimary,
                      fontSize: '0.95rem',
                      mt: 0.5,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 0.5
                    }}
                  >
                    <LocationOn sx={{ fontSize: '1rem', mt: 0.25, flexShrink: 0 }} />
                    {order.deliveryAddress || '—'}
                  </Typography>
                </Box>

                {/* Customer phone - Full Row */}
                <Box sx={{ mb: 1.5 }}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: colors.textSecondary,
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    Customer phone
                  </Typography>
                  <Typography 
                    variant="body2" 
                    component="a"
                    href={order.customerPhone ? `tel:${order.customerPhone}` : undefined}
                    sx={{ 
                      color: colors.accentText,
                      fontSize: '0.95rem',
                      mt: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      textDecoration: 'none',
                      '&:hover': { textDecoration: 'underline' }
                    }}
                  >
                    <PhoneIcon sx={{ fontSize: '1rem' }} />
                    {order.customerPhone || '—'}
                  </Typography>
                </Box>

                {/* Payment status - Full Row */}
                <Box sx={{ mb: 1.5 }}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: colors.textSecondary,
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    Payment status
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      label={order.paymentStatus || '—'}
                      size="small"
                      color={getPaymentStatusColor(order.paymentStatus)}
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </Box>
                </Box>

                {/* Driver Assigned - Full Row */}
                <Box sx={{ mb: 2 }}>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: colors.textSecondary,
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    Driver Assigned
                  </Typography>
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      color: colors.textPrimary,
                      fontSize: '1rem',
                      mt: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}
                  >
                    <LocalShipping sx={{ fontSize: '1.2rem' }} />
                    {order.driver?.name || 'No driver assigned'}
                  </Typography>
                </Box>

                {/* View items - expand or button */}
                <Box sx={{ mb: 2 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    fullWidth
                    startIcon={<ShoppingCart />}
                    endIcon={expandedOrderId === order.id ? <ExpandLess /> : <ExpandMore />}
                    onClick={() => toggleItemsExpand(order.id)}
                    sx={{
                      borderColor: colors.border,
                      color: colors.textPrimary,
                      fontSize: '0.85rem',
                      textTransform: 'none',
                      '&:hover': {
                        borderColor: colors.accentText,
                        backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.08)' : 'rgba(0, 224, 184, 0.06)'
                      }
                    }}
                  >
                    View items ({getOrderItems(order).length})
                  </Button>
                  {expandedOrderId === order.id && (
                    <Box sx={{ mt: 1.5, pl: 1, borderLeft: `2px solid ${colors.border}` }}>
                      {getOrderItems(order).length === 0 ? (
                        <Typography variant="body2" color="text.secondary">No items.</Typography>
                      ) : (
                        getOrderItems(order).map((item, idx) => (
                          <Box key={item.id || idx} sx={{ py: 0.5, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                            <Typography variant="body2" sx={{ color: colors.textPrimary }}>
                              {item.drink?.name || 'Item'} × {item.quantity || 0}
                            </Typography>
                            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                              KES {Number(item.price || 0).toFixed(2)}
                            </Typography>
                          </Box>
                        ))
                      )}
                    </Box>
                  )}
                </Box>

                {/* Update Button - Full Row */}
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<Edit />}
                  onClick={() => handleUpdateClick(order)}
                  sx={{
                    backgroundColor: colors.accentText,
                    color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                    fontSize: '0.9rem',
                    padding: '8px 16px',
                    '&:hover': {
                      backgroundColor: '#00C4A3'
                    }
                  }}
                >
                  Update Order
                </Button>
              </Paper>
            ))}
          </Box>
        )}
      </Box>

      {/* Update Order Dialog */}
      <Dialog
        open={updateDialogOpen}
        onClose={() => {
          setUpdateDialogOpen(false);
          setSelectedOrder(null);
          setSelectedDriverId('');
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: colors.paper,
            color: colors.textPrimary,
            width: { xs: 'calc(90vw - 28.8px)', sm: 'auto' },
            maxWidth: { xs: 'calc(90vw - 28.8px)', sm: '500px' },
            margin: { xs: '14.4px', sm: 'auto' }
          }
        }}
      >
        <DialogTitle sx={{ 
          fontSize: { xs: '1.08rem', sm: '1.2rem' },
          padding: { xs: '1.35rem', sm: '1.5rem' }
        }}>
          Update Order #{selectedOrder?.id}
        </DialogTitle>
        <DialogContent sx={{ 
          padding: { xs: 1.8, sm: 3 }
        }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
              {error}
            </Alert>
          )}
          {selectedOrder && (selectedOrder.status === 'delivered' || selectedOrder.status === 'completed') && (
            <Alert severity="warning" sx={{ mb: 2, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
              This order is {selectedOrder.status}. Driver assignment cannot be modified.
            </Alert>
          )}
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Assign Driver</InputLabel>
            <Select
              value={selectedDriverId}
              label="Assign Driver"
              onChange={(e) => setSelectedDriverId(e.target.value)}
              disabled={selectedOrder && (selectedOrder.status === 'delivered' || selectedOrder.status === 'completed')}
              sx={{
                '& .MuiSelect-select': {
                  fontSize: { xs: '0.9rem', sm: '1rem' }
                }
              }}
            >
              <MenuItem value="">None</MenuItem>
              {drivers.map((driver) => (
                <MenuItem 
                  key={driver.id} 
                  value={driver.id}
                  sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}
                >
                  {driver.name} - {driver.phoneNumber}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ 
          padding: { xs: 1.8, sm: 2 },
          gap: { xs: 1.8, sm: 2 }
        }}>
          <Button
            onClick={() => {
              setUpdateDialogOpen(false);
              setSelectedOrder(null);
              setSelectedDriverId('');
              setError(null);
            }}
            sx={{ 
              color: colors.textSecondary,
              fontSize: { xs: '0.9rem', sm: '1rem' }
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpdateOrder}
            disabled={updating || (selectedOrder && (selectedOrder.status === 'delivered' || selectedOrder.status === 'completed'))}
            variant="contained"
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              fontSize: { xs: '0.9rem', sm: '1rem' },
              '&:hover': {
                backgroundColor: '#00C4A3'
              },
              '&:disabled': {
                backgroundColor: colors.border,
                color: colors.textSecondary
              }
            }}
          >
            {updating ? <CircularProgress size={18} /> : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrdersWithoutDriver;

