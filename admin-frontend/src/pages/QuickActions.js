import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Divider,
  AppBar,
  Toolbar,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import {
  Add,
  LocalShipping,
  PendingActions,
  CheckCircle,
  Close,
  ArrowBack
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';
import NewOrderDialog from '../components/NewOrderDialog';

const QuickActions = () => {
  const { isDarkMode, colors } = useTheme();
  const navigate = useNavigate();

  const [newOrderDialogOpen, setNewOrderDialogOpen] = useState(false);
  const [forceCompleteDialogOpen, setForceCompleteDialogOpen] = useState(false);
  const [ordersWithoutDriver, setOrdersWithoutDriver] = useState([]);
  const [orderCounts, setOrderCounts] = useState({ pending: 0, out_for_delivery: 0 });
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrderForComplete, setSelectedOrderForComplete] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState('');
  const [todayCompletedOrders, setTodayCompletedOrders] = useState([]);
  const [loadingTodayOrders, setLoadingTodayOrders] = useState(false);

  const handleAction = (actionFn) => {
    actionFn();
  };

  const actions = [
    {
      icon: <Add />,
      name: 'Place New Order',
      action: () => {
        setNewOrderDialogOpen(true);
      }
    },
    {
      icon: <LocalShipping />,
      name: 'Orders Without Driver',
      action: () => {
        // Navigate to mobile-specific page on mobile, regular page on desktop
        const isMobile = window.innerWidth < 960;
        if (isMobile) {
          navigate('/orders/without-driver');
        } else {
          navigate('/orders?filter=no-driver');
        }
      }
    },
    {
      icon: <PendingActions />,
      name: 'Pending Orders',
      action: () => {
        // Navigate to mobile-specific page on mobile, regular page on desktop
        const isMobile = window.innerWidth < 960;
        if (isMobile) {
          navigate('/orders/pending');
        } else {
          navigate('/orders?filter=pending');
        }
      }
    },
    {
      icon: <CheckCircle />,
      name: 'Force Complete',
      action: async () => {
        setLoadingOrders(true);
        try {
          const response = await api.get('/admin/orders');
          const orders = response.data || [];
          // Filter orders that can be force completed (pending, out_for_delivery, delivered)
          const completableOrders = orders.filter(order => 
            (order.status === 'pending' || 
             order.status === 'out_for_delivery' || 
             order.status === 'delivered') && 
            order.status !== 'completed' && 
            order.status !== 'cancelled'
          );
          setOrdersWithoutDriver(completableOrders);
          
          // Calculate counts for pending and out_for_delivery
          const counts = {
            pending: orders.filter(o => o.status === 'pending' && o.status !== 'cancelled' && o.status !== 'completed').length,
            out_for_delivery: orders.filter(o => o.status === 'out_for_delivery' && o.status !== 'cancelled' && o.status !== 'completed').length
          };
          setOrderCounts(counts);
          
          setForceCompleteDialogOpen(true);
        } catch (error) {
          console.error('Error fetching orders:', error);
        } finally {
          setLoadingOrders(false);
        }
      }
    }
  ];

  const handleForceComplete = async (orderId) => {
    setCompleting(true);
    setCompleteError('');
    try {
      await api.patch(`/admin/orders/${orderId}/status`, { status: 'completed' });
      
      // Remove the completed order from the list immediately
      setOrdersWithoutDriver(prevOrders => prevOrders.filter(order => order.id !== orderId));
      
      // Reset selection
      setSelectedOrderForComplete(null);
      setCompleteError('');
      
      // Keep dialog open to allow completing more orders
      // Don't close the dialog or navigate away
    } catch (error) {
      console.error('Error force completing order:', error);
      setCompleteError(error.response?.data?.error || 'Failed to complete order');
    } finally {
      setCompleting(false);
    }
  };

  const handleNewOrderCreated = (order) => {
    setNewOrderDialogOpen(false);
    navigate('/orders');
  };

  const fetchTodayCompletedOrders = async () => {
    try {
      setLoadingTodayOrders(true);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Fetch all orders and filter on frontend
      const response = await api.get('/admin/orders');
      
      const orders = response.data || [];
      
      // Filter to only completed/delivered orders that were completed today
      const completedOrders = orders.filter(order => {
        const isCompleted = order.status === 'completed' || order.status === 'delivered';
        if (!isCompleted) return false;
        
        // Check if order was completed today (use updatedAt as completion time)
        const completedAt = new Date(order.updatedAt || order.createdAt);
        completedAt.setHours(0, 0, 0, 0);
        const isToday = completedAt.getTime() === today.getTime();
        
        return isToday;
      });
      
      // Sort by completion time (most recent first)
      completedOrders.sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.createdAt).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt).getTime();
        return timeB - timeA;
      });
      
      setTodayCompletedOrders(completedOrders);
    } catch (error) {
      console.error('Error fetching today completed orders:', error);
      setTodayCompletedOrders([]);
    } finally {
      setLoadingTodayOrders(false);
    }
  };

  useEffect(() => {
    fetchTodayCompletedOrders();
  }, []);

  // Get today's date and day
  const today = new Date();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const dateString = today.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const formatCurrency = (value) => `KES ${Number(value || 0).toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
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
          minHeight: { xs: '48px !important', sm: '64px' },
          justifyContent: 'center'
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: { xs: 1.5, sm: 2 },
            marginLeft: '-50px'
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
              Quick Actions
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ 
        p: { xs: 3, sm: 2 },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3
      }}>
        {/* Quick Panel */}
        <Card sx={{ 
          backgroundColor: colors.paper, 
          border: `1px solid ${colors.border}`, 
          width: { xs: '90%', sm: '100%' },
          borderRadius: 2
        }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box>
                <Typography variant="h6" sx={{ color: colors.accentText, fontWeight: 700, mb: 0.5, fontSize: { xs: '1.08rem', sm: '1.25rem' } }}>
                  {dayName}
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary, fontSize: { xs: '0.85rem', sm: '0.95rem' } }}>
                  {dateString}
                </Typography>
              </Box>
              <Typography variant="body1" sx={{ color: colors.textPrimary, fontWeight: 600, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                {todayCompletedOrders.length} {todayCompletedOrders.length === 1 ? 'Order' : 'Orders'} Completed
              </Typography>
            </Box>

            {loadingTodayOrders ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : todayCompletedOrders.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Typography variant="body2" sx={{ color: colors.textSecondary, fontSize: { xs: '0.85rem', sm: '0.9rem' } }}>
                  No orders completed today
                </Typography>
              </Box>
            ) : (
              <TableContainer component={Paper} sx={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#FFFFFF', maxHeight: { xs: 300, sm: 400 }, overflow: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: colors.accentText, fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' }, py: 1 }}>Order #</TableCell>
                      <TableCell sx={{ color: colors.accentText, fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' }, py: 1 }}>Customer</TableCell>
                      <TableCell sx={{ color: colors.accentText, fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' }, py: 1 }} align="right">Amount</TableCell>
                      <TableCell sx={{ color: colors.accentText, fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' }, py: 1 }} align="right">Time</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {todayCompletedOrders.map((order) => {
                      const isPOS = order.isPOS || order.deliveryAddress === 'In-Store Purchase';

                      return (
                        <TableRow 
                          key={order.id}
                          sx={{
                            backgroundColor: isPOS ? 'rgba(156, 39, 176, 0.08)' : 'transparent',
                            '&:hover': {
                              backgroundColor: isPOS ? 'rgba(156, 39, 176, 0.12)' : 'rgba(0, 224, 184, 0.05)',
                              cursor: 'pointer'
                            }
                          }}
                          onClick={() => navigate(`/orders?orderId=${order.id}`)}
                        >
                          <TableCell sx={{ color: colors.textPrimary, fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.875rem' }, py: 1 }}>
                            #{order.orderNumber || order.id}
                            {isPOS && (
                              <Chip
                                label="POS"
                                size="small"
                                sx={{
                                  ml: 0.5,
                                  backgroundColor: '#9C27B0',
                                  color: '#FFFFFF',
                                  fontWeight: 700,
                                  fontSize: { xs: '0.6rem', sm: '0.7rem' },
                                  height: { xs: 16, sm: 18 }
                                }}
                              />
                            )}
                          </TableCell>
                          <TableCell sx={{ color: colors.textPrimary, fontSize: { xs: '0.75rem', sm: '0.875rem' }, py: 1 }}>
                            {order.customerName || 'Unknown'}
                          </TableCell>
                          <TableCell sx={{ color: colors.textPrimary, fontSize: { xs: '0.75rem', sm: '0.875rem' }, py: 1 }} align="right">
                            {formatCurrency(order.totalAmount)}
                          </TableCell>
                          <TableCell sx={{ color: colors.textSecondary, fontSize: { xs: '0.75rem', sm: '0.875rem' }, py: 1 }} align="right">
                            {formatTime(order.updatedAt || order.createdAt)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        <List sx={{ 
          backgroundColor: colors.paper, 
          borderRadius: 2, 
          overflow: 'hidden',
          width: { xs: '90%', sm: '100%' } // 10% narrower on mobile
        }}>
          {actions.map((action, index) => (
            <React.Fragment key={action.name}>
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleAction(action.action)}
                  sx={{
                    py: { xs: 1.8, sm: 2 }, // 10% smaller on mobile (2 * 0.9 = 1.8)
                    '&:hover': {
                      backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                    }
                  }}
                >
                  <ListItemIcon sx={{ 
                    color: colors.accentText, 
                    minWidth: { xs: 36, sm: 40 }, // 10% smaller on mobile (40 * 0.9 = 36)
                    '& svg': {
                      fontSize: { xs: '1.8rem', sm: '2rem' } // 10% smaller on mobile (2rem * 0.9 = 1.8rem)
                    }
                  }}>
                    {action.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          fontWeight: 500,
                          fontSize: { xs: '0.9rem', sm: '1rem' } // 10% smaller on mobile (1rem * 0.9 = 0.9rem)
                        }}
                      >
                        {action.name}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
              {index < actions.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      </Box>

      {/* New Order Dialog */}
      <NewOrderDialog
        open={newOrderDialogOpen}
        onClose={() => setNewOrderDialogOpen(false)}
        onOrderCreated={handleNewOrderCreated}
        mobileSize={true}
      />

      {/* Force Complete Dialog */}
      <Dialog
        open={forceCompleteDialogOpen}
        onClose={() => {
          setForceCompleteDialogOpen(false);
          setSelectedOrderForComplete(null);
          setCompleteError('');
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: colors.paper,
            color: colors.textPrimary,
            width: { xs: 'calc(100vw - 32px)', sm: 'auto' },
            maxWidth: { xs: 'calc(100vw - 32px)', sm: '600px' },
            maxHeight: { xs: 'calc(100vh - 32px)', sm: '90vh' },
            margin: { xs: '16px', sm: 'auto' },
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: `1px solid ${colors.border}`,
          padding: { xs: '1.35rem', sm: '1.5rem' } // More padding on mobile
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography 
              variant="h6"
              sx={{ fontSize: { xs: '1.08rem', sm: '1.2rem' } }} // 10% smaller on mobile
            >
              Force Complete Orders
            </Typography>
            <IconButton
              onClick={() => {
                setForceCompleteDialogOpen(false);
                setSelectedOrderForComplete(null);
                setCompleteError('');
              }}
              size="small"
              sx={{ 
                color: colors.textPrimary,
                '& svg': {
                  fontSize: { xs: '1.35rem', sm: '1.5rem' } // 10% smaller on mobile
                }
              }}
            >
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ 
          mt: 2,
          overflowY: 'auto',
          maxHeight: { xs: 'calc(100vh - 200px)', sm: 'calc(90vh - 120px)' },
          padding: { xs: 2, sm: 3 }
        }}>
          {loadingOrders ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: { xs: 3.6, sm: 4 } }}>
              <CircularProgress 
                sx={{ 
                  width: { xs: '27px !important', sm: '30px !important' },
                  height: { xs: '27px !important', sm: '30px !important' }
                }} 
              />
            </Box>
          ) : ordersWithoutDriver.length === 0 ? (
            <Alert 
              severity="info"
              sx={{ 
                fontSize: { xs: '0.9rem', sm: '1rem' },
                padding: { xs: '0.9rem', sm: '1rem' }
              }}
            >
              No orders available to force complete.
            </Alert>
          ) : (
            <>
              {completeError && (
                <Alert 
                  severity="error" 
                  sx={{ 
                    mb: { xs: 1.8, sm: 2 },
                    fontSize: { xs: '0.9rem', sm: '1rem' },
                    padding: { xs: '0.9rem', sm: '1rem' }
                  }}
                >
                  {completeError}
                </Alert>
              )}
              
              {/* Order Counts */}
              <Box sx={{ 
                mb: { xs: 1.8, sm: 2 },
                p: 1.5,
                backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                borderRadius: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 1
              }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    fontWeight: 600,
                    color: colors.textPrimary,
                    fontSize: { xs: '0.9rem', sm: '1rem' }
                  }}
                >
                  Order Status Counts:
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: colors.textSecondary,
                      fontSize: { xs: '0.85rem', sm: '0.9rem' }
                    }}
                  >
                    Pending: {orderCounts.pending}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: colors.textSecondary,
                      fontSize: { xs: '0.85rem', sm: '0.9rem' }
                    }}
                  >
                    Out for Delivery: {orderCounts.out_for_delivery}
                  </Typography>
                </Box>
              </Box>
              
              <Typography 
                variant="body2" 
                sx={{ 
                  mb: { xs: 1.8, sm: 2 }, // 10% smaller on mobile
                  color: colors.textSecondary,
                  fontSize: { xs: '0.9rem', sm: '1rem' } // 10% smaller on mobile
                }}
              >
                Select an order to force complete ({ordersWithoutDriver.length} available):
              </Typography>
              <List sx={{ 
                maxHeight: { xs: 'calc(100vh - 400px)', sm: 'calc(90vh - 350px)' },
                overflowY: 'auto',
                padding: 0
              }}>
                {ordersWithoutDriver.map((order, index) => (
                  <React.Fragment key={order.id}>
                    <ListItem
                      disablePadding
                      sx={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 1,
                        mb: 1,
                        '&:hover': {
                          backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.05)' : 'rgba(0, 0, 0, 0.02)'
                        }
                      }}
                    >
                      <ListItemButton
                        onClick={() => setSelectedOrderForComplete(order)}
                        selected={selectedOrderForComplete?.id === order.id}
                      >
                        <ListItemIcon>
                          <CheckCircle sx={{ 
                            color: colors.accentText,
                            fontSize: { xs: '1.8rem', sm: '2rem' } // 10% smaller on mobile
                          }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                              {`Order #${order.id}`}
                            </Typography>
                          }
                          secondary={
                            <Box sx={{ mt: { xs: 0.45, sm: 0.5 } }}>
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  display: 'block', 
                                  color: colors.textSecondary,
                                  fontSize: { xs: '0.72rem', sm: '0.8rem' } // 10% smaller on mobile
                                }}
                              >
                                {order.customerName || 'Unknown Customer'}
                              </Typography>
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  display: 'block', 
                                  color: colors.textSecondary,
                                  fontSize: { xs: '0.72rem', sm: '0.8rem' },
                                  mt: 0.25
                                }}
                              >
                                Driver: {order.driver?.name || 'No driver assigned'}
                              </Typography>
                              <Chip
                                label={order.status}
                                size="small"
                                sx={{
                                  mt: { xs: 0.45, sm: 0.5 },
                                  height: { xs: 18, sm: 20 }, // 10% smaller on mobile
                                  fontSize: { xs: '0.63rem', sm: '0.7rem' }, // 10% smaller on mobile
                                  backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                                  color: colors.accentText
                                }}
                              />
                            </Box>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                    {index < ordersWithoutDriver.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          borderTop: `1px solid ${colors.border}`, 
          p: { xs: 2.7, sm: 2 }, // More padding on mobile
          gap: { xs: 1.8, sm: 2 } // 10% smaller gap on mobile
        }}>
          <Button
            onClick={() => {
              setForceCompleteDialogOpen(false);
              setSelectedOrderForComplete(null);
              setCompleteError('');
            }}
            sx={{ 
              color: colors.textSecondary,
              fontSize: { xs: '0.9rem', sm: '1rem' }, // 10% smaller on mobile
              padding: { xs: '0.45rem 1.8rem', sm: '0.5rem 2rem' } // 10% smaller on mobile
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => selectedOrderForComplete && handleForceComplete(selectedOrderForComplete.id)}
            disabled={!selectedOrderForComplete || completing}
            variant="contained"
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              fontSize: { xs: '0.9rem', sm: '1rem' }, // 10% smaller on mobile
              padding: { xs: '0.45rem 1.8rem', sm: '0.5rem 2rem' }, // 10% smaller on mobile
              '&:hover': {
                backgroundColor: colors.accent,
              },
              '&:disabled': {
                backgroundColor: colors.border,
                color: colors.textSecondary
              }
            }}
          >
            {completing ? <CircularProgress size={18} /> : 'Force Complete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QuickActions;

