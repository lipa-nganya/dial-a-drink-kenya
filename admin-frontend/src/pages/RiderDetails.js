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
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  ArrowBack,
  LocalShipping,
  Phone,
  Email,
  Person,
  Assignment,
  Add
} from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';
import { useAdmin } from '../contexts/AdminContext';
import { api } from '../services/api';

const RiderDetails = () => {
  const { riderId } = useParams();
  const navigate = useNavigate();
  const { isDarkMode, colors } = useTheme();
  const { user } = useAdmin();
  const isSuperAdmin = user?.role === 'super_admin';
  
  const [rider, setRider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersPage, setOrdersPage] = useState(0);
  const [ordersRowsPerPage, setOrdersRowsPerPage] = useState(10);
  const [ordersSearch, setOrdersSearch] = useState('');
  const [savingsBalance, setSavingsBalance] = useState(null);
  const [savingsLoading, setSavingsLoading] = useState(false);
  const [transactionTab, setTransactionTab] = useState('orders'); // 'orders', 'cash-at-hand', 'savings', 'loans'
  const [cashAtHandData, setCashAtHandData] = useState(null);
  const [cashAtHandLoading, setCashAtHandLoading] = useState(false);
  const [cashAtHandAmount, setCashAtHandAmount] = useState(null);
  const [savingsData, setSavingsData] = useState(null);
  const [savingsTransactionsLoading, setSavingsTransactionsLoading] = useState(false);
  const [addLoanDialogOpen, setAddLoanDialogOpen] = useState(false);
  const [loanAmount, setLoanAmount] = useState('');
  const [loanReason, setLoanReason] = useState('');
  const [addingLoan, setAddingLoan] = useState(false);
  const [addPenaltyDialogOpen, setAddPenaltyDialogOpen] = useState(false);
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [penaltyReason, setPenaltyReason] = useState('');
  const [addingPenalty, setAddingPenalty] = useState(false);
  const [addTransactionDialogOpen, setAddTransactionDialogOpen] = useState(false);
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionType, setTransactionType] = useState('debit');
  const [transactionApplyTo, setTransactionApplyTo] = useState('cash_at_hand');
  const [transactionReason, setTransactionReason] = useState('');
  const [addingTransaction, setAddingTransaction] = useState(false);

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
          const savings = parseFloat(walletData.wallet.savings || 0);
          console.log('Setting savings balance:', savings, 'Display will show:', Math.max(0, savings));
          setSavingsBalance(savings);
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
    return `KES ${Math.round(Number(amount || 0))}`;
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


  const handleAddPenalty = async () => {
    if (!isSuperAdmin) return;
    if (!penaltyAmount || !penaltyReason || parseFloat(penaltyAmount) <= 0) {
      return;
    }

    try {
      setAddingPenalty(true);
      const response = await api.post('/admin/penalties', {
        driverId: parseInt(riderId, 10),
        amount: parseFloat(penaltyAmount),
        reason: penaltyReason.trim()
      });

      if (response?.data?.success) {
        // Refresh savings balance to reflect the penalty (which reduces savings)
        const walletResponse = await api.get(`/driver-wallet/${riderId}`);
        let walletData = null;
        if (walletResponse?.data?.success && walletResponse.data.data) {
          walletData = walletResponse.data.data;
        } else if (walletResponse?.data?.data) {
          walletData = walletResponse.data.data;
        } else if (walletResponse?.data) {
          walletData = walletResponse.data;
        }
        if (walletData?.wallet?.savings !== undefined) {
          const newSavings = parseFloat(walletData.wallet.savings || 0);
          console.log('Updated savings balance after penalty:', newSavings);
          setSavingsBalance(newSavings);
        }

        setAddPenaltyDialogOpen(false);
        setPenaltyAmount('');
        setPenaltyReason('');
        alert('Penalty added successfully');
      } else {
        alert('Failed to add penalty: ' + (response?.data?.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error adding penalty:', err);
      alert('Error adding penalty: ' + (err.response?.data?.error || err.message));
    } finally {
      setAddingPenalty(false);
    }
  };

  const handleAddLoan = async () => {
    if (!isSuperAdmin) return;
    if (!loanAmount || !loanReason || parseFloat(loanAmount) <= 0) {
      return;
    }

    try {
      setAddingLoan(true);
      const response = await api.post('/admin/loans', {
        driverId: parseInt(riderId, 10),
        amount: parseFloat(loanAmount),
        reason: loanReason.trim()
      });

      if (response?.data?.success) {
        // Close dialog first
        setAddLoanDialogOpen(false);
        setLoanAmount('');
        setLoanReason('');
        
        // Use the newSavings from the response immediately
        const responseSavings = response?.data?.data?.newSavings;
        if (responseSavings !== undefined) {
          const newSavings = parseFloat(responseSavings || 0);
          console.log('Setting savings from loan response:', newSavings);
          setSavingsBalance(newSavings);
        }
        
        // Also refresh from wallet endpoint after a short delay to ensure we have the latest
        setTimeout(async () => {
          try {
            const walletResponse = await api.get(`/driver-wallet/${riderId}`);
            let walletData = null;
            if (walletResponse?.data?.success && walletResponse.data.data) {
              walletData = walletResponse.data.data;
            } else if (walletResponse?.data?.data) {
              walletData = walletResponse.data.data;
            } else if (walletResponse?.data) {
              walletData = walletResponse.data;
            }
            if (walletData?.wallet?.savings !== undefined) {
              const walletSavings = parseFloat(walletData.wallet.savings || 0);
              console.log('Updated savings balance from wallet after loan:', walletSavings);
              setSavingsBalance(walletSavings);
            }
          } catch (walletErr) {
            console.error('Error fetching wallet after loan:', walletErr);
          }
        }, 300);

        alert('Loan added successfully');
      } else {
        alert('Failed to add loan: ' + (response?.data?.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error adding loan:', err);
      alert('Error adding loan: ' + (err.response?.data?.error || err.message));
    } finally {
      setAddingLoan(false);
    }
  };

  const handleAddTransaction = async () => {
    if (!transactionAmount || !transactionReason || parseFloat(transactionAmount) <= 0) {
      return;
    }

    try {
      setAddingTransaction(true);
      const response = await api.post(`/driver-wallet/${riderId}/cash-at-hand/manual-transaction`, {
        amount: parseFloat(transactionAmount),
        transactionType,
        applyTo: transactionApplyTo,
        reason: transactionReason.trim()
      });

      if (response?.data?.success) {
        // Refresh balances immediately in profile card and transactions tab
        const cashResponse = await api.get(`/driver-wallet/${riderId}/cash-at-hand`);
        let cashData = null;
        if (cashResponse?.data?.success && cashResponse.data.data) {
          cashData = cashResponse.data.data;
        } else if (cashResponse?.data?.data) {
          cashData = cashResponse.data.data;
        } else if (cashResponse?.data) {
          cashData = cashResponse.data;
        }
        setCashAtHandData(cashData);
        if (cashData?.totalCashAtHand !== undefined) {
          setCashAtHandAmount(parseFloat(cashData.totalCashAtHand || 0));
        }
        const walletResponse = await api.get(`/driver-wallet/${riderId}`);
        const walletData = walletResponse?.data?.data || walletResponse?.data;
        if (walletData?.wallet?.savings !== undefined) {
          setSavingsBalance(parseFloat(walletData.wallet.savings || 0));
        }

        setAddTransactionDialogOpen(false);
        setTransactionAmount('');
        setTransactionType('debit');
        setTransactionApplyTo('cash_at_hand');
        setTransactionReason('');
        alert('Transaction added successfully');
      } else {
        alert('Failed to add transaction: ' + (response?.data?.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error adding manual transaction:', err);
      alert('Error adding transaction: ' + (err.response?.data?.error || err.message));
    } finally {
      setAddingTransaction(false);
    }
  };

  const paymentStatusColor = (paymentStatus) => {
    if (paymentStatus === 'paid') return 'success';
    if (paymentStatus === 'unpaid') return 'error';
    return 'default';
  };

  const normalizedOrdersSearch = String(ordersSearch || '').trim().toLowerCase();
  const filteredOrders = normalizedOrdersSearch
    ? (orders || []).filter((o) => {
        const haystack = [
          o?.id,
          o?.customerName,
          o?.customerPhone,
          o?.deliveryAddress,
          o?.status,
          o?.paymentStatus,
          o?.paymentMethod
        ]
          .filter((v) => v !== null && v !== undefined)
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedOrdersSearch);
      })
    : (orders || []);

  const paginatedOrders = filteredOrders.slice(
    ordersPage * ordersRowsPerPage,
    ordersPage * ordersRowsPerPage + ordersRowsPerPage
  );

  // Reset to first page when orders list changes (e.g. different rider)
  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filteredOrders.length / ordersRowsPerPage) - 1);
    if (ordersPage > maxPage) setOrdersPage(0);
  }, [filteredOrders.length, ordersRowsPerPage, ordersPage]);

  // Reset paging when search changes
  useEffect(() => {
    setOrdersPage(0);
  }, [normalizedOrdersSearch]);

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
                  <>
                    <Box>
                      <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                        Savings Balance
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: savingsBalance < 0 ? '#f44336' : colors.textPrimary }}>
                        {formatCurrency(savingsBalance)}
                      </Typography>
                    </Box>
                  </>
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                {isSuperAdmin && (
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setAddLoanDialogOpen(true)}
                    sx={{
                      backgroundColor: colors.accentText,
                      color: '#FFFFFF',
                      '&:hover': {
                        backgroundColor: colors.accentText,
                        opacity: 0.9,
                        color: '#FFFFFF'
                      }
                    }}
                  >
                    Add Loan
                  </Button>
                )}
                {isSuperAdmin && (
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setAddPenaltyDialogOpen(true)}
                    sx={{
                      backgroundColor: '#f44336',
                      color: '#FFFFFF',
                      '&:hover': {
                        backgroundColor: '#d32f2f',
                        opacity: 0.9,
                        color: '#FFFFFF'
                      }
                    }}
                  >
                    Add Penalty
                  </Button>
                )}
                {isSuperAdmin && (
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setAddTransactionDialogOpen(true)}
                    sx={{
                      backgroundColor: '#1976d2',
                      color: '#FFFFFF',
                      '&:hover': {
                        backgroundColor: '#1565c0',
                        opacity: 0.9,
                        color: '#FFFFFF'
                      }
                    }}
                  >
                    Add Transaction
                  </Button>
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
          <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              fullWidth
              value={ordersSearch}
              onChange={(e) => setOrdersSearch(e.target.value)}
              placeholder="Search orders (e.g. #123, name, phone, address, status...)"
              sx={{ maxWidth: 520 }}
              InputProps={{
                sx: { backgroundColor: colors.paper }
              }}
            />
            {normalizedOrdersSearch && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => setOrdersSearch('')}
                sx={{ borderColor: colors.border, color: colors.textPrimary }}
              >
                Clear
              </Button>
            )}
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
              Showing {filteredOrders.length} / {orders.length}
            </Typography>
          </Box>
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
                  <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Order #</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Customer name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Delivery address</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Order Value</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Order status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Payment status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Driver response</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3, color: colors.textSecondary }}>
                      {orders.length === 0
                        ? 'No orders assigned to this rider.'
                        : 'No orders match your search.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedOrders.map((order) => (
                    <TableRow key={order.id} hover>
                      <TableCell sx={{ color: colors.textPrimary, fontWeight: 600 }}>#{order.id}</TableCell>
                      <TableCell sx={{ color: colors.textPrimary }}>{order.customerName || '—'}</TableCell>
                      <TableCell sx={{ color: colors.textPrimary, maxWidth: 280 }}>{order.deliveryAddress || '—'}</TableCell>
                      <TableCell sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                        {(() => {
                          const totalAmount = Number(order.totalAmount || 0);
                          const tipAmount = Number(order.tipAmount || 0);
                          const orderValue = totalAmount - tipAmount;
                          return `KES ${Math.round(orderValue > 0 ? orderValue : 0)}`;
                        })()}
                      </TableCell>
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
            {filteredOrders.length > 0 && (
              <TablePagination
                component="div"
                count={filteredOrders.length}
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
                    <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Order #</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="right">Debit</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="right">Credit</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="right">Balance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(() => {
                    const entryType = (entry) => {
                      const t = entry.type ?? entry.transaction_type ?? entry.Type;
                      return typeof t === 'string' ? t.toLowerCase() : t;
                    };
                    // Sort entries by date descending (newest first)
                    const sortedEntries = [...(cashAtHandData.entries || [])].sort((a, b) => {
                      const dateA = new Date(a.date);
                      const dateB = new Date(b.date);
                      return dateB - dateA;
                    });
                    // Calculate running balance backwards from current total (same logic as Rider Cash at Hand Details)
                    let balanceAfter = parseFloat(cashAtHandData.totalCashAtHand || 0);
                    return sortedEntries.map((entry, index) => {
                      const type = entryType(entry);
                      // IMPORTANT: treat debits/credits based on entry.type from the API.
                      // Do NOT infer credit purely from having an orderId; many debits are order-linked.
                      const isCredit = type === 'cash_received';
                      const amount = parseFloat(entry.amount || 0);
                      const currentBalance = balanceAfter;
                      if (isCredit) {
                        balanceAfter -= amount;
                      } else {
                        balanceAfter += amount;
                      }
                      return (
                        <TableRow key={entry.transactionId ?? entry.id ?? index} hover>
                          <TableCell sx={{ color: colors.textPrimary }}>
                            {new Date(entry.date).toLocaleDateString('en-KE', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </TableCell>
                          <TableCell sx={{ color: colors.textPrimary }}>
                            {entry.orderId != null || entry.order_id != null
                              ? `#${entry.orderId ?? entry.order_id}`
                              : '—'}
                          </TableCell>
                          <TableCell sx={{ color: colors.textPrimary }}>
                            {entry.description || entry.customerName || 'N/A'}
                          </TableCell>
                          <TableCell align="right" sx={{ color: colors.textPrimary }}>
                            {!isCredit ? `KES ${Math.round(amount)}` : '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ color: colors.textPrimary }}>
                            {isCredit ? `KES ${Math.round(amount)}` : '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                            KES {Math.round(currentBalance)}
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
                    <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Order #</TableCell>
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
                          <TableCell colSpan={6} align="center" sx={{ py: 3, color: colors.textSecondary }}>
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
                        : (tx.notes || `Savings withdrawal - KES ${Math.round(amount)}`);
                      
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
                            {isCredit && (tx.orderId != null || tx.orderNumber != null)
                              ? `#${tx.orderId ?? tx.orderNumber}`
                              : '—'}
                          </TableCell>
                          <TableCell sx={{ color: colors.textPrimary }}>
                            {description}
                          </TableCell>
                          <TableCell align="right" sx={{ color: colors.textPrimary }}>
                            {!isCredit ? `KES ${Math.round(amount)}` : '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ color: colors.textPrimary }}>
                            {isCredit ? `KES ${Math.round(amount)}` : '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                            KES {Math.round(currentBalance)}
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

      {/* Loans Tab */}
      {/* Add Loan Dialog */}
      <Dialog
        open={addLoanDialogOpen}
        onClose={() => {
          setAddLoanDialogOpen(false);
          setLoanAmount('');
          setLoanReason('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: colors.accentText, fontWeight: 600 }}>
          Add Savings Loan
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Driver"
              value={rider?.name || ''}
              disabled
              fullWidth
              sx={{
                '& .MuiInputBase-input': {
                  color: colors.textPrimary
                }
              }}
            />
            <TextField
              label="Loan Amount (KES)"
              type="number"
              value={loanAmount}
              onChange={(e) => setLoanAmount(e.target.value)}
              fullWidth
              required
              inputProps={{ min: 0, step: 0.01 }}
              sx={{
                '& .MuiInputBase-input': {
                  color: colors.textPrimary
                }
              }}
            />
            <TextField
              label="Reason"
              value={loanReason}
              onChange={(e) => setLoanReason(e.target.value)}
              fullWidth
              required
              multiline
              rows={3}
              sx={{
                '& .MuiInputBase-input': {
                  color: colors.textPrimary
                }
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setAddLoanDialogOpen(false);
              setLoanAmount('');
              setLoanReason('');
            }}
            sx={{ color: colors.textSecondary }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddLoan}
            variant="contained"
            disabled={addingLoan || !loanAmount || !loanReason || parseFloat(loanAmount) <= 0}
            sx={{
              backgroundColor: colors.accentText,
              color: '#FFFFFF',
              '&:hover': {
                backgroundColor: colors.accentText,
                opacity: 0.9,
                color: '#FFFFFF'
              },
              '&:disabled': {
                backgroundColor: colors.textSecondary,
                color: '#FFFFFF'
              }
            }}
          >
            {addingLoan ? 'Adding...' : 'Add Loan'}
          </Button>
        </DialogActions>
      </Dialog>


      {/* Add Penalty Dialog */}
      <Dialog
        open={addPenaltyDialogOpen}
        onClose={() => {
          setAddPenaltyDialogOpen(false);
          setPenaltyAmount('');
          setPenaltyReason('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: '#f44336', fontWeight: 600 }}>
          Add Rider Penalty
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Driver"
              value={rider?.name || ''}
              disabled
              fullWidth
              sx={{
                '& .MuiInputBase-input': {
                  color: colors.textPrimary
                }
              }}
            />
            <TextField
              label="Penalty Amount (KES)"
              type="number"
              value={penaltyAmount}
              onChange={(e) => setPenaltyAmount(e.target.value)}
              fullWidth
              required
              inputProps={{ min: 0, step: 0.01 }}
              sx={{
                '& .MuiInputBase-input': {
                  color: colors.textPrimary
                }
              }}
            />
            <TextField
              label="Penalty Reason"
              value={penaltyReason}
              onChange={(e) => setPenaltyReason(e.target.value)}
              fullWidth
              required
              multiline
              rows={3}
              placeholder="Enter the reason for this penalty..."
              sx={{
                '& .MuiInputBase-input': {
                  color: colors.textPrimary
                }
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setAddPenaltyDialogOpen(false);
              setPenaltyAmount('');
              setPenaltyReason('');
            }}
            sx={{ color: colors.textSecondary }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddPenalty}
            variant="contained"
            disabled={addingPenalty || !penaltyAmount || !penaltyReason || parseFloat(penaltyAmount) <= 0}
            sx={{
              backgroundColor: '#f44336',
              color: '#FFFFFF',
              '&:hover': {
                backgroundColor: '#d32f2f',
                opacity: 0.9,
                color: '#FFFFFF'
              },
              '&:disabled': {
                backgroundColor: colors.textSecondary,
                color: '#FFFFFF'
              }
            }}
          >
            {addingPenalty ? 'Adding...' : 'Add Penalty'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Cash at Hand Transaction Dialog */}
      <Dialog
        open={addTransactionDialogOpen}
        onClose={() => {
          setAddTransactionDialogOpen(false);
          setTransactionAmount('');
          setTransactionType('debit');
          setTransactionApplyTo('cash_at_hand');
          setTransactionReason('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: '#1976d2', fontWeight: 600 }}>
          Add Cash at Hand Transaction
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Driver"
              value={rider?.name || ''}
              disabled
              fullWidth
            />
            <TextField
              label="Amount (KES)"
              type="number"
              value={transactionAmount}
              onChange={(e) => setTransactionAmount(e.target.value)}
              fullWidth
              required
              inputProps={{ min: 0, step: 0.01 }}
            />
            <FormControl fullWidth>
              <InputLabel>Transaction Type</InputLabel>
              <Select
                value={transactionType}
                label="Transaction Type"
                onChange={(e) => setTransactionType(e.target.value)}
              >
                <MenuItem value="debit">Debit</MenuItem>
                <MenuItem value="credit">Credit</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Apply To</InputLabel>
              <Select
                value={transactionApplyTo}
                label="Apply To"
                onChange={(e) => setTransactionApplyTo(e.target.value)}
              >
                <MenuItem value="cash_at_hand">Cash at Hand</MenuItem>
                <MenuItem value="savings">Savings</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Reason"
              value={transactionReason}
              onChange={(e) => setTransactionReason(e.target.value)}
              fullWidth
              required
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setAddTransactionDialogOpen(false);
              setTransactionAmount('');
              setTransactionType('debit');
              setTransactionApplyTo('cash_at_hand');
              setTransactionReason('');
            }}
            sx={{ color: colors.textSecondary }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddTransaction}
            variant="contained"
            disabled={addingTransaction || !transactionAmount || !transactionReason || parseFloat(transactionAmount) <= 0}
            sx={{
              backgroundColor: '#1976d2',
              color: '#FFFFFF',
              '&:hover': {
                backgroundColor: '#1565c0',
                opacity: 0.9,
                color: '#FFFFFF'
              },
              '&:disabled': {
                backgroundColor: colors.textSecondary,
                color: '#FFFFFF'
              }
            }}
          >
            {addingTransaction ? 'Adding...' : 'Add Transaction'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RiderDetails;
