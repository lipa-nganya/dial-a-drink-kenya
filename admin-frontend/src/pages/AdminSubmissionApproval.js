import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  CircularProgress,
  Alert
} from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAdmin } from '../contexts/AdminContext';
import { api } from '../services/api';

const formatCurrency = (amount) => `KES ${Math.round(Number(amount || 0)).toLocaleString()}`;

const AdminSubmissionApproval = () => {
  const { submissionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { colors } = useTheme();
  const { user } = useAdmin();
  const isSuperAdmin = user?.role === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submission, setSubmission] = useState(location.state?.submission || null);

  const [accounts, setAccounts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [approvalMode, setApprovalMode] = useState('account'); // account | supplier
  const [accountId, setAccountId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [transactionCode, setTransactionCode] = useState('');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadSubmission = async () => {
    if (submission) return;
    const res = await api.get(`/driver-wallet/admin/cash-submissions/${submissionId}`);
    const data = res.data?.data ?? res.data;
    setSubmission(data || null);
  };

  const loadAccounts = async () => {
    const res = await api.get('/admin/accounts');
    setAccounts(Array.isArray(res.data) ? res.data : []);
  };

  const loadSuppliers = async () => {
    const res = await api.get('/suppliers');
    setSuppliers(Array.isArray(res.data) ? res.data : []);
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([loadSubmission(), loadAccounts(), loadSuppliers()]);
      } catch (err) {
        if (!mounted) return;
        setError(err.response?.data?.error || err.message || 'Failed to load submission');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  useEffect(() => {
    if (!submission?.details) return;
    const d = submission.details || {};
    if (d.assetAccountId) setAccountId(d.assetAccountId);
    if (d.accountReference) setReference(d.accountReference);
    if (d.transactionCode) setTransactionCode(d.transactionCode);
    if (d.transactionDate) setTransactionDate(d.transactionDate);
    if (d.supplierPayment?.supplierId) {
      setApprovalMode('supplier');
      setSupplierId(d.supplierPayment.supplierId);
    }
  }, [submission]);

  const accountById = useMemo(() => {
    const map = new Map();
    accounts.forEach((a) => map.set(a.id, a));
    return map;
  }, [accounts]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      setError('Forbidden: super admin only');
      return;
    }
    if (!submission) {
      setError('Submission not found');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const amount = Number(submission.amount || 0);
      if (!amount || amount <= 0) throw new Error('Invalid submission amount');

      const existingDetails = submission.details && typeof submission.details === 'object' ? submission.details : {};

      if (approvalMode === 'supplier') {
        if (!supplierId) throw new Error('Please select a supplier');

        const supplier = suppliers.find((s) => String(s.id) === String(supplierId)) || null;
        const mergedDetails = {
          ...existingDetails,
          supplierPayment: {
            supplierId,
            supplierName: supplier?.name || null,
            reference: reference || null,
            paymentDate: transactionDate || null
          }
        };

        await api.patch(`/driver-wallet/admin/cash-submissions/${submission.id}`, { details: mergedDetails });
        await api.post(`/driver-wallet/admin/cash-submissions/${submission.id}/approve`);
        await api.post(`/suppliers/${supplierId}/transactions`, {
          transactionType: 'credit',
          amount: Number(amount),
          reason: `Payment from admin cash submission #${submission.id}`,
          reference: reference || null
        });

        navigate('/admin-cash-at-hand', { replace: true });
        return;
      }

      // account mode
      if (!accountId) throw new Error('Please select an account');
      const mergedDetails = {
        ...existingDetails,
        assetAccountId: accountId,
        assetAccountName: accountById.get(accountId)?.name || existingDetails.assetAccountName || null,
        transactionCode: transactionCode || null,
        accountReference: reference || null,
        transactionDate: transactionDate || null
      };

      await api.patch(`/driver-wallet/admin/cash-submissions/${submission.id}`, { details: mergedDetails });
      await api.post(`/driver-wallet/admin/cash-submissions/${submission.id}/approve`);
      await api.post('/admin/accounts/transactions', {
        amount: Number(amount),
        reference: [
          transactionCode ? `TxCode: ${transactionCode}` : '',
          reference || '',
          `Admin submission #${submission.id}`
        ]
          .filter(Boolean)
          .join(' | '),
        transactionDate,
        accountId,
        transactionType: 'debit'
      });

      navigate('/admin-cash-at-hand', { replace: true });
    } catch (err) {
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
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/admin-cash-at-hand')} sx={{ color: colors.textSecondary }}>
          Back to Admin Cash At Hand
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/admin-cash-at-hand')} sx={{ mb: 2, color: colors.textSecondary }}>
        Back to Admin Cash At Hand
      </Button>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!isSuperAdmin && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Only super admin users can approve/reject submissions.
        </Alert>
      )}

      <Typography variant="h5" sx={{ mb: 2, color: colors.textPrimary, fontWeight: 600 }}>
        Approve Admin Submission
      </Typography>

      <Paper sx={{ p: 2, mb: 3, backgroundColor: colors.paper }}>
        <form onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button
              type="button"
              variant={approvalMode === 'account' ? 'contained' : 'outlined'}
              onClick={() => setApprovalMode('account')}
              sx={{
                backgroundColor: approvalMode === 'account' ? colors.accentText : 'transparent',
                color: approvalMode === 'account' ? '#FFFFFF' : colors.textSecondary,
                fontWeight: 600
              }}
            >
              Confirm to Account
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

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <TextField label="Submission #" value={submission.id} InputProps={{ readOnly: true }} fullWidth />
            <TextField label="Amount" value={formatCurrency(submission.amount)} InputProps={{ readOnly: true }} fullWidth />

            {approvalMode === 'account' && (
              <>
                <FormControl fullWidth>
                  <InputLabel id="account-label">Account</InputLabel>
                  <Select
                    labelId="account-label"
                    label="Account"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                  >
                    {accounts.map((account) => (
                      <MenuItem key={account.id} value={account.id}>
                        {account.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Date"
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <TextField label="Transaction code" value={transactionCode} onChange={(e) => setTransactionCode(e.target.value)} fullWidth />
                <TextField label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} fullWidth />
              </>
            )}

            {approvalMode === 'supplier' && (
              <>
                <FormControl fullWidth>
                  <InputLabel id="supplier-label">Supplier</InputLabel>
                  <Select
                    labelId="supplier-label"
                    label="Supplier"
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                  >
                    {suppliers.map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Payment Date"
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <TextField label="Reference" value={reference} onChange={(e) => setReference(e.target.value)} fullWidth />
              </>
            )}
          </Box>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="submit"
              variant="contained"
              sx={{ backgroundColor: colors.accentText, color: '#fff', fontWeight: 600 }}
              disabled={submitting || !isSuperAdmin}
            >
              {submitting ? 'Approving…' : 'Approve submission'}
            </Button>
          </Box>
        </form>
      </Paper>
    </Box>
  );
};

export default AdminSubmissionApproval;

