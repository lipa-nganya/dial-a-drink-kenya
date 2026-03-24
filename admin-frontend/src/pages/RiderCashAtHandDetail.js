import React, { useState, useEffect, useCallback } from 'react';
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
  Tabs,
  Tab,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import { useParams, Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';

const formatCurrency = (amount) => `KES ${Math.round(Number(amount || 0)).toLocaleString()}`;

const formatDate = (dateString) => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleString('en-KE', {
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
    order_payment: 'Submission'
  };
  return labels[type] || type;
};

const getStatusColor = (status) => {
  switch (status) {
    case 'approved': return 'success';
    case 'pending': return 'warning';
    case 'rejected': return 'error';
    default: return 'default';
  }
};

const RiderCashAtHandDetail = () => {
  const { riderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { colors } = useTheme();
  const [rider, setRider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabIndex, setTabIndex] = useState(0);
  const mapLegacySubmissionsSubTab = (v) => {
    if (typeof v !== 'number') return 0;
    // Legacy mapping (pre-removal of "All Submissions"):
    // 0 = All submissions, 1 = Pending, 2 = Approved, 3 = Rejected
    // New mapping:
    // 0 = Pending, 1 = Approved, 2 = Rejected
    if (v === 1) return 0;
    if (v === 2) return 1;
    if (v === 3) return 2;
    // Any other value (including legacy 0/"All submissions") defaults to Pending
    return 0;
  };

  const initialSubmissionsSubTab = mapLegacySubmissionsSubTab(location.state?.submissionsSubTab);
  const [submissionsSubTab, setSubmissionsSubTab] = useState(initialSubmissionsSubTab);
  const [submissions, setSubmissions] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [logs, setLogs] = useState([]);
  const [totalCashAtHand, setTotalCashAtHand] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectSubmissionId, setRejectSubmissionId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [confirmedSearch, setConfirmedSearch] = useState('');

  const fetchRider = useCallback(async () => {
    if (!riderId) return;
    try {
      const res = await api.get(`/drivers/${riderId}`);
      const data = res.data?.data ?? res.data;
      setRider(data || null);
    } catch {
      setRider(null);
    }
  }, [riderId]);

  const fetchSubmissions = useCallback(async () => {
    if (!riderId) return;
    try {
      const statusMap = { 0: 'pending', 1: 'approved', 2: 'rejected' };
      const statusParam = statusMap[submissionsSubTab];
      const res = await api.get(`/driver-wallet/${riderId}/cash-submissions`, {
        params: statusParam ? { status: statusParam } : { limit: 500 }
      });
      const data = res.data?.data ?? res.data;
      setSubmissions(Array.isArray(data?.submissions) ? data.submissions : []);
      setCounts(data?.counts ?? { pending: 0, approved: 0, rejected: 0 });
    } catch (err) {
      setSubmissions([]);
      setCounts({ pending: 0, approved: 0, rejected: 0 });
    }
  }, [riderId, submissionsSubTab]);

  const fetchLogs = useCallback(async () => {
    if (!riderId) return;
    setLogsLoading(true);
    try {
      const res = await api.get(`/driver-wallet/${riderId}/cash-at-hand`);
      const data = res.data?.data ?? res.data;
      setLogs(Array.isArray(data?.entries) ? data.entries : []);
      setTotalCashAtHand(parseFloat(data?.totalCashAtHand ?? data?.cashAtHand ?? 0) || 0);
    } catch {
      setLogs([]);
      setTotalCashAtHand(0);
    } finally {
      setLogsLoading(false);
    }
  }, [riderId]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchRider()
      .then(() => {})
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchRider]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  useEffect(() => {
    if (typeof location.state?.submissionsSubTab === 'number') {
      setSubmissionsSubTab(mapLegacySubmissionsSubTab(location.state.submissionsSubTab));
    }
  }, [location.state?.submissionsSubTab]);

  // Only keep/allow search on the Confirmed tab.
  useEffect(() => {
    if (submissionsSubTab !== 1) setConfirmedSearch('');
  }, [submissionsSubTab]);

  useEffect(() => {
    if (tabIndex === 1) fetchLogs();
  }, [tabIndex, fetchLogs]);

  const riderName = rider?.name ?? 'Rider';
  const pendingCount = counts.pending ?? 0;

  const handleApprove = (submissionId) => {
    // Route to the detailed approval page so admin can assign an account
    navigate(`/cash-at-hand/submissions/${submissionId}/approve`);
  };

  const handleRejectClick = (submissionId) => {
    setRejectSubmissionId(submissionId);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!riderId || rejectSubmissionId == null) return;
    setActionLoadingId(rejectSubmissionId);
    setError(null);
    try {
      await api.post(`/driver-wallet/${riderId}/cash-submissions/${rejectSubmissionId}/reject`, {
        rejectionReason: rejectReason || undefined
      });
      setRejectDialogOpen(false);
      setRejectSubmissionId(null);
      setRejectReason('');
      await fetchSubmissions();
      await fetchLogs();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to reject submission');
    } finally {
      setActionLoadingId(null);
    }
  };


  const renderSubmissionDetails = (s) => {
    const orders = s.orders || [];
    if (orders.length > 0) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {orders.map((order) => {
            const address = order.deliveryAddress ?? order.delivery_address ?? '';
            return (
              <Box
                key={order.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 0.75
                }}
              >
                <Chip
                  size="small"
                  label={`#${order.orderNumber ?? order.id}`}
                  sx={{ mr: 0.5 }}
                />
                <Typography
                  component="span"
                  variant="body2"
                  sx={{ color: colors.textSecondary }}
                >
                  {address || '—'}
                </Typography>
              </Box>
            );
          })}
        </Box>
      );
    }
    if (s.details && typeof s.details === 'object') {
      if (s.submissionType === 'cash' && s.details.recipientName) return s.details.recipientName;
      if (s.submissionType === 'general_expense' && s.details.nature) return s.details.nature;
      if (s.submissionType === 'payment_to_office' && s.details.accountType) return `Payment to office: ${s.details.accountType}`;
      if (s.submissionType === 'purchases' && s.details.supplier) return `Purchase from ${s.details.supplier}`;
      if (s.submissionType === 'order_payment' && s.details.orderId) return `Order #${s.details.orderId}`;
    }
    return s.details && typeof s.details === 'object' ? JSON.stringify(s.details) : (s.details ?? '—');
  };

  const confirmedQuery = String(confirmedSearch || '').trim().toLowerCase();
  const submissionsForTable =
    submissionsSubTab === 1 && confirmedQuery
      ? submissions.filter((s) => {
          const detailsText = String(renderSubmissionDetails(s) || '');
          const haystack = `${s.id} ${s.submissionType} ${s.amount} ${detailsText}`;
          return haystack.toLowerCase().includes(confirmedQuery);
        })
      : submissions;

  if (loading && !rider) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress sx={{ color: colors.accent }} />
      </Box>
    );
  }

  if (!rider && !loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">Rider not found.</Alert>
        <Button component={RouterLink} to="/riders" startIcon={<ArrowBack />} sx={{ mt: 2 }}>
          Back to Riders
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Button
        component={RouterLink}
        to="/riders"
        startIcon={<ArrowBack />}
        sx={{ mb: 2, color: colors.textSecondary }}
      >
        Back to Riders
      </Button>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Typography variant="h5" sx={{ mb: 2, color: colors.textPrimary, fontWeight: 600 }}>
        {riderName} Cash at Hand Details
      </Typography>
      <Paper sx={{ backgroundColor: colors.paper }}>
        <Tabs
          value={tabIndex}
          onChange={(_, v) => setTabIndex(v)}
          sx={{ borderBottom: `1px solid ${colors.border}` }}
        >
          <Tab
            label={
              <Badge badgeContent={pendingCount} color="error" max={99}>
                <span>Submissions</span>
              </Badge>
            }
          />
          <Tab label="Logs" />
        </Tabs>
        {tabIndex === 0 && (
          <Box sx={{ p: 2 }}>
            <Tabs
              value={submissionsSubTab}
              onChange={(_, v) => setSubmissionsSubTab(v)}
              sx={{ borderBottom: `1px solid ${colors.border}`, mb: 2 }}
            >
              {/* Removed "All Submissions" tab; tabs now start at Pending */}
              <Tab
                label={
                  <Badge badgeContent={pendingCount} color="error" max={99}>
                    <span>Pending</span>
                  </Badge>
                }
              />
              <Tab label="Confirmed" />
              <Tab label="Rejected" />
            </Tabs>
            {submissionsSubTab === 1 && (
              <TextField
                size="small"
                fullWidth
                placeholder="Search confirmed submissions..."
                value={confirmedSearch}
                onChange={(e) => setConfirmedSearch(e.target.value)}
                sx={{ mb: 2 }}
              />
            )}
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Status</TableCell>
                    {(submissionsSubTab === 0 || submissions.some((s) => s.status === 'pending')) && (
                      <TableCell align="right">Actions</TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {submissionsForTable.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={submissionsSubTab === 0 ? 5 : 4}
                        align="center"
                        sx={{ color: colors.textSecondary, py: 3 }}
                      >
                        No submissions in this category.
                      </TableCell>
                    </TableRow>
                  ) : (
                    submissionsForTable.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell sx={{ color: colors.textSecondary }}>{formatDate(s.createdAt)}</TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>{getSubmissionTypeLabel(s.submissionType)}</TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary }}>{formatCurrency(s.amount)}</TableCell>
                        <TableCell>
                          <Chip size="small" label={s.status} color={getStatusColor(s.status)} />
                        </TableCell>
                        {(submissionsSubTab === 0 || submissions.some((x) => x.status === 'pending')) && (
                          <TableCell align="right">
                            {s.status === 'pending' ? (
                              <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="primary"
                                  disabled={actionLoadingId === s.id}
                                  onClick={() => handleApprove(s.id)}
                                >
                                  {actionLoadingId === s.id ? '…' : 'Approve'}
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  disabled={actionLoadingId === s.id}
                                  onClick={() => handleRejectClick(s.id)}
                                >
                                  Reject
                                </Button>
                              </Box>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle sx={{ color: colors.textPrimary }}>Reject cash submission</DialogTitle>
              <DialogContent>
                <TextField
                  autoFocus
                  margin="dense"
                  label="Rejection reason (optional)"
                  fullWidth
                  multiline
                  rows={2}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  sx={{ mt: 1 }}
                />
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setRejectDialogOpen(false)} sx={{ color: colors.textSecondary }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleRejectConfirm}
                  color="error"
                  variant="contained"
                  disabled={rejectSubmissionId != null && actionLoadingId === rejectSubmissionId}
                >
                  {rejectSubmissionId != null && actionLoadingId === rejectSubmissionId ? 'Rejecting…' : 'Reject'}
                </Button>
              </DialogActions>
            </Dialog>
          </Box>
        )}
        {tabIndex === 1 && (
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: colors.textPrimary }}>
              Cash at Hand Transactions
            </Typography>
            {logsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress sx={{ color: colors.accent }} />
              </Box>
            ) : !logs || logs.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: colors.paper }}>
                <Typography variant="body1" sx={{ color: colors.textSecondary }}>
                  No cash at hand transactions found
                </Typography>
              </Paper>
            ) : (
              <TableContainer component={Paper} sx={{ backgroundColor: colors.paper }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Order #</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Type</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="right">Credit</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="right">Debit</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="right">Balance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(() => {
                      const sortedEntries = [...logs].sort((a, b) => {
                        const dateA = new Date(a.date);
                        const dateB = new Date(b.date);
                        return dateB - dateA;
                      });
                      let balanceAfter = totalCashAtHand;
                      const entryType = (entry) => {
                        const t = entry.type ?? entry.transaction_type ?? entry.Type;
                        return typeof t === 'string' ? t.toLowerCase() : t;
                      };
                      const getLogType = (entry, isCredit) => {
                        const type = entryType(entry);
                        if (isCredit || type === 'cash_received') return 'Payment Received';
                        return 'Submission';
                      };
                      const getDescription = (entry) => {
                        let desc = entry.description || entry.customerName || 'N/A';
                        if (typeof desc === 'string') {
                          desc = desc.replace(/\s+submission\s*$/i, '').trim();
                        }
                        return desc || 'N/A';
                      };
                      const getOrderNumber = (entry) => {
                        const id = entry.orderId ?? entry.order_id ?? entry.details?.orderId ?? entry.details?.order_id;
                        if (id != null) return id;
                        const desc = entry.description || '';
                        const match = typeof desc === 'string' && desc.match(/Order payment #(\d+)/);
                        return match ? match[1] : null;
                      };
                      return sortedEntries.map((entry, index) => {
                        const type = entryType(entry);
                        const isCredit = type === 'cash_received';
                        const amount = parseFloat(entry.amount || 0);
                        const currentBalance = balanceAfter;
                        const orderNum = getOrderNumber(entry);
                        if (isCredit) {
                          balanceAfter -= amount;
                        } else {
                          balanceAfter += amount;
                        }
                        return (
                          <TableRow key={entry.transactionId ?? entry.id ?? index} hover>
                            <TableCell sx={{ color: colors.textSecondary, fontWeight: 600 }}>
                              {sortedEntries.length - index}
                            </TableCell>
                            <TableCell sx={{ color: colors.textPrimary }}>
                              {new Date(entry.date).toLocaleDateString('en-KE', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </TableCell>
                            <TableCell sx={{ color: colors.textPrimary }}>
                              {orderNum != null ? `#${orderNum}` : '—'}
                            </TableCell>
                            <TableCell sx={{ color: colors.textPrimary }}>
                              {getLogType(entry, isCredit)}
                            </TableCell>
                            <TableCell sx={{ color: colors.textPrimary }}>
                              {getDescription(entry)}
                            </TableCell>
                            <TableCell align="right" sx={{ color: colors.textPrimary }}>
                              {isCredit ? formatCurrency(amount) : '—'}
                            </TableCell>
                            <TableCell align="right" sx={{ color: colors.textPrimary }}>
                              {!isCredit ? formatCurrency(amount) : '—'}
                            </TableCell>
                            <TableCell align="right" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                              {formatCurrency(currentBalance)}
                            </TableCell>
                          </TableRow>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
      </Paper>

    </Box>
  );
};

export default RiderCashAtHandDetail;
