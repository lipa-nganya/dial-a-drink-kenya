import React, { useState } from 'react';
import {
  Box,
  Fab,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  useMediaQuery,
  useTheme as useMUITheme
} from '@mui/material';
import {
  Add,
  LocalShipping,
  PendingActions,
  CheckCircle,
  Close,
  FlashOn,
  AssignmentInd,
  Done,
  Phone,
  StopCircle
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';
import NewOrderDialog from './NewOrderDialog';

const QuickActionsMenu = () => {
  const { isDarkMode, colors } = useTheme();
  const muiTheme = useMUITheme();
  // Show on screens smaller than 960px (md breakpoint)
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();

  // Debug: Log mobile detection (remove in production)
  React.useEffect(() => {
    console.log('QuickActionsMenu - isMobile:', isMobile, 'window width:', window.innerWidth);
  }, [isMobile]);
  const [newOrderDialogOpen, setNewOrderDialogOpen] = useState(false);
  const [forceCompleteDialogOpen, setForceCompleteDialogOpen] = useState(false);
  const [ordersWithoutDriver, setOrdersWithoutDriver] = useState([]);
  const [orderCounts, setOrderCounts] = useState({ pending: 0, out_for_delivery: 0 });
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrderForComplete, setSelectedOrderForComplete] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState('');
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const menuOpen = Boolean(menuAnchorEl);
  const [orderTab, setOrderTab] = useState('pending'); // 'pending', 'completed', 'unassigned'
  const [recentOrders, setRecentOrders] = useState([]);
  const [loadingRecentOrders, setLoadingRecentOrders] = useState(false);
  const [postStopDialogOpen, setPostStopDialogOpen] = useState(false);

  const handleMenuOpen = (event) => {
    // On mobile, navigate to quick actions page instead of showing dropdown
    if (isMobile) {
      navigate('/quick-actions');
    } else {
      setMenuAnchorEl(event.currentTarget);
    }
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleAction = (actionFn) => {
    handleMenuClose();
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
        navigate('/orders?filter=no-driver');
      }
    },
    {
      icon: <PendingActions />,
      name: 'Pending Orders',
      action: () => {
        navigate('/orders?tab=pending');
      }
    },
    {
      icon: <Done />,
      name: 'Completed Orders',
      action: () => {
        navigate('/orders?tab=completed');
      }
    },
    {
      icon: <AssignmentInd />,
      name: 'Unassigned Orders',
      action: () => {
        navigate('/orders?tab=unassigned');
      }
    },
    {
      icon: <CheckCircle />,
      name: 'Force Complete',
      action: async () => {
        setLoadingOrders(true);
        try {
          // Fetch orders that can be force completed (pending, out_for_delivery, delivered)
          const response = await api.get('/admin/orders');
          const orders = response.data || [];
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
    },
    {
      icon: <StopCircle />,
      name: 'Post Stop',
      action: () => {
        setPostStopDialogOpen(true);
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
    setPostStopDialogOpen(false);
    // Refresh recent orders
    fetchRecentOrders();
    // Navigate to orders page to see the new order
    navigate('/orders');
  };

  const fetchRecentOrders = async () => {
    try {
      setLoadingRecentOrders(true);
      const response = await api.get('/admin/orders');
      const orders = response.data || [];
      // Get most recent 5 orders (already sorted by backend)
      setRecentOrders(orders.slice(0, 5));
    } catch (error) {
      console.error('Error fetching recent orders:', error);
    } finally {
      setLoadingRecentOrders(false);
    }
  };

  // Fetch recent orders when menu opens
  React.useEffect(() => {
    if (menuOpen) {
      fetchRecentOrders();
    }
  }, [menuOpen]);

  // Debug: Log when component renders
  React.useEffect(() => {
    console.log('QuickActionsMenu rendered - isMobile:', isMobile, 'colors:', { accentText: colors.accentText, paper: colors.paper });
  }, [isMobile, colors]);

  // Always render on mobile - don't check isMobile here, use CSS display instead
  console.log('QuickActionsMenu rendering - isMobile:', isMobile, 'window.innerWidth:', typeof window !== 'undefined' ? window.innerWidth : 'N/A');

  return (
    <>
      <Box
        sx={{
          position: 'fixed',
          top: 16,
          right: { xs: 8, sm: 16 }, // Smaller offset on mobile
          zIndex: 1400, // Higher than dialogs (1300)
          display: { xs: 'flex', md: 'none' }, // Show on mobile, hide on desktop
          alignItems: 'center',
          justifyContent: 'center',
          maxWidth: 'calc(100vw - 16px)', // Ensure button doesn't overflow
          boxSizing: 'border-box',
        }}
      >
        <Fab
          color="primary"
          aria-label="Quick Actions Menu"
          onClick={handleMenuOpen}
          sx={{
            backgroundColor: colors.accentText,
            color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
            width: 56,
            height: 56,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            flexShrink: 0, // Prevent button from shrinking
            '&:hover': {
              backgroundColor: '#00C4A3',
            }
          }}
        >
          <FlashOn />
        </Fab>
        <Menu
          anchorEl={menuAnchorEl}
          open={menuOpen}
          onClose={handleMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          disableScrollLock={false}
          disablePortal={false}
          PaperProps={{
            sx: {
              backgroundColor: colors.paper,
              color: colors.textPrimary,
              border: `1px solid ${colors.border}`,
              width: { xs: 'calc(100vw - 32px) !important', sm: 250 },
              maxWidth: { xs: 'calc(100vw - 32px) !important', sm: 300 },
              maxHeight: { xs: 'calc(100vh - 100px)', sm: 'none' },
              mt: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              left: { xs: '16px !important', sm: 'auto' },
              right: { xs: '16px !important', sm: 'auto' },
              boxSizing: 'border-box',
            }
          }}
          slotProps={{
            paper: {
              sx: {
                maxWidth: 'calc(100vw - 32px) !important',
                maxHeight: 'calc(100vh - 100px) !important',
                width: { xs: 'calc(100vw - 32px) !important', sm: 'auto' },
                left: { xs: '16px !important', sm: 'auto' },
                right: { xs: '16px !important', sm: 'auto' },
                boxSizing: 'border-box',
              }
            }
          }}
          MenuListProps={{
            sx: {
              padding: 0,
              maxWidth: '100%',
              overflowX: 'hidden',
              boxSizing: 'border-box',
            }
          }}
        >
          {actions.map((action) => (
            <MenuItem
              key={action.name}
              onClick={() => handleAction(action.action)}
              sx={{
                whiteSpace: 'normal',
                wordWrap: 'break-word',
                '&:hover': {
                  backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                }
              }}
            >
              <ListItemIcon sx={{ color: colors.accentText, minWidth: 36, flexShrink: 0 }}>
                {action.icon}
              </ListItemIcon>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontSize: { xs: '0.875rem', sm: '0.875rem' },
                  overflowWrap: 'break-word',
                  wordBreak: 'break-word',
                  maxWidth: '100%',
                  flex: 1,
                }}
              >
                {action.name}
              </Typography>
            </MenuItem>
          ))}
          
          {/* Recent Orders Section */}
          <Divider sx={{ my: 1 }} />
          <Box sx={{ px: 2, py: 1 }}>
            <Typography 
              variant="subtitle2" 
              sx={{ 
                fontWeight: 600,
                color: colors.textPrimary,
                mb: 1,
                fontSize: '0.875rem'
              }}
            >
              Recent Orders
            </Typography>
            {loadingRecentOrders ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={20} />
              </Box>
            ) : recentOrders.length === 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                No recent orders
              </Typography>
            ) : (
              <List sx={{ p: 0, maxHeight: '300px', overflowY: 'auto' }}>
                {recentOrders.map((order) => (
                  <ListItem
                    key={order.id}
                    disablePadding
                    sx={{
                      mb: 1,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 1,
                      px: 1,
                      py: 0.5,
                      '&:hover': {
                        backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.05)' : 'rgba(0, 0, 0, 0.02)'
                      }
                    }}
                  >
                    <ListItemText
                      primary={
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                          Order #{order.id} - {order.customerName || 'Unknown'}
                        </Typography>
                      }
                      secondary={
                        <Box sx={{ mt: 0.5 }}>
                          {order.customerPhone && order.customerPhone !== 'POS' && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                              <Phone sx={{ fontSize: '0.75rem', color: colors.accentText }} />
                              <Typography
                                component="a"
                                href={`tel:${order.customerPhone}`}
                                variant="caption"
                                sx={{
                                  color: colors.accentText,
                                  textDecoration: 'none',
                                  fontSize: '0.75rem',
                                  '&:hover': {
                                    textDecoration: 'underline'
                                  }
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                              >
                                {order.customerPhone}
                              </Typography>
                            </Box>
                          )}
                          <Chip
                            label={order.status}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.65rem',
                              backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                              color: colors.accentText,
                              mt: 0.5
                            }}
                          />
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </Menu>
      </Box>

      {/* New Order Dialog */}
      <NewOrderDialog
        open={newOrderDialogOpen}
        onClose={() => setNewOrderDialogOpen(false)}
        onOrderCreated={handleNewOrderCreated}
        mobileSize={true}
      />

      {/* Post Stop Dialog */}
      <NewOrderDialog
        open={postStopDialogOpen}
        onClose={() => setPostStopDialogOpen(false)}
        onOrderCreated={handleNewOrderCreated}
        mobileSize={true}
        initialIsStop={true}
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
        <DialogTitle sx={{ borderBottom: `1px solid ${colors.border}` }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Force Complete Orders</Typography>
            <IconButton
              onClick={() => {
                setForceCompleteDialogOpen(false);
                setSelectedOrderForComplete(null);
                setCompleteError('');
              }}
              size="small"
              sx={{ color: colors.textPrimary }}
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
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : ordersWithoutDriver.length === 0 ? (
            <Alert severity="info">No orders available to force complete.</Alert>
          ) : (
            <>
              {completeError && (
                <Alert severity="error" sx={{ mb: 2 }}>{completeError}</Alert>
              )}
              
              {/* Order Counts */}
              <Box sx={{ 
                mb: 2,
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
                    color: colors.textPrimary
                  }}
                >
                  Order Status Counts:
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, fontSize: '0.9rem' }}>
                    Pending: {orderCounts.pending}
                  </Typography>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, fontSize: '0.9rem' }}>
                    Out for Delivery: {orderCounts.out_for_delivery}
                  </Typography>
                </Box>
              </Box>
              
              <Typography variant="body2" sx={{ mb: 2, color: colors.textSecondary }}>
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
                          <CheckCircle sx={{ color: colors.accentText }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={`Order #${order.id}`}
                          secondary={
                            <Box sx={{ mt: 0.5 }}>
                              <Typography variant="caption" sx={{ display: 'block', color: colors.textSecondary }}>
                                {order.customerName || 'Unknown Customer'}
                              </Typography>
                              <Typography variant="caption" sx={{ display: 'block', color: colors.textSecondary, mt: 0.25 }}>
                                Driver: {order.driver?.name || 'No driver assigned'}
                              </Typography>
                              <Chip
                                label={order.status}
                                size="small"
                                sx={{
                                  mt: 0.5,
                                  height: 20,
                                  fontSize: '0.7rem',
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
        <DialogActions sx={{ borderTop: `1px solid ${colors.border}`, p: 2 }}>
          <Button
            onClick={() => {
              setForceCompleteDialogOpen(false);
              setSelectedOrderForComplete(null);
              setCompleteError('');
            }}
            sx={{ color: colors.textSecondary }}
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
              '&:hover': {
                backgroundColor: colors.accent,
              },
              '&:disabled': {
                backgroundColor: colors.border,
                color: colors.textSecondary
              }
            }}
          >
            {completing ? <CircularProgress size={20} /> : 'Force Complete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default QuickActionsMenu;

