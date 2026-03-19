import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert
} from '@mui/material';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';

const formatCurrency = (amount) => `KES ${Math.round(Number(amount || 0)).toLocaleString()}`;

const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const PendingSubmissionApproval = () => {
  const { submissionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submission, setSubmission] = useState(location.state?.submission || null);
  const [accounts, setAccounts] = useState([]);
  const [approvedSubmissions, setApprovedSubmissions] = useState([]);

  const [accountId, setAccountId] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [transactionCode, setTransactionCode] = useState('');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Default to account flow; account flow is not shown in UI.
  const [approvalMode, setApprovalMode] = useState('account'); // 'account' or 'supplier'
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState('');

  const driver = submission?.driver || null;

  const transactionNumber = submission ? submission.id : submissionId;
  const riderName = driver?.name || '—';
  const amount = submission ? submission.amount : 0;

  const loadSubmission = async () => {
    if (submission) return;
    try {
      const res = await api.get(`/driver-wallet/admin/cash-submissions/${submissionId}`);
      const data = res.data?.data ?? res.data;
      setSubmission(data || null);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load submission');
    }
  };

  const loadAccounts = async () => {
    try {
      const res = await api.get('/admin/accounts');
      setAccounts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load accounts');
    }
  };

  const loadSuppliers = async () => {
    try {
      const res = await api.get('/suppliers');
      setSuppliers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      // Non-fatal for this page; log only
      console.error('Failed to load suppliers', err);
    }
  };

  const loadApprovedSubmissions = async (driverId) => {
    if (!driverId) return;
    try {
      const res = await api.get(`/driver-wallet/${driverId}/cash-submissions`, {
        params: { status: 'approved', limit: 200 }
      });
      const data = res.data?.data ?? res.data;
      const list = Array.isArray(data?.submissions) ? data.submissions : [];
      setApprovedSubmissions(list);
    } catch (err) {
      // Non-fatal
      console.error('Failed to load approved submissions', err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([loadSubmission(), loadAccounts(), loadSuppliers()]);
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };
    init();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  useEffect(() => {
    if (submission?.driver?.id) {
      loadApprovedSubmissions(submission.driver.id);
    }
  }, [submission]);

  useEffect(() => {
    if (submission?.details) {
      const d = submission.details;
      if (d.assetAccountId) setAccountId(d.assetAccountId);
      if (d.accountReference) setReference(d.accountReference);
      if (d.transactionCode) setTransactionCode(d.transactionCode);
      if (d.transactionDate) setTransactionDate(d.transactionDate);
    }
  }, [submission]);

  const similarApprovedTransactions = useMemo(() => {
    const targetAmount = Number(amount || 0);
    if (!approvedSubmissions || approvedSubmissions.length === 0) return [];

    return approvedSubmissions
      .filter((s) => Number(s.amount || 0) === targetAmount)
      .sort((a, b) => {
        const aTime = new Date(a.approvedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.approvedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });
  }, [approvedSubmissions, amount]);

  const accountById = useMemo(() => {
    const map = new Map();
    accounts.forEach((a) => map.set(a.id, a));
    return map;
  }, [accounts]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!submission || !driver?.id) {
      setError('Submission or rider not found');
      return;
    }

    if (approvalMode === 'supplier') {
      if (!supplierId) {
        setError('Please select a supplier');
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        // 1) Update submission details to record supplier payment metadata
        const existingDetails = (submission.details && typeof submission.details === 'object')
          ? submission.details
          : {};
        const supplier =
          suppliers.find((s) => s.id === supplierId || s.id === Number(supplierId)) || null;
        const mergedDetails = {
          ...existingDetails,
          supplierPayment: {
            supplierId,
            supplierName: supplier?.name || null,
            reference: reference || null,
            paymentDate: transactionDate || null
          }
        };

        await api.patch(`/driver-wallet/${driver.id}/cash-submissions/${submission.id}`, {
          details: mergedDetails
        });

        // 2) Approve the cash submission (deduct from driver cash at hand, etc.)
        await api.post(`/driver-wallet/${driver.id}/cash-submissions/${submission.id}/approve`);

        // 3) Create supplier transaction (credit = payment, reduces supplier balance)
        await api.post(`/suppliers/${supplierId}/transactions`, {
          transactionType: 'credit',
          amount: Number(amount),
          reason: `Payment from cash submission #${submission.id} (rider ${riderName})`,
          reference: reference || null
        });

        navigate(`/drivers/${driver?.id}/cash-at-hand`, {
          replace: true,
          state: { submissionsSubTab: 1 } // pending submissions tab
        });
      } catch (err) {
        console.error('Error approving submission as supplier payment', err);
        setError(err.response?.data?.error || err.message || 'Failed to approve supplier payment');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Default: confirm to asset account
    if (!accountId) {
      setError('Please select an account');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // 1) Update submission details (while still pending)
      const existingDetails = (submission.details && typeof submission.details === 'object')
        ? submission.details
        : {};
      const mergedDetails = {
        ...existingDetails,
        assetAccountId: accountId,
        assetAccountName: accountById.get(accountId)?.name || existingDetails.assetAccountName || null,
        transactionCode: transactionCode || null,
        accountReference: reference || null,
        transactionDate: transactionDate || null,
        recipient: existingDetails.recipient || riderName
      };

      await api.patch(`/driver-wallet/${driver.id}/cash-submissions/${submission.id}`, {
        details: mergedDetails
      });

      // 2) Approve the cash submission (deduct from driver cash at hand, credit merchant wallet, etc.)
      await api.post(`/driver-wallet/${driver.id}/cash-submissions/${submission.id}/approve`);

      // 3) Create asset account transaction (credit the selected account)
      await api.post('/admin/accounts/transactions', {
        amount: Number(amount),
        reference: [
          transactionCode ? `TxCode: ${transactionCode}` : '',
          reference || '',
          `Driver: ${riderName}`,
          `Submission #${submission.id}`
        ]
          .filter(Boolean)
          .join(' | '),
        transactionDate,
        accountId,
        transactionType: 'debit' // debit = increase asset account balance
      });

      // Go back to rider cash-at-hand pending tab
      navigate(`/drivers/${driver?.id}/cash-at-hand`, {
        replace: true,
        state: { submissionsSubTab: 1 } // pending submissions tab
      });
    } catch (err) {
      console.error('Error approving submission with account', err);
      setError(err.response?.data?.error || err.message || 'Failed to approve submission');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !submission) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <CircularProgress sx={{ color: colors.accent }} />
      </Box>
    );
  }

  if (!submission) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Submission not found.
        </Alert>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/cash-at-hand')}
          sx={{ color: colors.textSecondary }}
        >
          Back to Cash at Hand
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/cash-at-hand')}
        sx={{ mb: 2, color: colors.textSecondary }}
      >
        Back to Cash at Hand
      </Button>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Typography variant="h5" sx={{ mb: 2, color: colors.textPrimary, fontWeight: 600 }}>
        Approve Cash Submission
      </Typography>

      <Paper
        sx={{
          p: 2,
          mb: 2,
          backgroundColor: colors.paper,
          width: '100%'
        }}
      >
        <form onSubmit={handleSubmit}>
          {/* Single-row layout (desktop): keep everything aligned in one line. */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                // Wider Date/Payment Date column.
                md: '1.1fr 1.1fr 0.9fr 1.05fr 1.6fr 1fr 1.15fr'
              },
              gap: 1
            }}
          >
            <TextField
              label="Transaction number"
              value={transactionNumber}
              InputProps={{ readOnly: true }}
              size="small"
              fullWidth
            />

            <TextField
              label="Rider Name"
              value={riderName}
              InputProps={{ readOnly: true }}
              size="small"
              fullWidth
            />

            <TextField
              label="Amount"
              value={formatCurrency(amount)}
              InputProps={{ readOnly: true }}
              size="small"
              fullWidth
            />

            {approvalMode === 'account' ? (
              <FormControl fullWidth>
                <InputLabel id="account-label">Account</InputLabel>
                <Select
                  labelId="account-label"
                  label="Account"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  size="small"
                >
                  {accounts.map((account) => (
                    <MenuItem key={account.id} value={account.id}>
                      {account.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <FormControl fullWidth>
                <InputLabel id="supplier-label">Supplier</InputLabel>
                <Select
                  labelId="supplier-label"
                  label="Supplier"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  size="small"
                >
                  {suppliers.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <TextField
              label={approvalMode === 'account' ? 'Date' : 'Payment Date'}
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
              fullWidth
            />

            <TextField
              label="Transaction code"
              value={approvalMode === 'account' ? transactionCode : '—'}
              onChange={(e) => {
                if (approvalMode === 'account') setTransactionCode(e.target.value);
              }}
              InputProps={{ readOnly: approvalMode !== 'account' }}
              size="small"
              fullWidth
            />

            <TextField
              label="Reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              size="small"
              fullWidth
            />
          </Box>

          <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              type="submit"
              variant="contained"
              sx={{ backgroundColor: colors.accentText, color: '#fff', fontWeight: 600 }}
              disabled={submitting}
            >
              {submitting
                ? 'Approving…'
                : approvalMode === 'account'
                  ? 'Approve to Account'
                  : 'Approve Supplier Payment'}
            </Button>
            <Button
              type="button"
              variant={approvalMode === 'supplier' ? 'contained' : 'outlined'}
              onClick={() => setApprovalMode('supplier')}
              sx={{
                backgroundColor: approvalMode === 'supplier' ? colors.accentText : 'transparent',
                color: approvalMode === 'supplier' ? '#FFFFFF' : colors.textSecondary,
                fontWeight: 600
              }}
            >
              Supplier Payment
            </Button>
          </Box>
        </form>
      </Paper>

      <Typography variant="h6" sx={{ mb: 1.5, color: colors.textPrimary, fontWeight: 600 }}>
        Similar approved transactions
      </Typography>

      <Paper sx={{ backgroundColor: colors.paper }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Account</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell>Transaction Code</TableCell>
                <TableCell>Recipient</TableCell>
                <TableCell>Approved By</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {similarApprovedTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3, color: colors.textSecondary }}>
                    No similar approved transactions found.
                  </TableCell>
                </TableRow>
              ) : (
                similarApprovedTransactions.map((s) => {
                  const d = (s.details && typeof s.details === 'object') ? s.details : {};
                  const account = d.assetAccountId ? accountById.get(d.assetAccountId) : null;
                  const supplierName = d.supplierPayment?.supplierName || null;
                  const recipient = d.recipient || s.driver?.name || '—';
                  const ref = d.accountReference || d.supplierPayment?.reference || d.reference || '—';
                  const txCode = d.transactionCode || '—';
                  const approvedBy =
                    s.approver?.username ||
                    s.approver?.name ||
                    '—';
                  return (
                    <TableRow key={s.id}>
                      <TableCell sx={{ color: colors.textSecondary }}>
                        {formatDateTime(s.approvedAt || s.createdAt)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>
                        {formatCurrency(s.amount)}
                      </TableCell>
                      <TableCell sx={{ color: colors.textPrimary }}>
                        {account?.name || supplierName || '—'}
                      </TableCell>
                      <TableCell sx={{ color: colors.textSecondary }}>{ref}</TableCell>
                      <TableCell sx={{ color: colors.textSecondary }}>{txCode}</TableCell>
                      <TableCell sx={{ color: colors.textSecondary }}>{recipient}</TableCell>
                      <TableCell sx={{ color: colors.textSecondary }}>{approvedBy}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default PendingSubmissionApproval;

