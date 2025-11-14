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
import {
  getOrderStatusChipProps,
  getPaymentMethodChipProps,
  getTransactionTypeChipProps,
  getTransactionStatusChipProps
} from '../utils/chipStyles';

const AdminOverview = () => {
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
    // Initialize socket connection - use production URL
    const isHosted =
      window.location.hostname.includes('onrender.com') ||
      window.location.hostname.includes('run.app');
    const socketUrl = isHosted
      ? 'https://dialadrink-backend-910510650031.us-central1.run.app'
      : 'http://localhost:5001';
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
      setLatestOrders(response.data);
    } catch (error) {
      console.error('Error fetching latest orders:', error);
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
      setLatestTransactions(response.data);
    } catch (error) {
      console.error('Error fetching latest transactions:', error);
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
          <Typography variant="h6" sx={{ color: '#00E0B8', fontWeight: 700, mb: 2 }}>
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
                      backgroundColor: '#121212',
                      height: '100%',
                      flexGrow: 1,
                      border: card.border || 'none'
                    }}
                  >
                    <CardContent sx={{ textAlign: 'center', py: 3 }}>
                      {card.icon}
                      <Typography variant="h5" sx={{ color: '#00E0B8', fontWeight: 700 }}>
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
            <Card sx={{ backgroundColor: '#121212', border: '1px solid #333' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ color: '#00E0B8', fontWeight: 600, mb: 2 }}>
                  Latest Orders
                </Typography>
                <TableContainer component={Paper} sx={{ backgroundColor: '#1a1a1a' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: '#00E0B8' }}>Transaction Number</TableCell>
                        <TableCell sx={{ color: '#00E0B8' }}>Order #</TableCell>
                        <TableCell sx={{ color: '#00E0B8' }}>Customer</TableCell>
                        <TableCell sx={{ color: '#00E0B8' }} align="right">Amount</TableCell>
                        <TableCell sx={{ color: '#00E0B8' }} align="right">Status</TableCell>
                        <TableCell sx={{ color: '#00E0B8' }} align="right">Created</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {latestOrders.map((order) => {
                        const statusChip = getOrderStatusChipProps(order.status);

                        return (
                          <TableRow key={order.id}>
                            <TableCell sx={{ color: '#F5F5F5' }}>
                              {order.transactionNumber ? `#${order.transactionNumber}` : 'N/A'}
                            </TableCell>
                            <TableCell sx={{ color: '#F5F5F5' }}>#{order.orderNumber}</TableCell>
                            <TableCell sx={{ color: '#F5F5F5' }}>{order.customerName}</TableCell>
                            <TableCell sx={{ color: '#F5F5F5' }} align="right">
                              KES {Number(order.totalAmount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell sx={{ color: '#F5F5F5' }} align="right">
                              <Chip
                                size="small"
                                {...statusChip}
                              />
                            </TableCell>
                            <TableCell sx={{ color: '#F5F5F5' }} align="right">
                              {new Date(order.createdAt).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' })}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {latestOrders.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} sx={{ color: '#999', textAlign: 'center' }}>
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
            <Card sx={{ backgroundColor: '#121212', border: '1px solid #333' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ color: '#00E0B8', fontWeight: 600, mb: 2 }}>
                  Top Inventory Items
                </Typography>
                <TableContainer component={Paper} sx={{ backgroundColor: '#1a1a1a' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: '#00E0B8' }}>Item</TableCell>
                        <TableCell sx={{ color: '#00E0B8' }}>Category</TableCell>
                        <TableCell sx={{ color: '#00E0B8' }} align="right">Total Sold</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {topInventoryItems.map((item) => (
                        <TableRow key={item.drinkId}>
                          <TableCell sx={{ color: '#F5F5F5' }}>{item.name}</TableCell>
                          <TableCell sx={{ color: '#F5F5F5' }}>{item.category}</TableCell>
                          <TableCell sx={{ color: '#F5F5F5' }} align="right">{item.totalQuantity}</TableCell>
                        </TableRow>
                      ))}
                      {topInventoryItems.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} sx={{ color: '#999', textAlign: 'center' }}>
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
            <Card sx={{ backgroundColor: '#121212', border: '1px solid #333' }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ color: '#00E0B8', fontWeight: 600, mb: 2 }}>
                  Latest Transactions
                </Typography>
                <TableContainer component={Paper} sx={{ backgroundColor: '#1a1a1a' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: '#00E0B8' }}>Transaction Number</TableCell>
                        <TableCell sx={{ color: '#00E0B8' }}>Order #</TableCell>
                        <TableCell sx={{ color: '#00E0B8' }}>Type</TableCell>
                        <TableCell sx={{ color: '#00E0B8' }}>Payment Method</TableCell>
                        <TableCell sx={{ color: '#00E0B8' }} align="right">Amount</TableCell>
                        <TableCell sx={{ color: '#00E0B8' }}>Status</TableCell>
                        <TableCell sx={{ color: '#00E0B8' }}>Customer</TableCell>
                        <TableCell sx={{ color: '#00E0B8' }} align="right">Created</TableCell>
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
                            const isDriverPayment = Boolean(txn?.driverWalletId || txn?.driverId);
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

                        return (
                          <TableRow
                            key={txn.id}
                            sx={{
                              backgroundColor: isTip ? 'rgba(255, 193, 7, 0.12)' : 'transparent',
                              '&:hover': {
                                backgroundColor: isTip ? 'rgba(255, 193, 7, 0.18)' : 'rgba(0, 224, 184, 0.05)'
                              }
                            }}
                          >
                            <TableCell sx={{ color: '#F5F5F5' }}>#{txn.id}</TableCell>
                            <TableCell sx={{ color: '#F5F5F5' }}>#{txn.orderId}</TableCell>
                            <TableCell sx={{ color: '#F5F5F5' }}>
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
                            <TableCell sx={{ color: '#F5F5F5' }}>
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
                            <TableCell sx={{ color: '#F5F5F5' }} align="right">
                              KES {Number(txn.amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell sx={{ color: '#F5F5F5' }}>
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
                            <TableCell sx={{ color: '#F5F5F5' }}>{txn.customerName}</TableCell>
                            <TableCell sx={{ color: '#F5F5F5' }} align="right">
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
                          <TableCell colSpan={8} sx={{ color: '#999', textAlign: 'center' }}>
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
