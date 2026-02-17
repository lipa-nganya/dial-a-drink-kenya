import React, { useEffect, useState } from 'react';
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
  IconButton,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Grid,
  TablePagination,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  People,
  Visibility,
  VpnKey,
  VisibilityOff,
  Refresh,
  ContentCopy,
  Search,
  Clear
} from '@mui/icons-material';
import {
  getOrderStatusChipProps,
  getPaymentStatusChipProps,
  getPaymentMethodChipProps,
  getTransactionTypeChipProps,
  getTransactionStatusChipProps
} from '../utils/chipStyles';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const formatCurrency = (value) => `KES ${(Number(value || 0)).toLocaleString('en-KE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`;

const formatDateTime = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-KE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const Customers = () => {
  const { colors } = useTheme();
  // Ensure customers is always initialized as an array
  const [customers, setCustomers] = useState(() => []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [customerOtps, setCustomerOtps] = useState({});
  const [showOtps, setShowOtps] = useState({});
  const [loadingOtps, setLoadingOtps] = useState({});
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailTab, setDetailTab] = useState(0);
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCustomers, setTotalCustomers] = useState(0);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Debounce search input - update searchQuery after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(0); // Reset to first page when search changes
    }, 500); // 500ms debounce delay

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchCustomers();
  }, [page, rowsPerPage, searchQuery]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError('');
      const params = {
        page: page + 1, // Backend uses 1-based pagination
        limit: rowsPerPage
      };
      
      // Add search query if provided
      if (searchQuery && searchQuery.trim() !== '') {
        params.search = searchQuery.trim();
      }
      
      const response = await api.get('/admin/customers', { params });
      
      // Defensive: Always ensure we have a valid response
      if (!response || !response.data) {
        console.warn('Invalid response from /admin/customers:', response);
        setCustomers([]);
        setTotalCustomers(0);
        return;
      }
      
      // Handle both paginated and non-paginated responses
      if (response.data.customers && Array.isArray(response.data.customers) && typeof response.data.total === 'number') {
        // Paginated response: { customers: [...], total: N, page: P, limit: L }
        setCustomers(response.data.customers);
        setTotalCustomers(response.data.total);
      } else if (Array.isArray(response.data)) {
        // Non-paginated response (fallback): direct array
        setCustomers(response.data);
        setTotalCustomers(response.data.length);
      } else if (response.data.data && Array.isArray(response.data.data)) {
        // Wrapped response: { data: [...] }
        setCustomers(response.data.data);
        setTotalCustomers(response.data.data.length);
      } else {
        // Fallback: ensure customers is always an array
        console.warn('Unexpected response format from /admin/customers:', {
          data: response.data,
          type: typeof response.data,
          isArray: Array.isArray(response.data),
          keys: response.data ? Object.keys(response.data) : []
        });
        setCustomers([]);
        setTotalCustomers(0);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError(err.response?.data?.error || 'Failed to load customers');
      // Ensure customers is always an array even on error
      setCustomers([]);
      setTotalCustomers(0);
    } finally {
      setLoading(false);
    }
  };
  
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0); // Reset to first page when changing rows per page
  };

  const handleSearchChange = (event) => {
    setSearchInput(event.target.value);
    // searchQuery will be updated automatically via debounce useEffect
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    setPage(0);
  };

  const fetchCustomerDetails = async (customerId) => {
    try {
      setDetailsLoading(true);
      setDetailError('');
      const response = await api.get(`/admin/customers/${customerId}`);
      setCustomerDetails(response.data);
    } catch (err) {
      console.error('Error fetching customer details:', err);
      setDetailError(err.response?.data?.error || 'Failed to load customer details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const fetchCustomerOtp = async (customerId) => {
    try {
      setLoadingOtps((prev) => ({ ...prev, [customerId]: true }));
      const response = await api.get(`/admin/customers/${customerId}/latest-otp`);
      setCustomerOtps((prev) => ({ ...prev, [customerId]: response.data }));
    } catch (err) {
      console.error('Error fetching customer OTP:', err);
      setCustomerOtps((prev) => ({
        ...prev,
        [customerId]: { hasOtp: false, error: 'Failed to fetch OTP' }
      }));
    } finally {
      setLoadingOtps((prev) => ({ ...prev, [customerId]: false }));
    }
  };

  const toggleOtpVisibility = (customer) => {
    const customerId = customer.id;
    setShowOtps((prev) => ({ ...prev, [customerId]: !prev[customerId] }));

    if (!customerOtps[customerId]) {
      fetchCustomerOtp(customerId);
    }
  };

  const handleOpenDetails = (customer) => {
    setSelectedCustomer(customer);
    setCustomerDetails(null);
    setDetailTab(0);
    fetchCustomerDetails(customer.id);
  };

  const handleCloseDetails = () => {
    setSelectedCustomer(null);
    setCustomerDetails(null);
    setDetailError('');
  };

  const handleCopyOtp = (customerId) => {
    const otpInfo = customerOtps[customerId];
    if (otpInfo?.otpCode) {
      navigator.clipboard.writeText(otpInfo.otpCode).catch((err) => {
        console.error('Failed to copy OTP:', err);
      });
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <People sx={{ color: colors.accentText, fontSize: 40 }} />
        <Box>
          <Typography variant="h4" sx={{ color: colors.accentText, fontWeight: 700 }}>
            Customers
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Customers who have logged in and placed orders
          </Typography>
        </Box>
      </Box>

      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 300, maxWidth: 500 }}>
          <TextField
            fullWidth
            placeholder="Search by name, phone, email, or username..."
            value={searchInput}
            onChange={handleSearchChange}
            variant="outlined"
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: colors.textSecondary }} />
                </InputAdornment>
              ),
              endAdornment: searchInput && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={handleClearSearch}
                    sx={{ color: colors.textSecondary }}
                  >
                    <Clear />
                  </IconButton>
                </InputAdornment>
              ),
              sx: {
                backgroundColor: colors.paper,
                color: colors.textPrimary,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: colors.border
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: colors.accentText
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: colors.accentText
                }
              }
            }}
            sx={{
              '& .MuiInputBase-input': {
                color: colors.textPrimary
              },
              '& .MuiInputBase-input::placeholder': {
                color: colors.textSecondary,
                opacity: 1
              }
            }}
          />
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchCustomers}
          disabled={loading}
          sx={{
            borderColor: colors.accentText,
            color: colors.accentText,
            '&:hover': {
              borderColor: '#00C4A3',
              backgroundColor: 'rgba(0, 224, 184, 0.1)'
            }
          }}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: colors.accentText }}>Customer</TableCell>
                <TableCell sx={{ color: colors.accentText }}>Contact</TableCell>
                <TableCell sx={{ color: colors.accentText }}>Orders</TableCell>
                <TableCell sx={{ color: colors.accentText }}>Total Spent</TableCell>
                <TableCell sx={{ color: colors.accentText }}>Date Joined</TableCell>
                <TableCell sx={{ color: colors.accentText }}>OTP</TableCell>
                <TableCell sx={{ color: colors.accentText }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.isArray(customers) && customers.length > 0 ? (
                customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                      {customer.name || 'Customer'}
                      <Typography variant="caption" display="block" color="text.secondary">
                        {customer.username}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ color: colors.textPrimary }}>
                      {customer.phone && (
                        <Typography variant="body2" color="text.secondary">
                          {customer.phone}
                        </Typography>
                      )}
                      {customer.email && (
                        <Typography variant="body2" color="text.secondary">
                          {customer.email}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ color: colors.textPrimary }}>
                      <Chip
                        label={`${customer.totalOrders || 0}`}
                        color={customer.totalOrders > 0 ? 'success' : 'default'}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                      {customer.lastOrderAt && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          Last: {formatDate(new Date(customer.lastOrderAt))}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ color: colors.textPrimary }}>
                      {formatCurrency(customer.totalSpent || 0)}
                    </TableCell>
                    <TableCell sx={{ color: colors.textPrimary }}>
                      {formatDate(customer.dateJoined || customer.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Toggle OTP">
                        <span>
                          <IconButton
                            onClick={() => toggleOtpVisibility(customer)}
                            size="small"
                            sx={{ color: colors.accentText }}
                          >
                            {showOtps[customer.id] ? <VisibilityOff /> : <VpnKey />}
                          </IconButton>
                        </span>
                      </Tooltip>
                      {loadingOtps[customer.id] && <CircularProgress size={16} sx={{ ml: 1 }} />}
                      {showOtps[customer.id] && customerOtps[customer.id] && (
                        <Box sx={{ mt: 1 }}>
                          {customerOtps[customer.id].hasOtp ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                                OTP: {customerOtps[customer.id].otpCode}
                              </Typography>
                              <Tooltip title="Copy OTP">
                                <IconButton
                                  size="small"
                                  onClick={() => handleCopyOtp(customer.id)}
                                  sx={{ color: colors.accentText }}
                                >
                                  <ContentCopy fontSize="inherit" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              {customerOtps[customer.id].message || customerOtps[customer.id].error || 'No active OTP'}
                            </Typography>
                          )}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<Visibility />}
                        onClick={() => handleOpenDetails(customer)}
                        sx={{
                          borderColor: colors.accentText,
                          color: colors.accentText,
                          '&:hover': {
                            borderColor: '#00C4A3',
                            backgroundColor: 'rgba(0, 224, 184, 0.1)'
                          }
                        }}
                      >
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} sx={{ color: colors.textSecondary, textAlign: 'center', py: 4 }}>
                    {loading ? 'Loading customers...' : 'No customers found.'}
                  </TableCell>
                </TableRow>
              )}

              {Array.isArray(customers) && customers.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ color: colors.textSecondary, textAlign: 'center', py: 4 }}>
                    No customers found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={totalCustomers}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50, 100]}
            sx={{
              color: colors.textPrimary,
              '& .MuiTablePagination-toolbar': {
                color: colors.textPrimary
              },
              '& .MuiTablePagination-selectLabel': {
                color: colors.textPrimary
              },
              '& .MuiTablePagination-displayedRows': {
                color: colors.textPrimary
              },
              '& .MuiIconButton-root': {
                color: colors.textPrimary,
                '&.Mui-disabled': {
                  color: colors.textSecondary
                }
              },
              '& .MuiSelect-root': {
                color: colors.textPrimary
              }
            }}
          />
        </TableContainer>
      )}

      <Dialog
        open={Boolean(selectedCustomer)}
        onClose={handleCloseDetails}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Customer Profile
            </Typography>
            {selectedCustomer && (
              <Typography variant="body2" color="text.secondary">
                {selectedCustomer.name || selectedCustomer.username}
              </Typography>
            )}
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ backgroundColor: colors.paper }}>
          {detailsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : detailError ? (
            <Alert severity="error">{detailError}</Alert>
          ) : customerDetails ? (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
                    <Typography variant="caption" color="text.secondary">Total Orders</Typography>
                    <Typography variant="h6" sx={{ color: colors.accentText, fontWeight: 700 }}>
                      {customerDetails.stats.totalOrders}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
                    <Typography variant="caption" color="text.secondary">Total Spent</Typography>
                    <Typography variant="h6" sx={{ color: colors.accentText, fontWeight: 700 }}>
                      {formatCurrency(customerDetails.stats.totalSpent)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
                    <Typography variant="caption" color="text.secondary">Date Joined</Typography>
                    <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 700 }}>
                      {formatDate(customerDetails.stats.dateJoined)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
                    <Typography variant="caption" color="text.secondary">Last Order</Typography>
                    <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 700 }}>
                      {customerDetails.stats.lastOrderAt ? formatDateTime(customerDetails.stats.lastOrderAt) : '—'}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Tabs
                value={detailTab}
                onChange={(event, newValue) => setDetailTab(newValue)}
                textColor="inherit"
                sx={{ mb: 2 }}
              >
                <Tab label="Orders" />
                <Tab label="Transactions" />
              </Tabs>

              {detailTab === 0 && (
                <TableContainer component={Paper} sx={{ backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: colors.accentText }}>Order #</TableCell>
                        <TableCell sx={{ color: colors.accentText }}>Status</TableCell>
                        <TableCell sx={{ color: colors.accentText }}>Payment</TableCell>
                        <TableCell sx={{ color: colors.accentText }} align="right">Amount</TableCell>
                        <TableCell sx={{ color: colors.accentText }} align="right">Created</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {customerDetails.orders.map((order) => {
                        const statusChip = getOrderStatusChipProps(order.status);
                        const paymentStatusChip = getPaymentStatusChipProps(order.paymentStatus, order.status);
                        const paymentMethodChip = getPaymentMethodChipProps(order.paymentMethod);

                        return (
                          <TableRow key={order.id}>
                            <TableCell sx={{ color: colors.textPrimary }}>#{order.orderNumber}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                {...statusChip}
                                sx={{ fontWeight: 600 }}
                              />
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {paymentStatusChip ? (
                                  <Chip
                                    size="small"
                                    {...paymentStatusChip}
                                    sx={{ fontWeight: 600 }}
                                  />
                                ) : (
                                  <Typography variant="body2" sx={{ color: colors.textPrimary }}>—</Typography>
                                )}
                                {paymentMethodChip && (
                                  <Chip
                                    size="small"
                                    label={paymentMethodChip.label}
                                    sx={{ fontWeight: 600, ...paymentMethodChip.sx }}
                                  />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell sx={{ color: colors.textPrimary }} align="right">
                              {formatCurrency(order.totalAmount)}
                            </TableCell>
                            <TableCell sx={{ color: colors.textPrimary }} align="right">
                              {formatDateTime(order.createdAt)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {customerDetails.orders.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} sx={{ color: colors.textSecondary, textAlign: 'center' }}>
                            No orders found for this customer.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {detailTab === 1 && (
                <TableContainer component={Paper} sx={{ backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: colors.accentText }}>Order #</TableCell>
                        <TableCell sx={{ color: colors.accentText }}>Type</TableCell>
                        <TableCell sx={{ color: colors.accentText }}>Payment Method</TableCell>
                        <TableCell sx={{ color: colors.accentText }} align="right">Amount</TableCell>
                        <TableCell sx={{ color: colors.accentText }}>Status</TableCell>
                        <TableCell sx={{ color: colors.accentText }} align="right">Created</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {customerDetails.transactions.map((txn) => {
                        const txnTypeChip = getTransactionTypeChipProps(txn.transactionType);
                        const txnMethodChip = getPaymentMethodChipProps(txn.paymentMethod);
                        const txnStatusChip = getTransactionStatusChipProps(txn.status || txn.paymentStatus);
                        const isTip = (txn.transactionType || '').toLowerCase() === 'tip';

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
                            <TableCell sx={{ color: colors.textPrimary }}>#{txn.orderId}</TableCell>
                            <TableCell>
                              {txnTypeChip ? (
                                <Chip
                                  size="small"
                                  label={typeof txnTypeChip === 'function' ? (txnTypeChip(txn).label) : txnTypeChip.label}
                                  sx={{ fontWeight: 700, ...(typeof txnTypeChip === 'function' ? txnTypeChip(txn).sx : txnTypeChip.sx) }}
                                />
                              ) : (
                                <Typography variant="body2" sx={{ color: colors.textPrimary }}>—</Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              {txnMethodChip ? (
                                <Chip
                                  size="small"
                                  label={txnMethodChip.label}
                                  sx={{ fontWeight: 700, ...txnMethodChip.sx }}
                                />
                              ) : (
                                <Typography variant="body2" sx={{ color: colors.textPrimary }}>—</Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ color: colors.textPrimary }} align="right">
                              {formatCurrency(txn.amount)}
                            </TableCell>
                            <TableCell>
                              {txnStatusChip ? (
                                <Chip
                                  size="small"
                                  {...txnStatusChip}
                                  sx={{ fontWeight: 600 }}
                                />
                              ) : (
                                <Typography variant="body2" sx={{ color: colors.textPrimary }}>—</Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ color: colors.textPrimary }} align="right">
                              {formatDateTime(txn.createdAt)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {customerDetails.transactions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} sx={{ color: colors.textSecondary, textAlign: 'center' }}>
                            No transactions found for this customer.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetails} sx={{ color: 'text.secondary' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Customers;
