import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Grid,
  Tabs,
  Tab,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  AttachMoney,
  ShoppingCart,
  LocalShipping,
  TrendingUp,
  TrendingDown,
  Add,
  CheckCircle,
  Cancel
} from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';
import { useAdmin } from '../contexts/AdminContext';
import { api } from '../services/api';

const CashAtHand = () => {
  const { colors } = useTheme();
  const { user } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cashAtHand, setCashAtHand] = useState(0);
  const [breakdown, setBreakdown] = useState({
    cashFromPOS: 0,
    cashFromDrivers: 0,
    cashSpent: 0
  });
  const [submissions, setSubmissions] = useState([]);
  const [posOrders, setPosOrders] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const { fetchPendingSubmissionsCount } = useAdmin();
  const [mySubmissionsTab, setMySubmissionsTab] = useState('pending');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [createSubmissionDialogOpen, setCreateSubmissionDialogOpen] = useState(false);
  const [submissionFormData, setSubmissionFormData] = useState({
    submissionType: 'cash',
    amount: '',
    details: {},
    orderIds: []
  });
  const [availableOrders, setAvailableOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [actionSubmissionId, setActionSubmissionId] = useState(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectSubmission, setRejectSubmission] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchCashAtHand = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get('/admin/cash-at-hand');
      
      if (response.data.success) {
        setCashAtHand(response.data.cashAtHand || 0);
        setBreakdown(response.data.breakdown || {});
        const allSubmissions = response.data.submissions || [];
        
        // Check for new pending submissions before updating state
        setSubmissions(prevSubmissions => {
          const previousPendingCount = prevSubmissions.filter(s => s.status === 'pending').length;
          const newPendingCount = allSubmissions.filter(s => s.status === 'pending').length;
          
          if (newPendingCount > previousPendingCount && previousPendingCount > 0) {
            // Play notification sound for new pending submissions
            try {
              const audioContext = new (window.AudioContext || window.webkitAudioContext)();
              if (audioContext.state === 'suspended') {
                audioContext.resume();
              }
              const oscillator = audioContext.createOscillator();
              const gainNode = audioContext.createGain();
              oscillator.connect(gainNode);
              gainNode.connect(audioContext.destination);
              oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
              oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.05);
              gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
              oscillator.start(audioContext.currentTime);
              oscillator.stop(audioContext.currentTime + 0.3);
            } catch (error) {
              console.warn('Could not play notification sound:', error);
            }
          }
          
          return allSubmissions;
        });
        
        setPosOrders(response.data.posOrders || []);
        
        // Update pending submissions count in context
        if (fetchPendingSubmissionsCount) {
          fetchPendingSubmissionsCount();
        }
      } else {
        setError(response.data.error || 'Failed to load cash at hand data');
      }
    } catch (error) {
      console.error('Error fetching cash at hand:', error);
      setError(error.response?.data?.error || error.message || 'Failed to load cash at hand data');
    } finally {
      setLoading(false);
    }
  }, [fetchPendingSubmissionsCount]);

  useEffect(() => {
    fetchCashAtHand();
    // Fetch pending submissions count on mount
    if (fetchPendingSubmissionsCount) {
      fetchPendingSubmissionsCount();
    }
  }, [fetchCashAtHand, fetchPendingSubmissionsCount]);

  const fetchOrdersForSelection = async () => {
    try {
      setLoadingOrders(true);
      
      // Fetch orders and approved cash submissions in parallel
      const [ordersResponse, approvedSubmissionsResponse] = await Promise.all([
        api.get('/admin/orders'),
        api.get('/driver-wallet/admin/cash-submissions/all')
      ]);
      
      // Get all orders
      const allOrders = ordersResponse.data || [];
      
      // Get approved cash submissions with their associated orders
      const allSubmissions = approvedSubmissionsResponse.data?.data?.submissions || approvedSubmissionsResponse.data?.submissions || [];
      const approvedSubmissions = allSubmissions.filter(s => s.status === 'approved');
      
      // Collect order IDs that are already associated with approved submissions
      const usedOrderIds = new Set();
      approvedSubmissions.forEach(submission => {
        if (submission.orders && Array.isArray(submission.orders)) {
          submission.orders.forEach(order => {
            usedOrderIds.add(order.id);
          });
        }
      });
      
      // Filter to only show POS orders with CASH payment method
      const isPOSOrder = (order) => {
        return order.adminOrder === true || 
               order.status === 'pos_order' ||
               (order.deliveryAddress && order.deliveryAddress.includes('In-Store Purchase'));
      };

      // Filter out cancelled orders, non-POS orders, non-cash payment methods, and orders already associated with approved submissions
      const availableOrders = allOrders.filter(order => {
        if (order.status === 'cancelled') return false;
        if (!isPOSOrder(order)) return false;
        if (order.paymentMethod !== 'cash') return false;
        if (usedOrderIds.has(order.id)) return false;
        return true;
      });
      
      setAvailableOrders(availableOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setAvailableOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleCreateSubmission = async () => {
    try {
      // Validate form data based on submission type
      if (!submissionFormData.amount || parseFloat(submissionFormData.amount) <= 0) {
        alert('Please enter a valid amount');
        return;
      }

      const details = {};
      if (submissionFormData.submissionType === 'purchases') {
        if (!submissionFormData.details.supplier || !submissionFormData.details.item || !submissionFormData.details.price || !submissionFormData.details.deliveryLocation) {
          alert('Please fill in all required fields for purchases');
          return;
        }
        details.supplier = submissionFormData.details.supplier;
        details.item = submissionFormData.details.item;
        details.price = submissionFormData.details.price;
        details.deliveryLocation = submissionFormData.details.deliveryLocation;
      } else if (submissionFormData.submissionType === 'cash') {
        if (!submissionFormData.details.recipientName) {
          alert('Please enter recipient name');
          return;
        }
        details.recipientName = submissionFormData.details.recipientName;
      } else if (submissionFormData.submissionType === 'general_expense') {
        if (!submissionFormData.details.nature) {
          alert('Please enter expense nature');
          return;
        }
        details.nature = submissionFormData.details.nature;
      } else if (submissionFormData.submissionType === 'payment_to_office') {
        if (!submissionFormData.details.accountType) {
          alert('Please select account type');
          return;
        }
        details.accountType = submissionFormData.details.accountType;
      } else if (submissionFormData.submissionType === 'walk_in_sale') {
        // Walk-in sale details are optional
      }

      await api.post('/driver-wallet/admin/cash-submissions', {
        submissionType: submissionFormData.submissionType,
        amount: parseFloat(submissionFormData.amount),
        details,
        orderIds: submissionFormData.orderIds || []
      });

      alert('Cash submission created successfully!');
      setCreateSubmissionDialogOpen(false);
      setSubmissionFormData({ submissionType: 'cash', amount: '', details: {}, orderIds: [] });
      setAvailableOrders([]);
      await fetchCashAtHand();
    } catch (error) {
      console.error('Error creating cash submission:', error);
      alert(error.response?.data?.error || 'Failed to create cash submission');
    }
  };


  const getApproveRejectEndpoint = (item) => {
    const id = item.id;
    if (item.driver?.id) {
      return { base: 'driver-wallet', driverId: item.driver.id, id };
    }
    return { base: 'driver-wallet/admin/cash-submissions', id, isAdmin: true };
  };

  const handleApprove = async (item) => {
    const { base, driverId, id, isAdmin } = getApproveRejectEndpoint(item);
    setActionSubmissionId(id);
    try {
      const url = isAdmin
        ? `/${base}/${id}/approve`
        : `/${base}/${driverId}/cash-submissions/${id}/approve`;
      await api.post(url);
      await fetchCashAtHand();
      if (fetchPendingSubmissionsCount) fetchPendingSubmissionsCount();
    } catch (err) {
      console.error('Error approving submission:', err);
      alert(err.response?.data?.error || err.message || 'Failed to approve');
    } finally {
      setActionSubmissionId(null);
    }
  };

  const handleRejectClick = (item) => {
    setRejectSubmission(item);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectSubmission) return;
    const { base, driverId, id, isAdmin } = getApproveRejectEndpoint(rejectSubmission);
    setActionSubmissionId(id);
    try {
      const url = isAdmin
        ? `/${base}/${id}/reject`
        : `/${base}/${driverId}/cash-submissions/${id}/reject`;
      await api.post(url, { rejectionReason: rejectReason || undefined });
      setRejectDialogOpen(false);
      setRejectSubmission(null);
      setRejectReason('');
      await fetchCashAtHand();
      if (fetchPendingSubmissionsCount) fetchPendingSubmissionsCount();
    } catch (err) {
      console.error('Error rejecting submission:', err);
      alert(err.response?.data?.error || err.message || 'Failed to reject');
    } finally {
      setActionSubmissionId(null);
    }
  };

  const formatCurrency = (amount) => {
    return `KES ${Number(amount || 0).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSubmissionTypeLabel = (type) => {
    const labels = {
      purchases: 'Purchases',
      cash: 'Cash',
      general_expense: 'General Expense',
      payment_to_office: 'Payment to Office',
      walk_in_sale: 'Walk-in Sale',
      order_payment: 'Order Payment'
    };
    return labels[type] || type;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'pending':
        return 'warning';
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  const getPendingSubmissions = useMemo(() => {
    // All pending submissions (driver and admin) so any admin can approve
    return submissions.filter(s => s.status === 'pending');
  }, [submissions]);

  const getMySubmissions = useMemo(() => {
    if (!user?.id) return [];
    // Filter submissions by current admin
    const seen = new Set();
    const allMySubmissions = submissions.filter((submission) => {
      if (submission.adminId !== user.id) {
        return false;
      }
      // De-duplicate by submission id
      if (seen.has(submission.id)) {
        return false;
      }
      seen.add(submission.id);
      return true;
    });
    
    // Filter by status based on mySubmissionsTab
    if (mySubmissionsTab === 'pending') {
      return allMySubmissions.filter(s => s.status === 'pending');
    } else if (mySubmissionsTab === 'approved') {
      return allMySubmissions.filter(s => s.status === 'approved');
    } else if (mySubmissionsTab === 'rejected') {
      return allMySubmissions.filter(s => s.status === 'rejected');
    }
    return allMySubmissions;
  }, [submissions, user?.id, mySubmissionsTab]);

  const displayData = useMemo(() => {
    if (activeTab === 0) {
      // Show all submissions
      return submissions;
    } else if (activeTab === 1) {
      // Show pending submissions from drivers
      return getPendingSubmissions;
    } else if (activeTab === 2) {
      // Show my submissions (admin cash submissions)
      return getMySubmissions;
    } else if (activeTab === 3) {
      // Show POS orders
      return posOrders.map(order => ({
        id: `pos-${order.id}`,
        type: 'pos_order',
        amount: order.totalAmount,
        customerName: order.customerName,
        createdAt: order.createdAt,
        orderId: order.id
      }));
    }
    return [];
  }, [activeTab, submissions, getPendingSubmissions, getMySubmissions, posOrders]);

  const paginatedData = useMemo(() => {
    return displayData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [displayData, page, rowsPerPage]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 700, color: colors.textPrimary }}>
        Cash at Hand
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ backgroundColor: colors.paper, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AttachMoney sx={{ color: colors.accentText, mr: 1, fontSize: 24 }} />
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  Total Cash at Hand
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: colors.accentText, flexGrow: 1 }}>
                {formatCurrency(cashAtHand)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ backgroundColor: colors.paper, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TrendingUp sx={{ color: colors.accentText, mr: 1, fontSize: 24 }} />
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  Cash Received
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary, mb: 0.5 }}>
                {formatCurrency(breakdown.cashFromPOS + breakdown.cashFromDrivers)}
              </Typography>
              <Typography variant="caption" sx={{ color: colors.textSecondary, mt: 'auto' }}>
                POS: {formatCurrency(breakdown.cashFromPOS)} • Drivers: {formatCurrency(breakdown.cashFromDrivers)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ backgroundColor: colors.paper, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TrendingDown sx={{ color: colors.error, mr: 1, fontSize: 24 }} />
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  Cash Spent
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 600, color: colors.error, flexGrow: 1 }}>
                {formatCurrency(breakdown.cashSpent)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Create Submission Button */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setCreateSubmissionDialogOpen(true);
            fetchOrdersForSelection();
          }}
          sx={{
            backgroundColor: colors.accentText,
            color: '#FFFFFF',
            fontWeight: 600,
            '&:hover': { 
              backgroundColor: '#00C4A3',
              color: '#FFFFFF'
            }
          }}
        >
          Create Cash Submission
        </Button>
      </Box>

      {/* Tabs */}
      <Paper sx={{ backgroundColor: colors.paper, mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => {
            setActiveTab(newValue);
            setPage(0);
          }}
          sx={{
            borderBottom: `1px solid ${colors.border}`,
            '& .MuiTab-root': {
              color: colors.textSecondary,
              fontWeight: 600,
              '&.Mui-selected': {
                color: colors.accentText
              }
            }
          }}
        >
          <Tab label={`All Submissions (${submissions.length})`} />
          <Tab label={`Pending Submissions (${getPendingSubmissions.length})`} />
          <Tab label={`My Submissions (${getMySubmissions.length})`} />
          <Tab label={`POS Orders (${posOrders.length})`} />
        </Tabs>
      </Paper>

      {/* My Submissions Sub-Tabs */}
      {activeTab === 2 && (
        <Paper sx={{ backgroundColor: colors.paper, mb: 2 }}>
          <Tabs
            value={mySubmissionsTab}
            onChange={(e, newValue) => {
              setMySubmissionsTab(newValue);
              setPage(0);
            }}
            sx={{
              borderBottom: `1px solid ${colors.border}`,
              '& .MuiTab-root': {
                color: colors.textSecondary,
                fontWeight: 600,
                '&.Mui-selected': {
                  color: colors.accentText
                }
              }
            }}
          >
            <Tab label={`Pending (${submissions.filter(s => s.adminId === user?.id && s.status === 'pending').length})`} value="pending" />
            <Tab label={`Approved (${submissions.filter(s => s.adminId === user?.id && s.status === 'approved').length})`} value="approved" />
            <Tab label={`Rejected (${submissions.filter(s => s.adminId === user?.id && s.status === 'rejected').length})`} value="rejected" />
          </Tabs>
        </Paper>
      )}

      {/* Data Table */}
      <Paper sx={{ backgroundColor: colors.paper }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {activeTab === 2 ? (
                  <>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Order ID</TableCell>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Customer</TableCell>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Amount</TableCell>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Date</TableCell>
                  </>
                  ) : (
                  <>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Type</TableCell>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Payment Type</TableCell>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Source</TableCell>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Amount</TableCell>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Date</TableCell>
                    <TableCell sx={{ color: colors.accentText, fontWeight: 600 }} align="right">Actions</TableCell>
                  </>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell 
                    colSpan={activeTab === 3 ? 4 : 7} 
                    sx={{ textAlign: 'center', py: 4, color: colors.textSecondary }}
                  >
                    No data found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((item) => {
                  if (activeTab === 3) {
                    // POS orders
                    return (
                      <TableRow key={item.id} hover>
                        <TableCell sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                          #{item.orderId}
                        </TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>
                          {item.customerName || 'Guest'}
                        </TableCell>
                        <TableCell sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                          {formatCurrency(item.amount)}
                        </TableCell>
                        <TableCell sx={{ color: colors.textSecondary }}>
                          {formatDate(item.createdAt)}
                        </TableCell>
                      </TableRow>
                    );
                  } else if (activeTab === 0 || activeTab === 1 || activeTab === 2) {
                    // Cash submissions
                    const isFromDriver = item.driver !== null;
                    const isAdminSubmission = item.admin !== null;
                    
                    return (
                      <TableRow key={item.id} hover>
                        <TableCell sx={{ color: colors.textPrimary }}>
                          {getSubmissionTypeLabel(item.submissionType)}
                        </TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>
                          <Chip
                            label={item.details?.paymentType === 'mpesa' ? 'Mpesa' : 'Cash'}
                            size="small"
                            color={item.details?.paymentType === 'mpesa' ? 'primary' : 'default'}
                            sx={{
                              fontWeight: 600,
                              backgroundColor: item.details?.paymentType === 'mpesa' ? '#2196F3' : undefined
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>
                          {isFromDriver ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <LocalShipping fontSize="small" />
                              <Typography variant="body2">
                                {item.driver?.name || 'Driver'}
                              </Typography>
                            </Box>
                          ) : isAdminSubmission ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <ShoppingCart fontSize="small" />
                              <Typography variant="body2">
                                {item.admin?.name || item.admin?.username || 'Admin'}
                              </Typography>
                            </Box>
                          ) : (
                            'N/A'
                          )}
                        </TableCell>
                        <TableCell sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                          {formatCurrency(item.amount)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={item.status}
                            color={getStatusColor(item.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell sx={{ color: colors.textSecondary }}>
                          {formatDate(item.approvedAt || item.createdAt)}
                        </TableCell>
                        <TableCell align="right">
                          {item.status === 'pending' ? (
                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                              <Tooltip title="Approve">
                                <span>
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => handleApprove(item)}
                                    disabled={actionSubmissionId !== null}
                                    sx={{ color: colors.accentText }}
                                  >
                                    {actionSubmissionId === item.id ? (
                                      <CircularProgress size={20} />
                                    ) : (
                                      <CheckCircle fontSize="small" />
                                    )}
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Reject">
                                <span>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleRejectClick(item)}
                                    disabled={actionSubmissionId !== null}
                                  >
                                    <Cancel fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Box>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  }
                  return null;
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={displayData.length}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
          sx={{
            borderTop: `1px solid ${colors.border}`,
            '& .MuiTablePagination-toolbar': {
              color: colors.textPrimary
            }
          }}
        />
      </Paper>

      {/* Create Cash Submission Dialog */}
      <Dialog
        open={createSubmissionDialogOpen}
        onClose={() => {
          setCreateSubmissionDialogOpen(false);
          setSubmissionFormData({ submissionType: 'cash', amount: '', details: {}, orderIds: [] });
          setAvailableOrders([]);
        }}
        TransitionProps={{
          onEnter: () => {
            fetchOrdersForSelection();
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>
          Create Cash Submission
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Submission Type</InputLabel>
              <Select
                value={submissionFormData.submissionType}
                onChange={(e) => setSubmissionFormData({ ...submissionFormData, submissionType: e.target.value, details: {}, orderIds: submissionFormData.orderIds || [] })}
                label="Submission Type"
              >
                <MenuItem value="cash">Cash</MenuItem>
                <MenuItem value="purchases">Purchases</MenuItem>
                <MenuItem value="general_expense">General Expense</MenuItem>
                <MenuItem value="payment_to_office">Payment to Office</MenuItem>
                <MenuItem value="walk_in_sale">Walk-In Sale</MenuItem>
              </Select>
            </FormControl>

            <Autocomplete
              multiple
              options={availableOrders}
              getOptionLabel={(option) => {
                const orderId = option.id || option;
                const customerName = option.customerName || 'Unknown';
                const totalAmount = option.totalAmount || 0;
                return `Order #${orderId} - ${customerName} (KES ${parseFloat(totalAmount).toFixed(2)})`;
              }}
              value={availableOrders.filter(order => (submissionFormData?.orderIds || []).includes(order.id))}
              onChange={(event, newValue) => {
                const totalAmount = newValue.reduce((sum, order) => {
                  return sum + parseFloat(order.totalAmount || 0);
                }, 0);
                
                setSubmissionFormData({
                  ...submissionFormData,
                  orderIds: newValue.map(order => order.id),
                  amount: totalAmount > 0 ? totalAmount.toFixed(2) : ''
                });
              }}
              loading={loadingOrders}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Associated Orders (Optional)"
                  placeholder="Select orders to associate with this cash submission"
                  helperText="Select orders to automatically calculate the total amount"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingOrders ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Order #{option.id} - {option.customerName || 'Unknown'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      KES {parseFloat(option.totalAmount || 0).toFixed(2)} • {option.status || 'unknown'}
                    </Typography>
                  </Box>
                </li>
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={option.id}
                    label={`Order #${option.id}`}
                    size="small"
                    icon={<ShoppingCart />}
                  />
                ))
              }
            />

            <TextField
              label="Amount (KES)"
              type="number"
              value={submissionFormData.amount}
              onChange={(e) => setSubmissionFormData({ ...submissionFormData, amount: e.target.value })}
              fullWidth
              required
              helperText={submissionFormData.orderIds && submissionFormData.orderIds.length > 0 
                ? `Total from ${submissionFormData.orderIds.length} selected order(s)` 
                : 'Enter amount or select orders to auto-calculate'}
            />

            {submissionFormData.submissionType === 'cash' && (
              <TextField
                label="Recipient"
                value={submissionFormData.details.recipientName || ''}
                onChange={(e) => setSubmissionFormData({
                  ...submissionFormData,
                  details: { ...submissionFormData.details, recipientName: e.target.value }
                })}
                fullWidth
                required
                helperText="The person who received the cash submission"
              />
            )}

            {submissionFormData.submissionType === 'purchases' && (
              <>
                <TextField
                  label="Supplier"
                  value={submissionFormData.details.supplier || ''}
                  onChange={(e) => setSubmissionFormData({
                    ...submissionFormData,
                    details: { ...submissionFormData.details, supplier: e.target.value }
                  })}
                  fullWidth
                  required
                />
                <TextField
                  label="Item"
                  value={submissionFormData.details.item || ''}
                  onChange={(e) => setSubmissionFormData({
                    ...submissionFormData,
                    details: { ...submissionFormData.details, item: e.target.value }
                  })}
                  fullWidth
                  required
                />
                <TextField
                  label="Price"
                  type="number"
                  value={submissionFormData.details.price || ''}
                  onChange={(e) => setSubmissionFormData({
                    ...submissionFormData,
                    details: { ...submissionFormData.details, price: e.target.value }
                  })}
                  fullWidth
                  required
                />
                <TextField
                  label="Delivery Location"
                  value={submissionFormData.details.deliveryLocation || ''}
                  onChange={(e) => setSubmissionFormData({
                    ...submissionFormData,
                    details: { ...submissionFormData.details, deliveryLocation: e.target.value }
                  })}
                  fullWidth
                  required
                />
              </>
            )}

            {submissionFormData.submissionType === 'general_expense' && (
              <TextField
                label="Nature of Expense"
                value={submissionFormData.details.nature || ''}
                onChange={(e) => setSubmissionFormData({
                  ...submissionFormData,
                  details: { ...submissionFormData.details, nature: e.target.value }
                })}
                fullWidth
                required
              />
            )}

            {submissionFormData.submissionType === 'payment_to_office' && (
              <FormControl fullWidth>
                <InputLabel>Account Type</InputLabel>
                <Select
                  value={submissionFormData.details.accountType || ''}
                  onChange={(e) => setSubmissionFormData({
                    ...submissionFormData,
                    details: { ...submissionFormData.details, accountType: e.target.value }
                  })}
                  label="Account Type"
                  required
                >
                  <MenuItem value="mpesa">M-Pesa</MenuItem>
                  <MenuItem value="till">Till</MenuItem>
                  <MenuItem value="bank">Bank</MenuItem>
                  <MenuItem value="paybill">Paybill</MenuItem>
                  <MenuItem value="pdq">PDQ</MenuItem>
                </Select>
              </FormControl>
            )}

          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => {
              setCreateSubmissionDialogOpen(false);
              setSubmissionFormData({ submissionType: 'cash', amount: '', details: {}, orderIds: [] });
            }}
            sx={{ color: colors.textSecondary }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateSubmission}
            variant="contained"
            sx={{
              backgroundColor: colors.accentText,
              color: '#FFFFFF',
              fontWeight: 600,
              '&:hover': { 
                backgroundColor: '#00C4A3',
                color: '#FFFFFF'
              }
            }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Cash Submission Dialog */}
      <Dialog
        open={rejectDialogOpen}
        onClose={() => {
          if (!actionSubmissionId) {
            setRejectDialogOpen(false);
            setRejectSubmission(null);
            setRejectReason('');
          }
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>
          Reject Cash Submission
        </DialogTitle>
        <DialogContent>
          {rejectSubmission && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                Reject submission of {formatCurrency(rejectSubmission.amount)} from{' '}
                {rejectSubmission.driver?.name || rejectSubmission.admin?.name || rejectSubmission.admin?.username || 'Unknown'}?
              </Typography>
              <TextField
                label="Reason (optional)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                fullWidth
                multiline
                rows={2}
                placeholder="e.g. Missing documentation"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => {
              setRejectDialogOpen(false);
              setRejectSubmission(null);
              setRejectReason('');
            }}
            disabled={!!actionSubmissionId}
            sx={{ color: colors.textSecondary }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRejectConfirm}
            color="error"
            variant="contained"
            disabled={!!actionSubmissionId}
          >
            {actionSubmissionId === rejectSubmission?.id ? <CircularProgress size={24} /> : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CashAtHand;
