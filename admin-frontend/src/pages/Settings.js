import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Grid,
  Alert,
  CircularProgress,
  TextField,
  Chip,
  Switch,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Notifications,
  LocalShipping,
  LocalOffer,
  Image as ImageIcon,
  Save,
  Edit,
  Add,
  Delete,
  Phone,
  Person,
  NotificationsActive,
  NotificationsOff,
  Warning,
  Cancel as CancelIcon,
  PersonAdd,
  AdminPanelSettings,
  CloudUpload
} from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const { isDarkMode, colors } = useTheme();

  // Notifications module state
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingNotification, setEditingNotification] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    isActive: true,
    notes: ''
  });
  const [formError, setFormError] = useState('');

  // SMS Settings state
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [smsSettingsLoading, setSmsSettingsLoading] = useState(false);

  // Stock Alert Settings state
  const [stockAlertSettings, setStockAlertSettings] = useState({
    stockAlertQuantity: 10,
    stockAlertRecipient: ''
  });
  const [stockAlertSettingsLoading, setStockAlertSettingsLoading] = useState(false);
  const [showStockAlertSettings, setShowStockAlertSettings] = useState(false);

  // Delivery Fee Settings state
  const [deliverySettings, setDeliverySettings] = useState({
    isTestMode: false,
    deliveryFeeWithAlcohol: 50,
    deliveryFeeWithoutAlcohol: 30,
    maxTipEnabled: false,
    driverPayPerDeliveryEnabled: false,
    driverPayPerDeliveryAmount: 0
  });
  const [showDeliverySettings, setShowDeliverySettings] = useState(false);
  const [deliverySettingsLoading, setDeliverySettingsLoading] = useState(false);
  const [showTestModeWarning, setShowTestModeWarning] = useState(false);

  // Countdown Offers state
  const [countdowns, setCountdowns] = useState([]);
  const [showCountdownForm, setShowCountdownForm] = useState(false);
  const [countdownForm, setCountdownForm] = useState({
    title: '',
    startDate: '',
    endDate: ''
  });
  const [editingCountdown, setEditingCountdown] = useState(null);
  const [countdownFormError, setCountdownFormError] = useState('');
  const countdownFieldStyles = {
    '& .MuiOutlinedInput-root': {
      backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
      '& fieldset': { borderColor: colors.accentText },
      '&:hover fieldset': { borderColor: colors.accentText },
      '&.Mui-focused fieldset': { borderColor: colors.accentText }
    },
    '& .MuiOutlinedInput-input': {
      color: colors.textPrimary
    },
    '& .MuiInputBase-input': {
      color: colors.textPrimary
    },
    '& input[type="datetime-local"]': {
      color: colors.textPrimary
    },
    '& .MuiInputLabel-root': {
      color: isDarkMode ? colors.accentText : undefined
    },
    '& .MuiInputLabel-root.Mui-focused': {
      color: colors.accentText
    },
    '& input[type="datetime-local"]::-webkit-calendar-picker-indicator': {
      filter: isDarkMode ? 'invert(75%) sepia(59%) saturate(514%) hue-rotate(116deg) brightness(97%) contrast(93%)' : 'none'
    },
    '& input[type="datetime-local"]::-webkit-calendar-picker-indicator:hover': {
      filter: isDarkMode ? 'invert(75%) sepia(59%) saturate(514%) hue-rotate(116deg) brightness(97%) contrast(93%)' : 'none'
    }
  };

  const formatDateTimeLocal = (value) => {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const offset = date.getTimezoneOffset();
    const adjusted = new Date(date.getTime() - offset * 60000);
    return adjusted.toISOString().slice(0, 16);
  };

  const isCountdownSaveDisabled =
    !countdownForm.title.trim() || !countdownForm.startDate || !countdownForm.endDate;

  // Hero Management state
  const [heroImage, setHeroImage] = useState('');
  const [heroImageInput, setHeroImageInput] = useState('');
  const [heroImageFileName, setHeroImageFileName] = useState('');
  const [heroImageUploadError, setHeroImageUploadError] = useState('');
  const [heroImageUploadLoading, setHeroImageUploadLoading] = useState(false);
  const [useHeroImageUrl, setUseHeroImageUrl] = useState(false);
  const [showHeroImageForm, setShowHeroImageForm] = useState(false);
  const heroImageFileInputRef = useRef(null);

  // User Management state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [openUserDialog, setOpenUserDialog] = useState(false);
  const [userFormData, setUserFormData] = useState({
    username: '',
    email: '',
    role: 'manager'
  });
  const [userFormError, setUserFormError] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState(null);

  useEffect(() => {
    fetchAllData();
    fetchCurrentUser();
    fetchStockAlertSettings();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await api.get('/admin/me');
      setCurrentUserRole(response.data.role);
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  // ========== USER MANAGEMENT ==========
  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const response = await api.get('/admin/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      if (error.response?.status === 403) {
        setError('You do not have permission to manage users. Admin role required.');
      } else if (error.response?.status === 401) {
        setError('Authentication required. Please log in again.');
      } else if (!error.response) {
        setError('Failed to connect to server. Please ensure the backend is running.');
      } else {
        setError(error.response?.data?.error || 'Failed to fetch users');
      }
    } finally {
      setUsersLoading(false);
    }
  };

  const handleOpenUserDialog = () => {
    setUserFormData({ username: '', email: '', role: 'manager' });
    setUserFormError('');
    setOpenUserDialog(true);
  };

  const handleCloseUserDialog = () => {
    setOpenUserDialog(false);
    setUserFormData({ username: '', email: '', role: 'manager' });
    setUserFormError('');
  };

  const handleSaveUser = async () => {
    setUserFormError('');
    
    if (!userFormData.username.trim()) {
      setUserFormError('Username is required');
      return;
    }

    if (!userFormData.email.trim()) {
      setUserFormError('Email is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userFormData.email.trim())) {
      setUserFormError('Please enter a valid email address');
      return;
    }

    try {
      await api.post('/admin/users', userFormData);
      setNotification({ message: 'User created and invite email sent successfully!' });
      handleCloseUserDialog();
      fetchUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message || 'Failed to create user';
      const errorDetails = error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : '';
      setUserFormError(errorMessage + (errorDetails ? `: ${errorDetails}` : ''));
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchNotifications(),
        fetchSmsSettings(),
        fetchDeliverySettings(),
        fetchCountdowns(),
        fetchHeroImage(),
        fetchUsers()
      ]);
    } catch (error) {
      console.error('Error fetching settings data:', error);
      setError('Failed to load settings data');
    } finally {
      setLoading(false);
    }
  };

  // ========== NOTIFICATIONS MODULE ==========
  const fetchNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const response = await api.get('/admin/order-notifications');
      setNotifications(response.data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setError(error.response?.data?.error || error.message);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleOpenDialog = (notification = null) => {
    if (notification) {
      setEditingNotification(notification);
      setFormData({
        name: notification.name || '',
        phoneNumber: notification.phoneNumber || '',
        isActive: notification.isActive !== undefined ? notification.isActive : true,
        notes: notification.notes || ''
      });
    } else {
      setEditingNotification(null);
      setFormData({
        name: '',
        phoneNumber: '',
        isActive: true,
        notes: ''
      });
    }
    setFormError('');
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingNotification(null);
    setFormData({
      name: '',
      phoneNumber: '',
      isActive: true,
      notes: ''
    });
    setFormError('');
  };

  const handleSaveNotification = async () => {
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Name is required');
      return;
    }

    if (!formData.phoneNumber.trim()) {
      setFormError('Phone number is required');
      return;
    }

    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(formData.phoneNumber.trim())) {
      setFormError('Please enter a valid phone number');
      return;
    }

    try {
      if (editingNotification) {
        await api.put(`/admin/order-notifications/${editingNotification.id}`, formData);
      } else {
        await api.post('/admin/order-notifications', formData);
      }
      handleCloseDialog();
      fetchNotifications();
      setNotification({ message: `Notification ${editingNotification ? 'updated' : 'added'} successfully!` });
    } catch (error) {
      console.error('Error saving notification:', error);
      setFormError(error.response?.data?.error || error.message || 'Failed to save notification');
    }
  };

  const handleDeleteNotification = async (id) => {
    if (!window.confirm('Are you sure you want to delete this notification recipient?')) {
      return;
    }

    try {
      await api.delete(`/admin/order-notifications/${id}`);
      fetchNotifications();
      setNotification({ message: 'Notification deleted successfully!' });
    } catch (error) {
      console.error('Error deleting notification:', error);
      alert(error.response?.data?.error || error.message || 'Failed to delete notification');
    }
  };

  // ========== SMS SETTINGS ==========
  const fetchSmsSettings = async () => {
    try {
      const response = await api.get('/admin/sms-settings');
      setSmsEnabled(response.data.smsEnabled);
    } catch (error) {
      console.error('Error fetching SMS settings:', error);
      setSmsEnabled(true);
    }
  };

  const updateSmsSettings = async (enabled) => {
    try {
      setSmsSettingsLoading(true);
      await api.put('/admin/sms-settings', { smsEnabled: enabled });
      setSmsEnabled(enabled);
      setNotification({ message: `SMS notifications ${enabled ? 'enabled' : 'disabled'} successfully!` });
    } catch (error) {
      console.error('Error updating SMS settings:', error);
      setError(`Failed to ${enabled ? 'enable' : 'disable'} SMS notifications`);
      setSmsEnabled(!enabled);
    } finally {
      setSmsSettingsLoading(false);
    }
  };

  // ========== STOCK ALERT SETTINGS ==========
  const fetchStockAlertSettings = async () => {
    try {
      const [quantityRes, recipientRes] = await Promise.all([
        api.get('/settings/stockAlertQuantity').catch(() => ({ data: null, status: 404 })),
        api.get('/settings/stockAlertRecipient').catch(() => ({ data: null, status: 404 }))
      ]);

      // Convert comma-separated recipients to newline-separated for better display in multiline field
      const recipientValue = recipientRes.data?.value || '';
      const formattedRecipients = recipientValue
        .split(',')
        .map(r => r.trim())
        .filter(r => r.length > 0)
        .join('\n');

      setStockAlertSettings({
        stockAlertQuantity: parseInt(quantityRes.data?.value || '10'),
        stockAlertRecipient: formattedRecipients
      });
    } catch (error) {
      console.error('Error fetching stock alert settings:', error);
      setStockAlertSettings({
        stockAlertQuantity: 10,
        stockAlertRecipient: ''
      });
    }
  };

  const saveStockAlertSettings = async () => {
    // Parse recipients (comma or newline separated)
    const recipients = stockAlertSettings.stockAlertRecipient
      .split(/[,\n]/)
      .map(r => r.trim())
      .filter(r => r.length > 0);

    if (recipients.length === 0) {
      setError('At least one stock alert recipient is required');
      return;
    }

    if (stockAlertSettings.stockAlertQuantity < 0) {
      setError('Stock alert quantity must be a non-negative number');
      return;
    }

    try {
      setStockAlertSettingsLoading(true);
      // Save as comma-separated string
      await Promise.all([
        api.put('/settings/stockAlertQuantity', { value: stockAlertSettings.stockAlertQuantity.toString() }),
        api.put('/settings/stockAlertRecipient', { value: recipients.join(',') })
      ]);
      setNotification({ message: `Stock alert settings saved successfully! ${recipients.length} recipient(s) configured.` });
      setShowStockAlertSettings(false);
    } catch (error) {
      console.error('Error saving stock alert settings:', error);
      setError('Failed to save stock alert settings');
    } finally {
      setStockAlertSettingsLoading(false);
    }
  };

  // ========== DELIVERY FEE SETTINGS ==========
  const fetchDeliverySettings = async () => {
    try {
      const [testModeRes, withAlcoholRes, withoutAlcoholRes, maxTipRes, driverPayEnabledRes, driverPayAmountRes] = await Promise.all([
        api.get('/settings/deliveryTestMode').catch(() => ({ data: null, status: 404 })),
        api.get('/settings/deliveryFeeWithAlcohol').catch(() => ({ data: null, status: 404 })),
        api.get('/settings/deliveryFeeWithoutAlcohol').catch(() => ({ data: null, status: 404 })),
        api.get('/settings/maxTipEnabled').catch(() => ({ data: null, status: 404 })),
        api.get('/settings/driverPayPerDeliveryEnabled').catch(() => ({ data: null, status: 404 })),
        api.get('/settings/driverPayPerDeliveryAmount').catch(() => ({ data: null, status: 404 }))
      ]);

      setDeliverySettings({
        isTestMode: testModeRes.data?.value === 'true' || false,
        deliveryFeeWithAlcohol: parseFloat(withAlcoholRes.data?.value || '50'),
        deliveryFeeWithoutAlcohol: parseFloat(withoutAlcoholRes.data?.value || '30'),
        maxTipEnabled: maxTipRes.data?.value === 'true' || false,
        driverPayPerDeliveryEnabled: driverPayEnabledRes.data?.value === 'true' || false,
        driverPayPerDeliveryAmount: parseFloat(driverPayAmountRes.data?.value || '0')
      });
    } catch (error) {
      console.error('Error fetching delivery settings:', error);
      setDeliverySettings({
        isTestMode: false,
        deliveryFeeWithAlcohol: 50,
        deliveryFeeWithoutAlcohol: 30,
        maxTipEnabled: false,
        driverPayPerDeliveryEnabled: false,
        driverPayPerDeliveryAmount: 0
      });
    }
  };

  const saveDeliverySettings = async () => {
    try {
      setDeliverySettingsLoading(true);
      await Promise.all([
        api.put('/settings/deliveryTestMode', { value: deliverySettings.isTestMode.toString() }),
        api.put('/settings/deliveryFeeWithAlcohol', { value: deliverySettings.deliveryFeeWithAlcohol.toString() }),
        api.put('/settings/deliveryFeeWithoutAlcohol', { value: deliverySettings.deliveryFeeWithoutAlcohol.toString() }),
        api.put('/settings/maxTipEnabled', { value: deliverySettings.maxTipEnabled.toString() }),
        api.put('/settings/driverPayPerDeliveryEnabled', { value: deliverySettings.driverPayPerDeliveryEnabled.toString() }),
        api.put('/settings/driverPayPerDeliveryAmount', { value: deliverySettings.driverPayPerDeliveryAmount.toString() })
      ]);
      setNotification({ message: 'Delivery settings saved successfully!' });
      setShowDeliverySettings(false);
    } catch (error) {
      console.error('Error saving delivery settings:', error);
      setError('Failed to save delivery settings');
    } finally {
      setDeliverySettingsLoading(false);
    }
  };

  const handleTestModeToggle = (checked) => {
    if (checked) {
      setShowTestModeWarning(true);
    } else {
      setDeliverySettings(prev => ({ ...prev, isTestMode: false }));
    }
  };

  const confirmTestMode = () => {
    setDeliverySettings(prev => ({ ...prev, isTestMode: true }));
    setShowTestModeWarning(false);
  };

  // ========== COUNTDOWN OFFERS ==========
  const fetchCountdowns = async () => {
    try {
      const response = await api.get('/countdown');
      setCountdowns(response.data);
    } catch (error) {
      console.error('Error fetching countdowns:', error);
    }
  };

  const handleNewCountdown = () => {
    setEditingCountdown(null);
    setCountdownForm({
      title: '',
      startDate: '',
      endDate: ''
    });
    setCountdownFormError('');
    setShowCountdownForm(true);
  };

  const handleCancelCountdownForm = () => {
      setShowCountdownForm(false);
    setEditingCountdown(null);
    setCountdownForm({
      title: '',
      startDate: '',
      endDate: ''
    });
    setCountdownFormError('');
  };

  const handleEditCountdown = (countdown) => {
    setEditingCountdown(countdown);
    setCountdownForm({
      title: countdown.title || '',
      startDate: formatDateTimeLocal(countdown.startDate),
      endDate: formatDateTimeLocal(countdown.endDate)
    });
    setCountdownFormError('');
    setShowCountdownForm(true);
  };

  const handleSaveCountdown = async () => {
    setCountdownFormError('');

    if (!countdownForm.title.trim()) {
      setCountdownFormError('Offer title is required');
      return;
    }

    if (!countdownForm.startDate || !countdownForm.endDate) {
      setCountdownFormError('Start and end date are required');
      return;
    }

    const startDateObj = new Date(countdownForm.startDate);
    const endDateObj = new Date(countdownForm.endDate);

    if (Number.isNaN(startDateObj.getTime()) || Number.isNaN(endDateObj.getTime())) {
      setCountdownFormError('Please provide valid start and end dates');
      return;
    }

    if (startDateObj >= endDateObj) {
      setCountdownFormError('End date must be after the start date');
      return;
    }

    const payload = {
      title: countdownForm.title.trim(),
      startDate: startDateObj.toISOString(),
      endDate: endDateObj.toISOString()
    };

    try {
      if (editingCountdown) {
        await api.put(`/countdown/${editingCountdown.id}`, payload);
        setNotification({ message: 'Countdown offer updated successfully!' });
      } else {
        await api.post('/countdown', payload);
      setNotification({ message: 'Countdown offer created successfully!' });
      }

      await fetchCountdowns();
      handleCancelCountdownForm();
    } catch (error) {
      console.error('Error saving countdown:', error);
      const errorMessage = error.response?.data?.error || 'Failed to save countdown offer';
      setCountdownFormError(errorMessage);
    }
  };

  const deleteCountdown = async (id) => {
    try {
      await api.delete(`/countdown/${id}`);
      fetchCountdowns();
      setNotification({ message: 'Countdown offer deleted successfully!' });
    } catch (error) {
      console.error('Error deleting countdown:', error);
    }
  };

  // ========== HERO MANAGEMENT ==========
  const fetchHeroImage = async () => {
    try {
      const response = await api.get('/settings/heroImage');
      if (response.data && response.data.value) {
        setHeroImage(response.data.value);
        setHeroImageInput(response.data.value);
        setHeroImageFileName('');
        setHeroImageUploadError('');
        setUseHeroImageUrl(false);
      }
    } catch (error) {
      console.error('Error fetching hero image:', error);
    }
  };

  const updateHeroImage = async () => {
    try {
      await api.put('/settings/heroImage', { value: heroImageInput });
      setHeroImage(heroImageInput);
      setShowHeroImageForm(false);
      setHeroImageFileName('');
      setHeroImageUploadError('');
      setHeroImageUploadLoading(false);
      setUseHeroImageUrl(false);
      setNotification({ message: 'Hero image updated successfully!' });
    } catch (error) {
      console.error('Error updating hero image:', error);
      setError('Failed to update hero image. Please try again.');
    }
  };

  const handleHeroImageFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setHeroImageUploadError('');
    setHeroImageUploadLoading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await api.post('/settings/heroImage/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const uploadedUrl = response.data?.url || response.data?.path;
      if (!uploadedUrl) {
        throw new Error('Upload failed. No URL returned.');
      }

      setHeroImageInput(uploadedUrl);
      setHeroImageFileName(file.name);
      setUseHeroImageUrl(false);
    } catch (uploadError) {
      console.error('Error uploading hero image:', uploadError);
      const message = uploadError.response?.data?.error || uploadError.message || 'Failed to upload hero image.';
      setHeroImageUploadError(message);
    } finally {
      setHeroImageUploadLoading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const openHeroImageFilePicker = () => {
    if (heroImageFileInputRef.current) {
      heroImageFileInputRef.current.click();
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading settings...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <SettingsIcon sx={{ color: colors.accentText, fontSize: 40 }} />
          <Typography variant="h4" component="h1" gutterBottom sx={{ color: colors.accentText, fontWeight: 700 }}>
            Settings
          </Typography>
        </Box>
        <Typography variant="h6" color="text.secondary">
          Manage your LiquorOS configuration
        </Typography>
      </Box>

      {/* Notification Alert */}
      {notification && (
        <Alert 
          severity="success" 
          sx={{ mb: 3 }}
          onClose={() => setNotification(null)}
        >
          {notification.message}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* User Management Module - Admin Only */}
      {currentUserRole === 'admin' && (
        <Card sx={{ mb: 4, backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AdminPanelSettings sx={{ color: colors.accentText, fontSize: 32 }} />
                <Typography variant="h5" sx={{ color: colors.accentText, fontWeight: 600 }}>
                  User Management
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<PersonAdd />}
                onClick={handleOpenUserDialog}
                sx={{
                  backgroundColor: colors.accentText,
                  color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                  '&:hover': { backgroundColor: '#00C4A3' }
                }}
              >
                Invite User
              </Button>
            </Box>

            {usersLoading ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer component={Paper} sx={{ backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Username</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Email</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Role</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Created</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell sx={{ color: colors.textPrimary }}>{user.username}</TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>{user.email}</TableCell>
                        <TableCell>
                          <Chip
                            label={user.role === 'admin' ? 'Admin' : 'Manager'}
                            color={user.role === 'admin' ? 'primary' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>
                          {new Date(user.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 4, color: colors.textSecondary }}>
                          <Typography variant="body2" color="text.secondary">
                            No users found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notifications Module */}
      <Card sx={{ mb: 4, backgroundColor: colors.paper }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Notifications sx={{ color: colors.accentText, fontSize: 32 }} />
              <Typography variant="h5" sx={{ color: colors.accentText, fontWeight: 600 }}>
                Notifications
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
              Add Notification
            </Button>
          </Box>

          {/* SMS Toggle */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="body1" fontWeight="medium">
                  SMS Notifications
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {smsEnabled ? 'SMS notifications are enabled' : 'SMS notifications are disabled'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip
                  label={smsEnabled ? 'ENABLED' : 'DISABLED'}
                  color={smsEnabled ? 'success' : 'default'}
                  sx={{ mr: 1 }}
                />
                {smsSettingsLoading && <CircularProgress size={20} />}
                <Switch
                  checked={smsEnabled}
                  onChange={(e) => updateSmsSettings(e.target.checked)}
                  disabled={smsSettingsLoading}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: colors.accentText,
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: colors.accentText,
                    },
                  }}
                />
              </Box>
            </Box>
          </Box>

          {/* Notification Recipients Table */}
          {notificationsLoading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : notifications.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <NotificationsActive sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No notification recipients found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
                Add recipients to receive notifications when new orders are placed
              </Typography>
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
                Add First Notification
              </Button>
            </Paper>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Phone Number</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Notes</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {notifications.map((notification) => (
                    <TableRow
                      key={notification.id}
                      sx={{
                        '&:hover': {
                          backgroundColor: 'rgba(0, 224, 184, 0.05)'
                        }
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Person fontSize="small" color="text.secondary" />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {notification.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Phone fontSize="small" color="text.secondary" />
                          <Typography variant="body2">
                            {notification.phoneNumber}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={notification.isActive ? <NotificationsActive /> : <NotificationsOff />}
                          label={notification.isActive ? 'Active' : 'Inactive'}
                          color={notification.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {notification.notes || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(notification)}
                            sx={{ color: colors.accentText }}
                          >
                            <Edit />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteNotification(notification.id)}
                            sx={{ color: '#FF3366' }}
                          >
                            <Delete />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Delivery Fee Settings */}
      <Card sx={{ mb: 4, backgroundColor: colors.paper }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <LocalShipping sx={{ fontSize: 32, color: colors.accentText }} />
              <Box>
                <Typography variant="h5" sx={{ color: colors.accentText, fontWeight: 600 }}>
                  Delivery Fee Settings
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Configure delivery fees and terms
                </Typography>
              </Box>
            </Box>
            <Button
              variant="outlined"
              onClick={() => setShowDeliverySettings(!showDeliverySettings)}
              startIcon={<Edit />}
              sx={{
                borderColor: colors.accentText,
                color: colors.accentText,
                '&:hover': { borderColor: '#00C4A3', backgroundColor: 'rgba(0, 224, 184, 0.1)' }
              }}
            >
              {showDeliverySettings ? 'Hide Settings' : 'Edit Settings'}
            </Button>
          </Box>

          {showDeliverySettings && (
            <Box sx={{ mt: 3 }}>
              <Alert severity="info" sx={{ mb: 3 }}>
                Test Mode sets delivery fee to 0. Production Mode uses configured fees based on order type.
              </Alert>

              {showTestModeWarning && (
                <Alert 
                  severity="warning" 
                  sx={{ mb: 3 }}
                  action={
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        color="inherit"
                        size="small"
                        onClick={() => setShowTestModeWarning(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        color="inherit"
                        size="small"
                        onClick={confirmTestMode}
                        variant="contained"
                      >
                        Confirm
                      </Button>
                    </Box>
                  }
                >
                  <Box>
                    <Typography variant="body2" fontWeight="bold" gutterBottom>
                      <Warning sx={{ verticalAlign: 'middle', mr: 1 }} />
                      Warning: Test Mode
                    </Typography>
                    <Typography variant="body2">
                      Enabling Test Mode will set delivery fee to KES 0.00 for all orders. 
                      This should only be used for testing purposes. Are you sure you want to continue?
                    </Typography>
                  </Box>
                </Alert>
              )}

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Box>
                      <Typography variant="body1" fontWeight="medium">
                        Test Mode
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Set delivery fee to 0 (for testing only)
                      </Typography>
                    </Box>
                    <Chip
                      label={deliverySettings.isTestMode ? 'ON' : 'OFF'}
                      color={deliverySettings.isTestMode ? 'warning' : 'default'}
                      sx={{ mr: 2 }}
                    />
                    <Switch
                      checked={deliverySettings.isTestMode}
                      onChange={(e) => handleTestModeToggle(e.target.checked)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: '#FF9800',
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: '#FF9800',
                        },
                      }}
                    />
                  </Box>
                </Grid>

                {deliverySettings.isTestMode && (
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={600}>
                          Max Tip (1 KES)
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          When enabled, maximum tip is limited to 1 KES
                        </Typography>
                      </Box>
                      <Switch
                        checked={deliverySettings.maxTipEnabled}
                        onChange={(e) => setDeliverySettings(prev => ({ ...prev, maxTipEnabled: e.target.checked }))}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: colors.accentText,
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: colors.accentText,
                          },
                        }}
                      />
                    </Box>
                  </Grid>
                )}

                {/* Driver Pay Per Delivery */}
                <Grid item xs={12}>
                  <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={600}>
                          Driver Pay Per Delivery
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Pay drivers a fixed amount per completed delivery
                        </Typography>
                      </Box>
                      <Switch
                        checked={deliverySettings.driverPayPerDeliveryEnabled}
                        onChange={(e) => setDeliverySettings(prev => ({ ...prev, driverPayPerDeliveryEnabled: e.target.checked }))}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: colors.accentText,
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: colors.accentText,
                          },
                        }}
                      />
                    </Box>
                    <TextField
                      fullWidth
                      label="Amount Per Delivery (KES)"
                      type="number"
                      value={deliverySettings.driverPayPerDeliveryAmount}
                      onChange={(e) => setDeliverySettings(prev => ({
                        ...prev,
                        driverPayPerDeliveryAmount: parseFloat(e.target.value) || 0
                      }))}
                      inputProps={{ min: 0, step: 0.01 }}
                      helperText="Amount drivers receive for each completed delivery"
                      disabled={!deliverySettings.driverPayPerDeliveryEnabled}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                          '& fieldset': { borderColor: colors.border },
                          '&:hover fieldset': { borderColor: colors.accentText },
                          '&.Mui-focused fieldset': { borderColor: colors.accentText },
                          '&.Mui-disabled': {
                            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                            color: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'
                          }
                        },
                        '& .MuiInputBase-input': {
                          color: colors.textPrimary
                        },
                        '& .MuiInputLabel-root': {
                          color: colors.textSecondary
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: colors.accentText
                        }
                      }}
                    />
                  </Box>
                </Grid>

                {!deliverySettings.isTestMode && (
                  <>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Delivery Fee (With Alcohol)"
                        type="number"
                        value={deliverySettings.deliveryFeeWithAlcohol}
                        onChange={(e) => setDeliverySettings(prev => ({
                          ...prev,
                          deliveryFeeWithAlcohol: parseFloat(e.target.value) || 0
                        }))}
                        inputProps={{ min: 0, step: 0.01 }}
                        helperText="Applied when order contains alcohol items"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                            '& fieldset': { borderColor: colors.border },
                            '&:hover fieldset': { borderColor: colors.accentText },
                            '&.Mui-focused fieldset': { borderColor: colors.accentText }
                          },
                          '& .MuiInputBase-input': {
                            color: colors.textPrimary
                          },
                          '& .MuiInputLabel-root': {
                            color: colors.textSecondary
                          },
                          '& .MuiInputLabel-root.Mui-focused': {
                            color: colors.accentText
                          }
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Delivery Fee (Without Alcohol)"
                        type="number"
                        value={deliverySettings.deliveryFeeWithoutAlcohol}
                        onChange={(e) => setDeliverySettings(prev => ({
                          ...prev,
                          deliveryFeeWithoutAlcohol: parseFloat(e.target.value) || 0
                        }))}
                        inputProps={{ min: 0, step: 0.01 }}
                        helperText="Applied when order only contains soft drinks"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                            '& fieldset': { borderColor: colors.border },
                            '&:hover fieldset': { borderColor: colors.accentText },
                            '&.Mui-focused fieldset': { borderColor: colors.accentText }
                          },
                          '& .MuiInputBase-input': {
                            color: colors.textPrimary
                          },
                          '& .MuiInputLabel-root': {
                            color: colors.textSecondary
                          },
                          '& .MuiInputLabel-root.Mui-focused': {
                            color: colors.accentText
                          }
                        }}
                      />
                    </Grid>
                  </>
                )}

                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setShowDeliverySettings(false);
                        fetchDeliverySettings();
                      }}
                      sx={{
                        borderColor: colors.border,
                        color: colors.textSecondary,
                        '&:hover': { 
                          borderColor: colors.accentText,
                          backgroundColor: 'rgba(0, 224, 184, 0.05)'
                        }
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="contained"
                      onClick={saveDeliverySettings}
                      disabled={deliverySettingsLoading}
                      startIcon={deliverySettingsLoading ? <CircularProgress size={20} /> : <Save />}
                      sx={{
                        backgroundColor: colors.accentText,
                        color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                        '&:hover': { backgroundColor: '#00C4A3' }
                      }}
                    >
                      {deliverySettingsLoading ? 'Saving...' : 'Save Settings'}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}

          {!showDeliverySettings && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary" component="span">
                  Mode:
                </Typography>
                <Chip label={deliverySettings.isTestMode ? 'Test (KES 0)' : 'Production'} size="small" color={deliverySettings.isTestMode ? 'warning' : 'default'} />
              </Box>
              {!deliverySettings.isTestMode && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  With Alcohol: KES {deliverySettings.deliveryFeeWithAlcohol.toFixed(2)} | 
                  Without Alcohol: KES {deliverySettings.deliveryFeeWithoutAlcohol.toFixed(2)}
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Stock Alert Settings */}
      <Card sx={{ mb: 4, backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Warning sx={{ color: colors.accentText, fontSize: 32 }} />
              <Typography variant="h5" sx={{ color: colors.accentText, fontWeight: 600 }}>
                Stock Alert Settings
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={showStockAlertSettings ? <CancelIcon /> : <Edit />}
              onClick={() => {
                setShowStockAlertSettings(!showStockAlertSettings);
                if (!showStockAlertSettings) {
                  fetchStockAlertSettings();
                }
              }}
              sx={{
                borderColor: colors.accentText,
                color: colors.accentText,
                '&:hover': { borderColor: '#00C4A3', backgroundColor: 'rgba(0, 224, 184, 0.1)' }
              }}
            >
              {showStockAlertSettings ? 'Hide Settings' : 'Edit Settings'}
            </Button>
          </Box>

          {showStockAlertSettings && (
            <Box sx={{ mt: 3 }}>
              <Alert severity="info" sx={{ mb: 3 }}>
                Configure when to receive alerts for low stock levels. Alerts will be sent when any product's stock falls below the threshold.
              </Alert>

              {/* SMS Enable/Disable Toggle */}
              <Box sx={{ mb: 3, p: 2, bgcolor: colors.paper, borderRadius: 1, border: `1px solid ${colors.border}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body1" fontWeight="medium" sx={{ color: colors.textPrimary }}>
                      Enable SMS Alerts
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {smsEnabled ? 'SMS alerts are enabled and will be sent when stock falls below threshold' : 'SMS alerts are disabled - no alerts will be sent'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Chip
                      label={smsEnabled ? 'ENABLED' : 'DISABLED'}
                      color={smsEnabled ? 'success' : 'default'}
                      sx={{ mr: 1 }}
                    />
                    {smsSettingsLoading && <CircularProgress size={20} />}
                    <Switch
                      checked={smsEnabled}
                      onChange={(e) => updateSmsSettings(e.target.checked)}
                      disabled={smsSettingsLoading}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: colors.accentText,
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: colors.accentText,
                        },
                      }}
                    />
                  </Box>
                </Box>
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Stock Alert Quantity"
                    type="number"
                    value={stockAlertSettings.stockAlertQuantity}
                    onChange={(e) => setStockAlertSettings(prev => ({
                      ...prev,
                      stockAlertQuantity: parseInt(e.target.value) || 0
                    }))}
                    inputProps={{ min: 0, step: 1 }}
                    helperText="Alert when stock falls below this quantity"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                        '& fieldset': { borderColor: colors.border },
                        '&:hover fieldset': { borderColor: colors.accentText },
                        '&.Mui-focused fieldset': { borderColor: colors.accentText }
                      },
                      '& .MuiInputBase-input': {
                        color: colors.textPrimary
                      },
                      '& .MuiInputLabel-root': {
                        color: colors.textSecondary
                      },
                      '& .MuiInputLabel-root.Mui-focused': {
                        color: colors.accentText
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Stock Alert Recipients"
                    value={stockAlertSettings.stockAlertRecipient}
                    onChange={(e) => setStockAlertSettings(prev => ({
                      ...prev,
                      stockAlertRecipient: e.target.value
                    }))}
                    placeholder="0712345678&#10;0723456789&#10;0734567890"
                    helperText="Enter phone numbers separated by commas or new lines. Each number will receive stock alerts."
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                        '& fieldset': { borderColor: colors.border },
                        '&:hover fieldset': { borderColor: colors.accentText },
                        '&.Mui-focused fieldset': { borderColor: colors.accentText }
                      },
                      '& .MuiInputBase-input': {
                        color: colors.textPrimary
                      },
                      '& .MuiInputLabel-root': {
                        color: colors.textSecondary
                      },
                      '& .MuiInputLabel-root.Mui-focused': {
                        color: colors.accentText
                      }
                    }}
                  />
                  {stockAlertSettings.stockAlertRecipient && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {stockAlertSettings.stockAlertRecipient
                          .split(/[,\n]/)
                          .map(r => r.trim())
                          .filter(r => r.length > 0).length} recipient(s) configured
                      </Typography>
                    </Box>
                  )}
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setShowStockAlertSettings(false);
                        fetchStockAlertSettings();
                      }}
                      sx={{
                        borderColor: colors.border,
                        color: colors.textSecondary,
                        '&:hover': { 
                          borderColor: colors.accentText,
                          backgroundColor: 'rgba(0, 224, 184, 0.05)'
                        }
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="contained"
                      onClick={saveStockAlertSettings}
                      disabled={stockAlertSettingsLoading}
                      startIcon={stockAlertSettingsLoading ? <CircularProgress size={20} /> : <Save />}
                      sx={{
                        backgroundColor: colors.accentText,
                        color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                        '&:hover': { backgroundColor: '#00C4A3' }
                      }}
                    >
                      {stockAlertSettingsLoading ? 'Saving...' : 'Save Settings'}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}

          {!showStockAlertSettings && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="body2" color="text.secondary" component="span">
                  Alert Threshold:
                </Typography>
                <Chip label={`${stockAlertSettings.stockAlertQuantity} units`} size="small" color="warning" />
              </Box>
              {stockAlertSettings.stockAlertRecipient && (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    Recipients ({stockAlertSettings.stockAlertRecipient.split(/[,\n]/).map(r => r.trim()).filter(r => r.length > 0).length}):
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {stockAlertSettings.stockAlertRecipient
                      .split(/[,\n]/)
                      .map(r => r.trim())
                      .filter(r => r.length > 0)
                      .map((recipient, index) => (
                        <Chip 
                          key={index}
                          label={recipient} 
                          size="small" 
                          sx={{ 
                            backgroundColor: colors.accentText + '20',
                            color: colors.accentText
                          }} 
                        />
                      ))}
                  </Box>
                </Box>
              )}
              {!stockAlertSettings.stockAlertRecipient && (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  No recipients configured
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Countdown Offers */}
      <Card sx={{ mb: 4, backgroundColor: colors.paper }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocalOffer sx={{ color: colors.accentText, fontSize: 32 }} />
              <Typography variant="h5" sx={{ color: colors.accentText, fontWeight: 600 }}>
                Countdown Offers
              </Typography>
            </Box>
            <Button 
              variant="contained" 
              onClick={handleNewCountdown}
              startIcon={<Add />}
              sx={{
                backgroundColor: colors.accentText,
                color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                '&:hover': { backgroundColor: '#00C4A3' }
              }}
            >
              New Countdown
            </Button>
          </Box>

          {showCountdownForm && (
            <Card sx={{ mb: 3, backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: colors.accentText }}>
                  {editingCountdown ? 'Edit Countdown' : 'Create New Countdown'}
                </Typography>
                {countdownFormError && (
                  <Alert severity="error" sx={{ mb: 2 }} onClose={() => setCountdownFormError('')}>
                    {countdownFormError}
                  </Alert>
                )}
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Offer Title"
                      value={countdownForm.title}
                      onChange={(e) => setCountdownForm({...countdownForm, title: e.target.value})}
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                          '& fieldset': { borderColor: colors.border },
                          '&:hover fieldset': { borderColor: colors.accentText },
                          '&.Mui-focused fieldset': { borderColor: colors.accentText }
                        },
                        '& .MuiInputBase-input': {
                          color: colors.textPrimary
                        },
                        '& .MuiInputLabel-root': {
                          color: colors.textSecondary
                        },
                        '& .MuiInputLabel-root.Mui-focused': {
                          color: colors.accentText
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      label="Start Date & Time"
                      type="datetime-local"
                      value={countdownForm.startDate}
                      onChange={(e) => setCountdownForm({...countdownForm, startDate: e.target.value})}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                      sx={countdownFieldStyles}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      fullWidth
                      label="End Date & Time"
                      type="datetime-local"
                      value={countdownForm.endDate}
                      onChange={(e) => setCountdownForm({...countdownForm, endDate: e.target.value})}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                      sx={countdownFieldStyles}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                      <Button
                        variant="outlined"
                        onClick={handleCancelCountdownForm}
                        sx={{
                          borderColor: colors.border,
                          color: colors.textPrimary,
                          '&:hover': { 
                            borderColor: colors.accentText,
                            backgroundColor: 'rgba(0, 224, 184, 0.05)',
                            color: colors.accentText
                          }
                        }}
                      >
                        Cancel
                      </Button>
                    <Button 
                      variant="contained" 
                        onClick={handleSaveCountdown}
                        disabled={isCountdownSaveDisabled}
                      startIcon={<LocalOffer />}
                      sx={{
                        backgroundColor: colors.accentText,
                        color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                        '&:hover': { backgroundColor: '#00C4A3' }
                      }}
                    >
                        {editingCountdown ? 'Update Countdown' : 'Create Countdown'}
                    </Button>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}

          {countdowns.map((countdown) => (
            <Card key={countdown.id} sx={{ mb: 2, backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h6" sx={{ color: colors.accentText, fontWeight: 600 }}>
                      {countdown.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Start: {new Date(countdown.startDate).toLocaleString('en-GB', {
                        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      End: {new Date(countdown.endDate).toLocaleString('en-GB', {
                        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </Typography>
                    <Chip 
                      label={countdown.isActive ? 'Active' : 'Inactive'} 
                      color={countdown.isActive ? 'success' : 'default'}
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button 
                      size="small"
                      variant="outlined"
                      startIcon={<Edit />}
                      onClick={() => handleEditCountdown(countdown)}
                      sx={{
                        borderColor: colors.accentText,
                        color: colors.accentText,
                        '&:hover': { borderColor: '#00C4A3', backgroundColor: 'rgba(0, 224, 184, 0.1)' }
                      }}
                    >
                      Edit
                    </Button>
                  <Button 
                    color="error" 
                    onClick={() => deleteCountdown(countdown.id)}
                    size="small"
                    startIcon={<Delete />}
                    sx={{
                      color: '#FF3366',
                      '&:hover': { backgroundColor: 'rgba(255, 51, 102, 0.1)' }
                    }}
                  >
                    Delete
                  </Button>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* Hero Management */}
      <Card sx={{ mb: 4, backgroundColor: colors.paper }}>
        <CardContent>
          <Box 
            display="flex" 
            justifyContent="space-between" 
            alignItems="center" 
            sx={{ mb: 2 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ImageIcon sx={{ color: colors.accentText, fontSize: 32 }} />
              <Typography 
                variant="h5" 
                sx={{ color: colors.accentText, fontWeight: 600 }}
              >
                Hero Image Management
              </Typography>
            </Box>
            <Button 
              variant="outlined" 
              onClick={() => {
                const next = !showHeroImageForm;
                setShowHeroImageForm(next);
                if (next) {
                  setUseHeroImageUrl(false);
                  setHeroImageInput('');
                }
                setHeroImageFileName('');
                setHeroImageUploadError('');
                setHeroImageUploadLoading(false);
              }}
              startIcon={showHeroImageForm ? <Edit /> : <ImageIcon />}
              sx={{
                borderColor: colors.accentText,
                color: colors.accentText,
                '&:hover': { 
                  borderColor: '#00C4A3',
                  backgroundColor: 'rgba(0, 224, 184, 0.1)'
                }
              }}
            >
              {showHeroImageForm ? 'Cancel' : 'Edit Hero Image'}
            </Button>
          </Box>

          {!showHeroImageForm && (
            <Card sx={{ backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Box>
                    <Typography variant="h6" sx={{ color: colors.accentText, mb: 1 }}>
                      Current Hero Image
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, wordBreak: 'break-all' }}>
                      {heroImage || '/assets/images/ads/hero-ad.png'}
                    </Typography>
                    {heroImage && (
                      <Box 
                        sx={{ 
                          mt: 2, 
                          width: '100%', 
                          maxWidth: '400px',
                          borderRadius: '8px',
                          overflow: 'hidden'
                        }}
                      >
                        <img 
                          src={heroImage} 
                          alt="Current Hero Image" 
                          style={{ 
                            width: '100%', 
                            height: 'auto',
                            display: 'block'
                          }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </Box>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}

          {showHeroImageForm && (
            <Card sx={{ backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: colors.accentText }}>
                  Update Hero Image
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Upload a new image from your computer or provide a full URL. The selected image will appear on the customer homepage.
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Mode:
                  </Typography>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => {
                      setUseHeroImageUrl((prev) => {
                        const next = !prev;
                        if (next) {
                          setHeroImageInput('');
                          setHeroImageFileName('');
                          setHeroImageUploadError('');
                        } else {
                          setHeroImageInput('');
                          setHeroImageUploadError('');
                        }
                        return next;
                      });
                    }}
                    sx={{ color: colors.accentText, textTransform: 'none', px: 0, minWidth: 'unset' }}
                  >
                    {useHeroImageUrl ? 'Switch to upload' : 'Enter URL instead'}
                  </Button>
                </Box>
                <input
                  type="file"
                  accept="image/*"
                  ref={heroImageFileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleHeroImageFileChange}
                />
                <Box
                  sx={{
                    display: useHeroImageUrl ? 'none' : 'flex',
                    alignItems: 'center',
                    gap: 2,
                    mb: 2,
                    flexWrap: 'wrap'
                  }}
                >
                  <Button
                    variant="outlined"
                    startIcon={<CloudUpload />}
                    onClick={openHeroImageFilePicker}
                    disabled={heroImageUploadLoading}
                    sx={{
                      borderColor: colors.accentText,
                      color: colors.accentText,
                      '&:hover': { 
                        borderColor: '#00C4A3',
                        backgroundColor: 'rgba(0, 224, 184, 0.1)'
                      }
                    }}
                  >
                    {heroImageUploadLoading ? 'Uploading...' : 'Select Image'}
                  </Button>
                  {heroImageFileName && (
                    <Typography variant="body2" color="text.secondary">
                      Selected: {heroImageFileName}
                    </Typography>
                  )}
                </Box>
                {heroImageUploadError && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {heroImageUploadError}
                  </Alert>
                )}
                {useHeroImageUrl ? (
                  <TextField
                    fullWidth
                    label="Hero Image URL"
                    value={heroImageInput}
                    onChange={(e) => {
                      setHeroImageInput(e.target.value);
                      if (heroImageFileName) {
                        setHeroImageFileName('');
                      }
                      if (heroImageUploadError) {
                        setHeroImageUploadError('');
                      }
                    }}
                    placeholder="https://example.com/hero-image.jpg"
                    sx={{
                      mb: 2,
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                        '& fieldset': { borderColor: colors.border },
                        '&:hover fieldset': { borderColor: colors.accentText },
                        '&.Mui-focused fieldset': { borderColor: colors.accentText }
                      },
                      '& .MuiInputBase-input': {
                        color: colors.textPrimary
                      },
                      '& .MuiInputLabel-root': {
                        color: colors.textSecondary
                      },
                      '& .MuiInputLabel-root.Mui-focused': {
                        color: colors.accentText
                      }
                    }}
                    disabled={heroImageUploadLoading}
                  />
                ) : (
                  heroImageInput && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, wordBreak: 'break-all' }}>
                      Image URL: {heroImageInput}
                    </Typography>
                  )
                )}
                {heroImageInput && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Preview:
                    </Typography>
                    <Box 
                      sx={{ 
                        width: '100%', 
                        maxWidth: '400px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: `2px solid ${colors.accentText}`
                      }}
                    >
                      <img 
                        src={heroImageInput} 
                        alt="Hero Image Preview" 
                        style={{ 
                          width: '100%', 
                          height: 'auto',
                          display: 'block'
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = `<div style="padding: 40px; text-align: center; color: ${isDarkMode ? '#999' : '#666'}; background-color: ${colors.paper};">Image not found</div>`;
                        }}
                      />
                    </Box>
                  </Box>
                )}
                <Button 
                  variant="contained" 
                  onClick={updateHeroImage}
                  disabled={!heroImageInput || heroImageUploadLoading}
                  startIcon={<Save />}
                  sx={{
                    backgroundColor: colors.accentText,
                    color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                    '&:hover': { backgroundColor: '#00C4A3' }
                  }}
                >
                  Save Hero Image
                </Button>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Notification Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: colors.paper,
            border: `1px solid ${colors.border}`
          }
        }}
      >
        <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>
          {editingNotification ? 'Edit Notification' : 'Add Notification'}
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: colors.paper }}>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFormError('')}>
              {formError}
            </Alert>
          )}

          <TextField
            label="Name"
            fullWidth
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            sx={{ 
              mb: 2,
              '& .MuiOutlinedInput-root': {
                backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                '& fieldset': { borderColor: colors.border },
                '&:hover fieldset': { borderColor: colors.accentText },
                '&.Mui-focused fieldset': { borderColor: colors.accentText }
              },
              '& .MuiInputBase-input': {
                color: colors.textPrimary
              },
              '& .MuiInputLabel-root': {
                color: colors.textSecondary
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: colors.accentText
              }
            }}
            placeholder="Enter recipient name"
          />

          <TextField
            label="Phone Number"
            fullWidth
            required
            value={formData.phoneNumber}
            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
            sx={{ 
              mb: 2,
              '& .MuiOutlinedInput-root': {
                backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                '& fieldset': { borderColor: colors.border },
                '&:hover fieldset': { borderColor: colors.accentText },
                '&.Mui-focused fieldset': { borderColor: colors.accentText }
              },
              '& .MuiInputBase-input': {
                color: colors.textPrimary
              },
              '& .MuiInputLabel-root': {
                color: colors.textSecondary
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: colors.accentText
              }
            }}
            placeholder="0712345678 or 254712345678"
            helperText="Enter phone number for SMS/WhatsApp notifications"
          />

          <FormControlLabel
            control={
              <Switch
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: colors.accentText,
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: colors.accentText,
                  },
                }}
              />
            }
            label="Active"
            sx={{ mb: 2, color: colors.textPrimary }}
          />

          <TextField
            label="Notes (Optional)"
            fullWidth
            multiline
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Additional notes about this notification recipient"
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                '& fieldset': { borderColor: colors.border },
                '&:hover fieldset': { borderColor: colors.accentText },
                '&.Mui-focused fieldset': { borderColor: colors.accentText }
              },
              '& .MuiInputBase-input': {
                color: colors.textPrimary
              },
              '& .MuiInputLabel-root': {
                color: colors.textSecondary
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: colors.accentText
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ backgroundColor: colors.paper, p: 2 }}>
          <Button
            onClick={handleCloseDialog}
            startIcon={<CancelIcon />}
            sx={{ color: colors.textSecondary }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveNotification}
            variant="contained"
            startIcon={<Save />}
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              '&:hover': {
                backgroundColor: '#00C4A3'
              }
            }}
          >
            {editingNotification ? 'Update' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* User Management Dialog */}
      <Dialog
        open={openUserDialog}
        onClose={handleCloseUserDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: colors.paper,
            border: `1px solid ${colors.border}`
          }
        }}
      >
        <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>
          Invite New User
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: colors.paper }}>
          {userFormError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setUserFormError('')}>
              {userFormError}
            </Alert>
          )}
          <Box sx={{ mt: 2 }}>
            <TextField
              label="Username"
              fullWidth
              required
              value={userFormData.username}
              onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
              sx={{ 
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                  '& fieldset': { borderColor: colors.border },
                  '&:hover fieldset': { borderColor: colors.accentText },
                  '&.Mui-focused fieldset': { borderColor: colors.accentText }
                },
                '& .MuiInputBase-input': {
                  color: colors.textPrimary
                },
                '& .MuiInputLabel-root': {
                  color: colors.textSecondary
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: colors.accentText
                }
              }}
              placeholder="Enter username"
            />
            <TextField
              label="Email"
              fullWidth
              required
              type="email"
              value={userFormData.email}
              onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
              sx={{ 
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                  '& fieldset': { borderColor: colors.border },
                  '&:hover fieldset': { borderColor: colors.accentText },
                  '&.Mui-focused fieldset': { borderColor: colors.accentText }
                },
                '& .MuiInputBase-input': {
                  color: colors.textPrimary
                },
                '& .MuiInputLabel-root': {
                  color: colors.textSecondary
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: colors.accentText
                }
              }}
              placeholder="user@example.com"
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel sx={{ color: colors.textSecondary }}>Role</InputLabel>
              <Select
                value={userFormData.role}
                label="Role"
                onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                sx={{
                  color: colors.textPrimary,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: colors.border,
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: colors.accentText,
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: colors.accentText,
                  },
                  '& .MuiSvgIcon-root': {
                    color: colors.accentText,
                  },
                }}
              >
                <MenuItem value="manager">Manager</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
            <Alert severity="info" sx={{ mt: 2 }}>
              An invite email will be sent to the user. They will need to set their password using the link in the email.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: colors.paper, p: 2 }}>
          <Button
            onClick={handleCloseUserDialog}
            startIcon={<CancelIcon />}
            sx={{ color: colors.textSecondary }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveUser}
            variant="contained"
            startIcon={<Save />}
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              '&:hover': {
                backgroundColor: '#00C4A3'
              }
            }}
          >
            Send Invite
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Settings;

