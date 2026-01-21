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
  LocalShipping
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';
import { getOrderStatusChipProps } from '../utils/chipStyles';

const PendingOrders = () => {
  const { isDarkMode, colors } = useTheme();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [updating, setUpdating] = useState(false);

  const orderStatuses = [
    'pending',
    'confirmed',
    'out_for_delivery',
    'delivered',
    'completed',
    'cancelled'
  ];

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/orders');
      const allOrders = response.data || [];
      // Filter orders with pending or confirmed status, excluding cancelled and completed orders
      const pendingOrders = allOrders.filter(order => 
        (order.status === 'pending' || order.status === 'confirmed') && 
        order.status !== 'cancelled' && 
        order.status !== 'completed'
      );
      setOrders(pendingOrders);
      setError(null);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClick = (order) => {
    setSelectedOrder(order);
    setSelectedStatus(order.status || 'pending');
    setUpdateDialogOpen(true);
  };

  const handleUpdateOrder = async () => {
    if (!selectedOrder) return;

    try {
      setUpdating(true);
      setError(null);

      // Use the correct endpoint: PATCH /admin/orders/:id/status
      await api.patch(`/admin/orders/${selectedOrder.id}/status`, {
        status: selectedStatus
      });

      // Remove order from list if status is no longer pending or confirmed
      // This provides immediate feedback without waiting for refetch
      if (selectedStatus !== 'pending' && selectedStatus !== 'confirmed') {
        setOrders(prevOrders => prevOrders.filter(order => order.id !== selectedOrder.id));
      } else {
        // If status is still pending/confirmed, update it in the list
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order.id === selectedOrder.id 
              ? { ...order, status: selectedStatus }
              : order
          )
        );
      }

      setUpdateDialogOpen(false);
      setSelectedOrder(null);
      setSelectedStatus('');
      setError(null);
    } catch (err) {
      console.error('Error updating order:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to update order. Please try again.';
      setError(errorMessage);
    } finally {
      setUpdating(false);
    }
  };

  const getStatusChipProps = (status) => {
    return getOrderStatusChipProps(status, isDarkMode);
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
        <Toolbar sx={{ pl: '30px' }}>
          <IconButton
            edge="start"
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
              mr: { xs: 1.5, sm: 2 },
              '& svg': {
                fontSize: { xs: '2rem', sm: '2.25rem' } // Larger and more visible
              }
            }}
          >
            <ArrowBack />
          </IconButton>
          <Typography
            variant="h6"
            sx={{
              flexGrow: 1,
              color: colors.textPrimary,
              fontWeight: 600,
              fontSize: { xs: '1.08rem', sm: '1.2rem' }
            }}
          >
            Pending Orders
          </Typography>
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
          <Alert severity="info" sx={{ width: { xs: '90%', sm: '100%' } }}>No pending orders.</Alert>
        ) : (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 2,
            width: { xs: '90%', sm: '100%' }
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

                {/* Order Status - Full Row */}
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
                    Order Status
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      label={order.status || 'pending'}
                      size="small"
                      {...getStatusChipProps(order.status)}
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
                  Update Order Status
                </Button>
              </Paper>
            ))}
          </Box>
        )}
      </Box>

      {/* Update Order Status Dialog */}
      <Dialog
        open={updateDialogOpen}
        onClose={() => {
          setUpdateDialogOpen(false);
          setSelectedOrder(null);
          setSelectedStatus('');
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
          Update Order #{selectedOrder?.id} Status
        </DialogTitle>
        <DialogContent sx={{ 
          padding: { xs: 1.8, sm: 3 }
        }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
              {error}
            </Alert>
          )}
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Order Status</InputLabel>
            <Select
              value={selectedStatus}
              label="Order Status"
              onChange={(e) => setSelectedStatus(e.target.value)}
              sx={{
                '& .MuiSelect-select': {
                  fontSize: { xs: '0.9rem', sm: '1rem' }
                }
              }}
            >
              {orderStatuses.map((status) => (
                <MenuItem 
                  key={status} 
                  value={status}
                  sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
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
              setSelectedStatus('');
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
            disabled={updating || !selectedStatus}
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

export default PendingOrders;

