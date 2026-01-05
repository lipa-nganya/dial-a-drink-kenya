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
  TablePagination,
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
  VpnKey,
  WhatsApp
} from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const Drivers = () => {
  const { isDarkMode, colors } = useTheme();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    status: 'offline',
    creditLimit: '',
    cashAtHand: ''
  });
  const [driverOtps, setDriverOtps] = useState({}); // Store OTPs for each driver
  const [showOtps, setShowOtps] = useState({}); // Track which OTPs are visible
  const [loadingOtps, setLoadingOtps] = useState({}); // Track OTP loading state
  const [invitingDriver, setInvitingDriver] = useState(null); // Track which driver is being invited
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

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
        status: driver.status,
        creditLimit: driver.creditLimit || '',
        cashAtHand: driver.cashAtHand || ''
      });
    } else {
      setEditingDriver(null);
      setFormData({
        name: '',
        phoneNumber: '',
        status: 'offline',
        creditLimit: '',
        cashAtHand: ''
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
      status: 'offline',
      creditLimit: '',
      cashAtHand: ''
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
      setError(err.response?.data?.error || 'Failed to delete rider');
    }
  };

  const handleInviteDriver = async (driver) => {
    try {
      setInvitingDriver(driver.id);
      const response = await api.post(`/drivers/${driver.id}/invite-whatsapp`);
      
      if (response.data.success && response.data.whatsappLink) {
        // Open WhatsApp link in a new tab/window
        window.open(response.data.whatsappLink, '_blank');
      } else {
        setError('Failed to generate WhatsApp invitation link');
      }
    } catch (err) {
      console.error('Error inviting driver:', err);
      setError(err.response?.data?.error || 'Failed to send WhatsApp invitation');
    } finally {
      setInvitingDriver(null);
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
        <Typography variant="h6" sx={{ mt: 2 }}>Loading riders...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <LocalShipping sx={{ fontSize: 40, color: colors.accentText }} />
          <Typography variant="h4" sx={{ color: colors.accentText, fontWeight: 700 }}>
            Riders Management
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{
            backgroundColor: colors.accentText,
            color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
            '&:hover': {
              backgroundColor: '#00C4A3'
            }
          }}
        >
          Add Rider
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
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Rider Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Phone Number</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Credit Status</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Last Activity</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>OTP</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {drivers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    No riders found. Click "Add Rider" to create one.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              drivers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((driver) => {
                const creditStatus = driver.creditStatus || {};
                const balance = creditStatus.balance || 0;
                const creditLimit = creditStatus.creditLimit || 0;
                const debt = creditStatus.debt || 0;
                const exceeded = creditStatus.exceeded || false;
                const walletBalance = driver.wallet?.balance || 0;
                
                return (
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
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Chip
                        label={exceeded ? 'Limit Exceeded' : 'Within Limit'}
                        color={exceeded ? 'error' : 'success'}
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        Balance: KES {parseFloat(walletBalance).toFixed(2)}
                      </Typography>
                      {creditLimit > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          Limit: KES {parseFloat(creditLimit).toFixed(2)}
                        </Typography>
                      )}
                      {debt > 0 && (
                        <Typography variant="caption" color={exceeded ? 'error' : 'warning.main'}>
                          Debt: KES {parseFloat(debt).toFixed(2)}
                        </Typography>
                      )}
                    </Box>
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
                        sx={{ color: colors.accentText }}
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
                    <Tooltip title="Invite via WhatsApp">
                      <IconButton
                        size="small"
                        onClick={() => handleInviteDriver(driver)}
                        disabled={invitingDriver === driver.id}
                        sx={{ 
                          color: '#25D366',
                          '&:hover': { backgroundColor: 'rgba(37, 211, 102, 0.1)' }
                        }}
                      >
                        {invitingDriver === driver.id ? (
                          <CircularProgress size={20} />
                        ) : (
                          <WhatsApp />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit Rider">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(driver)}
                        sx={{ color: colors.accentText }}
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Rider">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(driver.id)}
                        sx={{ color: '#FF3366' }}
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={drivers.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
        />
      </TableContainer>

      {/* Add/Edit Rider Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingDriver ? 'Edit Rider' : 'Add New Rider'}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Rider Name"
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
            <TextField
              label="Credit Limit (KES)"
              type="number"
              value={formData.creditLimit}
              onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
              fullWidth
              helperText="Maximum amount driver can owe. Set to 0 to disable credit."
              InputProps={{
                inputProps: { min: 0, step: 0.01 }
              }}
            />
            <TextField
              label="Cash at Hand (KES)"
              type="number"
              value={formData.cashAtHand}
              onChange={(e) => setFormData({ ...formData, cashAtHand: e.target.value })}
              fullWidth
              helperText="Current cash amount with the driver"
              InputProps={{
                inputProps: { min: 0, step: 0.01 }
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
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

