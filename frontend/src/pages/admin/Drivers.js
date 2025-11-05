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
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Tooltip
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  LocalShipping,
  CheckCircle,
  Cancel,
  RemoveCircle,
  Phone,
  Visibility,
  VisibilityOff,
  VpnKey
} from '@mui/icons-material';
import { api } from '../../services/api';

const Drivers = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    status: 'offline'
  });
  const [driverOtps, setDriverOtps] = useState({}); // Store OTPs for each driver
  const [showOtps, setShowOtps] = useState({}); // Track which OTPs are visible
  const [loadingOtps, setLoadingOtps] = useState({}); // Track OTP loading state

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDriverOtp = async (driverId, phoneNumber) => {
    try {
      setLoadingOtps(prev => ({ ...prev, [driverId]: true }));
      const response = await api.get(`/drivers/${driverId}/latest-otp`);
      setDriverOtps(prev => ({ ...prev, [driverId]: response.data }));
    } catch (error) {
      console.error('Error fetching driver OTP:', error);
      setDriverOtps(prev => ({ ...prev, [driverId]: { hasOtp: false, error: 'Failed to fetch OTP' } }));
    } finally {
      setLoadingOtps(prev => ({ ...prev, [driverId]: false }));
    }
  };

  const toggleOtpVisibility = (driverId) => {
    setShowOtps(prev => ({ ...prev, [driverId]: !prev[driverId] }));
    
    // Fetch OTP if not already loaded
    if (!driverOtps[driverId]) {
      const driver = drivers.find(d => d.id === driverId);
      if (driver) {
        fetchDriverOtp(driverId, driver.phoneNumber);
      }
    }
  };

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/drivers');
      setDrivers(response.data);
      setError('');
    } catch (err) {
      console.error('Error fetching drivers:', err);
      setError(err.response?.data?.error || 'Failed to load drivers');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (driver = null) => {
    if (driver) {
      setEditingDriver(driver);
      setFormData({
        name: driver.name,
        phoneNumber: driver.phoneNumber,
        status: driver.status
      });
    } else {
      setEditingDriver(null);
      setFormData({
        name: '',
        phoneNumber: '',
        status: 'offline'
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingDriver(null);
    setFormData({
      name: '',
      phoneNumber: '',
      status: 'offline'
    });
  };

  const handleSubmit = async () => {
    try {
      setError('');
      if (!formData.name || !formData.phoneNumber) {
        setError('Name and phone number are required');
        return;
      }

      if (editingDriver) {
        await api.put(`/drivers/${editingDriver.id}`, formData);
      } else {
        await api.post('/drivers', formData);
      }

      handleCloseDialog();
      fetchDrivers();
    } catch (err) {
      console.error('Error saving driver:', err);
      setError(err.response?.data?.error || 'Failed to save driver');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this driver?')) {
      return;
    }

    try {
      await api.delete(`/drivers/${id}`);
      fetchDrivers();
    } catch (err) {
      console.error('Error deleting driver:', err);
      setError(err.response?.data?.error || 'Failed to delete driver');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'default';
      case 'on_delivery': return 'warning';
      case 'offline': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return <CheckCircle fontSize="small" />;
      case 'inactive': return <RemoveCircle fontSize="small" />;
      case 'on_delivery': return <LocalShipping fontSize="small" />;
      case 'offline': return <Cancel fontSize="small" />;
      default: return <Cancel fontSize="small" />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active': return 'Active';
      case 'inactive': return 'Inactive';
      case 'on_delivery': return 'On Delivery';
      case 'offline': return 'Offline';
      default: return status;
    }
  };

  const formatLastActivity = (date) => {
    if (!date) return 'Never';
    const activityDate = new Date(date);
    const now = new Date();
    const diffMs = now - activityDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return activityDate.toLocaleDateString('en-US', {
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
        <Typography variant="h6" sx={{ mt: 2 }}>Loading drivers...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <LocalShipping sx={{ fontSize: 40, color: '#00E0B8' }} />
          <Typography variant="h4" sx={{ color: '#00E0B8', fontWeight: 700 }}>
            Drivers Management
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
          Add Driver
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', color: '#00E0B8' }}>Driver Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: '#00E0B8' }}>Phone Number</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: '#00E0B8' }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: '#00E0B8' }}>Last Activity</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: '#00E0B8' }}>OTP</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: '#00E0B8' }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {drivers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    No drivers found. Click "Add Driver" to create one.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              drivers.map((driver) => (
                <TableRow key={driver.id} hover>
                  <TableCell sx={{ fontWeight: 500 }}>{driver.name}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Phone fontSize="small" sx={{ color: 'text.secondary' }} />
                      {driver.phoneNumber}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={getStatusIcon(driver.status)}
                      label={getStatusLabel(driver.status)}
                      color={getStatusColor(driver.status)}
                      size="small"
                      sx={{ fontWeight: 'bold' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title={driver.lastActivity ? new Date(driver.lastActivity).toLocaleString() : 'Never'}>
                      <Typography variant="body2" color="text.secondary">
                        {formatLastActivity(driver.lastActivity)}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton
                        size="small"
                        onClick={() => toggleOtpVisibility(driver.id)}
                        sx={{ color: '#00E0B8' }}
                        title={showOtps[driver.id] ? "Hide OTP" : "Show OTP"}
                      >
                        {showOtps[driver.id] ? <VisibilityOff /> : <VpnKey />}
                      </IconButton>
                      {showOtps[driver.id] && (
                        <Box>
                          {loadingOtps[driver.id] ? (
                            <CircularProgress size={16} />
                          ) : driverOtps[driver.id]?.hasOtp ? (
                            <Chip
                              label={
                                driverOtps[driver.id].isExpired 
                                  ? `Expired: ${driverOtps[driver.id].otpCode}`
                                  : `OTP: ${driverOtps[driver.id].otpCode}`
                              }
                              size="small"
                              color={driverOtps[driver.id].isExpired ? 'error' : 'success'}
                              sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                              No active OTP
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(driver)}
                      sx={{ color: '#00E0B8' }}
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(driver.id)}
                      sx={{ color: '#FF3366' }}
                    >
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Driver Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingDriver ? 'Edit Driver' : 'Add New Driver'}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Driver Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Phone Number"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value.replace(/\D/g, '') })}
              fullWidth
              required
              placeholder="0712345678 or 254712345678"
              InputProps={{
                startAdornment: <Phone sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                label="Status"
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="on_delivery">On Delivery</MenuItem>
                <MenuItem value="offline">Offline</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            sx={{
              backgroundColor: '#00E0B8',
              color: '#0D0D0D',
              '&:hover': {
                backgroundColor: '#00C4A3'
              }
            }}
          >
            {editingDriver ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Drivers;

