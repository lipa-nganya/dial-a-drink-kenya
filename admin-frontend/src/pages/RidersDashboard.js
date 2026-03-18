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
  Chip,
  CircularProgress,
  Alert,
  Badge,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import LocalShipping from '@mui/icons-material/LocalShipping';
import AttachMoney from '@mui/icons-material/AttachMoney';
import Edit from '@mui/icons-material/Edit';
import Visibility from '@mui/icons-material/Visibility';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';

const formatCurrency = (amount) => `KES ${Math.round(Number(amount || 0)).toLocaleString()}`;

const formatDashboardDate = () => {
  const d = new Date();
  const day = d.getDate();
  const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .replace(/(\d+)/, (_, num) => num + suffix)
    .replace(', ', ' ');
};

const RidersDashboard = () => {
  const navigate = useNavigate();
  const { colors, isDarkMode } = useTheme();
  const [activeView, setActiveView] = useState(null); // null | 'riders-list' | 'cash-at-hand'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalCashAtHand, setTotalCashAtHand] = useState(0);
  const [riders, setRiders] = useState([]);
  const [submissionsByDriver, setSubmissionsByDriver] = useState({});
  const [editOpen, setEditOpen] = useState(false);
  const [editingRider, setEditingRider] = useState(null);
  const [editLimit, setEditLimit] = useState('');
  const [editBalance, setEditBalance] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchTotalCashAtHand = useCallback(async () => {
    try {
      const res = await api.get('/admin/cash-at-hand', { params: { scope: 'company' } });
      if (res.data?.success) {
        setTotalCashAtHand(res.data.cashAtHand ?? 0);
      }
    } catch {
      setTotalCashAtHand(0);
    }
  }, []);

  const fetchRiders = useCallback(async () => {
    try {
      const res = await api.get('/drivers');
      const list = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
      setRiders(list);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load riders');
      setRiders([]);
    }
  }, []);

  const fetchSubmissionsByDriver = useCallback(async () => {
    try {
      // Use pending endpoint (doesn't require super admin) for per-rider pending counts
      const res = await api.get('/driver-wallet/cash-submissions/pending', { params: { limit: 500 } });
      const raw = res.data?.data?.submissions ?? res.data?.submissions ?? [];
      const byDriver = {};
      raw.forEach((s) => {
        if (s.driver?.id) {
          const id = s.driver.id;
          if (!byDriver[id]) byDriver[id] = { pending: 0 };
          if (s.status === 'pending') byDriver[id].pending += 1;
        }
      });
      setSubmissionsByDriver(byDriver);
    } catch {
      setSubmissionsByDriver({});
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([fetchTotalCashAtHand(), fetchRiders(), fetchSubmissionsByDriver()])
      .then(() => {})
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchTotalCashAtHand, fetchRiders, fetchSubmissionsByDriver]);

  const getStatus = (rider) => {
    const balance = parseFloat(rider.cashAtHand ?? 0);
    const limit = parseFloat(rider.creditLimit ?? rider.creditStatus?.creditLimit ?? 0);
    if (limit <= 0) return { label: 'No limit', color: 'default' };
    if (balance > limit) return { label: 'Above limit', color: 'error' };
    if (balance < 0) return { label: 'Below limit', color: 'warning' };
    return { label: 'Within limit', color: 'success' };
  };

  const openEdit = (rider) => {
    setEditingRider(rider);
    setEditLimit(String(rider.creditLimit ?? ''));
    setEditBalance(String(rider.cashAtHand ?? ''));
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditingRider(null);
    setEditLimit('');
    setEditBalance('');
  };

  const saveEdit = async () => {
    if (!editingRider) return;
    const limit = editLimit === '' ? undefined : parseFloat(editLimit);
    const balance = editBalance === '' ? undefined : parseFloat(editBalance);
    if (limit !== undefined && Number.isNaN(limit)) return;
    if (balance !== undefined && Number.isNaN(balance)) return;
    setSaving(true);
    try {
      const payload = {};
      if (limit !== undefined) payload.creditLimit = limit;
      if (balance !== undefined) payload.cashAtHand = balance;
      await api.put(`/drivers/${editingRider.id}`, payload);
      await fetchRiders();
      closeEdit();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = (driverId) => submissionsByDriver[driverId]?.pending ?? 0;

  const dashboardCards = [
    {
      id: 'riders-list',
      label: 'Riders List',
      icon: <LocalShipping sx={{ fontSize: 40 }} />,
      description: 'View and manage all riders',
      onClick: () => navigate('/drivers'),
      bg: isDarkMode ? 'rgba(0, 224, 184, 0.2)' : 'rgba(0, 224, 184, 0.12)',
      borderColor: colors.accent,
      iconColor: colors.accent
    },
    {
      id: 'cash-at-hand',
      label: 'Cash at Hand',
      icon: <AttachMoney sx={{ fontSize: 40 }} />,
      description: 'Total cash at hand and rider balances',
      onClick: () => setActiveView('cash-at-hand'),
      bg: isDarkMode ? 'rgba(33, 150, 243, 0.2)' : 'rgba(33, 150, 243, 0.1)',
      borderColor: '#2196F3',
      iconColor: '#2196F3'
    }
  ];

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ color: colors.textPrimary, fontWeight: 700, letterSpacing: '-0.02em' }}>
          RIDERS
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary, mt: 0.5 }}>
          {formatDashboardDate()}
        </Typography>
      </Box>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Clickable dashboard cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: 2,
          mb: 4
        }}
      >
        {dashboardCards.map((card) => (
          <Paper
            key={card.id}
            component="button"
            type="button"
            onClick={card.onClick}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 160,
              p: 3,
              textAlign: 'center',
              cursor: 'pointer',
              border: `2px solid ${activeView === card.id ? card.borderColor : 'transparent'}`,
              borderRadius: 3,
              backgroundColor: card.bg,
              color: colors.textPrimary,
              transition: 'all 0.2s ease',
              boxShadow: isDarkMode ? '0 4px 14px rgba(0,0,0,0.25)' : '0 2px 12px rgba(0,0,0,0.08)',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: isDarkMode ? '0 8px 24px rgba(0,0,0,0.35)' : '0 6px 20px rgba(0,0,0,0.12)',
                borderColor: card.borderColor,
                backgroundColor: card.id === 'riders-list'
                  ? (isDarkMode ? 'rgba(0, 224, 184, 0.28)' : 'rgba(0, 224, 184, 0.2)')
                  : (isDarkMode ? 'rgba(33, 150, 243, 0.28)' : 'rgba(33, 150, 243, 0.18)')
              },
              '&:focus-visible': {
                outline: `2px solid ${card.borderColor}`,
                outlineOffset: 2
              }
            }}
          >
            <Box sx={{ color: card.iconColor, mb: 1.5 }}>{card.icon}</Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: colors.textPrimary }}>
              {card.label}
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textSecondary, mt: 0.5 }}>
              {card.description}
            </Typography>
            <ChevronRight sx={{ mt: 1.5, color: colors.textSecondary, fontSize: 28 }} />
          </Paper>
        ))}
      </Box>

      {/* Cash at Hand content when that card is selected */}
      {activeView === 'cash-at-hand' && (
        <Paper sx={{ backgroundColor: colors.paper, borderRadius: 2, overflow: 'hidden', boxShadow: isDarkMode ? '0 4px 14px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.06)' }}>
          <Box sx={{ p: 2 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress sx={{ color: colors.accent }} />
              </Box>
            ) : (
              <>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                    Total Cash at Hand
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: colors.accentText }}>
                    {formatCurrency(totalCashAtHand)}
                  </Typography>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Rider name</TableCell>
                        <TableCell align="right">Limit</TableCell>
                        <TableCell align="right">Balance</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="center">Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {riders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ color: colors.textSecondary, py: 3 }}>
                            No riders found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        riders.map((rider) => {
                          const status = getStatus(rider);
                          const pending = pendingCount(rider.id);
                          return (
                            <TableRow key={rider.id}>
                              <TableCell sx={{ color: colors.textPrimary }}>
                                <Badge
                                  badgeContent={pending}
                                  color="error"
                                  max={99}
                                  invisible={!pending || pending < 1}
                                  sx={{ '& .MuiBadge-badge': { right: -8 } }}
                                >
                                  <span>{rider.name || '—'}</span>
                                </Badge>
                              </TableCell>
                              <TableCell align="right" sx={{ color: colors.textPrimary }}>
                                {formatCurrency(rider.creditLimit ?? rider.creditStatus?.creditLimit ?? 0)}
                              </TableCell>
                              <TableCell align="right" sx={{ color: colors.textPrimary }}>
                                {formatCurrency(rider.cashAtHand)}
                              </TableCell>
                              <TableCell>
                                <Chip size="small" label={status.label} color={status.color} />
                              </TableCell>
                              <TableCell align="center">
                                <IconButton
                                  size="small"
                                  onClick={() => openEdit(rider)}
                                  title="Edit limit or balance"
                                  sx={{ color: colors.textSecondary }}
                                >
                                  <Edit />
                                </IconButton>
                                <Button
                                  size="small"
                                  component={RouterLink}
                                  to={`/drivers/${rider.id}/cash-at-hand`}
                                  startIcon={<Visibility />}
                                  sx={{ color: colors.accent }}
                                >
                                  View details
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </Box>
        </Paper>
      )}

      <Dialog open={editOpen} onClose={closeEdit} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: colors.textPrimary }}>
          Edit {editingRider?.name ?? 'Rider'}
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Cash at Hand Limit (KES)"
            type="number"
            value={editLimit}
            onChange={(e) => setEditLimit(e.target.value)}
            inputProps={{ step: 1, min: 0 }}
            fullWidth
            sx={{ mt: 1 }}
          />
          <TextField
            label="Cash at Hand Balance (KES)"
            type="number"
            value={editBalance}
            onChange={(e) => setEditBalance(e.target.value)}
            inputProps={{ step: 0.01 }}
            fullWidth
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: `1px solid ${colors.border}` }}>
          <Button onClick={closeEdit} sx={{ color: colors.textSecondary }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={saveEdit} disabled={saving} sx={{ backgroundColor: colors.accent, color: '#000' }}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RidersDashboard;
