import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip
} from '@mui/material';
import {
  Dashboard,
  AttachMoney,
  ShoppingCart,
  LocalBar,
  TrendingUp,
  AccountBalanceWallet,
  EmojiEvents,
  Inventory2,
  CheckCircleOutlined,
  Block,
  LocalOffer,
  Cancel
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import io from 'socket.io-client';
import { useAdmin } from '../contexts/AdminContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  getOrderStatusChipProps,
  getPaymentMethodChipProps,
  getTransactionTypeChipProps,
  getTransactionStatusChipProps
} from '../utils/chipStyles';

const AdminOverview = () => {
  const { isDarkMode, colors } = useTheme();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [socket, setSocket] = useState(null);
  const [latestOrders, setLatestOrders] = useState([]);
  const [topInventoryItems, setTopInventoryItems] = useState([]);
  const [latestTransactions, setLatestTransactions] = useState([]);
  const navigate = useNavigate();
  const { fetchPendingOrdersCount, setIsAuthenticated } = useAdmin();

  useEffect(() => {
    // Check authentication on mount
    const token = localStorage.getItem('adminToken');
    if (token) {
      setIsAuthenticated(true);
    } else {
      navigate('/login');
    }
  }, [navigate, setIsAuthenticated]);

  useEffect(() => {
    // Initialize socket connection - use same logic as API calls
    const hostname = window.location.hostname;
    const isLocalHost = ['localhost', '127.0.0.1'].includes(hostname) || hostname.endsWith('.local');
    const isLanHost = /^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])/.test(hostname || '');
    
    // CRITICAL: Always use localhost when running locally
    let socketUrl;
    if (isLocalHost || isLanHost) {
      socketUrl = 'http://localhost:5001';
    } else {
      // For cloud-dev deployments, use REACT_APP_API_URL if set
      const isManagedHost = hostname.includes('onrender.com') || hostname.includes('run.app');
      if (isManagedHost) {
        const apiUrl = process.env.REACT_APP_API_URL;
        if (apiUrl) {
          socketUrl = apiUrl.replace('/api', '');
        } else {
          socketUrl = 'https://dialadrink-backend-910510650031.us-central1.run.app';
        }
      } else {
        const apiUrl = process.env.REACT_APP_API_URL;
        socketUrl = apiUrl ? apiUrl.replace('/api', '') : 'https://dialadrink-backend-910510650031.us-central1.run.app';
      }
    }
    
    const newSocket = io(socketUrl);
    newSocket.emit('join-admin');
    
    newSocket.on('new-order', (data) => {
      setNotification({
        message: data.message,
        order: data.order
      });
      // Play notification sound (handled by AdminContext)
      playNotificationSound();
      // Refresh stats
      fetchStats();
      // Refresh pending orders count in context
      fetchPendingOrdersCount();
    });

    setSocket(newSocket);

    // Fetch initial data
    fetchStats();
    fetchLatestOrders();
    fetchTopInventoryItems();
    fetchLatestTransactions();

    return () => {
      newSocket.close();
    };
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setError(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLatestOrders = async () => {
    try {
      const response = await api.get('/admin/latest-orders');
      console.log('📦 Latest orders response:', response.data);
      setLatestOrders(response.data || []);
    } catch (error) {
      console.error('Error fetching latest orders:', error);
      setLatestOrders([]);
    }
  };

  const fetchTopInventoryItems = async () => {
    try {
      const response = await api.get('/admin/top-inventory-items');
      setTopInventoryItems(response.data);
    } catch (error) {
      console.error('Error fetching top inventory items:', error);
    }
  };

  const fetchLatestTransactions = async () => {
    try {
      const response = await api.get('/admin/latest-transactions');
      console.log('💰 Latest transactions response:', response.data);
      setLatestTransactions(response.data || []);
    } catch (error) {
      console.error('Error fetching latest transactions:', error);
      setLatestTransactions([]);
    }
  };

  const playNotificationSound = () => {
    try {
      // Create a simple beep sound with better browser compatibility
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Resume audio context if suspended (required for autoplay policies)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Create a more noticeable notification sound
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.6);
      
      console.log('🔔 Notification sound played');
    } catch (error) {
      console.warn('Could not play notification sound:', error);
      // Fallback: show browser notification if sound fails
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New Order Received!', {
          body: 'A new order has been placed',
          icon: '/favicon.ico'
        });
      }
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading dashboard...</Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">Error loading dashboard: {error}</Alert>
      </Container>
    );
  }

  const formatNumber = (value) => Number(value || 0).toLocaleString('en-KE');
  const formatCurrency = (value) => `KES ${Number(value || 0).toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

  const dashboardSections = [
    {
      title: 'Finance',
      cards: [
        {
          key: 'totalRevenue',
          icon: <AccountBalanceWallet sx={{ fontSize: 36, color: '#00E0B8', mb: 1 }} />,
          label: 'Total Revenue (Excludes Tips)',
          value: stats.totalRevenue,
          formatter: formatCurrency
        },
        {
          key: 'todayRevenue',
          icon: <AttachMoney sx={{ fontSize: 36, color: '#FF3366', mb: 1 }} />,
          label: "Today's Revenue (Excludes Tips)",
          value: stats.todayRevenue,
          formatter: formatCurrency
        },
        {
          key: 'totalTips',
          icon: <EmojiEvents sx={{ fontSize: 36, color: '#FFC107', mb: 1 }} />,
          label: 'Total Tips (To Drivers)',
          value: stats.totalTips,
          formatter: formatCurrency,
          border: '1px solid rgba(255, 193, 7, 0.3)'
        },
        {
          key: 'todayTips',
          icon: <EmojiEvents sx={{ fontSize: 36, color: '#FFC107', mb: 1 }} />,
          label: "Today's Tips (To Drivers)",
          value: stats.todayTips,
          formatter: formatCurrency,
          border: '1px solid rgba(255, 193, 7, 0.3)'
        },
        {
          key: 'totalTipTransactions',
          icon: <EmojiEvents sx={{ fontSize: 36, color: '#FFC107', mb: 1 }} />,
          label: 'Total Tip Transactions',
          value: stats.totalTipTransactions,
          formatter: formatNumber,
          border: '1px solid rgba(255, 193, 7, 0.3)'
        },
        {
          key: 'todayTipTransactions',
          icon: <EmojiEvents sx={{ fontSize: 36, color: '#FFC107', mb: 1 }} />,
          label: "Today's Tip Transactions",
          value: stats.todayTipTransactions,
          formatter: formatNumber,
          border: '1px solid rgba(255, 193, 7, 0.3)'
        }
      ]
    },
    {
      title: 'Orders',
      cards: [
        {
          key: 'totalOrders',
          icon: <ShoppingCart sx={{ fontSize: 36, color: '#00E0B8', mb: 1 }} />,
          label: 'Total Orders',
          value: stats.totalOrders,
          formatter: formatNumber
        },
        {
          key: 'pendingOrders',
          icon: <TrendingUp sx={{ fontSize: 36, color: '#FF3366', mb: 1 }} />,
          label: 'Pending Orders',
          value: stats.pendingOrders,
          formatter: formatNumber
        },
        {
          key: 'todayOrders',
          icon: <ShoppingCart sx={{ fontSize: 36, color: '#00E0B8', mb: 1 }} />,
          label: "Today's Orders",
          value: stats.todayOrders,
          formatter: formatNumber
        },
        {
          key: 'cancelledOrders',
          icon: <Cancel sx={{ fontSize: 36, color: '#FF3366', mb: 1 }} />,
          label: 'Cancelled Orders',
          value: stats.cancelledOrders,
          formatter: formatNumber
        }
      ]
    },
    {
      title: 'Inventory',
      cards: [
        {
          key: 'totalItems',
          icon: <Inventory2 sx={{ fontSize: 36, color: '#00E0B8', mb: 1 }} />,
          label: 'Total Items',
          value: stats.totalItems ?? stats.totalDrinks,
          formatter: formatNumber
        },
        {
          key: 'availableItems',
          icon: <CheckCircleOutlined sx={{ fontSize: 36, color: '#00E0B8', mb: 1 }} />,
          label: 'Available Items',
          value: stats.availableItems,
          formatter: formatNumber
        },
        {
          key: 'outOfStockItems',
          icon: <Block sx={{ fontSize: 36, color: '#FF3366', mb: 1 }} />,
          label: 'Out of Stock Items',
          value: stats.outOfStockItems,
          formatter: formatNumber
        },
        {
          key: 'limitedOfferItems',
          icon: <LocalOffer sx={{ fontSize: 36, color: '#FFC107', mb: 1 }} />,
          label: 'Items on Limited Offer',
          value: stats.limitedOfferItems,
          formatter: formatNumber,
          border: '1px solid rgba(255, 193, 7, 0.3)'
        }
      ]
    }
  ];
 
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {dashboardSections.map((section) => (
        <Box key={section.title} sx={{ mb: 6 }}>
          <Typography variant="h6" sx={{ color: colors.accentText, fontWeight: 700, mb: 2 }}>
            {section.title}
          </Typography>
          <Grid
            container
            spacing={2}
            justifyContent="center"
            alignItems="stretch"
            sx={{ mb: 3 }}
          >
            {section.cards.map((card) => {
              const displayValue = card.formatter ? card.formatter(card.value) : formatNumber(card.value);
              return (
                <Grid key={card.key} item xs={12} sm={6} md={4} lg={2} sx={{ display: 'flex' }}>
                  <Card
                    sx={{
                      backgroundColor: colors.paper,
                      height: '100%',
                      flexGrow: 1,
                      border: card.border || `1px solid ${colors.border}`
                    }}
                  >
                    <CardContent sx={{ textAlign: 'center', py: 3 }}>
                      {card.icon}
                      <Typography variant="h5" sx={{ color: colors.accentText, fontWeight: 700 }}>
                        {displayValue}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {card.label}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          {section.title === 'Orders' && (
            <Card sx={{ backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ color: colors.accentText, fontWeight: 600, mb: 2 }}>
                  Latest Orders
                </Typography>
                <TableContainer component={Paper} sx={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#FFFFFF' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: colors.accentText }}>Transaction Number</TableCell>
                        <TableCell sx={{ color: colors.accentText }}>Order #</TableCell>
                        <TableCell sx={{ color: colors.accentText }}>Customer</TableCell>
                        <TableCell sx={{ color: colors.accentText }} align="right">Amount</TableCell>
                        <TableCell sx={{ color: colors.accentText }} align="right">Status</TableCell>
                        <TableCell sx={{ color: colors.accentText }} align="right">Created</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {latestOrders.map((order) => {
                        const statusChip = getOrderStatusChipProps(order.status);
                        const isPOS = order.isPOS || order.deliveryAddress === 'In-Store Purchase';

                        return (
                          <TableRow 
                            key={order.id}
                            sx={{
                              backgroundColor: isPOS ? 'rgba(156, 39, 176, 0.08)' : 'transparent',
                              '&:hover': {
                                backgroundColor: isPOS ? 'rgba(156, 39, 176, 0.12)' : 'rgba(0, 224, 184, 0.05)'
                              }
                            }}
                          >
                            <TableCell sx={{ color: colors.textPrimary }}>
                              #{order.orderNumber}
                            </TableCell>
                            <TableCell sx={{ color: colors.textPrimary }}>
                              Order #{order.orderNumber}
                              {isPOS && (
                                <Chip
                                  label="POS"
                                  size="small"
                                  sx={{
                                    ml: 1,
                                    backgroundColor: '#9C27B0',
                                    color: '#FFFFFF',
                                    fontWeight: 700,
                                    fontSize: '0.65rem',
                                    height: '20px'
                                  }}
                                />
                              )}
                            </TableCell>
                            <TableCell sx={{ color: colors.textPrimary }}>{order.customerName}</TableCell>
                            <TableCell sx={{ color: colors.textPrimary }} align="right">
                              KES {Number(order.totalAmount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell sx={{ color: colors.textPrimary }} align="right">
                              <Chip
                                size="small"
                                {...statusChip}
                              />
                            </TableCell>
                            <TableCell sx={{ color: colors.textPrimary }} align="right">
                              {new Date(order.createdAt).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' })}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {latestOrders.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} sx={{ color: colors.textSecondary, textAlign: 'center' }}>
                            No recent orders found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}

          {section.title === 'Inventory' && (
            <Card sx={{ backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ color: colors.accentText, fontWeight: 600, mb: 2 }}>
                  Top Inventory Items
                </Typography>
                <TableContainer component={Paper} sx={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#FFFFFF' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: colors.accentText }}>Item</TableCell>
                        <TableCell sx={{ color: colors.accentText }}>Category</TableCell>
                        <TableCell sx={{ color: colors.accentText }} align="right">Total Sold</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {topInventoryItems.map((item) => (
                        <TableRow key={item.drinkId}>
                          <TableCell sx={{ color: colors.textPrimary }}>{item.name}</TableCell>
                          <TableCell sx={{ color: colors.textPrimary }}>{item.category}</TableCell>
                          <TableCell sx={{ color: colors.textPrimary }} align="right">{item.totalQuantity}</TableCell>
                        </TableRow>
                      ))}
                      {topInventoryItems.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} sx={{ color: colors.textSecondary, textAlign: 'center' }}>
                            No inventory data available.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}

          {section.title === 'Finance' && (
            <Card sx={{ backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ color: colors.accentText, fontWeight: 600, mb: 2 }}>
                  Latest Transactions
                </Typography>
                <TableContainer component={Paper} sx={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#FFFFFF' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: colors.accentText }}>Transaction Number</TableCell>
                        <TableCell sx={{ color: colors.accentText }}>Order #</TableCell>
                        <TableCell sx={{ color: colors.accentText }}>Type</TableCell>
                        <TableCell sx={{ color: colors.accentText }}>Payment Method</TableCell>
                        <TableCell sx={{ color: colors.accentText }} align="right">Amount</TableCell>
                        <TableCell sx={{ color: colors.accentText }}>Status</TableCell>
                        <TableCell sx={{ color: colors.accentText }}>Customer</TableCell>
                        <TableCell sx={{ color: colors.accentText }} align="right">Created</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {latestTransactions.map((txn) => {
                        // Ensure transactionType is always present (normalize on frontend as well)
                        const safeTransactionType = (txn.transactionType && 
                          typeof txn.transactionType === 'string' && 
                          txn.transactionType.trim() !== '') 
                          ? txn.transactionType.trim() 
                          : 'payment';
                        
                        const typeChipRaw = getTransactionTypeChipProps(safeTransactionType);
                        // Handle function returns (e.g., delivery_pay which needs transaction context)
                        const typeChip = typeof typeChipRaw === 'function'
                          ? typeChipRaw(txn)
                          : typeChipRaw;
                        
                        // Ensure typeChip always has a label
                        let chipLabel = typeChip?.label;
                        let chipSx = typeChip?.sx;
                        
                        if (!chipLabel || chipLabel.trim() === '') {
                          if (safeTransactionType === 'delivery_pay' || safeTransactionType === 'delivery') {
                            // Check if it's a driver payment (has driverWalletId or driverId that is not null/undefined)
                            // CRITICAL: driverWalletId is the primary indicator for driver payments
                            // Merchant transactions have driverWalletId: null, driver transactions have driverWalletId: <number>
                            // Also check driverId as fallback for backwards compatibility
                            const isDriverPayment = (txn?.driverWalletId != null && txn?.driverWalletId !== undefined) ||
                                                   (txn?.driverId != null && txn?.driverId !== undefined);
                            chipLabel = isDriverPayment ? 'Delivery Fee Payment (Driver)' : 'Delivery Fee Payment (Merchant)';
                            chipSx = {
                              backgroundColor: isDriverPayment ? '#FFC107' : '#2196F3',
                              color: isDriverPayment ? '#000' : '#002A54',
                              fontWeight: 700
                            };
                          } else if (safeTransactionType && safeTransactionType.trim() !== '') {
                            chipLabel = safeTransactionType
                              .split('_')
                              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                              .join(' ');
                            chipSx = {
                              backgroundColor: '#616161',
                              color: '#FFFFFF',
                              fontWeight: 600
                            };
                          } else {
                            chipLabel = 'Payment';
                            chipSx = {
                              backgroundColor: '#616161',
                              color: '#FFFFFF',
                              fontWeight: 600
                            };
                          }
                        }
                        
                        const methodChip = getPaymentMethodChipProps(txn.paymentMethod);
                        const statusChip = getTransactionStatusChipProps(
                          txn.transactionStatus || txn.status || txn.paymentStatus
                        );
                        const isTip = safeTransactionType.toLowerCase() === 'tip';
                        const isPOS = txn.isPOS || txn.deliveryAddress === 'In-Store Purchase';

                        return (
                          <TableRow
                            key={txn.id}
                            sx={{
                              backgroundColor: isPOS 
                                ? 'rgba(156, 39, 176, 0.08)' 
                                : isTip 
                                  ? 'rgba(255, 193, 7, 0.12)' 
                                  : 'transparent',
                              '&:hover': {
                                backgroundColor: isPOS 
                                  ? 'rgba(156, 39, 176, 0.12)' 
                                  : isTip 
                                    ? 'rgba(255, 193, 7, 0.18)' 
                                    : 'rgba(0, 224, 184, 0.05)'
                              }
                            }}
                          >
                            <TableCell sx={{ color: colors.textPrimary }}>#{txn.id}</TableCell>
                            <TableCell sx={{ color: colors.textPrimary }}>
                              #{txn.orderId}
                              {isPOS && (
                                <Chip
                                  label="POS"
                                  size="small"
                                  sx={{
                                    ml: 1,
                                    backgroundColor: '#9C27B0',
                                    color: '#FFFFFF',
                                    fontWeight: 700,
                                    fontSize: '0.65rem',
                                    height: '20px'
                                  }}
                                />
                              )}
                            </TableCell>
                            <TableCell sx={{ color: colors.textPrimary }}>
                              <Chip
                                size="small"
                                label={chipLabel || 'Payment'}
                                sx={{ fontWeight: 700, ...(chipSx || {
                                  backgroundColor: '#616161',
                                  color: '#FFFFFF',
                                  fontWeight: 600
                                }) }}
                              />
                            </TableCell>
                            <TableCell sx={{ color: colors.textPrimary }}>
                              {methodChip ? (
                                <Chip
                                  size="small"
                                  label={methodChip.label}
                                  sx={{ fontWeight: 700, ...methodChip.sx }}
                                />
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell sx={{ color: colors.textPrimary }} align="right">
                              KES {Number(txn.amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell sx={{ color: colors.textPrimary }}>
                              {statusChip ? (
                                <Chip
                                  size="small"
                                  {...statusChip}
                                  sx={{ fontWeight: 600 }}
                                />
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell sx={{ color: colors.textPrimary }}>{txn.customerName}</TableCell>
                            <TableCell sx={{ color: colors.textPrimary }} align="right">
                              {new Date(txn.createdAt).toLocaleString('en-KE', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                              })}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {latestTransactions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} sx={{ color: colors.textSecondary, textAlign: 'center' }}>
                            No recent transactions found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </Box>
      ))}

      {/* Notification Alert */}
      {notification && (
        <Alert 
          severity="success" 
          sx={{ mt: 3 }}
          onClose={() => setNotification(null)}
        >
          {notification.message}
        </Alert>
      )}
    </Container>
  );
};

export default AdminOverview;
