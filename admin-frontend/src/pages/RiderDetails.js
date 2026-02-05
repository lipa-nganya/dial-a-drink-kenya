import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Tabs,
  Tab,
  Grid
} from '@mui/material';
import {
  ArrowBack,
  LocalShipping,
  Phone,
  Email,
  Person,
  Assignment
} from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';

const RiderDetails = () => {
  const { riderId } = useParams();
  const navigate = useNavigate();
  const { isDarkMode, colors } = useTheme();
  
  const [rider, setRider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersPage, setOrdersPage] = useState(0);
  const [ordersRowsPerPage, setOrdersRowsPerPage] = useState(10);
  const [savingsBalance, setSavingsBalance] = useState(null);
  const [savingsLoading, setSavingsLoading] = useState(false);
  const [transactionTab, setTransactionTab] = useState('orders'); // 'orders', 'cash-at-hand', 'savings'
  const [cashAtHandData, setCashAtHandData] = useState(null);
  const [cashAtHandLoading, setCashAtHandLoading] = useState(false);
  const [cashAtHandAmount, setCashAtHandAmount] = useState(null);
  const [savingsData, setSavingsData] = useState(null);
  const [savingsTransactionsLoading, setSavingsTransactionsLoading] = useState(false);

  // Fetch rider details
  useEffect(() => {
    const fetchRider = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get(`/drivers/${riderId}`);
        
        // Backend returns { success: true, data: driver } via sendSuccess
        let riderData = null;
        if (response?.data?.success && response.data.data) {
          riderData = response.data.data;
        } else if (response?.data?.data) {
          riderData = response.data.data;
        } else if (response?.data) {
          riderData = response.data;
        }
        
        if (!riderData) {
          throw new Error('Driver not found');
        }
        
        setRider(riderData);
      } catch (err) {
        console.error('Error fetching rider:', err);
        setError('Failed to load rider details: ' + (err.response?.data?.error || err.message));
      } finally {
        setLoading(false);
      }
    };
    
    if (riderId) {
      fetchRider();
    }
  }, [riderId]);

  // Fetch orders assigned to this rider (all, regardless of acceptance)
  useEffect(() => {
    const fetchOrders = async () => {
      if (!riderId) return;
      try {
        setOrdersLoading(true);
        const response = await api.get(`/driver-orders/${riderId}`, { params: { summary: 'true' } });
        let list = [];
        if (response?.data?.success && response.data.data) {
          list = response.data.data;
        } else if (response?.data?.data) {
          list = response.data.data;
        } else if (Array.isArray(response?.data)) {
          list = response.data;
        }
        setOrders(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Error fetching rider orders:', err);
        setOrders([]);
      } finally {
        setOrdersLoading(false);
      }
    };
    fetchOrders();
  }, [riderId]);

  // Fetch savings balance
  useEffect(() => {
    const fetchSavingsBalance = async () => {
      if (!riderId) return;
      try {
        setSavingsLoading(true);
        const response = await api.get(`/driver-wallet/${riderId}`);
        let walletData = null;
        if (response?.data?.success && response.data.data) {
          walletData = response.data.data;
        } else if (response?.data?.data) {
          walletData = response.data.data;
        } else if (response?.data) {
          walletData = response.data;
        }
        if (walletData?.wallet?.savings !== undefined) {
          setSavingsBalance(parseFloat(walletData.wallet.savings || 0));
        }
      } catch (err) {
        console.error('Error fetching savings balance:', err);
        setSavingsBalance(0);
      } finally {
        setSavingsLoading(false);
      }
    };
    fetchSavingsBalance();
  }, [riderId]);

  // Fetch cash at hand data (also fetch on mount to get the amount)
  useEffect(() => {
    const fetchCashAtHand = async () => {
      if (!riderId) return;
      try {
        setCashAtHandLoading(true);
        const response = await api.get(`/driver-wallet/${riderId}/cash-at-hand`);
        let data = null;
        if (response?.data?.success && response.data.data) {
          data = response.data.data;
        } else if (response?.data?.data) {
          data = response.data.data;
        } else if (response?.data) {
          data = response.data;
        }
        setCashAtHandData(data);
        // Update cash at hand amount from the API response
        if (data?.totalCashAtHand !== undefined) {
          setCashAtHandAmount(parseFloat(data.totalCashAtHand || 0));
        }
      } catch (err) {
        console.error('Error fetching cash at hand:', err);
        setCashAtHandData(null);
        setCashAtHandAmount(null);
      } finally {
        setCashAtHandLoading(false);
      }
    };
    fetchCashAtHand();
  }, [riderId, transactionTab]);

  // Fetch savings transactions
  useEffect(() => {
    const fetchSavingsTransactions = async () => {
      if (!riderId || transactionTab !== 'savings') return;
      try {
        setSavingsTransactionsLoading(true);
        const response = await api.get(`/driver-wallet/${riderId}`);
        let data = null;
        if (response?.data?.success && response.data.data) {
          data = response.data.data;
        } else if (response?.data?.data) {
          data = response.data.data;
        } else if (response?.data) {
          data = response.data;
        }
        setSavingsData(data);
      } catch (err) {
        console.error('Error fetching savings transactions:', err);
        setSavingsData(null);
      } finally {
        setSavingsTransactionsLoading(false);
      }
    };
    fetchSavingsTransactions();
  }, [riderId, transactionTab]);

  const formatCurrency = (amount) => {
    return `KES ${Number(amount || 0).toFixed(2)}`;
  };

  const driverResponseLabel = (driverAccepted) => {
    if (driverAccepted === true) return 'Accepted';
    if (driverAccepted === false) return 'Rejected';
    return 'Pending';
  };

  const driverResponseColor = (driverAccepted) => {
    if (driverAccepted === true) return 'success';
    if (driverAccepted === false) return 'error';
    return 'default';
  };

  const paymentStatusColor = (paymentStatus) => {
    if (paymentStatus === 'paid') return 'success';
    if (paymentStatus === 'unpaid') return 'error';
    return 'default';
  };

  const paginatedOrders = orders.slice(
    ordersPage * ordersRowsPerPage,
    ordersPage * ordersRowsPerPage + ordersRowsPerPage
  );

  // Reset to first page when orders list changes (e.g. different rider)
  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(orders.length / ordersRowsPerPage) - 1);
    if (ordersPage > maxPage) setOrdersPage(0);
  }, [orders.length, ordersRowsPerPage, ordersPage]);

  const handleOrdersPageChange = (_, newPage) => setOrdersPage(newPage);
  const handleOrdersRowsPerPageChange = (e) => {
    setOrdersRowsPerPage(parseInt(e.target.value, 10));
    setOrdersPage(0);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton
            onClick={() => navigate('/drivers')}
            sx={{ mr: 2, color: colors.textPrimary }}
          >
            <ArrowBack />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary }}>
            Rider Details
          </Typography>
        </Box>
        <Alert severity="error">{error || 'Rider not found'}</Alert>
      </Box>
    );
  }

  if (!rider) return null;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton
          onClick={() => navigate('/drivers')}
          sx={{ mr: 2, color: colors.textPrimary }}
        >
          <ArrowBack />
        </IconButton>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary }}>
            {rider?.name || 'Rider'} - Details
          </Typography>
        </Box>
      </Box>

      <Paper sx={{ backgroundColor: colors.paper, p: 3 }}>
        <Grid container spacing={3}>
          {/* Left Column: Personal Info */}
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Person sx={{ color: colors.accentText }} />
                <Typography variant="body1" component="div">
                  <strong>Name:</strong> {rider?.name || 'N/A'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Phone sx={{ color: colors.accentText }} />
                <Typography variant="body1" component="div">
                  <strong>Phone:</strong> {rider?.phoneNumber || 'N/A'}
                </Typography>
              </Box>
              {rider?.email && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Email sx={{ color: colors.accentText }} />
                  <Typography variant="body1" component="div">
                    <strong>Email:</strong> {rider.email}
                  </Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LocalShipping sx={{ color: colors.accentText }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body1" component="span">
                    <strong>Status:</strong>
                  </Typography>
                  <Chip
                    label={rider?.status || 'offline'}
                    size="small"
                    sx={{
                      backgroundColor: rider?.status === 'online' ? colors.accentText : colors.textSecondary,
                      color: isDarkMode ? '#0D0D0D' : '#FFFFFF'
                    }}
                  />
                </Box>
              </Box>
            </Box>
          </Grid>

          {/* Right Column: Financial Info */}
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Financial Info Row */}
              <Box sx={{ display: 'flex', flexDirection: 'row', gap: 3, flexWrap: 'wrap' }}>
                {rider?.creditLimit !== undefined && (
                  <Box>
                    <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                      Credit Limit
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                      {formatCurrency(rider.creditLimit)}
                    </Typography>
                  </Box>
                )}
                {cashAtHandAmount !== null ? (
                  <Box>
                    <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                      Cash at Hand
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                      {formatCurrency(cashAtHandAmount)}
                    </Typography>
                  </Box>
                ) : rider?.cashAtHand !== undefined && (
                  <Box>
                    <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                      Cash at Hand
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                      {formatCurrency(rider.cashAtHand)}
                    </Typography>
                  </Box>
                )}
                {savingsLoading ? (
                  <Box>
                    <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                      Savings Balance
                    </Typography>
                    <CircularProgress size={20} />
                  </Box>
                ) : savingsBalance !== null && (
                  <Box>
                    <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                      Savings Balance
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                      {formatCurrency(savingsBalance)}
                    </Typography>
                  </Box>
                )}
              </Box>
              {rider?.driverPayAmount && (
                <Box>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                    Total Earnings
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600, color: colors.accentText }}>
                    {formatCurrency(rider.driverPayAmount)}
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Transaction Tabs: Orders, Cash at Hand, Savings */}
      <Paper sx={{ mb: 3, backgroundColor: colors.paper }}>
        <Tabs
          value={transactionTab}
          onChange={(event, newValue) => {
            setTransactionTab(newValue);
            setOrdersPage(0);
          }}
          sx={{
            '& .MuiTab-root': {
              minHeight: 48,
              color: colors.textSecondary,
              fontSize: '0.95rem',
              '&.Mui-selected': {
                color: colors.accentText,
                fontWeight: 600
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: colors.accentText,
              height: 3
            }
          }}
        >
          <Tab label="Orders" value="orders" />
          <Tab label="Cash at Hand" value="cash-at-hand" />
          <Tab label="Savings" value="savings" />
        </Tabs>
      </Paper>

      {/* Orders Tab */}
      {transactionTab === 'orders' && (
        <>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assignment sx={{ color: colors.accentText }} />
            Orders assigned to {rider?.name || 'this rider'}
          </Typography>
          <TableContainer component={Paper} sx={{ backgroundColor: colors.paper }}>
        {ordersLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Customer name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Delivery address</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Order number</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Order status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Payment status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Driver response</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3, color: colors.textSecondary }}>
                      No orders assigned to this rider.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedOrders.map((order) => (
                    <TableRow key={order.id} hover>
                      <TableCell sx={{ color: colors.textPrimary }}>{order.customerName || '—'}</TableCell>
                      <TableCell sx={{ color: colors.textPrimary, maxWidth: 280 }}>{order.deliveryAddress || '—'}</TableCell>
                      <TableCell sx={{ color: colors.textPrimary, fontWeight: 500 }}>#{order.id}</TableCell>
                      <TableCell>
                        <Chip
                          label={order.status || '—'}
                          size="small"
                          sx={{ textTransform: 'capitalize', fontWeight: 500 }}
                          color={order.status === 'completed' ? 'success' : order.status === 'cancelled' ? 'error' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={order.paymentStatus || '—'}
                          size="small"
                          sx={{ textTransform: 'capitalize', fontWeight: 500 }}
                          color={paymentStatusColor(order.paymentStatus)}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={driverResponseLabel(order.driverAccepted)}
                          size="small"
                          color={driverResponseColor(order.driverAccepted)}
                          sx={{ fontWeight: 500 }}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {orders.length > 0 && (
              <TablePagination
                component="div"
                count={orders.length}
                page={ordersPage}
                onPageChange={handleOrdersPageChange}
                rowsPerPage={ordersRowsPerPage}
                onRowsPerPageChange={handleOrdersRowsPerPageChange}
                rowsPerPageOptions={[5, 10, 25, 50]}
                sx={{ color: colors.textPrimary, borderTop: 1, borderColor: 'divider' }}
              />
            )}
          </>
        )}
      </TableContainer>
      </>
      )}

      {/* Cash at Hand Transaction Logs */}
      {transactionTab === 'cash-at-hand' && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: colors.textPrimary }}>
            Cash at Hand Transactions
          </Typography>
          {cashAtHandLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : !cashAtHandData || !cashAtHandData.entries || cashAtHandData.entries.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                No cash at hand transactions found
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} sx={{ backgroundColor: colors.paper }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="right">Debit</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="right">Credit</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="right">Balance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(() => {
                    // Sort entries by date descending (newest first)
                    const sortedEntries = [...(cashAtHandData.entries || [])].sort((a, b) => {
                      const dateA = new Date(a.date);
                      const dateB = new Date(b.date);
                      return dateB - dateA;
                    });
                    
                    // Calculate running balance backwards from current total
                    let balanceAfter = parseFloat(cashAtHandData.totalCashAtHand || 0);
                    
                    return sortedEntries.map((entry, index) => {
                      const isCredit = entry.type === 'cash_received';
                      const amount = parseFloat(entry.amount || 0);
                      
                      // Current balance is the balance after this transaction
                      const currentBalance = balanceAfter;
                      
                      // Move to balance before this transaction for next iteration
                      if (isCredit) {
                        balanceAfter -= amount;
                      } else {
                        balanceAfter += amount;
                      }
                      
                      return (
                        <TableRow key={index} hover>
                          <TableCell sx={{ color: colors.textPrimary }}>
                            {new Date(entry.date).toLocaleDateString('en-KE', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </TableCell>
                          <TableCell sx={{ color: colors.textPrimary }}>
                            {entry.description || entry.customerName || 'N/A'}
                          </TableCell>
                          <TableCell align="right" sx={{ color: colors.textPrimary }}>
                            {isCredit ? `KES ${amount.toFixed(2)}` : '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ color: colors.textPrimary }}>
                            {!isCredit ? `KES ${amount.toFixed(2)}` : '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                            KES {currentBalance.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Savings Transaction Logs */}
      {transactionTab === 'savings' && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: colors.textPrimary }}>
            Savings Transactions
          </Typography>
          {savingsTransactionsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : !savingsData ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                No savings data found
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper} sx={{ backgroundColor: colors.paper }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="right">Debit</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="right">Credit</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="right">Balance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(() => {
                    // Get all transactions (credits and withdrawals)
                    const credits = savingsData.recentSavingsCredits || [];
                    const withdrawals = savingsData.recentWithdrawals || [];
                    
                    // Combine and sort by date (newest first)
                    const allTransactions = [];
                    credits.forEach(tx => {
                      allTransactions.push({ type: 'credit', ...tx });
                    });
                    withdrawals.forEach(wd => {
                      allTransactions.push({ type: 'withdrawal', ...wd });
                    });
                    
                    const sortedTransactions = allTransactions.sort((a, b) => {
                      const dateA = new Date(a.date || a.createdAt);
                      const dateB = new Date(b.date || b.createdAt);
                      return dateB - dateA;
                    });
                    
                    if (sortedTransactions.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ py: 3, color: colors.textSecondary }}>
                            No savings transactions found
                          </TableCell>
                        </TableRow>
                      );
                    }
                    
                    // Calculate running balance backwards from current savings
                    const currentSavings = parseFloat(savingsData.wallet?.savings || 0);
                    let balanceAfter = currentSavings;
                    
                    return sortedTransactions.map((tx, index) => {
                      const isCredit = tx.type === 'credit';
                      const amount = parseFloat(tx.amount || 0);
                      
                      // Current balance is the balance after this transaction
                      const currentBalance = balanceAfter;
                      
                      // Move to balance before this transaction for next iteration
                      if (isCredit) {
                        balanceAfter -= amount;
                      } else {
                        balanceAfter += amount;
                      }
                      
                      const description = isCredit 
                        ? (tx.notes || tx.orderLocation || tx.customerName || `Order #${tx.orderNumber || tx.orderId || 'N/A'}`)
                        : (tx.notes || `Savings withdrawal - KES ${amount.toFixed(2)}`);
                      
                      return (
                        <TableRow key={index} hover>
                          <TableCell sx={{ color: colors.textPrimary }}>
                            {new Date(tx.date || tx.createdAt).toLocaleDateString('en-KE', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </TableCell>
                          <TableCell sx={{ color: colors.textPrimary }}>
                            {description}
                          </TableCell>
                          <TableCell align="right" sx={{ color: colors.textPrimary }}>
                            {isCredit ? `KES ${amount.toFixed(2)}` : '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ color: colors.textPrimary }}>
                            {!isCredit ? `KES ${amount.toFixed(2)}` : '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                            KES {currentBalance.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}
    </Box>
  );
};

export default RiderDetails;
