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
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  AccountBalance,
  AttachMoney,
  List,
  Search,
  Receipt,
  CheckCircle,
  ShoppingCart
} from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { Snackbar } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const Payables = () => {
  const navigate = useNavigate();
  const { isDarkMode, colors } = useTheme();
  const [currentTab, setCurrentTab] = useState(0); // 0: Purchases, 1: Suppliers, 2: Payables
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
  const [openPurchaseDialog, setOpenPurchaseDialog] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    openingBalance: '0.00'
  });
  const [purchaseFormData, setPurchaseFormData] = useState({
    supplierId: '',
    amount: '',
    paymentMethod: 'cash', // 'cash' or 'mpesa'
    recipientName: '', // For cash
    mpesaName: '' // For M-Pesa
  });
  const [purchaseFormErrors, setPurchaseFormErrors] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingPurchase, setIsSubmittingPurchase] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessSnackbar, setShowSuccessSnackbar] = useState(false);
  const [touchedFields, setTouchedFields] = useState({});

  useEffect(() => {
    if (currentTab === 1 || currentTab === 2) {
      fetchSuppliers();
    }
    if (currentTab === 0) {
      fetchPurchases();
      // Also fetch suppliers for the dropdown
      if (suppliers.length === 0) {
        fetchSuppliers();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab]);

  useEffect(() => {
    if (currentTab === 1 || currentTab === 2) {
      filterSuppliers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, suppliers, currentTab]);

  useEffect(() => {
    if (currentTab === 0) {
      filterPurchases();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseSearchTerm, purchases, currentTab]);

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
      const response = await api.get('/driver-wallet/admin/cash-submissions/all', {
        params: { limit: 1000 }
      });
      // Handle standardized API response format: { success: true, data: { submissions, total } }
      const submissions = response.data?.data?.submissions || response.data?.submissions || [];
      // Filter for purchases type and sort by newest first (createdAt DESC)
      const purchaseSubmissions = Array.isArray(submissions) 
        ? submissions
            .filter(submission => submission.submissionType === 'purchases')
            .sort((a, b) => {
              const dateA = new Date(a.createdAt || 0);
              const dateB = new Date(b.createdAt || 0);
              return dateB - dateA; // Newest first
            })
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

  const filterSuppliers = () => {
    if (!searchTerm.trim()) {
      setFilteredSuppliers(suppliers);
      return;
    }

    const filtered = suppliers.filter(supplier =>
      supplier.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredSuppliers(filtered);
    setPage(0);
  };

  const filterPurchases = () => {
    if (!purchaseSearchTerm.trim()) {
      setFilteredPurchases(purchases);
      return;
    }

    const filtered = purchases.filter(purchase => {
      const supplier = purchase.details?.supplier || '';
      const item = purchase.details?.item || '';
      const items = purchase.details?.items || [];
      const itemsText = Array.isArray(items) ? items.map(i => i.item || i.name || '').join(' ') : '';
      const searchLower = purchaseSearchTerm.toLowerCase();
      
      return supplier.toLowerCase().includes(searchLower) ||
             item.toLowerCase().includes(searchLower) ||
             itemsText.toLowerCase().includes(searchLower);
    });
    setFilteredPurchases(filtered);
    setPurchasePage(0);
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
      setFormData({
        name: '',
        email: '',
        phone: '',
        openingBalance: '0.00'
      });
    }
    setFormErrors({});
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingSupplier(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      openingBalance: '0.00'
    });
    setFormErrors({});
  };

  const formatPhoneNumber = (value) => {
    const digits = value.replace(/\D/g, '');
    
    if (digits.startsWith('254')) {
      return digits.length <= 12 ? digits : digits.substring(0, 12);
    } else if (digits.startsWith('0')) {
      return digits.length <= 10 ? digits : digits.substring(0, 10);
    } else if (digits.length > 0) {
      return digits.length <= 9 ? `0${digits}` : `0${digits.substring(0, 9)}`;
    }
    return digits;
  };

  const validatePhoneNumber = (phone) => {
    if (!phone || !phone.trim()) return { isValid: true, error: '' };
    
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) {
      return { isValid: false, error: 'Phone number must be at least 9 digits' };
    }
    if (digits.length > 12) {
      return { isValid: false, error: 'Phone number is too long' };
    }
    if (!digits.startsWith('0') && !digits.startsWith('254')) {
      return { isValid: false, error: 'Phone number should start with 0 or 254' };
    }
    return { isValid: true, error: '' };
  };

  const validateField = (field, value) => {
    const errors = { ...formErrors };
    
    switch (field) {
      case 'name':
        if (!value.trim()) {
          errors.name = 'Supplier name is required';
        } else if (value.trim().length < 2) {
          errors.name = 'Supplier name must be at least 2 characters';
        } else {
          delete errors.name;
        }
        break;
      
      case 'email':
        if (value && value.trim()) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            errors.email = 'Please enter a valid email address';
          } else {
            delete errors.email;
          }
        } else {
          delete errors.email;
        }
        break;
      
      case 'phone':
        const phoneValidation = validatePhoneNumber(value);
        if (!phoneValidation.isValid) {
          errors.phone = phoneValidation.error;
        } else {
          delete errors.phone;
        }
        break;
      
      case 'openingBalance':
        if (value === '' || value === null || value === undefined) {
          errors.openingBalance = 'Opening balance is required';
        } else {
          const balance = parseFloat(value);
          if (isNaN(balance)) {
            errors.openingBalance = 'Opening balance must be a valid number';
          } else {
            delete errors.openingBalance;
          }
        }
        break;
      
      default:
        break;
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Supplier name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Supplier name must be at least 2 characters';
    }
    
    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        errors.email = 'Please enter a valid email address';
      }
    }
    
    const phoneValidation = validatePhoneNumber(formData.phone);
    if (!phoneValidation.isValid) {
      errors.phone = phoneValidation.error;
    }
    
    const balance = parseFloat(formData.openingBalance);
    if (isNaN(balance) && formData.openingBalance !== '') {
      errors.openingBalance = 'Opening balance must be a valid number';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFieldChange = (field, value) => {
    let processedValue = value;
    
    if (field === 'phone') {
      processedValue = formatPhoneNumber(value);
    }
    
    setFormData(prev => ({ ...prev, [field]: processedValue }));
    setTouchedFields(prev => ({ ...prev, [field]: true }));
    
    if (touchedFields[field] || processedValue) {
      validateField(field, processedValue);
    }
  };

  const handleSubmit = async () => {
    setTouchedFields({
      name: true,
      email: true,
      phone: true,
      openingBalance: true
    });

    if (!validateForm()) {
      setError('Please fix the errors in the form before submitting.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
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
      
      setFormData({
        name: '',
        email: '',
        phone: '',
        openingBalance: '0.00'
      });
      setTouchedFields({});
      setFormErrors({});

      if (currentTab === 1 || currentTab === 2) {
        await fetchSuppliers();
      }

      if (openDialog) {
        handleCloseDialog();
      }
    } catch (err) {
      console.error('Error saving supplier:', err);
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.message || 
                          'Failed to save supplier. Please try again.';
      setError(errorMessage);
      
      if (err.response?.data?.errors) {
        setFormErrors(err.response.data.errors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (supplier) => {
    if (!window.confirm(`Are you sure you want to delete ${supplier.name}?`)) {
      return;
    }

    try {
      setError(null);
      await api.delete(`/suppliers/${supplier.id}`);
      await fetchSuppliers();
    } catch (err) {
      console.error('Error deleting supplier:', err);
      setError(err.response?.data?.error || 'Failed to delete supplier. Please try again.');
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
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-KE', {
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

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handlePurchaseChangePage = (event, newPage) => {
    setPurchasePage(newPage);
  };

  const handlePurchaseChangeRowsPerPage = (event) => {
    setPurchaseRowsPerPage(parseInt(event.target.value, 10));
    setPurchasePage(0);
  };

  const handleOpenPurchaseDialog = () => {
    setPurchaseFormData({
      supplierId: '',
      amount: '',
      paymentMethod: 'cash',
      recipientName: '',
      mpesaName: ''
    });
    setPurchaseFormErrors({});
    setOpenPurchaseDialog(true);
  };

  const handleClosePurchaseDialog = () => {
    setOpenPurchaseDialog(false);
    setPurchaseFormData({
      supplierId: '',
      amount: '',
      paymentMethod: 'cash',
      recipientName: '',
      mpesaName: ''
    });
    setPurchaseFormErrors({});
  };

  const validatePurchaseForm = () => {
    const errors = {};
    
    if (!purchaseFormData.supplierId) {
      errors.supplierId = 'Supplier is required';
    }
    
    if (!purchaseFormData.amount || parseFloat(purchaseFormData.amount) <= 0) {
      errors.amount = 'Amount must be greater than 0';
    }
    
    if (purchaseFormData.paymentMethod === 'cash' && !purchaseFormData.recipientName?.trim()) {
      errors.recipientName = 'Recipient name is required for cash payments';
    }
    
    if (purchaseFormData.paymentMethod === 'mpesa' && !purchaseFormData.mpesaName?.trim()) {
      errors.mpesaName = 'M-Pesa name is required';
    }
    
    setPurchaseFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitPurchase = async () => {
    if (!validatePurchaseForm()) {
      setError('Please fix the errors in the form before submitting.');
      return;
    }

    try {
      setIsSubmittingPurchase(true);
      setError(null);
      
      const selectedSupplier = suppliers.find(s => s.id === parseInt(purchaseFormData.supplierId));
      if (!selectedSupplier) {
        setError('Selected supplier not found');
        return;
      }

      // Build details object based on payment method
      const details = {
        supplier: selectedSupplier.name,
        item: 'Purchase', // Default item name
        price: parseFloat(purchaseFormData.amount),
        deliveryLocation: 'Office', // Default delivery location for purchases
        paymentMethod: purchaseFormData.paymentMethod,
        ...(purchaseFormData.paymentMethod === 'cash' 
          ? { recipientName: purchaseFormData.recipientName.trim() }
          : { mpesaName: purchaseFormData.mpesaName.trim() })
      };

      const payload = {
        submissionType: 'purchases',
        amount: parseFloat(purchaseFormData.amount),
        details: details
      };

      await api.post('/driver-wallet/admin/cash-submissions', payload);
      
      setSuccessMessage('Purchase submitted successfully!');
      setShowSuccessSnackbar(true);
      
      handleClosePurchaseDialog();
      await fetchPurchases();
    } catch (err) {
      console.error('Error submitting purchase:', err);
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.message || 
                          'Failed to submit purchase. Please try again.';
      setError(errorMessage);
      
      if (err.response?.data?.errors) {
        setPurchaseFormErrors(err.response.data.errors);
      }
    } finally {
      setIsSubmittingPurchase(false);
    }
  };

  const renderPurchasesTab = () => {
    const paginatedPurchases = filteredPurchases.slice(
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
            onClick={handleOpenPurchaseDialog}
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              '&:hover': { backgroundColor: '#00C4A3' }
            }}
          >
            Add Purchase
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card sx={{ backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  Show
                </Typography>
                <TextField
                  select
                  size="small"
                  value={purchaseRowsPerPage}
                  onChange={handlePurchaseChangeRowsPerPage}
                  SelectProps={{ native: true }}
                  sx={{ minWidth: 80 }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </TextField>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  entries
                </Typography>
              </Box>
              <TextField
                size="small"
                placeholder="Search by supplier, item..."
                value={purchaseSearchTerm}
                onChange={(e) => setPurchaseSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: colors.textSecondary }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  minWidth: 250,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                    '& fieldset': { borderColor: colors.border },
                  },
                  '& .MuiInputBase-input': { color: colors.textPrimary }
                }}
              />
            </Box>

            {purchasesLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
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
                        <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Payment Method</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedPurchases.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ color: colors.textSecondary, py: 4 }}>
                            {purchaseSearchTerm ? 'No purchases found matching your search.' : 'No purchases found.'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedPurchases.map((purchase) => {
                          const paymentMethod = purchase.details?.paymentMethod || 'cash';
                          const paymentMethodDisplay = paymentMethod === 'mpesa' 
                            ? `M-Pesa: ${purchase.details?.mpesaName || 'N/A'}`
                            : `Cash: ${purchase.details?.recipientName || 'N/A'}`;
                          const adminName = purchase.admin?.name || purchase.admin?.username || 'N/A';

                          return (
                            <TableRow key={purchase.id} hover>
                              <TableCell sx={{ color: colors.textPrimary }}>
                                {formatDate(purchase.createdAt)}
                              </TableCell>
                              <TableCell sx={{ color: colors.textPrimary }}>
                                {adminName}
                              </TableCell>
                              <TableCell sx={{ color: colors.textPrimary, fontWeight: 500 }}>
                                {purchase.details?.supplier || '-'}
                              </TableCell>
                              <TableCell align="right" sx={{ color: colors.textPrimary, fontWeight: 500 }}>
                                {formatCurrency(purchase.amount)}
                              </TableCell>
                              <TableCell sx={{ color: colors.textPrimary }}>
                                {paymentMethodDisplay}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                <TablePagination
                  component="div"
                  count={filteredPurchases.length}
                  page={purchasePage}
                  onPageChange={handlePurchaseChangePage}
                  rowsPerPage={purchaseRowsPerPage}
                  onRowsPerPageChange={handlePurchaseChangeRowsPerPage}
                  rowsPerPageOptions={[10, 25, 50, 100]}
                  sx={{
                    color: colors.textPrimary,
                    '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                      color: colors.textPrimary
                    }
                  }}
                />
              </>
            )}
          </CardContent>
        </Card>
      </Box>
    );
  };

  const renderSuppliersTab = () => {
    const paginatedSuppliers = filteredSuppliers.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );

    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <List sx={{ color: colors.accentText, fontSize: 40 }} />
            <Typography variant="h4" component="h1" sx={{ color: colors.accentText, fontWeight: 700 }}>
              Suppliers
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              '&:hover': { backgroundColor: '#00C4A3' }
            }}
          >
            Add Supplier
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card sx={{ backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  Show
                </Typography>
                <TextField
                  select
                  size="small"
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                  }}
                  SelectProps={{ native: true }}
                  sx={{ minWidth: 80 }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </TextField>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  entries
                </Typography>
              </Box>
              <TextField
                size="small"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: colors.textSecondary }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  minWidth: 250,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                    '& fieldset': { borderColor: colors.border },
                  },
                  '& .MuiInputBase-input': { color: colors.textPrimary }
                }}
              />
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <TableContainer component={Paper} variant="outlined" sx={{ backgroundColor: colors.paper }}>
                  <Table>
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
                            <TableCell sx={{ color: colors.textPrimary, fontWeight: 500 }}>
                              {supplier.name}
                            </TableCell>
                            <TableCell sx={{ color: colors.textPrimary }}>
                              {supplier.phone || '-'}
                            </TableCell>
                            <TableCell sx={{ color: colors.textPrimary }}>
                              {supplier.email || '-'}
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenDialog(supplier)}
                                sx={{ color: colors.accentText }}
                                title="Edit Supplier"
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => handleDelete(supplier)}
                                sx={{ color: '#FF3366' }}
                                title="Delete Supplier"
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                <TablePagination
                  component="div"
                  count={filteredSuppliers.length}
                  page={page}
                  onPageChange={handleChangePage}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  rowsPerPageOptions={[10, 25, 50, 100]}
                  sx={{
                    color: colors.textPrimary,
                    '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                      color: colors.textPrimary
                    }
                  }}
                />
              </>
            )}
          </CardContent>
        </Card>
      </Box>
    );
  };

  const renderPayablesTab = () => {
    const paginatedSuppliers = filteredSuppliers.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );

    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Receipt sx={{ color: colors.accentText, fontSize: 40 }} />
            <Typography variant="h4" component="h1" sx={{ color: colors.accentText, fontWeight: 700 }}>
              Payables
            </Typography>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card sx={{ backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  Show
                </Typography>
                <TextField
                  select
                  size="small"
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                  }}
                  SelectProps={{ native: true }}
                  sx={{ minWidth: 80 }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </TextField>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  entries
                </Typography>
              </Box>
              <TextField
                size="small"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ color: colors.textSecondary }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  minWidth: 250,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                    '& fieldset': { borderColor: colors.border },
                  },
                  '& .MuiInputBase-input': { color: colors.textPrimary }
                }}
              />
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <TableContainer component={Paper} variant="outlined" sx={{ backgroundColor: colors.paper }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : 'rgba(0, 0, 0, 0.05)' }}>
                        <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Supplier</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Phone</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Email</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: colors.accentText }}>Opening Balance</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: colors.accentText }}>Status</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: colors.accentText }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedSuppliers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ color: colors.textSecondary, py: 4 }}>
                            {searchTerm ? 'No suppliers found matching your search.' : 'No suppliers found.'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedSuppliers.map((supplier) => (
                          <TableRow key={supplier.id} hover>
                            <TableCell sx={{ color: colors.textPrimary, fontWeight: 500 }}>
                              {supplier.name}
                            </TableCell>
                            <TableCell sx={{ color: colors.textPrimary }}>
                              {supplier.phone || '-'}
                            </TableCell>
                            <TableCell sx={{ color: colors.textPrimary }}>
                              {supplier.email || '-'}
                            </TableCell>
                            <TableCell align="right">
                              <Typography
                                variant="body1"
                                fontWeight="medium"
                                color={supplier.openingBalance >= 0 ? 'success.main' : 'error.main'}
                              >
                                {formatCurrency(supplier.openingBalance)}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={supplier.isActive ? 'Active' : 'Inactive'}
                                color={supplier.isActive ? 'success' : 'default'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/suppliers/${supplier.id}`)}
                                sx={{ color: colors.accentText }}
                                title="View Details"
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => handleDelete(supplier)}
                                sx={{ color: '#FF3366' }}
                                title="Delete Supplier"
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                <TablePagination
                  component="div"
                  count={filteredSuppliers.length}
                  page={page}
                  onPageChange={handleChangePage}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  rowsPerPageOptions={[10, 25, 50, 100]}
                  sx={{
                    color: colors.textPrimary,
                    '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                      color: colors.textPrimary
                    }
                  }}
                />
              </>
            )}
          </CardContent>
        </Card>
      </Box>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AccountBalance sx={{ color: colors.accentText, fontSize: 40 }} />
          <Typography variant="h4" component="h1" sx={{ color: colors.accentText, fontWeight: 700 }}>
            Purchases
          </Typography>
        </Box>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={currentTab}
          onChange={(e, newValue) => setCurrentTab(newValue)}
          sx={{
            '& .MuiTab-root': {
              color: colors.textSecondary,
              '&.Mui-selected': {
                color: colors.accentText
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: colors.accentText
            }
          }}
        >
          <Tab label="Purchases" />
          <Tab label="Suppliers" />
          <Tab label="Payables" />
        </Tabs>
      </Box>

      {currentTab === 0 && renderPurchasesTab()}
      {currentTab === 1 && renderSuppliersTab()}
      {currentTab === 2 && renderPayablesTab()}

      {/* Add/Edit Supplier Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>
          {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
        </DialogTitle>
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
                  helperText={formErrors.email && (touchedFields.email || formData.email) ? formErrors.email : 'Optional: Supplier email address'}
                  placeholder="Email"
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
                  label="Phone Number"
                  value={formData.phone}
                  onChange={(e) => handleFieldChange('phone', e.target.value)}
                  error={!!formErrors.phone && (touchedFields.phone || formData.phone)}
                  helperText={formErrors.phone && (touchedFields.phone || formData.phone) ? formErrors.phone : 'Optional: Format as 0712345678 or 254712345678'}
                  placeholder="Phone Number"
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
                  label="Opening Balance"
                  type="number"
                  required
                  value={formData.openingBalance}
                  onChange={(e) => handleFieldChange('openingBalance', e.target.value)}
                  error={!!formErrors.openingBalance && (touchedFields.openingBalance || formData.openingBalance)}
                  helperText={formErrors.openingBalance && (touchedFields.openingBalance || formData.openingBalance) ? formErrors.openingBalance : 'Enter positive or negative balance (e.g., 1000 or -500)'}
                  placeholder="Opening Balance"
                  InputProps={{
                    inputProps: { step: '0.01' }
                  }}
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
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: colors.paper, p: 2 }}>
          <Button onClick={handleCloseDialog} sx={{ color: colors.textSecondary }}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={20} /> : <CheckCircle />}
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              '&:hover': { backgroundColor: '#00C4A3' },
              '&:disabled': { backgroundColor: colors.border }
            }}
          >
            {isSubmitting ? 'Saving...' : (editingSupplier ? 'Update' : 'Add')} Supplier
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Purchase Dialog */}
      <Dialog open={openPurchaseDialog} onClose={handleClosePurchaseDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>
          Add Purchase
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: colors.paper }}>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel 
                    sx={{
                      color: colors.textSecondary,
                      '&.Mui-focused': { color: colors.accentText }
                    }}
                  >
                    Supplier *
                  </InputLabel>
                  <Select
                    value={purchaseFormData.supplierId}
                    onChange={(e) => setPurchaseFormData({ ...purchaseFormData, supplierId: e.target.value })}
                    error={!!purchaseFormErrors.supplierId}
                    label="Supplier *"
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 300,
                          minWidth: 300
                        }
                      }
                    }}
                    sx={{
                      color: colors.textPrimary,
                      minWidth: 300,
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: colors.border
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: colors.accentText
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: colors.accentText
                      }
                    }}
                  >
                    {suppliers.map((supplier) => (
                      <MenuItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {purchaseFormErrors.supplierId && (
                    <Typography variant="caption" sx={{ color: 'error.main', mt: 0.5, ml: 1.75 }}>
                      {purchaseFormErrors.supplierId}
                    </Typography>
                  )}
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Amount *"
                  type="number"
                  required
                  value={purchaseFormData.amount}
                  onChange={(e) => setPurchaseFormData({ ...purchaseFormData, amount: e.target.value })}
                  error={!!purchaseFormErrors.amount}
                  helperText={purchaseFormErrors.amount || 'Enter the purchase amount'}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <AttachMoney sx={{ color: colors.textSecondary }} />
                      </InputAdornment>
                    ),
                    inputProps: { step: '0.01', min: 0 }
                  }}
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
                <FormControl fullWidth>
                  <InputLabel 
                    sx={{
                      color: colors.textSecondary,
                      '&.Mui-focused': { color: colors.accentText }
                    }}
                  >
                    Payment Method *
                  </InputLabel>
                  <Select
                    value={purchaseFormData.paymentMethod}
                    onChange={(e) => setPurchaseFormData({ ...purchaseFormData, paymentMethod: e.target.value, recipientName: '', mpesaName: '' })}
                    label="Payment Method *"
                    sx={{
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
                    }}
                  >
                    <MenuItem value="cash">Cash</MenuItem>
                    <MenuItem value="mpesa">M-Pesa</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {purchaseFormData.paymentMethod === 'cash' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Recipient Name *"
                    required
                    value={purchaseFormData.recipientName}
                    onChange={(e) => setPurchaseFormData({ ...purchaseFormData, recipientName: e.target.value })}
                    error={!!purchaseFormErrors.recipientName}
                    helperText={purchaseFormErrors.recipientName || 'Enter the recipient name for cash payment'}
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
              )}
              {purchaseFormData.paymentMethod === 'mpesa' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="M-Pesa Name *"
                    required
                    value={purchaseFormData.mpesaName}
                    onChange={(e) => setPurchaseFormData({ ...purchaseFormData, mpesaName: e.target.value })}
                    error={!!purchaseFormErrors.mpesaName}
                    helperText={purchaseFormErrors.mpesaName || 'Enter the M-Pesa account name'}
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
              )}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: colors.paper, p: 2 }}>
          <Button onClick={handleClosePurchaseDialog} sx={{ color: colors.textSecondary }}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmitPurchase} 
            variant="contained"
            disabled={isSubmittingPurchase}
            startIcon={isSubmittingPurchase ? <CircularProgress size={20} /> : <CheckCircle />}
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              '&:hover': { backgroundColor: '#00C4A3' },
              '&:disabled': { backgroundColor: colors.border }
            }}
          >
            {isSubmittingPurchase ? 'Submitting...' : 'Submit Purchase'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Snackbar */}
      <Snackbar
        open={showSuccessSnackbar}
        autoHideDuration={3000}
        onClose={() => setShowSuccessSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setShowSuccessSnackbar(false)} 
          severity="success" 
          sx={{ width: '100%' }}
          icon={<CheckCircle />}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Payables;
