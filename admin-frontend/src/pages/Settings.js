import React, { useState, useEffect } from 'react';
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
  AdminPanelSettings
} from '@mui/icons-material';
import { api } from '../services/api';

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

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

  // Delivery Fee Settings state
  const [deliverySettings, setDeliverySettings] = useState({
    isTestMode: false,
    deliveryFeeWithAlcohol: 50,
    deliveryFeeWithoutAlcohol: 30
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

  // Hero Management state
  const [heroImage, setHeroImage] = useState('');
  const [heroImageInput, setHeroImageInput] = useState('');
  const [showHeroImageForm, setShowHeroImageForm] = useState(false);

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

  // ========== DELIVERY FEE SETTINGS ==========
  const fetchDeliverySettings = async () => {
    try {
      const [testModeRes, withAlcoholRes, withoutAlcoholRes] = await Promise.all([
        api.get('/settings/deliveryTestMode').catch(() => ({ data: null, status: 404 })),
        api.get('/settings/deliveryFeeWithAlcohol').catch(() => ({ data: null, status: 404 })),
        api.get('/settings/deliveryFeeWithoutAlcohol').catch(() => ({ data: null, status: 404 }))
      ]);

      setDeliverySettings({
        isTestMode: testModeRes.data?.value === 'true' || false,
        deliveryFeeWithAlcohol: parseFloat(withAlcoholRes.data?.value || '50'),
        deliveryFeeWithoutAlcohol: parseFloat(withoutAlcoholRes.data?.value || '30')
      });
    } catch (error) {
      console.error('Error fetching delivery settings:', error);
      setDeliverySettings({
        isTestMode: false,
        deliveryFeeWithAlcohol: 50,
        deliveryFeeWithoutAlcohol: 30
      });
    }
  };

  const saveDeliverySettings = async () => {
    try {
      setDeliverySettingsLoading(true);
      await Promise.all([
        api.put('/settings/deliveryTestMode', { value: deliverySettings.isTestMode.toString() }),
        api.put('/settings/deliveryFeeWithAlcohol', { value: deliverySettings.deliveryFeeWithAlcohol.toString() }),
        api.put('/settings/deliveryFeeWithoutAlcohol', { value: deliverySettings.deliveryFeeWithoutAlcohol.toString() })
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

  const createCountdown = async () => {
    try {
      const startDate = new Date(countdownForm.startDate).toISOString();
      const endDate = new Date(countdownForm.endDate).toISOString();
      
      const countdownData = {
        title: countdownForm.title,
        startDate: startDate,
        endDate: endDate
      };
      
      await api.post('/countdown', countdownData);
      setCountdownForm({ title: '', startDate: '', endDate: '' });
      setShowCountdownForm(false);
      fetchCountdowns();
      setNotification({ message: 'Countdown offer created successfully!' });
    } catch (error) {
      console.error('Error creating countdown:', error);
      setError('Failed to create countdown offer');
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
      setNotification({ message: 'Hero image updated successfully!' });
    } catch (error) {
      console.error('Error updating hero image:', error);
      setError('Failed to update hero image. Please try again.');
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
          <SettingsIcon sx={{ color: '#00E0B8', fontSize: 40 }} />
          <Typography variant="h4" component="h1" gutterBottom sx={{ color: '#00E0B8', fontWeight: 700 }}>
            Settings
          </Typography>
        </Box>
        <Typography variant="h6" color="text.secondary">
          Manage your Dial A Drink configuration
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
        <Card sx={{ mb: 4, backgroundColor: '#121212' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AdminPanelSettings sx={{ color: '#00E0B8', fontSize: 32 }} />
                <Typography variant="h5" sx={{ color: '#00E0B8', fontWeight: 600 }}>
                  User Management
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<PersonAdd />}
                onClick={handleOpenUserDialog}
                sx={{
                  backgroundColor: '#00E0B8',
                  color: '#0D0D0D',
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
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Username</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Chip
                            label={user.role === 'admin' ? 'Admin' : 'Manager'}
                            color={user.role === 'admin' ? 'primary' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
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
                        <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
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
      <Card sx={{ mb: 4, backgroundColor: '#121212' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Notifications sx={{ color: '#00E0B8', fontSize: 32 }} />
              <Typography variant="h5" sx={{ color: '#00E0B8', fontWeight: 600 }}>
                Notifications
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => handleOpenDialog()}
              sx={{
                backgroundColor: '#00E0B8',
                color: '#0D0D0D',
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
                      color: '#00E0B8',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#00E0B8',
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
                  backgroundColor: '#00E0B8',
                  color: '#0D0D0D',
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
                    <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }}>Phone Number</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }}>Notes</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#00E0B8' }} align="right">Actions</TableCell>
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
                            sx={{ color: '#00E0B8' }}
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
      <Card sx={{ mb: 4, backgroundColor: '#121212' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <LocalShipping sx={{ fontSize: 32, color: '#00E0B8' }} />
              <Box>
                <Typography variant="h5" sx={{ color: '#00E0B8', fontWeight: 600 }}>
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
                borderColor: '#00E0B8',
                color: '#00E0B8',
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
                            '& fieldset': { borderColor: '#00E0B8' },
                            '&:hover fieldset': { borderColor: '#00E0B8' },
                            '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
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
                            '& fieldset': { borderColor: '#00E0B8' },
                            '&:hover fieldset': { borderColor: '#00E0B8' },
                            '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
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
                        borderColor: '#666',
                        color: '#F5F5F5',
                        '&:hover': { borderColor: '#888' }
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
                        backgroundColor: '#00E0B8',
                        color: '#0D0D0D',
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

      {/* Countdown Offers */}
      <Card sx={{ mb: 4, backgroundColor: '#121212' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocalOffer sx={{ color: '#00E0B8', fontSize: 32 }} />
              <Typography variant="h5" sx={{ color: '#00E0B8', fontWeight: 600 }}>
                Countdown Offers
              </Typography>
            </Box>
            <Button 
              variant="contained" 
              onClick={() => setShowCountdownForm(!showCountdownForm)}
              startIcon={<Add />}
              sx={{
                backgroundColor: '#00E0B8',
                color: '#0D0D0D',
                '&:hover': { backgroundColor: '#00C4A3' }
              }}
            >
              {showCountdownForm ? 'Cancel' : 'New Countdown'}
            </Button>
          </Box>

          {showCountdownForm && (
            <Card sx={{ mb: 3, backgroundColor: '#121212' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: '#00E0B8' }}>
                  Create New Countdown
                </Typography>
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
                          '& fieldset': { borderColor: '#00E0B8' },
                          '&:hover fieldset': { borderColor: '#00E0B8' },
                          '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
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
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': { borderColor: '#00E0B8' },
                          '&:hover fieldset': { borderColor: '#00E0B8' },
                          '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
                        }
                      }}
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
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': { borderColor: '#00E0B8' },
                          '&:hover fieldset': { borderColor: '#00E0B8' },
                          '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button 
                      variant="contained" 
                      onClick={createCountdown}
                      disabled={!countdownForm.startDate || !countdownForm.endDate}
                      startIcon={<LocalOffer />}
                      sx={{
                        backgroundColor: '#00E0B8',
                        color: '#0D0D0D',
                        '&:hover': { backgroundColor: '#00C4A3' }
                      }}
                    >
                      Create Countdown
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}

          {countdowns.map((countdown) => (
            <Card key={countdown.id} sx={{ mb: 2, backgroundColor: '#121212' }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h6" sx={{ color: '#00E0B8', fontWeight: 600 }}>
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
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* Hero Management */}
      <Card sx={{ mb: 4, backgroundColor: '#121212' }}>
        <CardContent>
          <Box 
            display="flex" 
            justifyContent="space-between" 
            alignItems="center" 
            sx={{ mb: 2 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ImageIcon sx={{ color: '#00E0B8', fontSize: 32 }} />
              <Typography 
                variant="h5" 
                sx={{ color: '#00E0B8', fontWeight: 600 }}
              >
                Hero Image Management
              </Typography>
            </Box>
            <Button 
              variant="outlined" 
              onClick={() => setShowHeroImageForm(!showHeroImageForm)}
              startIcon={showHeroImageForm ? <Edit /> : <ImageIcon />}
              sx={{
                borderColor: '#00E0B8',
                color: '#00E0B8',
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
            <Card sx={{ backgroundColor: '#121212' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Box>
                    <Typography variant="h6" sx={{ color: '#00E0B8', mb: 1 }}>
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
            <Card sx={{ backgroundColor: '#121212' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: '#00E0B8' }}>
                  Update Hero Image
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Enter the URL or path to the hero image. This will replace the hero image on the home page.
                </Typography>
                <TextField
                  fullWidth
                  label="Hero Image URL or Path"
                  value={heroImageInput}
                  onChange={(e) => setHeroImageInput(e.target.value)}
                  placeholder="/assets/images/ads/hero-ad.png"
                  sx={{
                    mb: 2,
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: '#00E0B8' },
                      '&:hover fieldset': { borderColor: '#00E0B8' },
                      '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
                    }
                  }}
                />
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
                        border: '2px solid #00E0B8'
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
                          e.target.parentElement.innerHTML = '<div style="padding: 40px; text-align: center; color: #999;">Image not found</div>';
                        }}
                      />
                    </Box>
                  </Box>
                )}
                <Button 
                  variant="contained" 
                  onClick={updateHeroImage}
                  disabled={!heroImageInput}
                  startIcon={<Save />}
                  sx={{
                    backgroundColor: '#00E0B8',
                    color: '#0D0D0D',
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
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: '#00E0B8', fontWeight: 700 }}>
          {editingNotification ? 'Edit Notification' : 'Add Notification'}
        </DialogTitle>
        <DialogContent>
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
            sx={{ mb: 2 }}
            placeholder="Enter recipient name"
          />

          <TextField
            label="Phone Number"
            fullWidth
            required
            value={formData.phoneNumber}
            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
            sx={{ mb: 2 }}
            placeholder="0712345678 or 254712345678"
            helperText="Enter phone number for SMS/WhatsApp notifications"
          />

          <FormControlLabel
            control={
              <Switch
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                color="primary"
              />
            }
            label="Active"
            sx={{ mb: 2 }}
          />

          <TextField
            label="Notes (Optional)"
            fullWidth
            multiline
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Additional notes about this notification recipient"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={handleCloseDialog}
            startIcon={<CancelIcon />}
            sx={{ color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveNotification}
            variant="contained"
            startIcon={<Save />}
            sx={{
              backgroundColor: '#00E0B8',
              color: '#0D0D0D',
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
      >
        <DialogTitle sx={{ color: '#00E0B8', fontWeight: 700 }}>
          Invite New User
        </DialogTitle>
        <DialogContent>
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
              sx={{ mb: 2 }}
              placeholder="Enter username"
            />
            <TextField
              label="Email"
              fullWidth
              required
              type="email"
              value={userFormData.email}
              onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
              sx={{ mb: 2 }}
              placeholder="user@example.com"
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Role</InputLabel>
              <Select
                value={userFormData.role}
                label="Role"
                onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
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
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={handleCloseUserDialog}
            startIcon={<CancelIcon />}
            sx={{ color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveUser}
            variant="contained"
            startIcon={<Save />}
            sx={{
              backgroundColor: '#00E0B8',
              color: '#0D0D0D',
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

