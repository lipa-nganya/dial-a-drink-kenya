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
  CircularProgress,
  Alert,
  TextField,
  IconButton,
  InputAdornment
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import Visibility from '@mui/icons-material/Visibility';
import Edit from '@mui/icons-material/Edit';
import Check from '@mui/icons-material/Check';
import Close from '@mui/icons-material/Close';
import Search from '@mui/icons-material/Search';
import { useTheme } from '../contexts/ThemeContext';
import { useAdmin } from '../contexts/AdminContext';
import { api } from '../services/api';

const Accounts = () => {
  const { colors } = useTheme();
  const { user } = useAdmin();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editBalance, setEditBalance] = useState('');
  const [editLimit, setEditLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [accountSearch, setAccountSearch] = useState('');

  const isSuperAdmin = user?.role === 'super_admin';

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/admin/accounts');
      setAccounts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load accounts');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRecentTransactions = useCallback(async () => {
    try {
      setRecentLoading(true);
      const res = await api.get('/admin/accounts/recent-transactions', { params: { limit: 5 } });
      const data = res.data?.data ?? res.data;
      setRecentTransactions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load recent account transactions', err);
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    fetchRecentTransactions();
  }, [fetchAccounts, fetchRecentTransactions]);

  const startEdit = (account) => {
    setEditingId(account.id);
    setEditBalance(String(account.balance ?? 0));
    setEditLimit(String(account.limit ?? 0));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBalance('');
    setEditLimit('');
  };

  const saveEdit = async () => {
    if (editingId == null) return;
    const balance = parseFloat(editBalance);
    const limit = parseFloat(editLimit);
    if (Number.isNaN(balance) || Number.isNaN(limit)) {
      return;
    }
    setSaving(true);
    try {
      await api.put(`/admin/accounts/${editingId}`, { balance, limit });
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === editingId ? { ...a, balance, limit } : a
        )
      );
      cancelEdit();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to update account');
    } finally {
      setSaving(false);
    }
  };

  const formatMoney = (v) => {
    const n = Number(v);
    if (Number.isNaN(n)) return '0.00';
    return n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const isSubmissionLinkedTransaction = (tx) => {
    if (!tx || !tx.reference) return false;
    return typeof tx.reference === 'string' && tx.reference.includes('Submission #');
  };

  const filteredAccounts = accounts.filter((account) => {
    if (!accountSearch.trim()) return true;
    const q = accountSearch.toLowerCase();
    return (
      (account.name || '').toLowerCase().includes(q) ||
      (account.description || '').toLowerCase().includes(q)
    );
  });

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 1, color: colors.textPrimary, fontWeight: 600 }}>
        Asset Accounts
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search accounts..."
          value={accountSearch}
          onChange={(e) => setAccountSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: colors.textSecondary }} />
              </InputAdornment>
            )
          }}
          sx={{
            minWidth: 260,
            '& .MuiOutlinedInput-root': {
              backgroundColor: colors.paper,
              '& fieldset': { borderColor: colors.border },
              '&:hover fieldset': { borderColor: colors.accent },
              '&.Mui-focused fieldset': { borderColor: colors.accent }
            },
            '& .MuiInputBase-input': {
              color: colors.textPrimary
            }
          }}
        />
      </Box>
      <Paper sx={{ mb: 3, p: 2, backgroundColor: colors.paper }}>
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600, color: colors.textPrimary }}>
          Recent account transactions
        </Typography>
        {recentLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} sx={{ color: colors.accent }} />
          </Box>
        ) : recentTransactions.length === 0 ? (
          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
            No recent transactions.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Account</TableCell>
                  <TableCell>Reference</TableCell>
                  <TableCell align="right">Debit</TableCell>
                  <TableCell align="right">Credit</TableCell>
                  <TableCell>Posted By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentTransactions.map((tx) => {
                  const isSubmissionTx = isSubmissionLinkedTransaction(tx);
                  const debitVal = isSubmissionTx ? 0 : tx.debitAmount;
                  const creditSource =
                    tx.creditAmount && Number(tx.creditAmount) !== 0
                      ? tx.creditAmount
                      : tx.debitAmount;
                  const creditVal = isSubmissionTx ? creditSource : tx.creditAmount;

                  return (
                    <TableRow key={tx.id}>
                      <TableCell sx={{ color: colors.textSecondary }}>
                        {tx.transactionDate}
                      </TableCell>
                      <TableCell sx={{ color: colors.textPrimary }}>
                        {(() => {
                          const acctId =
                            tx.account?.id || tx.assetAccountId || tx.assetAccount?.id;
                          const name =
                            tx.account?.name || tx.assetAccount?.name || '—';
                          return acctId ? (
                            <Button
                              component={RouterLink}
                              to={`/accounts/${acctId}`}
                              size="small"
                              sx={{
                                color: colors.accentText,
                                textTransform: 'none',
                                p: 0,
                                minWidth: 0
                              }}
                            >
                              {name}
                            </Button>
                          ) : (
                            name
                          );
                        })()}
                      </TableCell>
                      <TableCell sx={{ color: colors.textSecondary }}>
                        {tx.reference || '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>
                        {formatMoney(debitVal)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>
                        {formatMoney(creditVal)}
                      </TableCell>
                      <TableCell sx={{ color: colors.textSecondary }}>
                        {tx.postedBy?.username || '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress sx={{ color: colors.accent }} />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ backgroundColor: colors.paper, mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Account Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Balance</TableCell>
                <TableCell align="right">Limit</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell sx={{ color: colors.textPrimary }}>{account.name}</TableCell>
                  <TableCell sx={{ color: colors.textSecondary }}>
                    {account.description || '—'}
                  </TableCell>
                  <TableCell align="right" sx={{ color: colors.textPrimary }}>
                    {editingId === account.id ? (
                      <TextField
                        size="small"
                        type="number"
                        value={editBalance}
                        onChange={(e) => setEditBalance(e.target.value)}
                        inputProps={{ step: 0.01, min: 0 }}
                        sx={{ width: 120 }}
                      />
                    ) : (
                      formatMoney(account.balance)
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ color: colors.textPrimary }}>
                    {editingId === account.id ? (
                      <TextField
                        size="small"
                        type="number"
                        value={editLimit}
                        onChange={(e) => setEditLimit(e.target.value)}
                        inputProps={{ step: 0.01, min: 0 }}
                        sx={{ width: 120 }}
                      />
                    ) : (
                      formatMoney(account.limit)
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {editingId === account.id ? (
                      <>
                        <IconButton
                          size="small"
                          onClick={saveEdit}
                          disabled={saving}
                          sx={{ color: colors.accent }}
                        >
                          <Check />
                        </IconButton>
                        <IconButton size="small" onClick={cancelEdit} sx={{ color: colors.textSecondary }}>
                          <Close />
                        </IconButton>
                      </>
                    ) : (
                      <>
                        {isSuperAdmin && (
                          <IconButton
                            size="small"
                            onClick={() => startEdit(account)}
                            title="Edit balance and limit"
                            sx={{ color: colors.textSecondary }}
                          >
                            <Edit />
                          </IconButton>
                        )}
                        <Button
                          component={RouterLink}
                          to={`/accounts/${account.id}`}
                          size="small"
                          startIcon={<Visibility />}
                          sx={{ color: colors.accent }}
                        >
                          Details
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default Accounts;
