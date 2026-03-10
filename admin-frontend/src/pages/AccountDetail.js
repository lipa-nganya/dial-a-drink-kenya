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
  Button,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import Add from '@mui/icons-material/Add';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { useTheme } from '../contexts/ThemeContext';
import { useAdmin } from '../contexts/AdminContext';
import { api } from '../services/api';

const formatMoney = (v) => {
  const n = Number(v);
  if (Number.isNaN(n)) return '0.00';
  return n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const AccountDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { colors } = useTheme();
  useAdmin(); // auth context
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabIndex, setTabIndex] = useState(0);
  const [years, setYears] = useState([]);
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [transactOpen, setTransactOpen] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({
    amount: '',
    reference: '',
    transactionDate: new Date().toISOString().slice(0, 10),
    accountId: id || '',
    transactionType: 'debit'
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchAccount = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (tabIndex === 0) {
        if (filterYear) params.year = filterYear;
        if (filterMonth) params.month = filterMonth;
        if (filterStatus) params.status = filterStatus;
      }
      const res = await api.get(`/admin/accounts/${id}`, { params });
      setAccount(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load account');
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, [id, tabIndex, filterYear, filterMonth, filterStatus]);

  const fetchYears = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get(`/admin/accounts/${id}/transaction-years`);
      setYears(Array.isArray(res.data) ? res.data : []);
    } catch {
      setYears([]);
    }
  }, [id]);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await api.get('/admin/accounts');
      setAccounts(Array.isArray(res.data) ? res.data : []);
    } catch {
      setAccounts([]);
    }
  }, []);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  useEffect(() => {
    fetchYears();
  }, [fetchYears]);

  useEffect(() => {
    if (transactOpen) fetchAccounts();
  }, [transactOpen, fetchAccounts]);

  useEffect(() => {
    if (id) setForm((f) => ({ ...f, accountId: id }));
  }, [id]);

  const handleTransactOpen = () => {
    setForm({
      amount: '',
      reference: '',
      transactionDate: new Date().toISOString().slice(0, 10),
      accountId: id,
      transactionType: 'debit'
    });
    setTransactOpen(true);
  };

  const handleTransactSubmit = async () => {
    const { amount, reference, transactionDate, accountId, transactionType } = form;
    const numAmount = parseFloat(amount);
    if (!accountId || !transactionType || Number.isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount and select account and type.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/admin/accounts/transactions', {
        amount: numAmount,
        reference: reference || undefined,
        transactionDate: transactionDate || new Date().toISOString().slice(0, 10),
        accountId: Number(accountId),
        transactionType
      });
      setTransactOpen(false);
      fetchAccount();
      fetchYears();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to post transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const transactions = account?.transactions ?? [];

  const isSubmissionLinkedTransaction = (tx) => {
    if (!tx || !tx.reference) return false;
    return typeof tx.reference === 'string' && tx.reference.includes('Submission #');
  };
  const months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
    { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
    { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
  ];

  return (
    <Box sx={{ p: 2 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/accounts')}
        sx={{ mb: 2, color: colors.textSecondary }}
      >
        Back to Accounts
      </Button>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {loading && !account ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress sx={{ color: colors.accent }} />
        </Box>
      ) : account ? (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <Box>
              <Typography variant="h5" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                {account.name}
              </Typography>
              {account.description && (
                <Typography variant="body2" sx={{ color: colors.textSecondary, mt: 0.5 }}>
                  {account.description}
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                <Chip
                  label={`Balance: ${formatMoney(account.balance)}`}
                  sx={{ backgroundColor: colors.accent + '22', color: colors.textPrimary }}
                />
                <Chip
                  label={`Limit: ${formatMoney(account.limit)}`}
                  sx={{ backgroundColor: colors.paper, color: colors.textSecondary, border: `1px solid ${colors.border}` }}
                />
              </Box>
            </Box>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleTransactOpen}
              sx={{ backgroundColor: colors.accent, color: '#000' }}
            >
              Transact
            </Button>
          </Box>

          <Paper sx={{ backgroundColor: colors.paper }}>
            <Tabs
              value={tabIndex}
              onChange={(_, v) => setTabIndex(v)}
              sx={{ borderBottom: `1px solid ${colors.border}` }}
            >
              <Tab label="Monthly Breakdown" />
              <Tab label="Transactions" />
            </Tabs>
            {tabIndex === 0 && (
              <Box sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                  <FormControl size="small" sx={{ minWidth: 100 }}>
                    <InputLabel>Year</InputLabel>
                    <Select
                      value={filterYear}
                      label="Year"
                      onChange={(e) => setFilterYear(e.target.value)}
                      sx={{ color: colors.textPrimary }}
                    >
                      <MenuItem value="">All</MenuItem>
                      {years.map((y) => (
                        <MenuItem key={y} value={String(y)}>{y}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Month</InputLabel>
                    <Select
                      value={filterMonth}
                      label="Month"
                      onChange={(e) => setFilterMonth(e.target.value)}
                      sx={{ color: colors.textPrimary }}
                    >
                      <MenuItem value="">All</MenuItem>
                      {months.map((m) => (
                        <MenuItem key={m.value} value={String(m.value)}>{m.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={filterStatus}
                      label="Status"
                      onChange={(e) => setFilterStatus(e.target.value)}
                      sx={{ color: colors.textPrimary }}
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="approved">Approved</MenuItem>
                      <MenuItem value="pending">Pending</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Transaction #</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Reference</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell align="right">Debit Amount</TableCell>
                        <TableCell align="right">Credit Amount</TableCell>
                        <TableCell>Posted By</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} align="center" sx={{ color: colors.textSecondary, py: 3 }}>
                            No transactions match the filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell sx={{ color: colors.textPrimary }}>#{tx.id}</TableCell>
                            <TableCell sx={{ color: colors.textSecondary }}>{tx.transactionDate}</TableCell>
                            <TableCell sx={{ color: colors.textSecondary }}>{tx.reference || '—'}</TableCell>
                            <TableCell sx={{ color: colors.textSecondary }}>{tx.description || '—'}</TableCell>
                            {(() => {
                              const isSubmissionTx = isSubmissionLinkedTransaction(tx);
                              const debitVal = isSubmissionTx ? 0 : tx.debitAmount;
                              const creditSource = tx.creditAmount && Number(tx.creditAmount) !== 0 ? tx.creditAmount : tx.debitAmount;
                              const creditVal = isSubmissionTx ? creditSource : tx.creditAmount;
                              return (
                                <>
                                  <TableCell align="right" sx={{ color: colors.textPrimary }}>
                                    {formatMoney(debitVal)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ color: colors.textPrimary }}>
                                    {formatMoney(creditVal)}
                                  </TableCell>
                                </>
                              );
                            })()}
                            <TableCell sx={{ color: colors.textSecondary }}>
                              {tx.postedBy?.username || '—'}
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={tx.status}
                                color={tx.status === 'approved' ? 'success' : 'default'}
                                sx={{ textTransform: 'capitalize' }}
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
            {tabIndex === 1 && (
              <Box sx={{ p: 2 }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Transaction #</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Reference</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell align="right">Debit Amount</TableCell>
                        <TableCell align="right">Credit Amount</TableCell>
                        <TableCell>Posted By</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} align="center" sx={{ color: colors.textSecondary, py: 3 }}>
                            No transactions yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell sx={{ color: colors.textPrimary }}>#{tx.id}</TableCell>
                            <TableCell sx={{ color: colors.textSecondary }}>{tx.transactionDate}</TableCell>
                            <TableCell sx={{ color: colors.textSecondary }}>{tx.reference || '—'}</TableCell>
                            <TableCell sx={{ color: colors.textSecondary }}>{tx.description || '—'}</TableCell>
                            {(() => {
                              const isSubmissionTx = isSubmissionLinkedTransaction(tx);
                              const debitVal = isSubmissionTx ? 0 : tx.debitAmount;
                              const creditSource = tx.creditAmount && Number(tx.creditAmount) !== 0 ? tx.creditAmount : tx.debitAmount;
                              const creditVal = isSubmissionTx ? creditSource : tx.creditAmount;
                              return (
                                <>
                                  <TableCell align="right" sx={{ color: colors.textPrimary }}>
                                    {formatMoney(debitVal)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ color: colors.textPrimary }}>
                                    {formatMoney(creditVal)}
                                  </TableCell>
                                </>
                              );
                            })()}
                            <TableCell sx={{ color: colors.textSecondary }}>{tx.postedBy?.username || '—'}</TableCell>
                            <TableCell>
                              <Chip size="small" label={tx.status} color={tx.status === 'approved' ? 'success' : 'default'} sx={{ textTransform: 'capitalize' }} />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </Paper>

          <Dialog open={transactOpen} onClose={() => !submitting && setTransactOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ color: colors.textPrimary }}>Post Transaction</DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                <TextField
                  label="Amount"
                  type="number"
                  required
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  inputProps={{ step: 0.01, min: 0 }}
                  fullWidth
                />
                <TextField
                  label="Reference"
                  value={form.reference}
                  onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                  fullWidth
                />
                <TextField
                  label="Date"
                  type="date"
                  value={form.transactionDate}
                  onChange={(e) => setForm((f) => ({ ...f, transactionDate: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <FormControl fullWidth>
                  <InputLabel>Account</InputLabel>
                  <Select
                    value={form.accountId}
                    label="Account"
                    onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
                    sx={{ color: colors.textPrimary }}
                  >
                    {accounts.map((a) => (
                      <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>Transaction Type</InputLabel>
                  <Select
                    value={form.transactionType}
                    label="Transaction Type"
                    onChange={(e) => setForm((f) => ({ ...f, transactionType: e.target.value }))}
                    sx={{ color: colors.textPrimary }}
                  >
                    <MenuItem value="debit">Debit</MenuItem>
                    <MenuItem value="credit">Credit</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2, borderTop: `1px solid ${colors.border}` }}>
              <Button onClick={() => !submitting && setTransactOpen(false)} sx={{ color: colors.textSecondary }}>
                Cancel
              </Button>
              <Button variant="contained" onClick={handleTransactSubmit} disabled={submitting} sx={{ backgroundColor: colors.accent, color: '#000' }}>
                {submitting ? 'Posting…' : 'Post'}
              </Button>
            </DialogActions>
          </Dialog>
        </>
      ) : !loading && !account ? (
        <Typography sx={{ color: colors.textSecondary }}>Account not found.</Typography>
      ) : null}
    </Box>
  );
};

export default AccountDetail;
