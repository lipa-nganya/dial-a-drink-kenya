import React, { useState, useEffect } from 'react';
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
  IconButton,
  Alert,
  CircularProgress,
  Chip,
  Grid,
  InputAdornment,
  TablePagination,
  Tabs,
  Tab,
  Tooltip
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  List,
  Search,
  CheckCircle,
  ShoppingCart,
  Visibility as ViewDetailsIcon
} from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { Snackbar } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';

const getPurchaseStatus = (p) => {
  const attachedToAccount = !!(p.details?.assetAccountId != null && p.details?.assetAccountId !== '');
  const amount = parseFloat(p.amount) || 0;
  const amountPaid = (p.details?.amountPaid != null) ? parseFloat(p.details.amountPaid) : 0;
  return attachedToAccount || amountPaid >= amount ? 'Paid' : 'Unpaid';
};

const Purchases = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, colors } = useTheme();
  const [currentTab, setCurrentTab] = useState(0); // 0: Purchases, 1: Suppliers
  const [suppliers, setSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [filteredPurchases, setFilteredPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasesLoading, setPurchasesLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [purchaseSearchTerm, setPurchaseSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [purchasePage, setPurchasePage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [purchaseRowsPerPage, setPurchaseRowsPerPage] = useState(10);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    openingBalance: '0.00'
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessSnackbar, setShowSuccessSnackbar] = useState(false);
  const [touchedFields, setTouchedFields] = useState({});
  const [purchaseDetailsOpen, setPurchaseDetailsOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [assetAccounts, setAssetAccounts] = useState([]);

  useEffect(() => {
    if (location.state?.action === 'add-supplier') {
      setCurrentTab(1);
      setOpenDialog(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (typeof location.state?.tab === 'number') {
      setCurrentTab(location.state.tab);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location.state]);

  useEffect(() => {
    fetchPurchases();
    fetchSuppliers();
    const loadAccounts = async () => {
      try {
        const res = await api.get('/admin/accounts');
        setAssetAccounts(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error('Error fetching asset accounts:', err);
      }
    };
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (currentTab === 1) {
      if (!searchTerm.trim()) {
        setFilteredSuppliers(suppliers);
      } else {
        const filtered = suppliers.filter(s =>
          s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.email?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredSuppliers(filtered);
        setPage(0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, suppliers, currentTab]);

  useEffect(() => {
    if (currentTab === 0) {
      if (!purchaseSearchTerm.trim()) {
        setFilteredPurchases(purchases);
      } else {
        const filtered = purchases.filter(p => {
          const supplier = p.details?.supplier || '';
          const item = p.details?.item || '';
          const items = p.details?.items || [];
          const itemsText = Array.isArray(items) ? items.map(i => i.item || i.name || '').join(' ') : '';
          const searchLower = purchaseSearchTerm.toLowerCase();
          return supplier.toLowerCase().includes(searchLower) ||
            item.toLowerCase().includes(searchLower) ||
            itemsText.toLowerCase().includes(searchLower);
        });
        setFilteredPurchases(filtered);
        setPurchasePage(0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseSearchTerm, purchases, currentTab]);

  useEffect(() => {
    setPurchasePage(0);
    setPage(0);
  }, [currentTab]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/suppliers');
      setSuppliers(response.data);
      setFilteredSuppliers(response.data);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      setError('Failed to fetch suppliers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchases = async () => {
    try {
      setPurchasesLoading(true);
      setError(null);
      const response = await api.get('/driver-wallet/admin/cash-submissions/all', { params: { limit: 1000 } });
      const submissions = response.data?.data?.submissions || response.data?.submissions || [];
      const purchaseSubmissions = Array.isArray(submissions)
        ? submissions
            .filter(s => s.submissionType === 'purchases')
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        : [];
      setPurchases(purchaseSubmissions);
      setFilteredPurchases(purchaseSubmissions);
    } catch (err) {
      console.error('Error fetching purchases:', err);
      setError('Failed to fetch purchases. Please try again.');
    } finally {
      setPurchasesLoading(false);
    }
  };

  const unpaidPurchases = purchases.filter(p => getPurchaseStatus(p) === 'Unpaid');

  const getAssetAccountName = (accountId) => {
    if (accountId == null || accountId === '') return '—';
    const id = Number(accountId);
    const account = assetAccounts.find(a => Number(a.id) === id);
    return account ? (account.name || `#${id}`) : `#${id}`;
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 2 }).format(amount || 0);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  };

  const formatPhoneNumber = (value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.startsWith('254')) return digits.length <= 12 ? digits : digits.substring(0, 12);
    if (digits.startsWith('0')) return digits.length <= 10 ? digits : digits.substring(0, 10);
    if (digits.length > 0) return digits.length <= 9 ? `0${digits}` : `0${digits.substring(0, 9)}`;
    return digits;
  };

  const validatePhoneNumber = (phone) => {
    if (!phone || !phone.trim()) return { isValid: true, error: '' };
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) return { isValid: false, error: 'Phone number must be at least 9 digits' };
    if (digits.length > 12) return { isValid: false, error: 'Phone number is too long' };
    if (!digits.startsWith('0') && !digits.startsWith('254')) return { isValid: false, error: 'Phone number should start with 0 or 254' };
    return { isValid: true, error: '' };
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Supplier name is required';
    else if (formData.name.trim().length < 2) errors.name = 'Supplier name must be at least 2 characters';
    if (formData.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Please enter a valid email address';
    const phoneValidation = validatePhoneNumber(formData.phone);
    if (!phoneValidation.isValid) errors.phone = phoneValidation.error;
    const balance = parseFloat(formData.openingBalance);
    if (isNaN(balance) && formData.openingBalance !== '') errors.openingBalance = 'Opening balance must be a valid number';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenDialog = (supplier = null) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        name: supplier.name || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        openingBalance: supplier.openingBalance?.toString() || '0.00'
      });
    } else {
      setEditingSupplier(null);
      setFormData({ name: '', email: '', phone: '', openingBalance: '0.00' });
    }
    setFormErrors({});
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingSupplier(null);
    setFormData({ name: '', email: '', phone: '', openingBalance: '0.00' });
    setFormErrors({});
  };

  const handleFieldChange = (field, value) => {
    const processed = field === 'phone' ? formatPhoneNumber(value) : value;
    setFormData(prev => ({ ...prev, [field]: processed }));
    setTouchedFields(prev => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async () => {
    setTouchedFields({ name: true, email: true, phone: true, openingBalance: true });
    if (!validateForm()) {
      setError('Please fix the errors in the form before submitting.');
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      const payload = {
        name: formData.name.trim(),
        email: formData.email?.trim() || null,
        phone: formData.phone?.trim() || null,
        openingBalance: parseFloat(formData.openingBalance) || 0
      };
      if (editingSupplier) {
        await api.put(`/suppliers/${editingSupplier.id}`, payload);
        setSuccessMessage(`Supplier "${formData.name.trim()}" updated successfully!`);
      } else {
        await api.post('/suppliers', payload);
        setSuccessMessage(`Supplier "${formData.name.trim()}" added successfully!`);
      }
      setShowSuccessSnackbar(true);
      setFormData({ name: '', email: '', phone: '', openingBalance: '0.00' });
      setTouchedFields({});
      setFormErrors({});
      await fetchSuppliers();
      handleCloseDialog();
    } catch (err) {
      console.error('Error saving supplier:', err);
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to save supplier. Please try again.');
      if (err.response?.data?.errors) setFormErrors(err.response.data.errors);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (supplier) => {
    if (!window.confirm(`Are you sure you want to delete ${supplier.name}?`)) return;
    try {
      setError(null);
      await api.delete(`/suppliers/${supplier.id}`);
      await fetchSuppliers();
    } catch (err) {
      console.error('Error deleting supplier:', err);
      setError(err.response?.data?.error || 'Failed to delete supplier. Please try again.');
    }
  };

  const handleOpenPurchaseDetails = (purchase) => {
    setSelectedPurchase(purchase);
    setPurchaseDetailsOpen(true);
  };

  const handleClosePurchaseDetails = () => {
    setPurchaseDetailsOpen(false);
    setSelectedPurchase(null);
  };

  const handlePurchaseChangePage = (e, newPage) => setPurchasePage(newPage);
  const handlePurchaseChangeRowsPerPage = (e) => {
    setPurchaseRowsPerPage(parseInt(e.target.value, 10));
    setPurchasePage(0);
  };
  const handleChangePage = (e, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const renderPurchasesTab = () => {
    const paginated = filteredPurchases.slice(
      purchasePage * purchaseRowsPerPage,
      purchasePage * purchaseRowsPerPage + purchaseRowsPerPage
    );
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShoppingCart sx={{ color: colors.accentText, fontSize: 40 }} />
            <Typography variant="h4" component="h1" sx={{ color: colors.accentText, fontWeight: 700 }}>
              Purchases
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate('/payables/add')}
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              '&:hover': { backgroundColor: '#00C4A3' }
            }}
          >
            Add Purchase
          </Button>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        <Card sx={{ backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>Show</Typography>
                <TextField select size="small" value={purchaseRowsPerPage} onChange={handlePurchaseChangeRowsPerPage} SelectProps={{ native: true }} sx={{ minWidth: 80 }}>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </TextField>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>entries</Typography>
              </Box>
              <TextField
                size="small"
                placeholder="Search by supplier, item..."
                value={purchaseSearchTerm}
                onChange={(e) => setPurchaseSearchTerm(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: colors.textSecondary }} /></InputAdornment> }}
                sx={{
                  minWidth: 250,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                    '& fieldset': { borderColor: colors.border },
                    '& .MuiInputBase-input': { color: colors.textPrimary }
                  }
                }}
              />
            </Box>
            {purchasesLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : (
              <>
                <TableContainer component={Paper} variant="outlined" sx={{ backgroundColor: colors.paper }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : 'rgba(0, 0, 0, 0.05)' }}>
                        <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Received By</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Supplier</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: colors.accentText }}>Amount</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Account</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginated.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ color: colors.textSecondary, py: 4 }}>
                            {purchaseSearchTerm ? 'No purchases found matching your search.' : 'No purchases found.'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginated.map((purchase) => {
                          const accountDisplay = getAssetAccountName(purchase.details?.assetAccountId);
                          const adminName = purchase.admin?.name || purchase.admin?.username || 'N/A';
                          const status = getPurchaseStatus(purchase);
                          const supplierName = purchase.details?.supplier || '';
                          const supplierMatch = suppliers.find(s => (s.name || '').trim().toLowerCase() === (supplierName || '').trim().toLowerCase());
                          return (
                            <TableRow key={purchase.id} hover onClick={() => handleOpenPurchaseDetails(purchase)} sx={{ cursor: 'pointer' }}>
                              <TableCell sx={{ color: colors.textPrimary }}>{formatDate(purchase.createdAt)}</TableCell>
                              <TableCell sx={{ color: colors.textPrimary }}>{adminName}</TableCell>
                              <TableCell sx={{ color: colors.textPrimary, fontWeight: 500 }}>
                                {supplierMatch ? (
                                  <Typography component="span" onClick={(e) => { e.stopPropagation(); navigate(`/payables/suppliers/${supplierMatch.id}/invoices`); }} sx={{ color: colors.accentText, cursor: 'pointer', textDecoration: 'underline' }}>
                                    {supplierName || '—'}
                                  </Typography>
                                ) : supplierName || '—'}
                              </TableCell>
                              <TableCell align="right" sx={{ color: colors.textPrimary, fontWeight: 500 }}>{formatCurrency(purchase.amount)}</TableCell>
                              <TableCell sx={{ color: colors.textPrimary }}>{accountDisplay}</TableCell>
                              <TableCell>
                                <Chip label={status} color={status === 'Paid' ? 'success' : 'default'} size="small" sx={status === 'Unpaid' ? { backgroundColor: '#FF3366', color: '#FFFFFF', '& .MuiChip-label': { color: '#FFFFFF' } } : undefined} />
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination component="div" count={filteredPurchases.length} page={purchasePage} onPageChange={handlePurchaseChangePage} rowsPerPage={purchaseRowsPerPage} onRowsPerPageChange={handlePurchaseChangeRowsPerPage} rowsPerPageOptions={[10, 25, 50, 100]} sx={{ color: colors.textPrimary, '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { color: colors.textPrimary } }} />
              </>
            )}
          </CardContent>
        </Card>
      </Box>
    );
  };

  const renderSuppliersTab = () => {
    const totalPayables = unpaidPurchases.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const latestPayables = unpaidPurchases.slice(0, 10);
    const paginatedSuppliers = filteredSuppliers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <List sx={{ color: colors.accentText, fontSize: 40 }} />
            <Typography variant="h4" component="h1" sx={{ color: colors.accentText, fontWeight: 700 }}>
              Suppliers
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<Add />} onClick={() => handleOpenDialog()} sx={{ backgroundColor: colors.accentText, color: isDarkMode ? '#0D0D0D' : '#FFFFFF', '&:hover': { backgroundColor: '#00C4A3' } }}>
            Add Supplier
          </Button>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        <Paper sx={{ p: 2, mb: 3, backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
          <Typography variant="subtitle1" sx={{ color: colors.textSecondary, mb: 0.5 }}>Total Supplier Payables</Typography>
          <Typography variant="h4" sx={{ color: colors.accentText, fontWeight: 700 }}>{formatCurrency(totalPayables)}</Typography>
          <Typography variant="caption" sx={{ color: colors.textSecondary }}>Total pending invoices ({unpaidPurchases.length})</Typography>
        </Paper>
        <Paper sx={{ p: 2, mb: 3, backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
          <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 600, color: colors.textPrimary }}>Latest supplier payables transactions</Typography>
          {purchasesLoading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={24} sx={{ color: colors.accent }} /></Box> : latestPayables.length === 0 ? (
            <Typography variant="body2" sx={{ color: colors.textSecondary }}>No pending invoices.</Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : 'rgba(0, 0, 0, 0.05)' }}>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Supplier</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Reference</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: colors.accentText }}>Amount</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {latestPayables.map((p) => {
                    const supplierName = p.details?.supplier || '—';
                    const supplierMatch = suppliers.find(s => (s.name || '').trim().toLowerCase() === (supplierName || '').trim().toLowerCase());
                    return (
                      <TableRow key={p.id} hover>
                        <TableCell sx={{ color: colors.textSecondary }}>{formatDate(p.createdAt)}</TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>
                          {supplierMatch ? (
                            <Typography component="span" onClick={() => navigate(`/suppliers/${supplierMatch.id}`)} sx={{ color: colors.accentText, cursor: 'pointer', textDecoration: 'underline' }}>{supplierName}</Typography>
                          ) : supplierName}
                        </TableCell>
                        <TableCell sx={{ color: colors.textSecondary }}>{p.details?.reference || '—'}</TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary, fontWeight: 500 }}>{formatCurrency(p.amount)}</TableCell>
                        <TableCell>
                          <Button size="small" onClick={() => handleOpenPurchaseDetails(p)} sx={{ color: colors.accentText }}>View</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
        <Card sx={{ backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>Show</Typography>
                <TextField select size="small" value={rowsPerPage} onChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }} SelectProps={{ native: true }} sx={{ minWidth: 80 }}>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </TextField>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>entries</Typography>
              </Box>
              <TextField
                size="small"
                placeholder="Search suppliers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: colors.textSecondary }} /></InputAdornment> }}
                sx={{
                  minWidth: 250,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                    '& fieldset': { borderColor: colors.border },
                    '& .MuiInputBase-input': { color: colors.textPrimary }
                  }
                }}
              />
            </Box>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : (
              <>
                <TableContainer component={Paper} variant="outlined" sx={{ backgroundColor: colors.paper }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : 'rgba(0, 0, 0, 0.05)' }}>
                        <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Supplier</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Phone</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Email</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: colors.accentText }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedSuppliers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ color: colors.textSecondary, py: 4 }}>
                            {searchTerm ? 'No suppliers found matching your search.' : 'No suppliers found.'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedSuppliers.map((supplier) => (
                          <TableRow key={supplier.id} hover>
                            <TableCell sx={{ color: colors.textPrimary, fontWeight: 500 }}>{supplier.name}</TableCell>
                            <TableCell sx={{ color: colors.textPrimary }}>{supplier.phone || '-'}</TableCell>
                            <TableCell sx={{ color: colors.textPrimary }}>{supplier.email || '-'}</TableCell>
                            <TableCell align="center">
                              <Tooltip title="View">
                                <IconButton size="small" onClick={() => navigate(`/suppliers/${supplier.id}`)} sx={{ color: colors.accentText }}><ViewDetailsIcon fontSize="small" /></IconButton>
                              </Tooltip>
                              <Tooltip title="Edit">
                                <IconButton size="small" onClick={() => handleOpenDialog(supplier)} sx={{ color: colors.accentText }}><Edit fontSize="small" /></IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton size="small" onClick={() => handleDelete(supplier)} sx={{ color: '#FF3366' }}><Delete fontSize="small" /></IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination component="div" count={filteredSuppliers.length} page={page} onPageChange={handleChangePage} rowsPerPage={rowsPerPage} onRowsPerPageChange={handleChangeRowsPerPage} rowsPerPageOptions={[10, 25, 50, 100]} sx={{ color: colors.textPrimary, '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { color: colors.textPrimary } }} />
              </>
            )}
          </CardContent>
        </Card>
      </Box>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Tabs
        value={currentTab}
        onChange={(e, v) => setCurrentTab(v)}
        sx={{
          minHeight: 40,
          mb: 2,
          '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 600 },
          '& .Mui-selected': { color: colors.accentText },
          '& .MuiTabs-indicator': { backgroundColor: colors.accentText }
        }}
      >
        <Tab label="Purchases" />
        <Tab label="Suppliers" />
      </Tabs>
      {currentTab === 0 && renderPurchasesTab()}
      {currentTab === 1 && renderSuppliersTab()}

      {/* Add/Edit Supplier Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
        <DialogContent sx={{ backgroundColor: colors.paper }}>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Supplier Name"
                  required
                  value={formData.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  error={!!formErrors.name && (touchedFields.name || formData.name)}
                  helperText={formErrors.name && (touchedFields.name || formData.name) ? formErrors.name : 'Enter the supplier company or individual name'}
                  placeholder="Supplier's Name"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                      '& fieldset': { borderColor: colors.border },
                      '&:hover fieldset': { borderColor: colors.accentText },
                      '&.Mui-focused fieldset': { borderColor: colors.accentText }
                    },
                    '& .MuiInputBase-input': { color: colors.textPrimary },
                    '& .MuiInputLabel-root': { color: colors.textSecondary },
                    '& .MuiInputLabel-root.Mui-focused': { color: colors.accentText }
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email Address"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleFieldChange('email', e.target.value)}
                  error={!!formErrors.email && (touchedFields.email || formData.email)}
                  helperText={formErrors.email && (touchedFields.email || formData.email) ? formErrors.email : 'Optional'}
                  placeholder="Email"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                      '& fieldset': { borderColor: colors.border }
                    },
                    '& .MuiInputBase-input': { color: colors.textPrimary },
                    '& .MuiInputLabel-root': { color: colors.textSecondary }
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  value={formData.phone}
                  onChange={(e) => handleFieldChange('phone', e.target.value)}
                  error={!!formErrors.phone && (touchedFields.phone || formData.phone)}
                  helperText={formErrors.phone && (touchedFields.phone || formData.phone) ? formErrors.phone : 'Optional'}
                  placeholder="Phone"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                      '& fieldset': { borderColor: colors.border }
                    },
                    '& .MuiInputBase-input': { color: colors.textPrimary },
                    '& .MuiInputLabel-root': { color: colors.textSecondary }
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Opening Balance"
                  type="number"
                  required
                  value={formData.openingBalance}
                  onChange={(e) => handleFieldChange('openingBalance', e.target.value)}
                  error={!!formErrors.openingBalance && (touchedFields.openingBalance || formData.openingBalance)}
                  helperText={formErrors.openingBalance && (touchedFields.openingBalance || formData.openingBalance) ? formErrors.openingBalance : 'Enter positive or negative balance'}
                  placeholder="0.00"
                  InputProps={{ inputProps: { step: '0.01' } }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                      '& fieldset': { borderColor: colors.border }
                    },
                    '& .MuiInputBase-input': { color: colors.textPrimary },
                    '& .MuiInputLabel-root': { color: colors.textSecondary }
                  }}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: colors.paper, p: 2 }}>
          <Button onClick={handleCloseDialog} sx={{ color: colors.textSecondary }}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={isSubmitting} startIcon={isSubmitting ? <CircularProgress size={20} /> : <CheckCircle />} sx={{ backgroundColor: colors.accentText, color: isDarkMode ? '#0D0D0D' : '#FFFFFF', '&:hover': { backgroundColor: '#00C4A3' }, '&:disabled': { backgroundColor: colors.border } }}>
            {isSubmitting ? 'Saving...' : (editingSupplier ? 'Update' : 'Add')} Supplier
          </Button>
        </DialogActions>
      </Dialog>

      {/* Purchase Details Dialog */}
      <Dialog open={purchaseDetailsOpen && !!selectedPurchase} onClose={handleClosePurchaseDetails} maxWidth="md" fullWidth>
        <DialogTitle>Purchase Details</DialogTitle>
        <DialogContent dividers>
          {selectedPurchase && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <Box><Typography variant="caption" color="text.secondary">Date</Typography><Typography variant="body1">{formatDate(selectedPurchase.createdAt)}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Supplier</Typography><Typography variant="body1">{selectedPurchase.details?.supplier || '—'}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Received By</Typography><Typography variant="body1">{selectedPurchase.admin?.name || selectedPurchase.admin?.username || '—'}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Amount</Typography><Typography variant="body1">{formatCurrency(selectedPurchase.amount)}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Payment Method</Typography><Typography variant="body1">{selectedPurchase.details?.paymentMethod === 'mpesa' ? `M-Pesa: ${selectedPurchase.details?.mpesaName || 'N/A'}` : `Cash: ${selectedPurchase.details?.recipientName || 'N/A'}`}</Typography></Box>
              </Box>
              <Typography variant="subtitle2" sx={{ mt: 1 }}>Items</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead><TableRow><TableCell>Item</TableCell><TableCell align="right">Quantity</TableCell><TableCell align="right">Unit Price</TableCell><TableCell align="right">Total</TableCell></TableRow></TableHead>
                  <TableBody>
                    {Array.isArray(selectedPurchase.details?.items) && selectedPurchase.details.items.length > 0 ? (
                      selectedPurchase.details.items.map((item, idx) => {
                        const qty = Number(item.quantity || 1);
                        const unit = Number(item.price || 0);
                        const lineTotal = !Number.isNaN(qty) && !Number.isNaN(unit) ? qty * unit : 0;
                        return (
                          <TableRow key={idx}>
                            <TableCell>{item.item || '—'}</TableCell>
                            <TableCell align="right">{qty}</TableCell>
                            <TableCell align="right">{formatCurrency(unit)}</TableCell>
                            <TableCell align="right">{formatCurrency(lineTotal)}</TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell>{selectedPurchase.details?.item || 'Purchase'}</TableCell>
                        <TableCell align="right">1</TableCell>
                        <TableCell align="right">{formatCurrency(selectedPurchase.details?.price || selectedPurchase.amount)}</TableCell>
                        <TableCell align="right">{formatCurrency(selectedPurchase.amount)}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions><Button onClick={handleClosePurchaseDetails}>Close</Button></DialogActions>
      </Dialog>

      <Snackbar open={showSuccessSnackbar} autoHideDuration={3000} onClose={() => setShowSuccessSnackbar(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={() => setShowSuccessSnackbar(false)} severity="success" sx={{ width: '100%' }} icon={<CheckCircle />}>{successMessage}</Alert>
      </Snackbar>
    </Container>
  );
};

export default Purchases;
