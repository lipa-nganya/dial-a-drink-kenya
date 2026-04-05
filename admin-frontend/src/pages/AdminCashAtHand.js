import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import { AttachMoney } from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';
import { useAdmin } from '../contexts/AdminContext';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { hasSuperAdminPrivileges } from '../utils/adminRoles';

const formatCurrency = (amount) => `KES ${Math.round(Number(amount || 0)).toLocaleString()}`;

const AdminCashAtHand = () => {
  const { colors } = useTheme();
  const { user } = useAdmin();
  const isSuperAdmin = hasSuperAdminPrivileges(user?.role);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [cashAtHand, setCashAtHand] = useState(0);
  const [pendingCashAtHand, setPendingCashAtHand] = useState(null);
  const [pendingSubmissionsTotal, setPendingSubmissionsTotal] = useState(0);
  const [cashOrders, setCashOrders] = useState([]);
  const [logs, setLogs] = useState([]);

  const [adminTab, setAdminTab] = useState('cash-orders'); // cash-orders | submissions
  const [cashOrdersSubTab, setCashOrdersSubTab] = useState('orders'); // orders | logs
  const [submissionsTab, setSubmissionsTab] = useState('pending'); // pending | approved | rejected
  const [submissions, setSubmissions] = useState([]);

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actingSubmission, setActingSubmission] = useState(null);
  const [acting, setActing] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createType, setCreateType] = useState('cash'); // cash | general_expense | payment_to_office
  const [createAmount, setCreateAmount] = useState('');
  const [createRecipientName, setCreateRecipientName] = useState('');
  const [createNature, setCreateNature] = useState('');
  const [createAccountType, setCreateAccountType] = useState('mpesa'); // mpesa|till|bank|paybill|pdq

  const loadSummary = async () => {
    const res = await api.get('/admin/cash-at-hand');
    if (!res.data?.success) throw new Error(res.data?.error || 'Failed to load cash at hand');
    setCashAtHand(res.data.cashAtHand || 0);
    setPendingSubmissionsTotal(res.data.pendingSubmissionsTotal || 0);
    setPendingCashAtHand(res.data.pendingCashAtHand ?? null);
  };

  const loadCashOrders = async () => {
    const res = await api.get('/admin/cash-at-hand/cash-orders');
    if (!res.data?.success) throw new Error(res.data?.error || 'Failed to load cash orders');
    setCashOrders(Array.isArray(res.data.orders) ? res.data.orders : []);
  };

  const loadLogs = async () => {
    const res = await api.get('/admin/cash-at-hand/transactions');
    if (!res.data?.success) throw new Error(res.data?.error || 'Failed to load logs');
    setLogs(Array.isArray(res.data.transactions) ? res.data.transactions : []);
  };

  const loadSubmissions = async (status) => {
    // Pending tab behavior:
    // - Normal admin: show only their pending submissions
    // - Super admin: show all pending admin submissions for approval
    const isSuperAdminPendingAll = isSuperAdmin && status === 'pending';
    const url = isSuperAdminPendingAll
      ? '/driver-wallet/admin/cash-submissions/all'
      : '/driver-wallet/admin/cash-submissions/mine';

    const res = await api.get(url, { params: { status } });
    const data = res.data?.data ?? res.data;
    const list = data?.submissions || [];
    const filtered = (Array.isArray(list) ? list : []).filter((s) => s?.submissionType !== 'purchases');
    setSubmissions(filtered);
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        await Promise.all([loadSummary(), loadCashOrders(), loadLogs(), loadSubmissions(submissionsTab)]);
      } catch (e) {
        if (!mounted) return;
        setError(e.message || 'Failed to load');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // refresh submissions when tab changes
    loadSubmissions(submissionsTab).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionsTab]);

  const runningLogRows = useMemo(() => {
    const list = Array.isArray(logs) ? [...logs] : [];
    // newest first to match RiderDetails log style
    list.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    let balanceAfter = Number(cashAtHand || 0);
    return list.map((tx, idx) => {
      const isCredit = tx.type === 'credit';
      const amount = Number(tx.amount || 0);
      const currentBalance = balanceAfter;
      balanceAfter = isCredit ? (balanceAfter - amount) : (balanceAfter + amount);
      return { ...tx, _key: tx.id ?? idx, _isCredit: isCredit, _amount: amount, _balance: currentBalance };
    });
  }, [logs, cashAtHand]);

  const handleReject = async () => {
    if (!isSuperAdmin || !actingSubmission) return;
    setActing(true);
    try {
      await api.post(`/driver-wallet/admin/cash-submissions/${actingSubmission.id}/reject`, { reason: rejectReason.trim() });
      setRejectDialogOpen(false);
      setRejectReason('');
      setActingSubmission(null);
      await Promise.all([loadSummary(), loadLogs(), loadSubmissions(submissionsTab)]);
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AttachMoney sx={{ color: colors.accentText }} />
        <Typography variant="h5" sx={{ fontWeight: 700, color: colors.accentText }}>
          Admin Cash At Hand
        </Typography>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            Actual Cash at Hand
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            {formatCurrency(cashAtHand)}
          </Typography>
          {pendingCashAtHand !== null && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Pending Cash at Hand: <strong>{formatCurrency(pendingCashAtHand)}</strong>
              {pendingSubmissionsTotal > 0 ? ` (pending submissions: ${formatCurrency(pendingSubmissionsTotal)})` : ''}
            </Typography>
          )}
          <Box sx={{ mt: 2 }}>
            <Button
              variant="contained"
              disabled={Number(cashAtHand || 0) <= 0}
              onClick={() => setCreateDialogOpen(true)}
            >
              Make cash at hand submission
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Paper sx={{ mb: 2, backgroundColor: colors.paper }}>
        <Tabs value={adminTab} onChange={(_, v) => setAdminTab(v)}>
          <Tab value="cash-orders" label="Cash Orders" />
          <Tab value="submissions" label="Submissions" />
        </Tabs>
      </Paper>

      {adminTab === 'cash-orders' && (
        <>
          <Paper sx={{ mb: 2, backgroundColor: colors.paper }}>
            <Tabs value={cashOrdersSubTab} onChange={(_, v) => setCashOrdersSubTab(v)}>
              <Tab value="orders" label="Orders" />
              <Tab value="logs" label="Logs" />
            </Tabs>
          </Paper>

          {cashOrdersSubTab === 'orders' && (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Order #</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Customer</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Amount</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Source</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cashOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 3, color: colors.textSecondary }}>
                        No cash orders found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    cashOrders.map((o) => (
                      <TableRow key={o.id} hover>
                        <TableCell>#{o.id}</TableCell>
                        <TableCell>{o.customerName || '—'}</TableCell>
                        <TableCell>{formatCurrency(o.totalAmount)}</TableCell>
                        <TableCell>{o.source === 'pos_cash' ? 'POS cash' : 'Admin cash at hand'}</TableCell>
                        <TableCell>{new Date(o.createdAt).toLocaleString('en-KE')}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {cashOrdersSubTab === 'logs' && (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Description</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">
                      Debit
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">
                      Credit
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">
                      Balance
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {runningLogRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 3, color: colors.textSecondary }}>
                        No logs found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    runningLogRows.map((tx) => (
                      <TableRow key={tx._key} hover>
                        <TableCell>{new Date(tx.date || tx.createdAt).toLocaleString('en-KE')}</TableCell>
                        <TableCell>{tx.description || '—'}</TableCell>
                        <TableCell align="right">{tx._isCredit ? '—' : formatCurrency(tx._amount)}</TableCell>
                        <TableCell align="right">{tx._isCredit ? formatCurrency(tx._amount) : '—'}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {formatCurrency(tx._balance)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {adminTab === 'submissions' && (
        <>
          <Paper sx={{ mb: 2, backgroundColor: colors.paper }}>
            <Tabs value={submissionsTab} onChange={(_, v) => setSubmissionsTab(v)}>
              <Tab value="pending" label="Pending" />
              <Tab value="approved" label="Approved" />
              <Tab value="rejected" label="Rejected" />
            </Tabs>
          </Paper>

          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Amount</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {submissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3, color: colors.textSecondary }}>
                      No submissions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  submissions.map((s) => (
                    <TableRow key={s.id} hover>
                      <TableCell>{s.id}</TableCell>
                      <TableCell>{s.submissionType}</TableCell>
                      <TableCell>{formatCurrency(s.amount)}</TableCell>
                      <TableCell>{s.status}</TableCell>
                      <TableCell>{new Date(s.createdAt).toLocaleString('en-KE')}</TableCell>
                      <TableCell>
                        {isSuperAdmin && s.status === 'pending' ? (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              size="small"
                              variant="contained"
                              disabled={acting}
                              onClick={() => navigate(`/admin-cash-at-hand/submissions/${s.id}/approve`, { state: { submission: s } })}
                            >
                              Approve
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              disabled={acting}
                              onClick={() => {
                                setActingSubmission(s);
                                setRejectDialogOpen(true);
                              }}
                            >
                              Reject
                            </Button>
                          </Box>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {!isSuperAdmin && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Only super admin users can approve/reject submissions.
            </Alert>
          )}
        </>
      )}

      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject submission</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Reason (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)} disabled={acting}>
            Cancel
          </Button>
          <Button onClick={handleReject} color="error" variant="contained" disabled={acting}>
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cash at hand submission</DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            label="Type"
            value={createType}
            onChange={(e) => setCreateType(e.target.value)}
            sx={{ mt: 1 }}
          >
            <option value="cash">Cash</option>
            <option value="general_expense">General expense</option>
            <option value="payment_to_office">Payment to office</option>
          </TextField>
          <TextField
            fullWidth
            label="Amount"
            type="number"
            value={createAmount}
            onChange={(e) => setCreateAmount(e.target.value)}
            sx={{ mt: 2 }}
            helperText={`Max: ${formatCurrency(cashAtHand)}`}
          />
          {createType === 'cash' && (
            <TextField
              fullWidth
              label="Recipient name"
              value={createRecipientName}
              onChange={(e) => setCreateRecipientName(e.target.value)}
              sx={{ mt: 2 }}
            />
          )}
          {createType === 'general_expense' && (
            <TextField
              fullWidth
              label="Nature"
              value={createNature}
              onChange={(e) => setCreateNature(e.target.value)}
              sx={{ mt: 2 }}
            />
          )}
          {createType === 'payment_to_office' && (
            <TextField
              select
              fullWidth
              label="Account type"
              value={createAccountType}
              onChange={(e) => setCreateAccountType(e.target.value)}
              sx={{ mt: 2 }}
            >
              <option value="mpesa">M-Pesa</option>
              <option value="till">Till</option>
              <option value="bank">Bank</option>
              <option value="paybill">Paybill</option>
              <option value="pdq">PDQ</option>
            </TextField>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} disabled={creating}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={creating}
            onClick={async () => {
              const amount = Number(createAmount || 0);
              if (!amount || amount <= 0) return;
              if (amount > Number(cashAtHand || 0)) return;
              if (createType === 'cash' && !createRecipientName.trim()) return;
              if (createType === 'general_expense' && !createNature.trim()) return;
              setCreating(true);
              try {
                const details = {};
                if (createType === 'cash') details.recipientName = createRecipientName.trim();
                if (createType === 'general_expense') details.nature = createNature.trim();
                if (createType === 'payment_to_office') details.accountType = createAccountType;
                await api.post('/driver-wallet/admin/cash-submissions', {
                  submissionType: createType,
                  amount,
                  details,
                  orderIds: []
                });
                setCreateDialogOpen(false);
                setCreateAmount('');
                setCreateRecipientName('');
                setCreateNature('');
                await Promise.all([loadSummary(), loadLogs(), loadSubmissions(submissionsTab)]);
              } finally {
                setCreating(false);
              }
            }}
          >
            {creating ? 'Submitting…' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminCashAtHand;

