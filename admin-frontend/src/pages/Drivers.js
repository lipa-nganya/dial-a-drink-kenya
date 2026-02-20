import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Tooltip,
  Snackbar,
  Collapse
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
  VpnKey,
  VisibilityOff,
  WhatsApp,
  Search,
  Notifications,
  AccessTime,
  Download
} from '@mui/icons-material';
import {
  Tabs,
  Tab
} from '@mui/material';
import NotificationEditor from '../components/NotificationEditor';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import io from 'socket.io-client';
import { getBackendUrl } from '../utils/backendUrl';

// Shift Report Tab Component
const ShiftReportTab = () => {
  const { isDarkMode, colors } = useTheme();
  const [shiftData, setShiftData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  useEffect(() => {
    fetchShiftReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps, no-use-before-define
  }, [dateRange, customStartDate, customEndDate]);

  const getDateRange = (range) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let startDate, endDate;
    
    if (range === 'custom' && customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(customEndDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      switch (range) {
        case 'today':
          // Today only - from start of today to current time
          startDate = new Date(today);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now); // Current time, not end of day
          break;
        case 'last7days':
          endDate = new Date(today);
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'last30days':
          endDate = new Date(today);
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 30);
          break;
        case 'last90days':
          endDate = new Date(today);
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 90);
          break;
        case 'thisMonth':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(today);
          break;
        case 'thisYear':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(today);
          break;
        default:
          endDate = new Date(today);
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 30);
      }
    }
    
    return { startDate, endDate };
  };

  const fetchShiftReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const { startDate, endDate } = getDateRange(dateRange);
      
      console.log('📊 Fetching shift report:', { startDate, endDate, dateRange });
      
      const response = await api.get('/admin/shift-report', {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });
      
      console.log('📊 Shift report response:', response.data);
      
      if (response.data?.success && Array.isArray(response.data.data)) {
        setShiftData(response.data.data);
      } else {
        console.warn('⚠️ Unexpected response format:', response.data);
        setShiftData([]);
      }
    } catch (err) {
      console.error('❌ Error fetching shift report:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      setError(err.response?.data?.error || err.message || 'Failed to load shift report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms) => {
    if (!ms || ms <= 0) return '00:00:00';
    
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    // Handle both YYYY-MM-DD format and ISO strings
    let date;
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // YYYY-MM-DD format - parse as local date
      const [year, month, day] = dateString.split('-').map(Number);
      date = new Date(year, month - 1, day);
    } else {
      // ISO string - parse and use local date
      date = new Date(dateString);
    }
    
    return date.toLocaleDateString('en-KE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Group shifts by driver and date
  const groupedShifts = useMemo(() => {
    const grouped = {};
    
    shiftData.forEach(driver => {
      if (!driver.shifts || !Array.isArray(driver.shifts)) {
        console.warn('Driver missing shifts array:', driver);
        return;
      }
      
      driver.shifts.forEach(shift => {
        // Handle both Date objects and ISO strings
        const shiftDate = shift.date instanceof Date 
          ? shift.date 
          : new Date(shift.date);
        
        if (isNaN(shiftDate.getTime())) {
          console.warn('Invalid date in shift:', shift);
          return;
        }
        
        // Use local date instead of UTC to avoid timezone issues
        const year = shiftDate.getFullYear();
        const month = String(shiftDate.getMonth() + 1).padStart(2, '0');
        const day = String(shiftDate.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${day}`;
        const key = `${driver.driverId}-${dateKey}`;
        
        if (!grouped[key]) {
          grouped[key] = {
            driverId: driver.driverId,
            driverName: driver.driverName,
            phoneNumber: driver.phoneNumber,
            date: dateKey,
            shiftDurationMs: 0
          };
        }
        
        grouped[key].shiftDurationMs += (shift.shiftDurationMs || 0);
      });
    });
    
    return Object.values(grouped).sort((a, b) => {
      // Sort by date (newest first), then by driver name
      const dateCompare = new Date(b.date) - new Date(a.date);
      if (dateCompare !== 0) return dateCompare;
      return a.driverName.localeCompare(b.driverName);
    });
  }, [shiftData]);

  const paginatedShifts = groupedShifts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleExportCSV = () => {
    if (groupedShifts.length === 0) {
      alert('No shift data to export');
      return;
    }

    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const headers = [
      'Date',
      'Driver Name',
      'Phone Number',
      'Shift Duration (HH:MM:SS)'
    ];

    const csvRows = groupedShifts.map(shift => {
      return [
        formatDate(shift.date),
        escapeCSV(shift.driverName),
        escapeCSV(shift.phoneNumber),
        formatDuration(shift.shiftDurationMs)
      ].join(',');
    });

    // Add summary row
    const totalMs = groupedShifts.reduce((sum, shift) => sum + shift.shiftDurationMs, 0);
    const summaryRow = [
      '',
      'TOTAL',
      '',
      formatDuration(totalMs)
    ];

    const csvContent = [
      headers.join(','),
      ...csvRows,
      summaryRow.join(',')
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const { startDate, endDate } = getDateRange(dateRange);
    const fileName = `shift-report-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary, mb: 1 }}>
          Shift Report
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary }}>
          Track driver shift durations per day
        </Typography>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3, backgroundColor: colors.paper }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel sx={{ color: colors.textSecondary }}>Date Range</InputLabel>
            <Select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value);
                setPage(0);
              }}
              label="Date Range"
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
                }
              }}
            >
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="last7days">Last 7 Days</MenuItem>
              <MenuItem value="last30days">Last 30 Days</MenuItem>
              <MenuItem value="last90days">Last 90 Days</MenuItem>
              <MenuItem value="thisMonth">This Month</MenuItem>
              <MenuItem value="thisYear">This Year</MenuItem>
              <MenuItem value="custom">Custom Range</MenuItem>
            </Select>
          </FormControl>
          
          <Collapse 
            in={dateRange === 'custom'} 
            orientation="horizontal"
            sx={{
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              '& .MuiCollapse-wrapper': {
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
              }
            }}
          >
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                type="date"
                label="From"
                size="small"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setPage(0);
                }}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 150 }}
              />
              <TextField
                type="date"
                label="To"
                size="small"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setPage(0);
                }}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 150 }}
              />
            </Box>
          </Collapse>

          <Box sx={{ flexGrow: 1 }} />
          
          <Button
            variant="contained"
            startIcon={<Download />}
            onClick={handleExportCSV}
            disabled={groupedShifts.length === 0}
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              '&:hover': {
                backgroundColor: '#00C4A3'
              },
              '&:disabled': {
                backgroundColor: colors.border,
                color: colors.textSecondary
              }
            }}
          >
            Export CSV
          </Button>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Driver Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Phone Number</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="right">Shift Duration</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedShifts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    No shift data found for the selected date range.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedShifts.map((shift, index) => (
                <TableRow key={`${shift.driverId}-${shift.date}-${index}`} hover>
                  <TableCell>{formatDate(shift.date)}</TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>{shift.driverName}</TableCell>
                  <TableCell>{shift.phoneNumber}</TableCell>
                  <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                    {formatDuration(shift.shiftDurationMs)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={groupedShifts.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
        />
      </TableContainer>
    </Box>
  );
};

const Drivers = () => {
  const { isDarkMode, colors } = useTheme();
  const navigate = useNavigate();
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
  const [testingPush, setTestingPush] = useState(null); // Track which driver is being tested for push
  const [pushTestResult, setPushTestResult] = useState(null); // Store push test result
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [penaltyDialogOpen, setPenaltyDialogOpen] = useState(false);
  const [loanFormData, setLoanFormData] = useState({
    driverId: '',
    amount: '',
    reason: ''
  });
  const [penaltyFormData, setPenaltyFormData] = useState({
    driverId: '',
    amount: '',
    reason: ''
  });
  const [creatingLoan, setCreatingLoan] = useState(false);
  const [creatingPenalty, setCreatingPenalty] = useState(false);
  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false);
  const [selectedDriverForPenalty, setSelectedDriverForPenalty] = useState(null);
  const [selectedDriverForWithdrawal, setSelectedDriverForWithdrawal] = useState(null);
  const [withdrawalFormData, setWithdrawalFormData] = useState({
    amount: '',
    reason: ''
  });
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    fetchDrivers();
    
    // Set up Socket.IO for real-time driver status updates
    const socketUrl = getBackendUrl();
    const socket = io(socketUrl);
    socket.emit('join-admin');
    
    // Listen for driver shift events
    socket.on('driver-shift-started', (data) => {
      console.log('Driver started shift:', data);
      // Update driver in local state immediately
      if (data.driver) {
        setDrivers(prevDrivers => 
          prevDrivers.map(driver => 
            driver.id === data.driverId ? { ...driver, ...data.driver } : driver
          )
        );
      }
      // Show notification
      setNotification({
        message: `${data.driverName || 'Driver'} has started shift`,
        severity: 'success'
      });
    });
    
    socket.on('driver-shift-ended', (data) => {
      console.log('Driver ended shift:', data);
      // Update driver in local state immediately
      if (data.driver) {
        setDrivers(prevDrivers => 
          prevDrivers.map(driver => 
            driver.id === data.driverId ? { ...driver, ...data.driver } : driver
          )
        );
      }
      // Show notification
      setNotification({
        message: `${data.driverName || 'Driver'} has ended shift`,
        severity: 'info'
      });
    });
    
    // Listen for general driver status updates
    socket.on('driver-status-updated', (data) => {
      console.log('Driver status updated:', data);
      // Update driver in local state immediately
      if (data.driver) {
        setDrivers(prevDrivers => 
          prevDrivers.map(driver => 
            driver.id === data.driverId ? { ...driver, ...data.driver } : driver
          )
        );
      }
    });
    
    return () => {
      socket.close();
    };
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
      // Ensure response.data is an array
      const driversData = response.data;
      if (Array.isArray(driversData)) {
        setDrivers(driversData);
      } else if (driversData && Array.isArray(driversData.data)) {
        // Handle wrapped response format
        setDrivers(driversData.data);
      } else {
        console.warn('Drivers response is not an array:', driversData);
        setDrivers([]);
      }
      setError('');
    } catch (err) {
      console.error('Error fetching drivers:', err);
      setError(err.response?.data?.error || 'Failed to load drivers');
      setDrivers([]);
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

  const handleStatusChange = async (driverId, newStatus) => {
    try {
      setError('');
      await api.put(`/drivers/${driverId}`, { status: newStatus });
      console.log(`✅ Driver ${driverId} status updated to ${newStatus}`);
      fetchDrivers(); // Refresh to show updated status
    } catch (err) {
      console.error('Error updating driver status:', err);
      setError(err.response?.data?.error || 'Failed to update driver status');
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

  const handleTestPush = async (driver) => {
    try {
      setTestingPush(driver.id);
      setPushTestResult(null);
      setError('');
      
      if (!driver.pushToken) {
        setPushTestResult({
          success: false,
          message: 'Driver has no push token registered. Make sure the app is open and logged in.'
        });
        return;
      }
      
      const response = await api.post(`/drivers/test-push/${driver.id}`);
      
      if (response.data.success) {
        setPushTestResult({
          success: true,
          message: `Test push notification sent successfully to ${driver.name}! Check their device.`
        });
        // Clear the result after 5 seconds
        setTimeout(() => setPushTestResult(null), 5000);
      } else {
        setPushTestResult({
          success: false,
          message: response.data.error || 'Failed to send push notification'
        });
      }
    } catch (err) {
      console.error('Error testing push notification:', err);
      const errorMessage = err.response?.data?.error || 'Failed to send test push notification';
      setPushTestResult({
        success: false,
        message: errorMessage
      });
      setError(errorMessage);
    } finally {
      setTestingPush(null);
    }
  };

  const handleOpenPenaltyDialog = (driver) => {
    setSelectedDriverForPenalty(driver);
    setPenaltyFormData({
      driverId: driver.id,
      amount: '',
      reason: ''
    });
    setPenaltyDialogOpen(true);
  };

  const handleOpenWithdrawalDialog = (driver) => {
    setSelectedDriverForWithdrawal(driver);
    setWithdrawalFormData({
      amount: '',
      reason: ''
    });
    setWithdrawalDialogOpen(true);
  };

  const handleCreatePenalty = async () => {
    if (!penaltyFormData.amount || !penaltyFormData.reason) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setCreatingPenalty(true);
      setError('');
      await api.post('/admin/penalties', penaltyFormData);
      setPenaltyDialogOpen(false);
      setPenaltyFormData({ driverId: '', amount: '', reason: '' });
      setSelectedDriverForPenalty(null);
      fetchDrivers();
      setNotification({
        message: 'Penalty created successfully',
        severity: 'success'
      });
    } catch (err) {
      console.error('Error creating penalty:', err);
      setError(err.response?.data?.error || 'Failed to create penalty');
    } finally {
      setCreatingPenalty(false);
    }
  };

  const handleWithdrawSavings = async () => {
    if (!withdrawalFormData.amount || !withdrawalFormData.reason) {
      setError('Please fill in all fields');
      return;
    }

    const savings = selectedDriverForWithdrawal?.savings || selectedDriverForWithdrawal?.wallet?.savings || 0;
    if (parseFloat(withdrawalFormData.amount) > parseFloat(savings)) {
      setError(`Insufficient savings. Available: KES ${Math.round(parseFloat(savings))}`);
      return;
    }

    try {
      setWithdrawing(true);
      setError('');
      await api.post(`/admin/drivers/${selectedDriverForWithdrawal.id}/withdraw-savings`, {
        amount: withdrawalFormData.amount,
        reason: withdrawalFormData.reason
      });
      setWithdrawalDialogOpen(false);
      setWithdrawalFormData({ amount: '', reason: '' });
      setSelectedDriverForWithdrawal(null);
      fetchDrivers();
      setNotification({
        message: 'Savings withdrawal completed successfully',
        severity: 'success'
      });
    } catch (err) {
      console.error('Error withdrawing savings:', err);
      setError(err.response?.data?.error || 'Failed to withdraw savings');
    } finally {
      setWithdrawing(false);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success'; // On Shift
      case 'inactive': return 'default';
      case 'on_delivery': return 'warning';
      case 'offline': return 'error'; // Off Shift
      default: return 'default';
    }
  };

  // eslint-disable-next-line no-unused-vars
  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return <CheckCircle fontSize="small" />;
      case 'inactive': return <RemoveCircle fontSize="small" />;
      case 'on_delivery': return <LocalShipping fontSize="small" />;
      case 'offline': return <Cancel fontSize="small" />;
      default: return <Cancel fontSize="small" />;
    }
  };

  // eslint-disable-next-line no-unused-vars
  const getStatusLabel = (status) => {
    switch (status) {
      case 'active': return 'On Shift';
      case 'inactive': return 'Inactive';
      case 'on_delivery': return 'On Delivery';
      case 'offline': return 'Off Shift';
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

  // Filter drivers based on search query
  const filteredDrivers = useMemo(() => {
    if (!searchQuery.trim()) return drivers;
    const query = searchQuery.toLowerCase().trim();
    return drivers.filter((driver) => {
      const name = (driver.name || '').toLowerCase();
      const phone = (driver.phoneNumber || '').toLowerCase();
      return name.includes(query) || phone.includes(query);
    });
  }, [drivers, searchQuery]);

  // Reset page to 0 when search query changes and results are fewer than current page
  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filteredDrivers.length / rowsPerPage) - 1);
    if (page > maxPage) {
      setPage(0);
    }
  }, [filteredDrivers.length, rowsPerPage, page]);

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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <LocalShipping sx={{ fontSize: 40, color: colors.accentText }} />
          <Typography variant="h4" sx={{ color: colors.accentText, fontWeight: 700 }}>
            Riders Management
          </Typography>
        </Box>
        {activeTab === 0 && (
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
        )}
      </Box>

      {/* Tabs */}
      <Paper sx={{ mb: 3, backgroundColor: colors.paper }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{
            borderBottom: `1px solid ${colors.border}`,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: '0.95rem',
              fontWeight: 500,
              minHeight: 64,
              color: colors.textSecondary,
              '&.Mui-selected': {
                color: colors.accentText,
                fontWeight: 600
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: colors.accentText,
              height: 3
            }
          }}
        >
          <Tab icon={<LocalShipping />} iconPosition="start" label="Riders" />
          <Tab icon={<Notifications />} iconPosition="start" label="Custom Notifications" />
          <Tab icon={<AccessTime />} iconPosition="start" label="Shift Report" />
        </Tabs>
      </Paper>

      {activeTab === 0 && (
        <>
          {pushTestResult && (
            <Alert 
              severity={pushTestResult.success ? 'success' : 'error'} 
              sx={{ mb: 3 }}
              onClose={() => setPushTestResult(null)}
            >
              {pushTestResult.message}
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {/* Search Bar */}
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              placeholder="Search riders by name or phone number..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0); // Reset to first page when search changes
              }}
              InputProps={{
                startAdornment: (
                  <Search sx={{ color: colors.textSecondary, mr: 1 }} />
                )
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: colors.paper,
                  '& fieldset': {
                    borderColor: colors.border,
                  },
                  '&:hover fieldset': {
                    borderColor: colors.accentText,
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: colors.accentText,
                  },
                },
                '& .MuiInputBase-input': {
                  color: colors.textPrimary,
                },
                '& .MuiInputBase-input::placeholder': {
                  color: colors.textSecondary,
                  opacity: 1,
                },
              }}
            />
          </Box>

          <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Rider Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Phone Number</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Cash at Hand</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Savings</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Credit Status</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Last Activity</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>OTP</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredDrivers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    {searchQuery.trim() 
                      ? `No riders found matching "${searchQuery}".` 
                      : 'No riders found. Click "Add Rider" to create one.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredDrivers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((driver) => {
                const creditStatus = driver.creditStatus || {};
                const cashAtHand = creditStatus.cashAtHand || driver.cashAtHand || 0;
                const savings = driver.savings || driver.wallet?.savings || 0;
                const creditLimit = creditStatus.creditLimit || driver.creditLimit || 0;
                const exceeded = creditStatus.exceeded || false;
                // const walletBalance = driver.wallet?.balance || 0; // Unused
                
                return (
                <TableRow 
                  key={driver.id} 
                  hover
                  onClick={() => navigate(`/drivers/${driver.id}`)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell sx={{ fontWeight: 500 }}>{driver.name}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Phone fontSize="small" sx={{ color: 'text.secondary' }} />
                      {driver.phoneNumber}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <Select
                        value={driver.status}
                        onChange={(e) => handleStatusChange(driver.id, e.target.value)}
                        sx={{
                          '& .MuiSelect-select': {
                            py: 0.5,
                            px: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            fontWeight: 'bold',
                            color: driver.status === 'active' ? '#2e7d32' :
                                   driver.status === 'on_delivery' ? '#ed6c02' :
                                   driver.status === 'offline' ? '#d32f2f' : 'inherit'
                          }
                        }}
                      >
                        <MenuItem value="offline">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Cancel fontSize="small" />
                            <span>Off Shift</span>
                          </Box>
                        </MenuItem>
                        <MenuItem value="active">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CheckCircle fontSize="small" />
                            <span>On Shift</span>
                          </Box>
                        </MenuItem>
                        <MenuItem value="on_delivery">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LocalShipping fontSize="small" />
                            <span>On Delivery</span>
                          </Box>
                        </MenuItem>
                        <MenuItem value="inactive">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <RemoveCircle fontSize="small" />
                            <span>Inactive</span>
                          </Box>
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: colors.textPrimary }}>
                      KES {Math.round(parseFloat(cashAtHand))}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 500, 
                        color: parseFloat(savings) < 0 ? '#d32f2f' : colors.textPrimary 
                      }}
                    >
                      KES {Math.round(parseFloat(savings))}
                    </Typography>
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
                        Cash at Hand: KES {Math.round(parseFloat(cashAtHand))}
                      </Typography>
                      {creditLimit > 0 && (
                        <>
                          <Typography variant="caption" color="text.secondary">
                            Credit Limit: KES {Math.round(parseFloat(creditLimit))}
                          </Typography>
                          {exceeded && (
                            <Typography variant="caption" color="error">
                              Exceeds by: KES {Math.round(parseFloat(cashAtHand) - parseFloat(creditLimit))}
                            </Typography>
                          )}
                        </>
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
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); toggleOtpVisibility(driver.id); }}
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
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Tooltip title={driver.pushToken ? "Test Push Notification" : "No push token - driver app not connected"}>
                        <span>
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); handleTestPush(driver); }}
                            disabled={testingPush === driver.id || !driver.pushToken}
                            sx={{ 
                              color: driver.pushToken ? colors.accentText : 'text.disabled',
                              '&:hover': { backgroundColor: driver.pushToken ? 'rgba(0, 224, 184, 0.1)' : 'transparent' }
                            }}
                          >
                            {testingPush === driver.id ? (
                              <CircularProgress size={20} />
                            ) : (
                              <Notifications />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                    <Tooltip title="Invite via WhatsApp">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInviteDriver(driver);
                        }}
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
                    <Tooltip title="Add Penalty">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenPenaltyDialog(driver);
                        }}
                        sx={{ color: '#FF9800' }}
                      >
                        <RemoveCircle />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Withdraw Savings">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenWithdrawalDialog(driver);
                        }}
                        disabled={parseFloat(savings) <= 0}
                        sx={{ 
                          color: parseFloat(savings) > 0 ? '#2196F3' : 'text.disabled',
                          '&:hover': { backgroundColor: parseFloat(savings) > 0 ? 'rgba(33, 150, 243, 0.1)' : 'transparent' }
                        }}
                      >
                        <Download />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit Rider">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDialog(driver);
                        }}
                        sx={{ color: colors.accentText }}
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Rider">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(driver.id);
                        }}
                        sx={{ color: '#FF3366' }}
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                    </Box>
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
          count={filteredDrivers.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
        />
      </TableContainer>
        </>
      )}

      {activeTab === 1 && (
        <NotificationEditor onNotificationSent={() => {}} />
      )}

      {activeTab === 2 && (
        <ShiftReportTab />
      )}

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

      {/* Notification Snackbar */}
      <Snackbar
        open={!!notification}
        autoHideDuration={4000}
        onClose={() => setNotification(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setNotification(null)} 
          severity={notification?.severity || 'info'}
          sx={{ 
            width: '100%',
            backgroundColor: notification?.severity === 'success' ? colors.accentText : undefined,
            color: notification?.severity === 'success' && isDarkMode ? '#0D0D0D' : undefined,
            '& .MuiAlert-icon': {
              color: notification?.severity === 'success' && isDarkMode ? '#0D0D0D' : undefined
            }
          }}
        >
          {notification?.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Drivers;

