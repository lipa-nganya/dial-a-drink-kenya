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
  Chip,
  Alert,
  CircularProgress,
  TextField,
  InputAdornment,
  IconButton,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
  Grid
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  AccessTime,
  Warning,
  Search,
  AttachMoney,
  Phone,
  Receipt,
  Info,
  ExpandMore,
  ExpandLess,
  CalendarToday,
  Clear
} from '@mui/icons-material';
import { api } from '../../services/api';

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    filterTransactions();
  }, [searchTerm, startDate, endDate, transactions]);

  const fetchTransactions = async () => {
    try {
      const response = await api.get('/admin/transactions');
      setTransactions(response.data);
      setFilteredTransactions(response.data);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setError(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
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
  };

  const handleClearDateFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'pending': return 'warning';
      case 'failed': return 'error';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle />;
      case 'pending': return <AccessTime />;
      case 'failed': return <Cancel />;
      case 'cancelled': return <Cancel />;
      default: return <AccessTime />;
    }
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

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading transactions...</Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">Error loading transactions: {error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Receipt sx={{ color: '#00E0B8', fontSize: 40 }} />
          <Typography variant="h4" component="h1" gutterBottom sx={{ color: '#00E0B8', fontWeight: 700 }}>
            Transactions
          </Typography>
        </Box>
        <Typography variant="h6" color="text.secondary">
          Track all payment transactions
        </Typography>
      </Box>

      {/* Summary Stats */}
      <Box sx={{ mb: 4, display: 'flex', gap: 2 }}>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="body2" color="text.secondary">Total Transactions</Typography>
          <Typography variant="h5" sx={{ color: '#00E0B8', fontWeight: 700 }}>
            {filteredTransactions.length}
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="body2" color="text.secondary">Completed</Typography>
          <Typography variant="h5" sx={{ color: '#00E0B8', fontWeight: 700 }}>
            {filteredTransactions.filter(t => t.status === 'completed').length}
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="body2" color="text.secondary">Total Amount</Typography>
          <Typography variant="h5" sx={{ color: '#FF3366', fontWeight: 700 }}>
            KES {filteredTransactions
              .filter(t => t.status === 'completed')
              .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
              .toFixed(2)}
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="body2" color="text.secondary">Pending/Failed</Typography>
          <Typography variant="h5" sx={{ color: '#FF3366', fontWeight: 700 }}>
            {filteredTransactions.filter(t => t.status === 'pending' || t.status === 'failed').length}
          </Typography>
        </Paper>
      </Box>

      {/* Date Range Filters */}
      <Paper sx={{ p: 2, mb: 3, backgroundColor: '#121212' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarToday sx={{ color: '#00E0B8' }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#00E0B8' }}>
              Filter by Date:
            </Typography>
          </Box>
          <TextField
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
            sx={{
              width: 180,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#00E0B8' },
                '&:hover fieldset': { borderColor: '#00E0B8' },
                '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
              },
              '& .MuiInputBase-input': {
                color: '#F5F5F5'
              }
            }}
          />
          <TextField
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
            sx={{
              width: 180,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#00E0B8' },
                '&:hover fieldset': { borderColor: '#00E0B8' },
                '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
              },
              '& .MuiInputBase-input': {
                color: '#F5F5F5'
              }
            }}
          />
          {(startDate || endDate) && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<Clear />}
              onClick={handleClearDateFilters}
              sx={{
                borderColor: '#666',
                color: '#F5F5F5',
                '&:hover': {
                  borderColor: '#888',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)'
                }
              }}
            >
              Clear Dates
            </Button>
          )}
          {(startDate || endDate) && (
            <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
              Showing transactions from {startDate || 'beginning'} to {endDate || 'today'}
            </Typography>
          )}
        </Box>
      </Paper>

      {/* Search */}
      <Box sx={{ mb: 3 }}>
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
              '& fieldset': { borderColor: '#00E0B8' },
              '&:hover fieldset': { borderColor: '#00E0B8' },
              '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
            }
          }}
        />
      </Box>

      {filteredTransactions.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Receipt sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            {searchTerm ? 'No transactions found matching your search' : 'No transactions found'}
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }} width="40px"></TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }}>Transaction ID</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }}>Order ID</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }}>Customer</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }}>Payment Method</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }}>Amount</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }}>Receipt Number</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }}>Phone</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTransactions.map((transaction) => {
                const isExpanded = expandedRows.has(transaction.id);
                return (
                  <React.Fragment key={transaction.id}>
                    <TableRow
                      sx={{
                        '&:hover': {
                          backgroundColor: 'rgba(0, 224, 184, 0.05)'
                        }
                      }}
                    >
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => toggleRowExpansion(transaction.id)}
                          sx={{ color: '#00E0B8' }}
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
                    <Typography variant="body2">
                      {getPaymentMethodLabel(transaction.paymentMethod, transaction.paymentProvider)}
                    </Typography>
                    {transaction.paymentProvider && (
                      <Typography variant="caption" color="text.secondary">
                        {transaction.paymentProvider}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#FF3366' }}>
                      KES {Number(transaction.amount).toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={getStatusIcon(transaction.status)}
                      label={transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                      color={getStatusColor(transaction.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {transaction.receiptNumber ? (
                      <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Receipt fontSize="small" />
                        {transaction.receiptNumber}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        N/A
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {transaction.phoneNumber ? (
                      <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Phone fontSize="small" />
                        {transaction.phoneNumber}
                      </Typography>
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
                      sx={{ color: '#00E0B8' }}
                    >
                      <Info />
                    </IconButton>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={11}>
                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                      <Box sx={{ margin: 2 }}>
                        <Typography variant="h6" gutterBottom sx={{ color: '#00E0B8', mb: 2 }}>
                          Transaction Details
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={6}>
                            <Paper sx={{ p: 2, backgroundColor: '#1a1a1a' }}>
                              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Transaction Information
                              </Typography>
                              <Divider sx={{ my: 1, borderColor: '#333' }} />
                              <Box sx={{ mt: 1 }}>
                                <Typography variant="body2" sx={{ mb: 1 }}>
                                  <strong>Transaction Type:</strong> {transaction.transactionType || 'N/A'}
                                </Typography>
                                <Typography variant="body2" sx={{ mb: 1 }}>
                                  <strong>Payment Provider:</strong> {transaction.paymentProvider || 'N/A'}
                                </Typography>
                                <Typography variant="body2" sx={{ mb: 1 }}>
                                  <strong>Checkout Request ID:</strong> {transaction.checkoutRequestID || 'N/A'}
                                </Typography>
                                <Typography variant="body2" sx={{ mb: 1 }}>
                                  <strong>Merchant Request ID:</strong> {transaction.merchantRequestID || 'N/A'}
                                </Typography>
                              </Box>
                            </Paper>
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <Paper sx={{ p: 2, backgroundColor: '#1a1a1a' }}>
                              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Order Information
                              </Typography>
                              <Divider sx={{ my: 1, borderColor: '#333' }} />
                              <Box sx={{ mt: 1 }}>
                                {transaction.order ? (
                                  <>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                      <strong>Customer Name:</strong> {transaction.order.customerName || 'N/A'}
                                    </Typography>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                      <strong>Customer Email:</strong> {transaction.order.customerEmail || 'N/A'}
                                    </Typography>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                      <strong>Order Total:</strong> KES {Number(transaction.order.totalAmount || 0).toFixed(2)}
                                    </Typography>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                      <strong>Order Status:</strong> {transaction.order.status || 'N/A'}
                                    </Typography>
                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                      <strong>Payment Status:</strong> {transaction.order.paymentStatus || 'N/A'}
                                    </Typography>
                                  </>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    Order information not available
                                  </Typography>
                                )}
                              </Box>
                            </Paper>
                          </Grid>
                          {transaction.notes && (
                            <Grid item xs={12}>
                              <Paper sx={{ p: 2, backgroundColor: '#1a1a1a' }}>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                  Notes
                                </Typography>
                                <Divider sx={{ my: 1, borderColor: '#333' }} />
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
        </TableContainer>
      )}

      {/* Transaction Details Dialog */}
      <Dialog
        open={selectedTransaction !== null}
        onClose={() => setSelectedTransaction(null)}
        maxWidth="md"
        fullWidth
      >
        {selectedTransaction && (
          <>
            <DialogTitle sx={{ color: '#00E0B8', fontWeight: 700 }}>
              Transaction Details #{selectedTransaction.id}
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={3} sx={{ mt: 1 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Transaction Information
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1.5 }}>
                      <strong>Transaction ID:</strong> #{selectedTransaction.id}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1.5 }}>
                      <strong>Transaction Type:</strong> {selectedTransaction.transactionType || 'N/A'}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1.5 }}>
                      <strong>Payment Method:</strong> {getPaymentMethodLabel(selectedTransaction.paymentMethod, selectedTransaction.paymentProvider)}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1.5 }}>
                      <strong>Payment Provider:</strong> {selectedTransaction.paymentProvider || 'N/A'}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1.5 }}>
                      <strong>Amount:</strong> <span style={{ color: '#FF3366', fontWeight: 600 }}>KES {Number(selectedTransaction.amount).toFixed(2)}</span>
                    </Typography>
                    <Box sx={{ mb: 1.5 }}>
                      <strong>Status: </strong>
                      <Chip
                        icon={getStatusIcon(selectedTransaction.status)}
                        label={selectedTransaction.status.charAt(0).toUpperCase() + selectedTransaction.status.slice(1)}
                        color={getStatusColor(selectedTransaction.status)}
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ mb: 1.5 }}>
                      <strong>Receipt Number:</strong> {selectedTransaction.receiptNumber || 'N/A'}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1.5 }}>
                      <strong>Phone Number:</strong> {selectedTransaction.phoneNumber || 'N/A'}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1.5 }}>
                      <strong>Transaction Date:</strong> {selectedTransaction.transactionDate 
                        ? new Date(selectedTransaction.transactionDate).toLocaleString('en-US')
                        : new Date(selectedTransaction.createdAt).toLocaleString('en-US')}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1.5 }}>
                      <strong>Created:</strong> {new Date(selectedTransaction.createdAt).toLocaleString('en-US')}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1.5 }}>
                      <strong>Last Updated:</strong> {new Date(selectedTransaction.updatedAt).toLocaleString('en-US')}
                    </Typography>
                    {selectedTransaction.checkoutRequestID && (
                      <Typography variant="body2" sx={{ mb: 1.5 }}>
                        <strong>Checkout Request ID:</strong> {selectedTransaction.checkoutRequestID}
                      </Typography>
                    )}
                    {selectedTransaction.merchantRequestID && (
                      <Typography variant="body2" sx={{ mb: 1.5 }}>
                        <strong>Merchant Request ID:</strong> {selectedTransaction.merchantRequestID}
                      </Typography>
                    )}
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Order Information
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ mt: 2 }}>
                    {selectedTransaction.order ? (
                      <>
                        <Typography variant="body2" sx={{ mb: 1.5 }}>
                          <strong>Order ID:</strong> #{selectedTransaction.order.id}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1.5 }}>
                          <strong>Customer Name:</strong> {selectedTransaction.order.customerName || 'N/A'}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1.5 }}>
                          <strong>Customer Phone:</strong> {selectedTransaction.order.customerPhone || 'N/A'}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1.5 }}>
                          <strong>Customer Email:</strong> {selectedTransaction.order.customerEmail || 'N/A'}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1.5 }}>
                          <strong>Delivery Address:</strong> {selectedTransaction.order.deliveryAddress || 'N/A'}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1.5 }}>
                          <strong>Order Total:</strong> <span style={{ color: '#FF3366', fontWeight: 600 }}>KES {Number(selectedTransaction.order.totalAmount || 0).toFixed(2)}</span>
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1.5 }}>
                          <strong>Order Status:</strong> {selectedTransaction.order.status || 'N/A'}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1.5 }}>
                          <strong>Payment Type:</strong> {selectedTransaction.order.paymentType === 'pay_now' ? 'Pay Now' : 'Pay on Delivery'}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1.5 }}>
                          <strong>Payment Status:</strong> {selectedTransaction.order.paymentStatus || 'N/A'}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1.5 }}>
                          <strong>Order Date:</strong> {new Date(selectedTransaction.order.createdAt).toLocaleString('en-US')}
                        </Typography>
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Order information not available
                      </Typography>
                    )}
                  </Box>
                </Grid>
                {selectedTransaction.notes && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Notes
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    <Paper sx={{ p: 2, backgroundColor: '#1a1a1a', mt: 1 }}>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {selectedTransaction.notes}
                      </Typography>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button
                onClick={() => setSelectedTransaction(null)}
                sx={{ color: 'text.secondary' }}
              >
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default Transactions;

