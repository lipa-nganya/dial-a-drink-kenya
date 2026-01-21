import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Chip,
  Grid,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  AttachMoney,
  TrendingUp,
  TrendingDown,
  AccountBalance,
  Email,
  Phone,
  Save,
  Cancel
} from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const SupplierDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDarkMode, colors } = useTheme();
  
  const [supplier, setSupplier] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [financialSummary, setFinancialSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Edit supplier state
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    openingBalance: '0.00'
  });
  const [saving, setSaving] = useState(false);
  
  // Credit/Debit dialog state
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [transactionType, setTransactionType] = useState('credit'); // 'credit' or 'debit'
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionReason, setTransactionReason] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [processingTransaction, setProcessingTransaction] = useState(false);

  useEffect(() => {
    fetchSupplierDetails();
  }, [id]);

  const fetchSupplierDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/suppliers/${id}/details`);
      setSupplier(response.data.supplier);
      setTransactions(response.data.supplier.transactions || []);
      setFinancialSummary(response.data.financialSummary);
      
      // Set form data for editing
      setFormData({
        name: response.data.supplier.name || '',
        email: response.data.supplier.email || '',
        phone: response.data.supplier.phone || '',
        openingBalance: response.data.supplier.openingBalance?.toString() || '0.00'
      });
    } catch (err) {
      console.error('Error fetching supplier details:', err);
      setError(err.response?.data?.error || 'Failed to load supplier details');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSupplier = async () => {
    try {
      setSaving(true);
      setError(null);
      
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        openingBalance: parseFloat(formData.openingBalance) || 0
      };
      
      await api.put(`/suppliers/${id}`, payload);
      await fetchSupplierDetails();
      setEditing(false);
    } catch (err) {
      console.error('Error updating supplier:', err);
      setError(err.response?.data?.error || 'Failed to update supplier');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTransaction = async () => {
    if (!transactionAmount || isNaN(parseFloat(transactionAmount)) || parseFloat(transactionAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    
    if (!transactionReason || !transactionReason.trim()) {
      setError('Please enter a reason for this transaction');
      return;
    }
    
    try {
      setProcessingTransaction(true);
      setError(null);
      
      await api.post(`/suppliers/${id}/transactions`, {
        transactionType,
        amount: parseFloat(transactionAmount),
        reason: transactionReason.trim(),
        reference: transactionReference.trim() || null
      });
      
      // Reset form
      setTransactionAmount('');
      setTransactionReason('');
      setTransactionReference('');
      setTransactionDialogOpen(false);
      
      // Refresh data
      await fetchSupplierDetails();
    } catch (err) {
      console.error('Error creating transaction:', err);
      setError(err.response?.data?.error || 'Failed to create transaction');
    } finally {
      setProcessingTransaction(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading supplier details...</Typography>
      </Container>
    );
  }

  if (error && !supplier) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/payables')} sx={{ mt: 2 }}>
          Back to Suppliers
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <IconButton onClick={() => navigate('/payables')} sx={{ color: colors.textSecondary }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" sx={{ color: colors.accentText, fontWeight: 700 }}>
          Supplier Details
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Supplier Information Card */}
      <Card sx={{ mb: 3, backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" sx={{ color: colors.accentText, fontWeight: 600 }}>
              Supplier Information
            </Typography>
            {!editing && (
              <Button
                startIcon={<Edit />}
                onClick={() => setEditing(true)}
                sx={{ color: colors.accentText }}
              >
                Edit
              </Button>
            )}
          </Box>

          {editing ? (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Supplier Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Opening Balance"
                  type="number"
                  value={formData.openingBalance}
                  onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">KES</InputAdornment>
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button
                    startIcon={<Cancel />}
                    onClick={() => {
                      setEditing(false);
                      // Reset form data
                      setFormData({
                        name: supplier.name || '',
                        email: supplier.email || '',
                        phone: supplier.phone || '',
                        openingBalance: supplier.openingBalance?.toString() || '0.00'
                      });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    onClick={handleSaveSupplier}
                    disabled={saving}
                    sx={{
                      backgroundColor: colors.accentText,
                      color: isDarkMode ? '#0D0D0D' : '#FFFFFF'
                    }}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          ) : (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <AccountBalance sx={{ color: colors.accentText }} />
                  <Typography variant="body1" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                    {supplier.name}
                  </Typography>
                </Box>
              </Grid>
              {supplier.email && (
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Email sx={{ color: colors.textSecondary }} />
                    <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                      {supplier.email}
                    </Typography>
                  </Box>
                </Grid>
              )}
              {supplier.phone && (
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Phone sx={{ color: colors.textSecondary }} />
                    <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                      {supplier.phone}
                    </Typography>
                  </Box>
                </Grid>
              )}
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Financial Statement Card */}
      <Card sx={{ mb: 3, backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" sx={{ color: colors.accentText, fontWeight: 600 }}>
              Financial Statement
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={<TrendingUp />}
                onClick={() => {
                  setTransactionType('credit');
                  setTransactionDialogOpen(true);
                }}
                sx={{
                  backgroundColor: '#4CAF50',
                  color: '#FFFFFF',
                  '&:hover': { backgroundColor: '#45a049' }
                }}
              >
                Credit
              </Button>
              <Button
                variant="contained"
                startIcon={<TrendingDown />}
                onClick={() => {
                  setTransactionType('debit');
                  setTransactionDialogOpen(true);
                }}
                sx={{
                  backgroundColor: '#FF9800',
                  color: '#FFFFFF',
                  '&:hover': { backgroundColor: '#F57C00' }
                }}
              >
                Debit
              </Button>
            </Box>
          </Box>

          {financialSummary && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 224, 184, 0.05)' }}>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>
                    Opening Balance
                  </Typography>
                  <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                    {formatCurrency(financialSummary.openingBalance)}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.1)' : 'rgba(76, 175, 80, 0.05)' }}>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>
                    Total Credits
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#4CAF50', fontWeight: 600 }}>
                    {formatCurrency(financialSummary.totalCredits)}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper sx={{ p: 2, backgroundColor: isDarkMode ? 'rgba(255, 152, 0, 0.1)' : 'rgba(255, 152, 0, 0.05)' }}>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>
                    Total Debits
                  </Typography>
                  <Typography variant="h6" sx={{ color: '#FF9800', fontWeight: 600 }}>
                    {formatCurrency(financialSummary.totalDebits)}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={3}>
                <Paper sx={{ 
                  p: 2, 
                  backgroundColor: financialSummary.currentBalance >= 0 
                    ? (isDarkMode ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.1)')
                    : (isDarkMode ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.1)')
                }}>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>
                    Current Balance
                  </Typography>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      color: financialSummary.currentBalance >= 0 ? '#4CAF50' : '#F44336',
                      fontWeight: 700 
                    }}
                  >
                    {formatCurrency(financialSummary.currentBalance)}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card sx={{ backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
        <CardContent>
          <Typography variant="h5" sx={{ color: colors.accentText, fontWeight: 600, mb: 3 }}>
            Transaction History
          </Typography>

          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : 'rgba(0, 0, 0, 0.05)' }}>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Amount</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Reason</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Reference</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Created By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: colors.textSecondary }}>
                      No transactions yet
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((transaction) => (
                    <TableRow key={transaction.id} hover>
                      <TableCell sx={{ color: colors.textPrimary }}>
                        {formatDate(transaction.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={transaction.transactionType === 'credit' ? 'Credit' : 'Debit'}
                          color={transaction.transactionType === 'credit' ? 'success' : 'warning'}
                          size="small"
                          icon={transaction.transactionType === 'credit' ? <TrendingUp /> : <TrendingDown />}
                        />
                      </TableCell>
                      <TableCell sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                        {formatCurrency(transaction.amount)}
                      </TableCell>
                      <TableCell sx={{ color: colors.textPrimary }}>
                        {transaction.reason || '-'}
                      </TableCell>
                      <TableCell sx={{ color: colors.textPrimary }}>
                        {transaction.reference || '-'}
                      </TableCell>
                      <TableCell sx={{ color: colors.textSecondary }}>
                        {transaction.createdByAdmin?.username || 'System'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Credit/Debit Dialog */}
      <Dialog 
        open={transactionDialogOpen} 
        onClose={() => !processingTransaction && setTransactionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>
          {transactionType === 'credit' ? 'Credit Supplier' : 'Debit Supplier'}
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: colors.paper, pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={transactionAmount}
              onChange={(e) => setTransactionAmount(e.target.value)}
              required
              InputProps={{
                startAdornment: <InputAdornment position="start">KES</InputAdornment>
              }}
              helperText={transactionType === 'credit' 
                ? 'Credit = Money owed to supplier (increases balance)' 
                : 'Debit = Money paid to supplier (decreases balance)'}
            />
            <TextField
              fullWidth
              label="Reason"
              value={transactionReason}
              onChange={(e) => setTransactionReason(e.target.value)}
              required
              multiline
              rows={3}
              helperText="Enter the reason for this transaction"
            />
            <TextField
              fullWidth
              label="Reference (Optional)"
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
              helperText="Invoice number, receipt number, etc."
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: colors.paper, p: 2 }}>
          <Button 
            onClick={() => setTransactionDialogOpen(false)}
            disabled={processingTransaction}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateTransaction}
            disabled={processingTransaction}
            startIcon={processingTransaction ? <CircularProgress size={20} /> : <AttachMoney />}
            sx={{
              backgroundColor: transactionType === 'credit' ? '#4CAF50' : '#FF9800',
              color: '#FFFFFF',
              '&:hover': {
                backgroundColor: transactionType === 'credit' ? '#45a049' : '#F57C00'
              }
            }}
          >
            {processingTransaction ? 'Processing...' : transactionType === 'credit' ? 'Credit' : 'Debit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SupplierDetail;

