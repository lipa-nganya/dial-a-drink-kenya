import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Chip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Visibility,
  ShoppingCart,
  Person,
  Phone,
  Email,
  LocationOn,
  AttachMoney,
  AccessTime
} from '@mui/icons-material';
import { api } from '../../services/api';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await api.get('/admin/orders');
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await api.patch(`/admin/orders/${orderId}/status`, { status: newStatus });
      setOrders(orders.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      ));
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'confirmed': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <AccessTime />;
      case 'confirmed': return <CheckCircle />;
      case 'cancelled': return <Cancel />;
      default: return <ShoppingCart />;
    }
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
        <Typography variant="h4" component="h1" gutterBottom sx={{ color: '#00E0B8', fontWeight: 700 }}>
          📋 Orders Management
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Manage customer orders and track their status
        </Typography>
      </Box>

      {orders.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <ShoppingCart sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No orders found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Orders will appear here when customers place them
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {orders.map((order) => (
            <Grid item xs={12} md={6} lg={4} key={order.id}>
              <Card 
                sx={{ 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 20px rgba(0, 224, 184, 0.15)'
                  }
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  {/* Order Header */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ color: '#00E0B8', fontWeight: 600 }}>
                      Order #{order.id}
                    </Typography>
                    <Chip
                      icon={getStatusIcon(order.status)}
                      label={order.status.toUpperCase()}
                      color={getStatusColor(order.status)}
                      size="small"
                    />
                  </Box>

                  {/* Customer Info */}
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Person sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">
                        {order.customerName}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Phone sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">
                        {order.customerPhone}
                      </Typography>
                    </Box>
                    {order.customerEmail && (
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Email sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {order.customerEmail}
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                      <LocationOn sx={{ mr: 1, fontSize: 16, color: 'text.secondary', mt: 0.5 }} />
                      <Typography variant="body2" color="text.secondary">
                        {order.deliveryAddress}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Order Items */}
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, color: '#00E0B8' }}>
                      Items ({order.items?.length || 0})
                    </Typography>
                    {order.items?.map((item, index) => (
                      <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">
                          {item.drink?.name} x{item.quantity}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          KES {Number(item.price).toFixed(2)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  {/* Total Amount */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, p: 1, backgroundColor: '#121212', borderRadius: 1 }}>
                    <Typography variant="subtitle1" sx={{ color: '#00E0B8', fontWeight: 600 }}>
                      Total:
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#FF3366', fontWeight: 700 }}>
                      KES {Number(order.totalAmount).toFixed(2)}
                    </Typography>
                  </Box>

                  {/* Order Notes */}
                  {order.notes && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        Note: {order.notes}
                      </Typography>
                    </Box>
                  )}

                  {/* Action Buttons */}
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {order.status === 'pending' && (
                      <>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<CheckCircle />}
                          onClick={() => handleStatusUpdate(order.id, 'confirmed')}
                          sx={{
                            backgroundColor: '#00E0B8',
                            color: '#0D0D0D',
                            '&:hover': { backgroundColor: '#00C4A3' }
                          }}
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Cancel />}
                          onClick={() => handleStatusUpdate(order.id, 'cancelled')}
                          sx={{
                            borderColor: '#FF3366',
                            color: '#FF3366',
                            '&:hover': { 
                              borderColor: '#FF3366',
                              backgroundColor: 'rgba(255, 51, 102, 0.1)'
                            }
                          }}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                    {order.status === 'confirmed' && (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Cancel />}
                        onClick={() => handleStatusUpdate(order.id, 'cancelled')}
                        sx={{
                          borderColor: '#FF3366',
                          color: '#FF3366',
                          '&:hover': { 
                            borderColor: '#FF3366',
                            backgroundColor: 'rgba(255, 51, 102, 0.1)'
                          }
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </Box>

                  {/* Order Date */}
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    {new Date(order.createdAt).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default Orders;
