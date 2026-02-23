import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  CheckCircle,
  Refresh,
  Warning
} from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const InventoryChecks = () => {
  const { colors } = useTheme();
  const [checks, setChecks] = useState([]);
  const [filteredChecks, setFilteredChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('pending'); // all, pending, approved, recount_requested
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [recountDialogOpen, setRecountDialogOpen] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState(null);
  const [updateStock, setUpdateStock] = useState(false);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchChecks();
  }, []);

  const filterChecks = useCallback(() => {
    let filtered = [...checks];

    if (statusFilter !== 'all') {
      filtered = filtered.filter(check => check.status === statusFilter);
    }

    if (flaggedOnly) {
      filtered = filtered.filter(check => check.isFlagged);
    }

    setFilteredChecks(filtered);
  }, [checks, statusFilter, flaggedOnly]);

  useEffect(() => {
    filterChecks();
  }, [filterChecks]);

  const fetchChecks = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/inventory-checks');
      if (response.data.success) {
        setChecks(response.data.checks);
      }
    } catch (err) {
      console.error('Error fetching inventory checks:', err);
      setError(err.response?.data?.error || 'Failed to load inventory checks');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedCheck) return;

    try {
      setProcessing(true);
      const response = await api.post(`/admin/inventory-checks/${selectedCheck.id}/approve`, {
        updateStock,
        notes
      });

      if (response.data.success) {
        setApproveDialogOpen(false);
        setSelectedCheck(null);
        setUpdateStock(false);
        setNotes('');
        fetchChecks();
      } else {
        setError(response.data.error || 'Failed to approve check');
      }
    } catch (err) {
      console.error('Error approving check:', err);
      setError(err.response?.data?.error || 'Failed to approve check');
    } finally {
      setProcessing(false);
    }
  };

  const handleRequestRecount = async () => {
    if (!selectedCheck) return;

    try {
      setProcessing(true);
      const response = await api.post(`/admin/inventory-checks/${selectedCheck.id}/request-recount`, {
        notes
      });

      if (response.data.success) {
        setRecountDialogOpen(false);
        setSelectedCheck(null);
        setNotes('');
        fetchChecks();
      } else {
        setError(response.data.error || 'Failed to request recount');
      }
    } catch (err) {
      console.error('Error requesting recount:', err);
      setError(err.response?.data?.error || 'Failed to request recount');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'recount_requested':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status Filter</InputLabel>
          <Select
            value={statusFilter}
            label="Status Filter"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="all">All Status</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="approved">Approved</MenuItem>
            <MenuItem value="recount_requested">Recount Requested</MenuItem>
          </Select>
        </FormControl>
        <FormControlLabel
          control={
            <Checkbox
              checked={flaggedOnly}
              onChange={(e) => setFlaggedOnly(e.target.checked)}
            />
          }
          label="Show flagged items only"
        />
        <Box sx={{ flexGrow: 1 }} />
        <Chip
          label={`Total: ${filteredChecks.length}`}
          color="primary"
        />
      </Box>

      <TableContainer component={Paper} sx={{ backgroundColor: colors.paper }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: colors.background }}>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Item Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Shop Agent</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="right">Agent Count</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="right">Database Count</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }} align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredChecks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No inventory checks found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredChecks.map((check) => (
                <TableRow
                  key={check.id}
                  sx={{
                    backgroundColor: check.isFlagged ? 'rgba(255, 193, 7, 0.1)' : 'transparent',
                    '&:hover': {
                      backgroundColor: check.isFlagged ? 'rgba(255, 193, 7, 0.2)' : 'rgba(0, 0, 0, 0.04)'
                    }
                  }}
                >
                  <TableCell>
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: check.isFlagged ? 600 : 400 }}>
                        {check.drink?.name || 'Unknown Item'}
                      </Typography>
                      {check.isFlagged && (
                        <Chip
                          icon={<Warning />}
                          label="Mismatch"
                          color="warning"
                          size="small"
                          sx={{ mt: 0.5 }}
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>{check.shopAgent?.name || 'Unknown'}</TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body1"
                      sx={{
                        fontWeight: 'bold',
                        color: check.isFlagged ? '#ff9800' : colors.text
                      }}
                    >
                      {check.agentCount}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{check.databaseCount}</TableCell>
                  <TableCell>
                    <Chip
                      label={check.status}
                      color={getStatusColor(check.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(check.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="center">
                    {check.status === 'pending' && (
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          startIcon={<CheckCircle />}
                          onClick={() => {
                            setSelectedCheck(check);
                            setApproveDialogOpen(true);
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          startIcon={<Refresh />}
                          onClick={() => {
                            setSelectedCheck(check);
                            setRecountDialogOpen(true);
                          }}
                        >
                          Reject
                        </Button>
                      </Box>
                    )}
                    {check.status === 'recount_requested' && (
                      <Chip label="Recount Requested" color="warning" size="small" />
                    )}
                    {check.status === 'approved' && (
                      <Chip label="Approved" color="success" size="small" />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onClose={() => setApproveDialogOpen(false)}>
        <DialogTitle>Approve Inventory Check</DialogTitle>
        <DialogContent>
          {selectedCheck && (
            <Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                <strong>Item:</strong> {selectedCheck.drink?.name}
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                <strong>Agent Count:</strong> {selectedCheck.agentCount} | <strong>Database Count:</strong> {selectedCheck.databaseCount}
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={updateStock}
                    onChange={(e) => setUpdateStock(e.target.checked)}
                  />
                }
                label="Update database stock to match agent count"
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                sx={{ mt: 1 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialogOpen(false)} disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={handleApprove}
            variant="contained"
            color="success"
            disabled={processing}
          >
            {processing ? <CircularProgress size={20} /> : 'Approve'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject/Recount Dialog */}
      <Dialog open={recountDialogOpen} onClose={() => setRecountDialogOpen(false)}>
        <DialogTitle>Reject Inventory Check</DialogTitle>
        <DialogContent>
          {selectedCheck && (
            <Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                <strong>Item:</strong> {selectedCheck.drink?.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                This will reject the submission and request a recount. The shop agent will be notified to submit a new inventory check.
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes for the shop agent..."
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRecountDialogOpen(false)} disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={handleRequestRecount}
            variant="contained"
            color="warning"
            disabled={processing}
          >
            {processing ? <CircularProgress size={20} /> : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InventoryChecks;
