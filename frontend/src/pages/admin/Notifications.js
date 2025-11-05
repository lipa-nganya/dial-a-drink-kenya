import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
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
  TextField,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Save,
  Cancel,
  Phone,
  Person,
  NotificationsActive,
  NotificationsOff,
  Notifications as NotificationsIcon
} from '@mui/icons-material';
import { api } from '../../services/api';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingNotification, setEditingNotification] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    isActive: true,
    notes: ''
  });
  const [formError, setFormError] = useState('');
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [smsLoading, setSmsLoading] = useState(false);

  useEffect(() => {
    fetchNotifications();
    fetchSmsSettings();
  }, []);

  const fetchSmsSettings = async () => {
    try {
      const response = await api.get('/admin/sms-settings');
      setSmsEnabled(response.data.smsEnabled !== false); // Default to true if not set
    } catch (error) {
      console.error('Error fetching SMS settings:', error);
      // Default to enabled if fetch fails
      setSmsEnabled(true);
    }
  };

  const handleSmsToggle = async (event) => {
    const newValue = event.target.checked;
    setSmsLoading(true);
    try {
      await api.put('/admin/sms-settings', { smsEnabled: newValue });
      setSmsEnabled(newValue);
    } catch (error) {
      console.error('Error updating SMS settings:', error);
      alert(error.response?.data?.error || 'Failed to update SMS settings');
    } finally {
      setSmsLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/order-notifications');
      setNotifications(response.data);
      setError(null);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setError(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
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

  const handleSave = async () => {
    setFormError('');

    // Validation
    if (!formData.name.trim()) {
      setFormError('Name is required');
      return;
    }

    if (!formData.phoneNumber.trim()) {
      setFormError('Phone number is required');
      return;
    }

    // Basic phone number validation
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(formData.phoneNumber.trim())) {
      setFormError('Please enter a valid phone number');
      return;
    }

    try {
      if (editingNotification) {
        // Update existing
        await api.put(`/admin/order-notifications/${editingNotification.id}`, formData);
      } else {
        // Create new
        await api.post('/admin/order-notifications', formData);
      }
      handleCloseDialog();
      fetchNotifications();
    } catch (error) {
      console.error('Error saving notification:', error);
      setFormError(error.response?.data?.error || error.message || 'Failed to save notification');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this notification recipient?')) {
      return;
    }

    try {
      await api.delete(`/admin/order-notifications/${id}`);
      fetchNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
      alert(error.response?.data?.error || error.message || 'Failed to delete notification');
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading notifications...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <NotificationsIcon sx={{ color: '#00E0B8', fontSize: 40 }} />
            <Typography variant="h4" component="h1" gutterBottom sx={{ color: '#00E0B8', fontWeight: 700 }}>
              Order Notifications
            </Typography>
          </Box>
          <Typography variant="h6" color="text.secondary">
            Manage recipients for order notifications
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{
            backgroundColor: '#00E0B8',
            color: '#0D0D0D',
            '&:hover': {
              backgroundColor: '#00C4A3'
            }
          }}
        >
          Add Notification
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* SMS Toggle */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: '#121212' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" sx={{ color: '#00E0B8', fontWeight: 600, mb: 1 }}>
              SMS Notifications
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Enable or disable SMS notifications to all recipients on this page when new orders are placed
            </Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={smsEnabled}
                onChange={handleSmsToggle}
                disabled={smsLoading}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#00E0B8',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#00E0B8',
                  },
                }}
              />
            }
            label={
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {smsEnabled ? 'Enabled' : 'Disabled'}
              </Typography>
            }
          />
        </Box>
        {smsEnabled && (
          <Alert severity="info" sx={{ mt: 2 }}>
            SMS notifications are currently <strong>enabled</strong>. All active recipients will receive SMS notifications when new orders are placed.
          </Alert>
        )}
        {!smsEnabled && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            SMS notifications are currently <strong>disabled</strong>. No SMS messages will be sent to recipients, even if they are marked as active.
          </Alert>
        )}
      </Paper>

      {notifications.length === 0 ? (
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
              '&:hover': {
                backgroundColor: '#00C4A3'
              }
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
                        onClick={() => handleDelete(notification.id)}
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

      {/* Add/Edit Dialog */}
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
            startIcon={<Cancel />}
            sx={{ color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
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
    </Container>
  );
};

export default Notifications;

