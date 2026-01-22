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
  Button,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  CircularProgress,
  Alert,
  IconButton,
  Collapse,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Tabs,
  Tab,
  Autocomplete
} from '@mui/material';
import {
  Search,
  Clear,
  ExpandLess,
  ExpandMore,
  Receipt,
  Info,
  AccountBalanceWallet,
  ShoppingCart
} from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useAdmin } from '../contexts/AdminContext';
import {
  getPaymentMethodChipProps,
  getTransactionTypeChipProps,
  getTransactionStatusChipProps
} from '../utils/chipStyles';

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [merchantWallet, setMerchantWallet] = useState(null);
  const [expandedRows, setExpandedRows] = useState(() => new Set());
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [transactionDialogTab, setTransactionDialogTab] = useState('transaction');
  const [currentTab, setCurrentTab] = useState('transactions');
  const [createSubmissionDialogOpen, setCreateSubmissionDialogOpen] = useState(false);
  const [submissionFormData, setSubmissionFormData] = useState({
    submissionType: 'cash',
    amount: '',
    details: {},
    orderIds: []
  });
  const [availableOrders, setAvailableOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const { isDarkMode, colors } = useTheme();
  const { user } = useAdmin();

  const dateFieldStyles = {
    minWidth: 180,
    '& .MuiOutlinedInput-root': {
      backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
      '& fieldset': { borderColor: colors.accentText },
      '&:hover fieldset': { borderColor: '#00C4A3' },
      '&.Mui-focused fieldset': { borderColor: colors.accentText }
    },
    '& .MuiOutlinedInput-input': {
      color: colors.textPrimary
    },
    '& .MuiInputBase-input': {
      color: colors.textPrimary
    },
    '& .MuiInputLabel-root': {
      color: isDarkMode ? colors.accentText : undefined
    },
    '& .MuiInputLabel-root.Mui-focused': {
      color: colors.accentText
    },
    '& input[type="date"]::-webkit-calendar-picker-indicator': {
      filter: isDarkMode ? 'invert(75%) sepia(59%) saturate(514%) hue-rotate(116deg) brightness(97%) contrast(93%)' : 'none'
    },
    '& input[type="date"]::-webkit-calendar-picker-indicator:hover': {
      filter: isDarkMode ? 'invert(75%) sepia(59%) saturate(514%) hue-rotate(116deg) brightness(97%) contrast(93%)' : 'none'
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchMerchantWallet();
  }, []);

  // Removed cash submissions tab - no longer needed

  // Get card payment transactions
  const getCardPaymentTransactions = () => {
    return transactions.filter(t => {
      // Filter for card payments: paymentMethod === 'card' or paymentProvider === 'pesapal'
      return t.paymentMethod === 'card' || t.paymentProvider === 'pesapal';
    });
  };

  // Filter card payment transactions
  const filterCardPaymentTransactions = () => {
    let filtered = getCardPaymentTransactions();

    // Apply same filters as regular transactions
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(t => {
        return (
          t.receiptNumber?.toLowerCase().includes(search) ||
          t.orderId?.toString().includes(search) ||
          t.phoneNumber?.includes(search) ||
          t.order?.customerName?.toLowerCase().includes(search) ||
          t.order?.customerPhone?.includes(search)
        );
      });
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    if (startDate || endDate) {
      filtered = filtered.filter(t => {
        const transactionDate = new Date(t.transactionDate || t.createdAt);
        transactionDate.setHours(0, 0, 0, 0);
        
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          return transactionDate >= start && transactionDate <= end;
        } else if (startDate) {
          const start = new Date(startDate);
          return transactionDate >= start;
        } else if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          return transactionDate <= end;
        }
        return true;
      });
    }

    return filtered;
  };

  useEffect(() => {
    if (currentTab === 'transactions') {
      filterTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps, no-use-before-define
  }, [searchTerm, statusFilter, paymentMethodFilter, startDate, endDate, transactions, currentTab]);

  const fetchTransactions = async () => {
    try {
      const response = await api.get('/admin/transactions');
      // Normalize transactions on the frontend as well (double safety)
      const normalizedTransactions = response.data.map(transaction => {
        // Ensure transactionType is always present
        if (!transaction.transactionType || 
            typeof transaction.transactionType !== 'string' || 
            transaction.transactionType.trim() === '') {
          console.warn(`⚠️ Frontend: Transaction #${transaction.id} has missing/null transactionType, defaulting to 'payment'`);
          transaction.transactionType = 'payment';
        }
        return transaction;
      });
      setTransactions(normalizedTransactions);
      setFilteredTransactions(normalizedTransactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setError(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMerchantWallet = async () => {
    try {
      const response = await api.get('/admin/merchant-wallet');
      setMerchantWallet(response.data);
    } catch (error) {
      console.error('Error fetching merchant wallet:', error);
      // Don't set error state, just log it
    }
  };

  const fetchOrdersForSelection = async () => {
    try {
      setLoadingOrders(true);
      
      // Fetch orders and approved cash submissions in parallel
      const [ordersResponse, approvedSubmissionsResponse] = await Promise.all([
        api.get('/admin/orders'),
        api.get('/driver-wallet/admin/cash-submissions/all')
      ]);
      
      // Get all orders
      const allOrders = ordersResponse.data || [];
      
      // Get approved cash submissions with their associated orders
      const allSubmissions = approvedSubmissionsResponse.data?.data?.submissions || approvedSubmissionsResponse.data?.submissions || [];
      const approvedSubmissions = allSubmissions.filter(s => s.status === 'approved');
      
      // Collect order IDs that are already associated with approved submissions
      const usedOrderIds = new Set();
      approvedSubmissions.forEach(submission => {
        if (submission.orders && Array.isArray(submission.orders)) {
          submission.orders.forEach(order => {
            usedOrderIds.add(order.id);
          });
        }
      });
      
      // Filter to only show POS orders with CASH payment method
      // POS orders are identified by: adminOrder === true OR status === 'pos_order' OR deliveryAddress === 'In-Store Purchase'
      const isPOSOrder = (order) => {
        return order.adminOrder === true || 
               order.status === 'pos_order' ||
               (order.deliveryAddress && order.deliveryAddress.includes('In-Store Purchase'));
      };

      // Filter out cancelled orders, non-POS orders, non-cash payment methods, and orders already associated with approved submissions
      const availableOrders = allOrders.filter(order => {
        // Must not be cancelled
        if (order.status === 'cancelled') return false;
        
        // Must be a POS order
        if (!isPOSOrder(order)) return false;
        
        // Must have payment method === 'cash'
        if (order.paymentMethod !== 'cash') return false;
        
        // Must not be already associated with an approved submission
        if (usedOrderIds.has(order.id)) return false;
        
        return true;
      });
      
      console.log(`📋 Filtered orders for cash submission: ${availableOrders.length} POS orders with CASH payment method out of ${allOrders.length} total orders`);
      
      setAvailableOrders(availableOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setAvailableOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };


  const handleCreateSubmission = async () => {
    try {
      // Validate form data based on submission type
      if (!submissionFormData.amount || parseFloat(submissionFormData.amount) <= 0) {
        alert('Please enter a valid amount');
        return;
      }

      const details = {};
      if (submissionFormData.submissionType === 'purchases') {
        if (!submissionFormData.details.supplier || !submissionFormData.details.item || !submissionFormData.details.price || !submissionFormData.details.deliveryLocation) {
          alert('Please fill in all required fields for purchases');
          return;
        }
        details.supplier = submissionFormData.details.supplier;
        details.item = submissionFormData.details.item;
        details.price = submissionFormData.details.price;
        details.deliveryLocation = submissionFormData.details.deliveryLocation;
      } else if (submissionFormData.submissionType === 'cash') {
        if (!submissionFormData.details.recipientName) {
          alert('Please enter recipient name');
          return;
        }
        details.recipientName = submissionFormData.details.recipientName;
      } else if (submissionFormData.submissionType === 'general_expense') {
        if (!submissionFormData.details.nature) {
          alert('Please enter expense nature');
          return;
        }
        details.nature = submissionFormData.details.nature;
      } else if (submissionFormData.submissionType === 'payment_to_office') {
        if (!submissionFormData.details.accountType) {
          alert('Please select account type');
          return;
        }
        details.accountType = submissionFormData.details.accountType;
      } else if (submissionFormData.submissionType === 'walk_in_sale') {
        // Walk-in sale details are optional
      }

      await api.post('/driver-wallet/admin/cash-submissions', {
        submissionType: submissionFormData.submissionType,
        amount: parseFloat(submissionFormData.amount),
        details,
        orderIds: submissionFormData.orderIds || []
      });

      alert('Cash submission created successfully!');
      setCreateSubmissionDialogOpen(false);
      setSubmissionFormData({ submissionType: 'cash', amount: '', details: {}, orderIds: [] });
      setAvailableOrders([]);
      // Refresh transactions to show the new submission
      fetchTransactions();
    } catch (error) {
      console.error('Error creating cash submission:', error);
      alert(error.response?.data?.error || 'Failed to create cash submission');
    }
  };

  const filterTransactions = () => {
    let filtered = [...transactions];

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(t => {
        return (
          t.receiptNumber?.toLowerCase().includes(search) ||
          t.orderId?.toString().includes(search) ||
          t.phoneNumber?.includes(search) ||
          t.order?.customerName?.toLowerCase().includes(search) ||
          t.order?.customerPhone?.includes(search)
        );
      });
    }

    // Filter by transaction status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    // Filter by payment method
    if (paymentMethodFilter !== 'all') {
      filtered = filtered.filter(t => {
        if (paymentMethodFilter === 'mobile_money') {
          return t.paymentMethod === 'mobile_money';
        } else if (paymentMethodFilter === 'card') {
          return t.paymentMethod === 'card';
        } else if (paymentMethodFilter === 'cash') {
          return t.paymentMethod === 'cash' || !t.paymentMethod;
        }
        return true;
      });
    }

    // Filter by date range
    if (startDate || endDate) {
      filtered = filtered.filter(t => {
        const transactionDate = new Date(t.transactionDate || t.createdAt);
        transactionDate.setHours(0, 0, 0, 0); // Set to start of day for comparison
        
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999); // Set to end of day
          return transactionDate >= start && transactionDate <= end;
        } else if (startDate) {
          const start = new Date(startDate);
          return transactionDate >= start;
        } else if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999); // Set to end of day
          return transactionDate <= end;
        }
        return true;
      });
    }

    setFilteredTransactions(filtered);
    setPage(0);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPaymentMethodFilter('all');
    setStartDate('');
    setEndDate('');
  };

  const getPaymentMethodLabel = (method, provider) => {
    if (method === 'mobile_money') {
      return provider === 'mpesa' ? 'M-Pesa' : 'Mobile Money';
    }
    return method === 'card' ? 'Card' : 'Cash';
  };

  const toggleRowExpansion = (transactionId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(transactionId)) {
      newExpanded.delete(transactionId);
    } else {
      newExpanded.add(transactionId);
    }
    setExpandedRows(newExpanded);
  };

  const handleViewDetails = (transaction) => {
    setSelectedTransaction(transaction);
  };

  const getTransactionCategory = (transactionType = '') => {
    const normalizedType = transactionType.toLowerCase();
    const debitTypes = new Set([
      'refund',
      'chargeback',
      'withdrawal',
      'payout',
      'driver_pay',
      'cash_settlement',
      'manual_payout',
      'reversal',
      'adjustment_debit'
    ]);

    if (debitTypes.has(normalizedType)) {
      return 'Debit';
    }

    return 'Credit';
  };

  const getCategoryChipProps = (transactionType) => {
    const category = getTransactionCategory(transactionType);
    if (category === 'Debit') {
      return {
        label: 'Debit',
        sx: {
          backgroundColor: '#FF3366',
          color: '#FFFFFF',
          fontWeight: 700
        }
      };
    }

    return {
      label: 'Credit',
        sx: {
          backgroundColor: colors.accentText,
          color: isDarkMode ? '#002A54' : '#FFFFFF',
          fontWeight: 700
        }
    };
  };

  const formatDateTime = (value) => {
    if (!value) {
      return 'N/A';
    }

    return new Date(value).toLocaleString('en-KE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const handleChangePage = (_event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
  };

  useEffect(() => {
    const transactionsToCheck = currentTab === 'card-payments' ? filterCardPaymentTransactions() : filteredTransactions;
    if (page > 0 && page * rowsPerPage >= transactionsToCheck.length) {
      const lastPage = Math.max(0, Math.ceil(transactionsToCheck.length / rowsPerPage) - 1);
      if (page !== lastPage) {
        setPage(lastPage);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTransactions.length, page, rowsPerPage, currentTab, transactions]);

  if (loading) {
    return (
      <Container maxWidth={false} sx={{ py: 4, px: { xs: 2, md: 4 }, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading transactions...</Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth={false} sx={{ py: 4, px: { xs: 2, md: 4 } }}>
        <Alert severity="error">Error loading transactions: {error}</Alert>
      </Container>
    );
  }

  // Get transactions to display based on current tab
  const getDisplayTransactions = () => {
    if (currentTab === 'card-payments') {
      return filterCardPaymentTransactions();
    }
    return filteredTransactions;
  };

  const displayTransactions = getDisplayTransactions();
  const paginatedTransactions = displayTransactions.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Container maxWidth={false} sx={{ py: 4, px: { xs: 2, md: 4 } }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Receipt sx={{ color: colors.accentText, fontSize: 40 }} />
          <Typography variant="h4" component="h1" gutterBottom sx={{ color: colors.accentText, fontWeight: 700 }}>
            Transactions
          </Typography>
        </Box>
        <Typography variant="h6" color="text.secondary">
          Track all payment transactions
        </Typography>
      </Box>

      {/* Merchant Wallet Section */}
      {merchantWallet && (
        <Box sx={{ mb: 3 }}>
          <Paper sx={{ p: 3, backgroundColor: colors.paper, border: `2px solid ${colors.accentText}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <AccountBalanceWallet sx={{ fontSize: 32, color: colors.accentText }} />
              <Typography variant="h5" sx={{ color: colors.accentText, fontWeight: 700 }}>
                Merchant Wallet
              </Typography>
            </Box>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary">Current Balance</Typography>
                <Typography variant="h4" sx={{ color: colors.accentText, fontWeight: 700 }}>
                  KES {Number(merchantWallet.balance || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary">Total Revenue</Typography>
                <Typography variant="h4" sx={{ color: colors.accentText, fontWeight: 700 }}>
                  KES {Number(merchantWallet.totalRevenue || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary">Paid Orders Count</Typography>
                <Typography variant="h4" sx={{ color: colors.accentText, fontWeight: 700 }}>
                  {merchantWallet.totalOrders || 0}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="text.secondary">All Orders Count</Typography>
                <Typography variant="h4" sx={{ color: colors.accentText, fontWeight: 700 }}>
                  {merchantWallet.allOrdersCount || 0}
                </Typography>
              </Grid>
            </Grid>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              * Both Current Balance and Total Revenue exclude driver tips. Tips are credited directly to driver wallets.
            </Typography>
          </Paper>
        </Box>
      )}

      {/* Main Tabs */}
      <Box sx={{ mb: 3 }}>
        <Tabs
          value={currentTab}
          onChange={(event, newValue) => {
            setCurrentTab(newValue);
            // Reset page when switching tabs
            setPage(0);
          }}
          textColor="secondary"
          indicatorColor="secondary"
          sx={{
            borderBottom: `1px solid ${colors.border}`,
            '& .MuiTab-root': {
              color: colors.textSecondary,
              fontWeight: 600,
              fontSize: '1rem'
            },
            '& .Mui-selected': {
              color: colors.accentText
            }
          }}
        >
          <Tab label="All Transactions" value="transactions" />
          <Tab label="Card Payments" value="card-payments" />
        </Tabs>
      </Box>


      {/* Summary Stats */}
      {(currentTab === 'transactions' || currentTab === 'card-payments') && (
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="body2" color="text.secondary">Total Transactions</Typography>
          <Typography variant="h5" sx={{ color: colors.accentText, fontWeight: 700 }}>
            {currentTab === 'card-payments' ? filterCardPaymentTransactions().length : filteredTransactions.length}
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="body2" color="text.secondary">Total Orders</Typography>
          <Typography variant="h5" sx={{ color: colors.accentText, fontWeight: 700 }}>
            {merchantWallet?.allOrdersCount || 0}
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="body2" color="text.secondary">Complete Transactions</Typography>
          <Typography variant="h5" sx={{ color: colors.accentText, fontWeight: 700 }}>
            {displayTransactions.filter(t => t.status === 'completed').length}
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="body2" color="text.secondary">Total Amount (Excludes Tips)</Typography>
          <Typography variant="h5" sx={{ color: '#FF3366', fontWeight: 700 }}>
            KES {displayTransactions
              .filter(t => {
                // Exclude tips
                if (t.transactionType === 'tip') return false;
                // Exclude driver delivery fee payments (delivery_pay transactions with driverWalletId)
                // Only include merchant delivery fee payments (delivery_pay with driverId/driverWalletId null)
                if (t.transactionType === 'delivery_pay' && t.driverWalletId) return false;
                return t.status === 'completed';
              })
              .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
              .toFixed(2)}
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="body2" color="text.secondary">Pending/Failed</Typography>
          <Typography variant="h5" sx={{ color: '#FF3366', fontWeight: 700 }}>
            {displayTransactions.filter(t => t.status === 'pending' || t.status === 'failed').length}
          </Typography>
        </Paper>
      </Box>
      )}

      {/* Filters - Show for transactions and card-payments tabs */}
      {(currentTab === 'transactions' || currentTab === 'card-payments') && (
      <Box sx={{ mb: 3 }}>
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Transaction Status</InputLabel>
              <Select
                value={statusFilter}
                label="Transaction Status"
                onChange={(e) => setStatusFilter(e.target.value)}
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
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Payment Method</InputLabel>
              <Select
                value={paymentMethodFilter}
                label="Payment Method"
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
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
                <MenuItem value="all">All Methods</MenuItem>
                <MenuItem value="mobile_money">Mobile Money (M-Pesa)</MenuItem>
                <MenuItem value="card">Card</MenuItem>
                <MenuItem value="cash">Cash</MenuItem>
              </Select>
            </FormControl>

            <TextField
              type="date"
              label="Start Date"
              size="small"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={dateFieldStyles}
            />

            <TextField
              type="date"
              label="End Date"
              size="small"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={dateFieldStyles}
            />

            {(statusFilter !== 'all' || paymentMethodFilter !== 'all' || startDate || endDate || searchTerm) && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<Clear />}
                onClick={handleClearFilters}
                sx={{
                  borderColor: colors.border,
                  color: colors.textPrimary,
                  '&:hover': { borderColor: colors.textSecondary }
                }}
              >
                Clear Filters
              </Button>
            )}
          </Box>

          {/* Search */}
          <TextField
            fullWidth
            placeholder="Search by receipt number, order ID, phone, or customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              )
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: colors.accentText },
                '&:hover fieldset': { borderColor: colors.accentText },
                '&.Mui-focused fieldset': { borderColor: colors.accentText }
              }
            }}
          />
        </Paper>
      </Box>
      )}

      {/* Transactions Table */}
      {(currentTab === 'transactions' || currentTab === 'card-payments') && (
      <>
      {displayTransactions.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Receipt sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            {searchTerm ? 'No transactions found matching your search' : 'No transactions found'}
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ width: '100%', overflowX: 'auto' }}>
          <Table sx={{ minWidth: 1300 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }} width="40px"></TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Transaction ID</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Transaction Type</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Order ID</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Customer</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Payment Method</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Amount</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Receipt Number</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedTransactions.map((transaction) => {
                const isExpanded = expandedRows.has(transaction.id);
                // Ensure transactionType is always present (fallback to 'payment' if missing)
                // Double-check: normalize transactionType to ensure it's a valid string
                const transactionType = (transaction.transactionType && 
                  typeof transaction.transactionType === 'string' && 
                  transaction.transactionType.trim() !== '') 
                  ? transaction.transactionType.trim() 
                  : 'payment';
                
                const typeChipRaw = getTransactionTypeChipProps(transactionType);
                
                // Handle function returns (e.g., delivery_pay which needs transaction context)
                let typeChip = typeof typeChipRaw === 'function'
                  ? typeChipRaw(transaction)
                  : typeChipRaw;
                
                // Ensure typeChip always has a label - if null, undefined, empty string, or missing label, create default
                if (!typeChip || !typeChip.label || typeChip.label.trim() === '') {
                  // Special handling for delivery_pay transactions
                  if (transactionType === 'delivery_pay' || transactionType === 'delivery') {
                    // Check if it's a driver payment (has driverId that is not null/undefined)
                    // CRITICAL: driverId must be explicitly checked for null/undefined, not just truthy
                    // Merchant transactions have driverId: null, driver transactions have driverId: <number>
                    const isDriverPayment = transaction?.driverId != null && transaction?.driverId !== undefined;
                    typeChip = {
                      label: isDriverPayment ? 'Delivery Fee Payment (Driver)' : 'Delivery Fee Payment (Merchant)',
                      sx: {
                        backgroundColor: isDriverPayment ? '#FFC107' : '#2196F3',
                        color: isDriverPayment ? '#000' : '#002A54',
                        fontWeight: 700
                      }
                    };
                  } else {
                    // Format the transaction type for display (capitalize first letter, replace underscores)
                    const formattedLabel = transactionType && transactionType.trim() !== ''
                      ? transactionType
                          .split('_')
                          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                          .join(' ')
                      : 'Payment';
                    
                    typeChip = {
                      label: formattedLabel,
                      sx: {
                        backgroundColor: '#616161',
                        color: '#FFFFFF',
                        fontWeight: 600
                      }
                    };
                  }
                }
                const methodChip = getPaymentMethodChipProps(transaction.paymentMethod);
                const statusChip = getTransactionStatusChipProps(transaction.status);
                const methodLabel = getPaymentMethodLabel(
                  transaction.paymentMethod,
                  transaction.paymentProvider
                );
                const providerLabel = transaction.paymentProvider
                  ? transaction.paymentProvider.replace(/_/g, ' ')
                  : '';
                const normalizedMethod = methodLabel
                  ? methodLabel.replace(/[^a-z0-9]/gi, '').toLowerCase()
                  : '';
                const normalizedProvider = providerLabel
                  ? providerLabel.replace(/[^a-z0-9]/gi, '').toLowerCase()
                  : '';
                const isTip = transactionType === 'tip';
                const isDriverDelivery = transactionType === 'delivery_pay' && !!transaction.driverWalletId;
                const isPOS = transaction.receiptNumber === 'POS';
                const highlighted = isTip || isDriverDelivery;
                const highlightBackground = 'rgba(255, 193, 7, 0.15)';
                const highlightBorder = '4px solid #FFC107';
                const hoverHighlightBackground = 'rgba(255, 193, 7, 0.2)';
                const posBackground = 'rgba(156, 39, 176, 0.15)'; // Light purple background
                const posHoverBackground = 'rgba(156, 39, 176, 0.2)'; // Slightly darker purple on hover

                return (
                  <React.Fragment key={transaction.id}>
                    <TableRow
                      sx={{
                        backgroundColor: isPOS ? posBackground : (highlighted ? highlightBackground : 'transparent'),
                        borderLeft: highlighted ? highlightBorder : 'none',
                        '&:hover': {
                          backgroundColor: isPOS ? posHoverBackground : (highlighted ? hoverHighlightBackground : 'rgba(0, 224, 184, 0.05)')
                        }
                      }}
                    >
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => toggleRowExpansion(transaction.id)}
                          sx={{ color: colors.accentText }}
                        >
                          {isExpanded ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          #{transaction.id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          // Double-check transactionType is valid (defensive programming)
                          const safeTransactionType = (transaction.transactionType && 
                            typeof transaction.transactionType === 'string' && 
                            transaction.transactionType.trim() !== '') 
                            ? transaction.transactionType.trim() 
                            : 'payment';
                          
                          // Ensure we always have a valid label (not empty string, null, or undefined)
                          let chipLabel = (typeChip?.label && typeof typeChip.label === 'string') ? typeChip.label.trim() : '';
                          let chipSx = typeChip?.sx;
                          
                          // If label is missing or empty, determine the correct label based on transaction type
                          if (!chipLabel || chipLabel === '') {
                          if (safeTransactionType === 'delivery_pay' || safeTransactionType === 'delivery') {
                            // Check if it's a driver payment (has driverWalletId or driverId that is not null/undefined)
                            // CRITICAL: driverWalletId is the primary indicator for driver payments
                            // Merchant transactions have driverWalletId: null, driver transactions have driverWalletId: <number>
                            // Also check driverId as fallback for backwards compatibility
                            const isDriverPayment = (transaction?.driverWalletId != null && transaction?.driverWalletId !== undefined) ||
                                                   (transaction?.driverId != null && transaction?.driverId !== undefined);
                              chipLabel = isDriverPayment ? 'Delivery Fee Payment (Driver)' : 'Delivery Fee Payment (Merchant)';
                              chipSx = {
                                backgroundColor: isDriverPayment ? '#FFC107' : '#2196F3',
                                color: isDriverPayment ? '#000' : '#002A54',
                                fontWeight: 700
                              };
                            } else if (safeTransactionType && typeof safeTransactionType === 'string' && safeTransactionType.trim() !== '') {
                              // Format other transaction types
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
                          
                          // Final safety check - ensure chipLabel is never empty
                          if (!chipLabel || chipLabel.trim() === '') {
                            console.warn(`⚠️ Frontend: Transaction #${transaction.id} still has empty label after all checks, forcing 'Payment'`);
                            chipLabel = 'Payment';
                            chipSx = {
                              backgroundColor: '#616161',
                              color: '#FFFFFF',
                              fontWeight: 600
                            };
                          }
                          
                          return (
                            <Chip
                              size="small"
                              label={chipLabel}
                              sx={{ fontWeight: 700, ...(chipSx || {
                                backgroundColor: '#616161',
                                color: '#FFFFFF',
                                fontWeight: 600
                              }) }}
                            />
                          );
                        })()}
                      </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      Order #{transaction.orderId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {transaction.order ? (
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {transaction.order.customerName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {transaction.order.customerPhone}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        N/A
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
                      {transactionType === 'tip' ? (
                        typeChip ? (
                          <Chip
                            size="small"
                            label={typeChip.label}
                            sx={{ fontWeight: 700, ...typeChip.sx }}
                          />
                        ) : (
                          <Chip
                            size="small"
                            label="Tip"
                            sx={{ fontWeight: 700, backgroundColor: '#FFC107', color: '#000' }}
                          />
                        )
                      ) : methodChip ? (
                        <Chip
                          size="small"
                          label={methodChip.label}
                          sx={{ fontWeight: 700, ...methodChip.sx }}
                        />
                      ) : (
                        <Chip
                          size="small"
                          label={methodLabel || '—'}
                          sx={{ fontWeight: 700, backgroundColor: '#424242', color: '#FFFFFF' }}
                        />
                      )}
                      {(() => {
                        let detailText;
                        if (transactionType.toLowerCase() === 'tip') {
                          detailText = providerLabel
                            ? `From ${providerLabel.toLowerCase()} payment`
                            : 'Tip transaction';
                        } else if (methodLabel) {
                          detailText = methodLabel;
                          if (
                            providerLabel &&
                            normalizedProvider &&
                            normalizedMethod &&
                            normalizedProvider !== normalizedMethod
                          ) {
                            detailText = `${methodLabel} (${providerLabel})`;
                          }
                        } else {
                          detailText = providerLabel || '—';
                        }
                        return (
                          <Typography variant="caption" color="text.secondary">
                            {detailText}
                          </Typography>
                        );
                      })()}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography 
                      variant="body1" 
                      sx={{ 
                        fontWeight: 600, 
                        color: transactionType === 'tip' ? '#FFC107' : '#FF3366'
                      }}
                    >
                      KES {Number(transaction.amount).toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const categoryChip = getCategoryChipProps(transactionType);
                      return (
                        <Chip
                          size="small"
                          label={categoryChip.label}
                          sx={categoryChip.sx}
                        />
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {statusChip ? (
                      <Chip
                        size="small"
                        {...statusChip}
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {transaction.status}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {transaction.receiptNumber ? (
                      (() => {
                        // Check if this is a POS order (cash or M-Pesa)
                        const isPOSOrder = transaction.order?.deliveryAddress === 'In-Store Purchase';
                        const isCashPOS = transaction.receiptNumber === 'POS';
                        const isMpesaPOS = isPOSOrder && transaction.paymentMethod === 'mobile_money' && transaction.receiptNumber !== 'POS';
                        
                        if (isCashPOS) {
                          // Cash POS order - show POS chip
                          return (
                            <Chip
                              label="POS"
                              size="small"
                              icon={<Receipt fontSize="small" />}
                              sx={{
                                backgroundColor: '#9C27B0', // Purple background
                                color: '#FFFFFF', // White text
                                fontWeight: 600,
                                '& .MuiChip-icon': {
                                  color: '#FFFFFF'
                                }
                              }}
                            />
                          );
                        } else if (isMpesaPOS) {
                          // M-Pesa POS order - show POS label above receipt number
                          return (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              <Chip
                                label="POS"
                                size="small"
                                sx={{
                                  backgroundColor: '#9C27B0', // Purple background
                                  color: '#FFFFFF', // White text
                                  fontWeight: 600,
                                  fontSize: '0.7rem',
                                  height: '20px',
                                  alignSelf: 'flex-start'
                                }}
                              />
                              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Receipt fontSize="small" />
                                {transaction.receiptNumber}
                              </Typography>
                            </Box>
                          );
                        } else {
                          // Regular transaction - show receipt number normally
                          return (
                            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Receipt fontSize="small" />
                              {transaction.receiptNumber}
                            </Typography>
                          );
                        }
                      })()
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        N/A
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(transaction.transactionDate || transaction.createdAt).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(transaction.transactionDate || transaction.createdAt).toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit' 
                      })}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={() => handleViewDetails(transaction)}
                      sx={{ color: colors.accentText }}
                    >
                      <Info />
                    </IconButton>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={13}>
                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                      <Box sx={{ margin: 2 }}>
                        <Typography variant="h6" gutterBottom sx={{ color: colors.accentText, mb: 2 }}>
                          Transaction Details
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={6}>
                            <Paper sx={{ p: 0, backgroundColor: colors.paper }}>
                              <Tabs
                                value={transactionDialogTab}
                                onChange={(_event, newValue) => setTransactionDialogTab(newValue)}
                                textColor="secondary"
                                indicatorColor="secondary"
                                variant="fullWidth"
                                sx={{
                                  borderBottom: `1px solid ${colors.border}`,
                                  '& .MuiTab-root': {
                                    color: colors.textSecondary,
                                    fontWeight: 600
                                  },
                                  '& .Mui-selected': {
                                    color: colors.accentText
                                  }
                                }}
                              >
                                <Tab label="Transaction Info" value="transaction" />
                                <Tab label="Order Info" value="order" />
                              </Tabs>
                              <Box sx={{ p: 3 }}>
                                {transactionDialogTab === 'transaction' ? (
                                  <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                      <Typography variant="h6" sx={{ color: colors.accentText, fontWeight: 700 }}>
                                        Transaction Information
                                      </Typography>
                                      {(() => {
                                        // Ensure we always have a valid label for the expanded view
                                        let expandedLabel = typeChip?.label;
                                        
                                        if (!expandedLabel || expandedLabel.trim() === '') {
                                          if (transactionType === 'delivery_pay' || transactionType === 'delivery') {
                                            // Check if it's a driver payment (has driverWalletId or driverId that is not null/undefined)
                                            // CRITICAL: driverWalletId is the primary indicator for driver payments
                                            const isDriverPayment = (transaction?.driverWalletId != null && transaction?.driverWalletId !== undefined) ||
                                                                   (transaction?.driverId != null && transaction?.driverId !== undefined);
                                            expandedLabel = isDriverPayment ? 'Delivery Fee Payment (Driver)' : 'Delivery Fee Payment (Merchant)';
                                          } else if (transactionType && transactionType.trim() !== '') {
                                            expandedLabel = transactionType
                                              .split('_')
                                              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                                              .join(' ');
                                          } else {
                                            expandedLabel = 'Payment';
                                          }
                                        }
                                        
                                        // Determine chip styling based on transaction type
                                        let chipBackgroundColor = '#00E0B8';
                                        let chipColor = '#002A54';
                                        
                                        if (transactionType === 'tip') {
                                          chipBackgroundColor = '#FFC107';
                                          chipColor = '#000';
                                        } else                                         if (transactionType === 'delivery_pay' || transactionType === 'delivery') {
                                          // Check if it's a driver payment (has driverWalletId or driverId that is not null/undefined)
                                          // CRITICAL: driverWalletId is the primary indicator for driver payments
                                          const isDriverPayment = (transaction?.driverWalletId != null && transaction?.driverWalletId !== undefined) ||
                                                                 (transaction?.driverId != null && transaction?.driverId !== undefined);
                                          chipBackgroundColor = isDriverPayment ? '#FFC107' : '#2196F3';
                                          chipColor = isDriverPayment ? '#000' : '#002A54';
                                        }
                                        
                                        return (
                                          <Chip
                                            label={expandedLabel.toUpperCase()}
                                            size="small"
                                            sx={{
                                              backgroundColor: chipBackgroundColor,
                                              color: chipColor,
                                              fontWeight: 700
                                            }}
                                          />
                                        );
                                      })()}
                                    </Box>
                                    <Typography variant="body1" sx={{ mb: 1.5 }}>
                                      <strong>Transaction ID:</strong> #{transaction.id}
                                    </Typography>
                                    <Typography variant="body1" sx={{ mb: 1.5 }}>
                                      <strong>Amount:</strong> KES {Number(transaction.amount || 0).toFixed(2)}
                                    </Typography>
                                    <Typography variant="body1" sx={{ mb: 1.5 }}>
                                      <strong>Category:</strong> {getTransactionCategory(transactionType)}
                                    </Typography>
                                    <Typography variant="body1" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <strong>Status:</strong>
                                      {(() => {
                                        const statusChip = getTransactionStatusChipProps(transaction.status);
                                        return statusChip ? (
                                          <Chip size="small" {...statusChip} />
                                        ) : (
                                          <Typography variant="body1" color="text.secondary">
                                            {transaction.status || 'N/A'}
                                          </Typography>
                                        );
                                      })()}
                                    </Typography>
                                    {transaction.paymentProvider && (
                                      <Typography variant="body1" sx={{ mb: 1.5 }}>
                                        <strong>Payment Provider:</strong> {transaction.paymentProvider}
                                      </Typography>
                                    )}
                                    {transaction.phoneNumber && (
                                      <Typography variant="body1" sx={{ mb: 1.5 }}>
                                        <strong>Phone Number:</strong> {transaction.phoneNumber}
                                      </Typography>
                                    )}
                                    <Typography variant="body1" sx={{ mb: 1.5 }}>
                                      <strong>Transaction Date:</strong>{' '}
                                      {new Date(transaction.transactionDate || transaction.createdAt).toLocaleString()}
                                    </Typography>
                                  </Box>
                                ) : (
                                  <Box>
                                    <Typography variant="h6" sx={{ color: colors.accentText, fontWeight: 700, mb: 2 }}>
                                      Order Information
                                    </Typography>
                                    {transaction.order ? (
                                      <>
                                        <Typography variant="body1" sx={{ mb: 1.5 }}>
                                          <strong>Order ID:</strong> #{transaction.order.id || transaction.orderId}
                                        </Typography>
                                        <Typography variant="body1" sx={{ mb: 1.5 }}>
                                          <strong>Customer Name:</strong> {transaction.order.customerName || 'N/A'}
                                        </Typography>
                                        {transaction.order.customerEmail && (
                                          <Typography variant="body1" sx={{ mb: 1.5 }}>
                                            <strong>Customer Email:</strong> {transaction.order.customerEmail}
                                          </Typography>
                                        )}
                                        {transaction.order.customerPhone && (
                                          <Typography variant="body1" sx={{ mb: 1.5 }}>
                                            <strong>Customer Phone:</strong> {transaction.order.customerPhone}
                                          </Typography>
                                        )}
                                        <Typography variant="body1" sx={{ mb: 1.5 }}>
                                          <strong>Order Total:</strong> KES {Number(transaction.order.totalAmount || 0).toFixed(2)}
                                        </Typography>
                                        <Typography variant="body1" sx={{ mb: 1.5 }}>
                                          <strong>Order Status:</strong> {transaction.order.status || 'N/A'}
                                        </Typography>
                                        <Typography variant="body1" sx={{ mb: 1.5 }}>
                                          <strong>Payment Method:</strong> {getPaymentMethodLabel(transaction.paymentMethod, transaction.paymentProvider)}
                                        </Typography>
                                      </>
                                    ) : (
                                      <Typography variant="body1" color="text.secondary">
                                        Order information not available
                                      </Typography>
                                    )}
                                  </Box>
                                )}
                              </Box>
                            </Paper>
                          </Grid>
                          {transaction.notes && (
                            <Grid item xs={12}>
                              <Paper sx={{ p: 2, backgroundColor: colors.paper }}>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                  Notes
                                </Typography>
                                <Divider sx={{ my: 1, borderColor: colors.border }} />
                                <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                                  {transaction.notes}
                                </Typography>
                              </Paper>
                            </Grid>
                          )}
                        </Grid>
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={displayTransactions.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50, 100]}
            sx={{
              borderTop: `1px solid ${colors.border}`,
              '& .MuiTablePagination-toolbar': {
                color: colors.textPrimary,
              },
              '& .MuiTablePagination-selectLabel': {
                color: colors.textPrimary,
              },
              '& .MuiTablePagination-displayedRows': {
                color: colors.textPrimary,
              },
              '& .MuiTablePagination-select': {
                color: colors.textPrimary,
              },
              '& .MuiTablePagination-selectIcon': {
                color: colors.textPrimary,
              },
              '& .MuiIconButton-root': {
                color: colors.textPrimary,
                '&:disabled': {
                  color: colors.textSecondary,
                },
              },
            }}
          />
        </TableContainer>
      )}
      </>
      )}

      {/* Cash Submissions Tables - Removed, moved to Cash at Hand page */}

      {/* Transaction Details Dialog */}
      <Dialog
        open={selectedTransaction !== null}
        onClose={() => {
          setSelectedTransaction(null);
          setTransactionDialogTab('transaction');
        }}
        maxWidth="md"
        fullWidth
      >
        {selectedTransaction && (
          <>
            <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>
              Transaction Details #{selectedTransaction.id}
            </DialogTitle>
            <DialogContent
              sx={{
                '& .MuiTypography-body1': { fontSize: '1rem' },
                '& .MuiTypography-body2': { fontSize: '0.95rem' },
                '& .MuiTypography-caption': { fontSize: '0.85rem' }
              }}
            >
              <Tabs
                value={transactionDialogTab}
                onChange={(_event, newValue) => setTransactionDialogTab(newValue)}
                textColor="secondary"
                indicatorColor="secondary"
                variant="fullWidth"
                sx={{
                  mb: 3,
                  borderBottom: `1px solid ${colors.border}`,
                  '& .MuiTab-root': {
                    color: colors.textSecondary,
                    fontWeight: 600,
                    fontSize: '0.95rem'
                  },
                  '& .Mui-selected': {
                    color: colors.accentText
                  }
                }}
              >
                <Tab label="Transaction Info" value="transaction" />
                <Tab label="Order Info" value="order" />
              </Tabs>

              {transactionDialogTab === 'transaction' ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
                  <Typography variant="body1"><strong>Transaction ID:</strong> #{selectedTransaction.id}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body1"><strong>Transaction Type:</strong></Typography>
                    {(() => {
                      const dialogTransactionType = selectedTransaction?.transactionType || 'payment';
                      const typeChipRaw = getTransactionTypeChipProps(dialogTransactionType);
                      let typeChip = typeof typeChipRaw === 'function'
                        ? typeChipRaw(selectedTransaction)
                        : typeChipRaw;
                      
                      // Ensure we always have a valid label
                      let chipLabel = typeChip?.label;
                      let chipSx = typeChip?.sx;
                      
                      if (!chipLabel || chipLabel.trim() === '') {
                        if (dialogTransactionType === 'delivery_pay' || dialogTransactionType === 'delivery') {
                          // Check if it's a driver payment (has driverWalletId or driverId that is not null/undefined)
                          // CRITICAL: driverWalletId is the primary indicator for driver payments
                          const isDriverPayment = (selectedTransaction?.driverWalletId != null && selectedTransaction?.driverWalletId !== undefined) ||
                                                 (selectedTransaction?.driverId != null && selectedTransaction?.driverId !== undefined);
                          chipLabel = isDriverPayment ? 'Delivery Fee Payment (Driver)' : 'Delivery Fee Payment (Merchant)';
                          chipSx = {
                            backgroundColor: isDriverPayment ? '#FFC107' : '#2196F3',
                            color: isDriverPayment ? '#000' : '#002A54',
                            fontWeight: 700
                          };
                        } else if (dialogTransactionType && dialogTransactionType.trim() !== '') {
                          chipLabel = dialogTransactionType
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
                      
                      return (
                        <Chip 
                          size="small" 
                          label={chipLabel} 
                          sx={{ fontWeight: 700, ...(chipSx || {
                            backgroundColor: '#616161',
                            color: '#FFFFFF',
                            fontWeight: 600
                          }) }} 
                        />
                      );
                    })()}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body1"><strong>Payment Method:</strong></Typography>
                    {(() => {
                      const methodChip = getPaymentMethodChipProps(selectedTransaction.paymentMethod);
                      return methodChip ? (
                        <Chip size="small" label={methodChip.label} sx={{ fontWeight: 700, ...methodChip.sx }} />
                      ) : (
                        <Typography variant="body1">
                          {getPaymentMethodLabel(selectedTransaction.paymentMethod, selectedTransaction.paymentProvider)}
                        </Typography>
                      );
                    })()}
                  </Box>
                  {selectedTransaction.paymentProvider && (
                    <Typography variant="body1">
                      <strong>Payment Provider:</strong> {selectedTransaction.paymentProvider}
                    </Typography>
                  )}
                  <Typography variant="body1">
                    <strong>Amount:</strong> KES {Number(selectedTransaction.amount || 0).toFixed(2)}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body1"><strong>Status:</strong></Typography>
                    {(() => {
                      const statusChip = getTransactionStatusChipProps(selectedTransaction.status);
                      return statusChip ? (
                        <Chip size="small" {...statusChip} />
                      ) : (
                        <Typography variant="body1">{selectedTransaction.status || 'N/A'}</Typography>
                      );
                    })()}
                  </Box>
                  {selectedTransaction.receiptNumber && (
                    <Typography variant="body1">
                      <strong>Receipt Number:</strong> {selectedTransaction.receiptNumber}
                    </Typography>
                  )}
                  {selectedTransaction.phoneNumber && (
                    <Typography variant="body1">
                      <strong>Phone Number:</strong> {selectedTransaction.phoneNumber}
                    </Typography>
                  )}
                  <Typography variant="body1">
                    <strong>Transaction Date:</strong> {formatDateTime(selectedTransaction.transactionDate || selectedTransaction.createdAt)}
                  </Typography>
                  <Typography variant="body1">
                    <strong>Created:</strong> {formatDateTime(selectedTransaction.createdAt)}
                  </Typography>
                  <Typography variant="body1">
                    <strong>Last Updated:</strong> {formatDateTime(selectedTransaction.updatedAt)}
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
                  {selectedTransaction.order ? (
                    <>
                      <Typography variant="body1"><strong>Order ID:</strong> #{selectedTransaction.order.id}</Typography>
                      {selectedTransaction.order.customerName && (
                        <Typography variant="body1"><strong>Customer Name:</strong> {selectedTransaction.order.customerName}</Typography>
                      )}
                      {selectedTransaction.order.customerPhone && (
                        <Typography variant="body1"><strong>Customer Phone:</strong> {selectedTransaction.order.customerPhone}</Typography>
                      )}
                      {selectedTransaction.order.customerEmail && (
                        <Typography variant="body1"><strong>Customer Email:</strong> {selectedTransaction.order.customerEmail}</Typography>
                      )}
                      {selectedTransaction.order.driver && selectedTransaction.order.driver.name && (
                        <Typography variant="body1"><strong>Driver Name:</strong> {selectedTransaction.order.driver.name}</Typography>
                      )}
                      {selectedTransaction.order.driver && selectedTransaction.order.driver.phoneNumber && (
                        <Typography variant="body1"><strong>Driver Phone:</strong> {selectedTransaction.order.driver.phoneNumber}</Typography>
                      )}
                      <Typography variant="body1">
                        <strong>Order Total:</strong> KES {Number(selectedTransaction.order.totalAmount || 0).toFixed(2)}
                      </Typography>
                      <Typography variant="body1">
                        <strong>Order Status:</strong> {selectedTransaction.order.status || 'N/A'}
                      </Typography>
                      <Typography variant="body1">
                        <strong>Payment Method:</strong> {getPaymentMethodLabel(selectedTransaction.paymentMethod, selectedTransaction.paymentProvider)}
                      </Typography>
                      {(() => {
                        if (!selectedTransaction.order.notes) {
                          return null;
                        }
                        const sanitizedNotes = selectedTransaction.order.notes.replace(/✅/g, '').trim();
                        if (!sanitizedNotes) {
                          return null;
                        }
                        return (
                          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                            <strong>Notes:</strong>
                            {'\n'}{sanitizedNotes}
                          </Typography>
                        );
                      })()}
                    </>
                  ) : (
                    <Typography variant="body1" color="text.secondary">
                      Order information not available
                    </Typography>
                  )}
                </Box>
              )}

              {selectedTransaction.notes && transactionDialogTab === 'transaction' && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" sx={{ color: colors.accentText, fontWeight: 700, mb: 1 }}>
                    Notes
                  </Typography>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                    {selectedTransaction.notes}
                  </Typography>
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => {
                setSelectedTransaction(null);
                setTransactionDialogTab('transaction');
              }} sx={{ color: '#FF3366' }}>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Create Cash Submission Dialog */}
      <Dialog
        open={createSubmissionDialogOpen}
        onClose={() => {
          setCreateSubmissionDialogOpen(false);
          setSubmissionFormData({ submissionType: 'cash', amount: '', details: {}, orderIds: [] });
          setAvailableOrders([]);
        }}
        TransitionProps={{
          onEnter: () => {
            // Fetch orders when dialog opens
            fetchOrdersForSelection();
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>
          Create Cash Submission
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Submission Type</InputLabel>
              <Select
                value={submissionFormData.submissionType}
                onChange={(e) => setSubmissionFormData({ ...submissionFormData, submissionType: e.target.value, details: {}, orderIds: submissionFormData.orderIds || [] })}
                label="Submission Type"
              >
                <MenuItem value="cash">Cash</MenuItem>
                <MenuItem value="purchases">Purchases</MenuItem>
                <MenuItem value="general_expense">General Expense</MenuItem>
                <MenuItem value="payment_to_office">Payment to Office</MenuItem>
                <MenuItem value="walk_in_sale">Walk-In Sale</MenuItem>
              </Select>
            </FormControl>

            {/* Order Selection - Moved to second position */}
            <Autocomplete
              multiple
              options={availableOrders}
              getOptionLabel={(option) => {
                const orderId = option.id || option;
                const customerName = option.customerName || 'Unknown';
                const totalAmount = option.totalAmount || 0;
                return `Order #${orderId} - ${customerName} (KES ${parseFloat(totalAmount).toFixed(2)})`;
              }}
              value={availableOrders.filter(order => (submissionFormData?.orderIds || []).includes(order.id))}
              onChange={(event, newValue) => {
                // Calculate total from selected orders
                const totalAmount = newValue.reduce((sum, order) => {
                  return sum + parseFloat(order.totalAmount || 0);
                }, 0);
                
                setSubmissionFormData({
                  ...submissionFormData,
                  orderIds: newValue.map(order => order.id),
                  amount: totalAmount > 0 ? totalAmount.toFixed(2) : ''
                });
              }}
              loading={loadingOrders}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Associated Orders (Optional)"
                  placeholder="Select orders to associate with this cash submission"
                  helperText="Select orders to automatically calculate the total amount"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingOrders ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Order #{option.id} - {option.customerName || 'Unknown'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      KES {parseFloat(option.totalAmount || 0).toFixed(2)} • {option.status || 'unknown'}
                    </Typography>
                  </Box>
                </li>
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={option.id}
                    label={`Order #${option.id}`}
                    size="small"
                    icon={<ShoppingCart />}
                  />
                ))
              }
            />

            <TextField
              label="Amount (KES)"
              type="number"
              value={submissionFormData.amount}
              onChange={(e) => setSubmissionFormData({ ...submissionFormData, amount: e.target.value })}
              fullWidth
              required
              helperText={submissionFormData.orderIds && submissionFormData.orderIds.length > 0 
                ? `Total from ${submissionFormData.orderIds.length} selected order(s)` 
                : 'Enter amount or select orders to auto-calculate'}
            />

            {submissionFormData.submissionType === 'cash' && (
              <TextField
                label="Recipient"
                value={submissionFormData.details.recipientName || ''}
                onChange={(e) => setSubmissionFormData({
                  ...submissionFormData,
                  details: { ...submissionFormData.details, recipientName: e.target.value }
                })}
                fullWidth
                required
                helperText="The person who received the cash submission"
              />
            )}

            {submissionFormData.submissionType === 'purchases' && (
              <>
                <TextField
                  label="Supplier"
                  value={submissionFormData.details.supplier || ''}
                  onChange={(e) => setSubmissionFormData({
                    ...submissionFormData,
                    details: { ...submissionFormData.details, supplier: e.target.value }
                  })}
                  fullWidth
                  required
                />
                <TextField
                  label="Item"
                  value={submissionFormData.details.item || ''}
                  onChange={(e) => setSubmissionFormData({
                    ...submissionFormData,
                    details: { ...submissionFormData.details, item: e.target.value }
                  })}
                  fullWidth
                  required
                />
                <TextField
                  label="Price"
                  type="number"
                  value={submissionFormData.details.price || ''}
                  onChange={(e) => setSubmissionFormData({
                    ...submissionFormData,
                    details: { ...submissionFormData.details, price: e.target.value }
                  })}
                  fullWidth
                  required
                />
                <TextField
                  label="Delivery Location"
                  value={submissionFormData.details.deliveryLocation || ''}
                  onChange={(e) => setSubmissionFormData({
                    ...submissionFormData,
                    details: { ...submissionFormData.details, deliveryLocation: e.target.value }
                  })}
                  fullWidth
                  required
                />
              </>
            )}

            {submissionFormData.submissionType === 'general_expense' && (
              <TextField
                label="Nature of Expense"
                value={submissionFormData.details.nature || ''}
                onChange={(e) => setSubmissionFormData({
                  ...submissionFormData,
                  details: { ...submissionFormData.details, nature: e.target.value }
                })}
                fullWidth
                required
              />
            )}

            {submissionFormData.submissionType === 'payment_to_office' && (
              <FormControl fullWidth>
                <InputLabel>Account Type</InputLabel>
                <Select
                  value={submissionFormData.details.accountType || ''}
                  onChange={(e) => setSubmissionFormData({
                    ...submissionFormData,
                    details: { ...submissionFormData.details, accountType: e.target.value }
                  })}
                  label="Account Type"
                  required
                >
                  <MenuItem value="mpesa">M-Pesa</MenuItem>
                  <MenuItem value="till">Till</MenuItem>
                  <MenuItem value="bank">Bank</MenuItem>
                  <MenuItem value="paybill">Paybill</MenuItem>
                  <MenuItem value="pdq">PDQ</MenuItem>
                </Select>
              </FormControl>
            )}

          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => {
              setCreateSubmissionDialogOpen(false);
              setSubmissionFormData({ submissionType: 'cash', amount: '', details: {}, orderIds: [] });
            }}
            sx={{ color: colors.textSecondary }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateSubmission}
            variant="contained"
            sx={{
              backgroundColor: colors.accentText,
              color: '#FFFFFF',
              fontWeight: 600,
              '&:hover': { 
                backgroundColor: '#00C4A3',
                color: '#FFFFFF'
              }
            }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Transactions;

