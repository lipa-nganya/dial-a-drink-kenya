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
  TablePagination
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  AccountBalance,
  Email,
  Phone,
  AttachMoney,
  List,
  Search,
  PersonAdd,
  Receipt,
  ArrowBack,
  CheckCircle,
  Info
} from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { Snackbar } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const Payables = () => {
  const navigate = useNavigate();
  const { isDarkMode, colors } = useTheme();
  const [view, setView] = useState('menu'); // 'menu', 'list', 'add', 'payables'
  const [suppliers, setSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
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

  useEffect(() => {
    if (view === 'list' || view === 'payables') {
    fetchSuppliers();
    }
  }, [view]);

  useEffect(() => {
    if (view === 'list' || view === 'payables') {
      filterSuppliers();
    }
  }, [searchTerm, suppliers, view]);

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
    setPage(0); // Reset to first page when filtering
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

  // Format phone number (Kenyan format)
  const formatPhoneNumber = (value) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    
    // Format as Kenyan phone number
    if (digits.startsWith('254')) {
      return digits.length <= 12 ? digits : digits.substring(0, 12);
    } else if (digits.startsWith('0')) {
      return digits.length <= 10 ? digits : digits.substring(0, 10);
    } else if (digits.length > 0) {
      // If it doesn't start with 0 or 254, assume it's a local number
      return digits.length <= 9 ? `0${digits}` : `0${digits.substring(0, 9)}`;
    }
    return digits;
  };

  // Validate phone number
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

  // Real-time validation
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
    
    // Format phone number
    if (field === 'phone') {
      processedValue = formatPhoneNumber(value);
    }
    
    setFormData(prev => ({ ...prev, [field]: processedValue }));
    setTouchedFields(prev => ({ ...prev, [field]: true }));
    
    // Real-time validation for touched fields
    if (touchedFields[field] || processedValue) {
      validateField(field, processedValue);
    }
  };

  const handleSubmit = async () => {
    // Mark all fields as touched
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
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        openingBalance: '0.00'
      });
      setTouchedFields({});
      setFormErrors({});

      // Refresh suppliers list if we're in list or payables view
      if (view === 'list' || view === 'payables') {
      await fetchSuppliers();
      }

      // Close dialog if open, or navigate to list view
      if (openDialog) {
      handleCloseDialog();
      }
      
      if (view === 'add') {
        // Wait a moment to show success message, then navigate
        setTimeout(() => {
          setView('list');
        }, 1500);
      }
    } catch (err) {
      console.error('Error saving supplier:', err);
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.message || 
                          'Failed to save supplier. Please try again.';
      setError(errorMessage);
      
      // If it's a validation error from the server, update form errors
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

  const getCurrentDate = () => {
    const date = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    // Add ordinal suffix
    const getOrdinal = (n) => {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    
    return `${dayName} ${getOrdinal(day)} ${month} ${year}`;
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Main menu view
  if (view === 'menu') {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          {/* Logo placeholder - you can replace with actual logo */}
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
            <AccountBalance sx={{ fontSize: 80, color: colors.accentText }} />
          </Box>
          <Typography 
            variant="h3" 
            component="h1" 
            sx={{ 
              fontWeight: 700, 
              mb: 2,
              color: colors.textPrimary,
              textTransform: 'uppercase',
              letterSpacing: 2
            }}
          >
            PAYABLES
          </Typography>
          <Typography 
            variant="h6" 
            sx={{ 
              color: colors.textSecondary,
              mb: 4
            }}
          >
            {getCurrentDate()}
          </Typography>
        </Box>

        <Grid container spacing={3} justifyContent="center">
          <Grid item xs={12} sm={6} md={4}>
            <Card
              sx={{
                textAlign: 'center',
                p: 3,
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                backgroundColor: colors.paper,
                border: `1px solid ${colors.border}`,
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4
                }
              }}
              onClick={() => {
                setView('add');
                setFormData({
                  name: '',
                  email: '',
                  phone: '',
                  openingBalance: '0.00'
                });
                setTouchedFields({});
                setFormErrors({});
                setError(null);
              }}
            >
              <CardContent>
                <PersonAdd sx={{ fontSize: 60, color: colors.accentText, mb: 2 }} />
                <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                  Add Supplier
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Card
              sx={{
                textAlign: 'center',
                p: 3,
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                backgroundColor: colors.paper,
                border: `1px solid ${colors.border}`,
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4
                }
              }}
              onClick={() => setView('list')}
            >
              <CardContent>
                <List sx={{ fontSize: 60, color: colors.accentText, mb: 2 }} />
                <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                  List Suppliers
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Card
              sx={{
                textAlign: 'center',
                p: 3,
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                backgroundColor: colors.paper,
                border: `1px solid ${colors.border}`,
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4
                }
              }}
              onClick={() => setView('payables')}
            >
              <CardContent>
                <Receipt sx={{ fontSize: 60, color: colors.accentText, mb: 2 }} />
                <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                  Payables List
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Add Supplier Dialog */}
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
              sx={{
                backgroundColor: colors.accentText,
                color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                '&:hover': { backgroundColor: '#00C4A3' }
              }}
            >
              {editingSupplier ? 'Update' : 'Add'} Supplier
        </Button>
          </DialogActions>
        </Dialog>
      </Container>
    );
  }

  // Add Supplier view
  if (view === 'add') {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => setView('menu')}
            sx={{ mb: 2, color: colors.textSecondary }}
          >
            Back to Menu
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <PersonAdd sx={{ color: colors.accentText, fontSize: 40 }} />
            <Typography variant="h4" component="h1" sx={{ color: colors.accentText, fontWeight: 700 }}>
              Add New Supplier
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 3 }}>
            Fill in the supplier details below. All fields marked with * are required.
          </Typography>
      </Box>

      {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

        <Card sx={{ backgroundColor: colors.paper, border: `1px solid ${colors.border}`, p: 3 }}>
          <Box sx={{ mb: 3, borderBottom: `1px solid ${colors.border}`, pb: 2 }}>
            <Typography variant="h6" sx={{ color: colors.accentText, fontWeight: 600 }}>
              Details
            </Typography>
        </Box>

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Supplier"
                placeholder="Supplier's Name"
                required
                value={formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                error={!!formErrors.name && (touchedFields.name || formData.name)}
                helperText={formErrors.name && (touchedFields.name || formData.name) ? formErrors.name : 'Enter the supplier company or individual name'}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AccountBalance sx={{ color: colors.textSecondary }} />
                    </InputAdornment>
                  ),
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
              <TextField
                fullWidth
                label="Email"
                placeholder="Email"
                type="email"
                value={formData.email}
                onChange={(e) => handleFieldChange('email', e.target.value)}
                error={!!formErrors.email && (touchedFields.email || formData.email)}
                helperText={formErrors.email && (touchedFields.email || formData.email) ? formErrors.email : 'Optional: Supplier email address'}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email sx={{ color: colors.textSecondary }} />
                    </InputAdornment>
                  ),
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
              <TextField
                fullWidth
                label="Phone"
                placeholder="Phone Number"
                value={formData.phone}
                onChange={(e) => handleFieldChange('phone', e.target.value)}
                error={!!formErrors.phone && (touchedFields.phone || formData.phone)}
                helperText={formErrors.phone && (touchedFields.phone || formData.phone) ? formErrors.phone : 'Optional: Format as 0712345678 or 254712345678'}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Phone sx={{ color: colors.textSecondary }} />
                    </InputAdornment>
                  ),
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
              <TextField
                fullWidth
                label="Opening Balance"
                placeholder="Opening Balance"
                type="number"
                required
                value={formData.openingBalance}
                onChange={(e) => handleFieldChange('openingBalance', e.target.value)}
                error={!!formErrors.openingBalance && (touchedFields.openingBalance || formData.openingBalance)}
                helperText={formErrors.openingBalance && (touchedFields.openingBalance || formData.openingBalance) ? formErrors.openingBalance : 'Enter positive or negative balance (e.g., 1000 or -500)'}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AttachMoney sx={{ color: colors.textSecondary }} />
                    </InputAdornment>
                  ),
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

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4, pt: 3, borderTop: `1px solid ${colors.border}` }}>
            <Button
              onClick={() => setView('menu')}
              sx={{ color: colors.textSecondary }}
            >
              Close
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={20} /> : <CheckCircle />}
              sx={{
                backgroundColor: colors.accentText,
                color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                '&:hover': { backgroundColor: '#00C4A3' },
                '&:disabled': { backgroundColor: colors.border }
              }}
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </Box>
        </Card>

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
  }

  // List Suppliers view
  if (view === 'list') {
    const paginatedSuppliers = filteredSuppliers.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );

    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <List sx={{ color: colors.accentText, fontSize: 40 }} />
            <Typography variant="h4" component="h1" sx={{ color: colors.accentText, fontWeight: 700 }}>
              Suppliers List
                </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => setView('menu')}
              sx={{ borderColor: colors.border, color: colors.textPrimary }}
            >
              Back
            </Button>
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
                  SelectProps={{
                    native: true,
                  }}
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
      </Container>
    );
  }

  // Payables List view (showing suppliers with balances)
  if (view === 'payables') {
    const paginatedSuppliers = filteredSuppliers.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );

    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Receipt sx={{ color: colors.accentText, fontSize: 40 }} />
            <Typography variant="h4" component="h1" sx={{ color: colors.accentText, fontWeight: 700 }}>
              Payables List
                            </Typography>
          </Box>
          <Button
            variant="outlined"
            onClick={() => setView('menu')}
            sx={{ borderColor: colors.border, color: colors.textPrimary }}
          >
            Back
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
                  SelectProps={{
                    native: true,
                  }}
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
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  error={!!formErrors.name}
                  helperText={formErrors.name}
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
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  error={!!formErrors.email}
                  helperText={formErrors.email}
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
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                  error={!!formErrors.openingBalance}
                  helperText={formErrors.openingBalance || 'Enter positive or negative balance (e.g., 1000 or -500)'}
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
              sx={{
                backgroundColor: colors.accentText,
                color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                '&:hover': { backgroundColor: '#00C4A3' }
              }}
            >
            {editingSupplier ? 'Update' : 'Add'} Supplier
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
    );
  }

  return (
    <>
      {/* Global Success Snackbar */}
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
    </>
  );
};

export default Payables;
