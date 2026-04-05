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
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import Visibility from '@mui/icons-material/Visibility';
import Edit from '@mui/icons-material/Edit';
import Check from '@mui/icons-material/Check';
import Close from '@mui/icons-material/Close';
import Search from '@mui/icons-material/Search';
import Delete from '@mui/icons-material/Delete';
import Add from '@mui/icons-material/Add';
import { useTheme } from '../contexts/ThemeContext';
import { useAdmin } from '../contexts/AdminContext';
import { api } from '../services/api';
import { hasSuperAdminPrivileges } from '../utils/adminRoles';

const Accounts = () => {
  const { colors } = useTheme();
  const { user } = useAdmin();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editBalance, setEditBalance] = useState('');
  const [editLimit, setEditLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addBalance, setAddBalance] = useState('0');
  const [addLimit, setAddLimit] = useState('0');
  const [addSaving, setAddSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [accountSearch, setAccountSearch] = useState('');

  const isSuperAdmin = hasSuperAdminPrivileges(user?.role);

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
    setEditName(account.name ?? '');
    setEditDescription(account.description ?? '');
    setEditBalance(String(account.balance ?? 0));
    setEditLimit(String(account.limit ?? 0));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDescription('');
    setEditBalance('');
    setEditLimit('');
  };

  const saveEdit = async () => {
    if (editingId == null) return;
    const name = (editName || '').trim();
    if (!name) {
      setError('Account name is required');
      return;
    }
    const balance = parseFloat(editBalance);
    const limit = parseFloat(editLimit);
    if (Number.isNaN(balance) || Number.isNaN(limit)) {
      return;
    }
    setSaving(true);
    try {
      await api.put(`/admin/accounts/${editingId}`, {
        name,
        description: (editDescription || '').trim() || null,
        balance,
        limit
      });
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === editingId
            ? { ...a, name, description: (editDescription || '').trim() || null, balance, limit }
            : a
        )
      );
      cancelEdit();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to update account');
    } finally {
      setSaving(false);
    }
  };

  const openAddDialog = () => {
    setAddName('');
    setAddDescription('');
    setAddBalance('0');
    setAddLimit('0');
    setAddDialogOpen(true);
  };

  const handleAddAccount = async () => {
    const name = (addName || '').trim();
    if (!name) {
      setError('Account name is required');
      return;
    }
    const balance = addBalance === '' || addBalance == null ? 0 : parseFloat(addBalance);
    const limit = addLimit === '' || addLimit == null ? 0 : parseFloat(addLimit);
    if (Number.isNaN(balance) || Number.isNaN(limit)) {
      setError('Balance and limit must be numbers');
      return;
    }
    setAddSaving(true);
    setError(null);
    try {
      const res = await api.post('/admin/accounts', {
        name,
        description: (addDescription || '').trim() || null,
        balance,
        limit
      });
      setAccounts((prev) => [...prev, res.data]);
      setAddDialogOpen(false);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to create account');
    } finally {
      setAddSaving(false);
    }
  };

  const handleDeleteClick = (account) => setDeleteConfirmId(account.id);

  const handleDeleteConfirm = async () => {
    if (deleteConfirmId == null) return;
    setDeleting(true);
    setError(null);
    try {
      await api.delete(`/admin/accounts/${deleteConfirmId}`);
      setAccounts((prev) => prev.filter((a) => a.id !== deleteConfirmId));
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
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
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, mb: 2 }}>
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
        {isSuperAdmin && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={openAddDialog}
            sx={{
              backgroundColor: colors.accent,
              color: colors.accentText,
              '&:hover': { backgroundColor: colors.accentHover }
            }}
          >
            Add account
          </Button>
        )}
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
                  <TableCell sx={{ color: colors.textPrimary }}>
                    {editingId === account.id ? (
                      <TextField
                        size="small"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Name"
                        sx={{ width: '100%', minWidth: 140 }}
                      />
                    ) : (
                      account.name
                    )}
                  </TableCell>
                  <TableCell sx={{ color: colors.textSecondary }}>
                    {editingId === account.id ? (
                      <TextField
                        size="small"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Description"
                        sx={{ width: '100%', minWidth: 140 }}
                      />
                    ) : (
                      account.description || '—'
                    )}
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
                          <>
                            <IconButton
                              size="small"
                              onClick={() => startEdit(account)}
                              title="Edit account"
                              sx={{ color: colors.textSecondary }}
                            >
                              <Edit />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteClick(account)}
                              title="Delete account"
                              sx={{ color: colors.textSecondary }}
                            >
                              <Delete />
                            </IconButton>
                          </>
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

      <Dialog
        open={addDialogOpen}
        onClose={() => !addSaving && setAddDialogOpen(false)}
        PaperProps={{ sx: { backgroundColor: colors.paper } }}
      >
        <DialogTitle sx={{ color: colors.textPrimary }}>Add asset account</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Account name"
            fullWidth
            required
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            sx={{ mt: 1, '& .MuiInputBase-input': { color: colors.textPrimary } }}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            value={addDescription}
            onChange={(e) => setAddDescription(e.target.value)}
            sx={{ '& .MuiInputBase-input': { color: colors.textPrimary } }}
          />
          <TextField
            margin="dense"
            label="Initial balance"
            type="number"
            fullWidth
            value={addBalance}
            onChange={(e) => setAddBalance(e.target.value)}
            inputProps={{ step: 0.01 }}
            sx={{ '& .MuiInputBase-input': { color: colors.textPrimary } }}
          />
          <TextField
            margin="dense"
            label="Limit"
            type="number"
            fullWidth
            value={addLimit}
            onChange={(e) => setAddLimit(e.target.value)}
            inputProps={{ step: 0.01, min: 0 }}
            sx={{ '& .MuiInputBase-input': { color: colors.textPrimary } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)} disabled={addSaving} sx={{ color: colors.textSecondary }}>
            Cancel
          </Button>
          <Button onClick={handleAddAccount} disabled={addSaving} sx={{ color: colors.accent }}>
            {addSaving ? 'Adding…' : 'Add account'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteConfirmId != null}
        onClose={() => !deleting && setDeleteConfirmId(null)}
        PaperProps={{ sx: { backgroundColor: colors.paper } }}
      >
        <DialogTitle sx={{ color: colors.textPrimary }}>Delete account?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: colors.textSecondary }}>
            This will permanently delete the account. Accounts with transactions cannot be deleted.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmId(null)} disabled={deleting} sx={{ color: colors.textSecondary }}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} disabled={deleting} color="error">
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Accounts;
