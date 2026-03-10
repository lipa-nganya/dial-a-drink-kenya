import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  IconButton,
  Alert,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  ArrowBack,
  Visibility as ViewItemsIcon
} from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 2 }).format(amount || 0);

const formatDate = (dateString) =>
  dateString
    ? new Date(dateString).toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '—';

const SupplierInvoices = () => {
  const { supplierId } = useParams();
  const navigate = useNavigate();
  const { isDarkMode, colors } = useTheme();
  const [supplier, setSupplier] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [itemsDialogOpen, setItemsDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchInvoices = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/suppliers/${supplierId}/invoices`);
        const data = res.data;
        if (cancelled) return;
        setSupplier(data.supplier || null);
        setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || 'Failed to load invoices.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchInvoices();
    return () => { cancelled = true; };
  }, [supplierId]);

  const handleViewItems = (invoice) => {
    setSelectedInvoice(invoice);
    setItemsDialogOpen(true);
  };

  const handleCloseItemsDialog = () => {
    setItemsDialogOpen(false);
    setSelectedInvoice(null);
  };

  return (
    <Box sx={{ py: 2, px: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate('/payables/manage', { state: { tab: 1 } })} sx={{ color: colors.textSecondary }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" sx={{ color: colors.accentText, fontWeight: 700 }}>
          View Invoices
          {supplier?.name && (
            <Typography component="span" variant="h5" sx={{ color: colors.textSecondary, fontWeight: 500, ml: 1 }}>
              — {supplier.name}
            </Typography>
          )}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card sx={{ backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ backgroundColor: colors.paper }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : 'rgba(0, 0, 0, 0.05)' }}>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Transaction #</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Reference</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: colors.accentText }}>Amount</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: colors.accentText }}>Amount Remaining</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Date</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, color: colors.accentText }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ color: colors.textSecondary, py: 4 }}>
                        No invoices found for this supplier.
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoices.map((inv) => (
                      <TableRow key={inv.id} hover>
                        <TableCell sx={{ color: colors.textPrimary, fontWeight: 500 }}>
                          {inv.transactionNumber ?? inv.id}
                        </TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>
                          {inv.reference || '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary }}>
                          {formatCurrency(inv.amount)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary }}>
                          {formatCurrency(inv.amountRemaining)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={inv.status || 'Not Paid'}
                            color={inv.status === 'Paid' ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>
                          {formatDate(inv.createdAt)}
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<ViewItemsIcon />}
                            onClick={() => handleViewItems(inv)}
                            sx={{
                              borderColor: colors.accentText,
                              color: colors.accentText,
                              '&:hover': { borderColor: colors.accentText, backgroundColor: 'rgba(0, 224, 184, 0.08)' }
                            }}
                          >
                            View items
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* View items dialog */}
      <Dialog open={itemsDialogOpen && !!selectedInvoice} onClose={handleCloseItemsDialog} maxWidth="md" fullWidth>
        <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>
          Invoice #{selectedInvoice?.transactionNumber ?? selectedInvoice?.id} — Items
        </DialogTitle>
        <DialogContent dividers sx={{ backgroundColor: colors.paper }}>
          {selectedInvoice && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <Box>
                  <Typography variant="caption" sx={{ color: colors.textSecondary }}>Reference</Typography>
                  <Typography variant="body1" sx={{ color: colors.textPrimary }}>
                    {selectedInvoice.reference || '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: colors.textSecondary }}>Amount</Typography>
                  <Typography variant="body1" sx={{ color: colors.textPrimary }}>
                    {formatCurrency(selectedInvoice.amount)}
                  </Typography>
                </Box>
              </Box>
              <Typography variant="subtitle2" sx={{ mt: 1, color: colors.textPrimary }}>Items</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Item</TableCell>
                      <TableCell align="right" sx={{ color: colors.accentText, fontWeight: 600 }}>Quantity</TableCell>
                      <TableCell align="right" sx={{ color: colors.accentText, fontWeight: 600 }}>Unit Price</TableCell>
                      <TableCell align="right" sx={{ color: colors.accentText, fontWeight: 600 }}>Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Array.isArray(selectedInvoice.details?.items) && selectedInvoice.details.items.length > 0 ? (
                      selectedInvoice.details.items.map((item, idx) => {
                        const qty = Number(item.quantity || 1);
                        const unit = Number(item.price || 0);
                        const lineTotal = !Number.isNaN(qty) && !Number.isNaN(unit) ? qty * unit : 0;
                        return (
                          <TableRow key={idx}>
                            <TableCell sx={{ color: colors.textPrimary }}>{item.item || '—'}</TableCell>
                            <TableCell align="right" sx={{ color: colors.textPrimary }}>{qty}</TableCell>
                            <TableCell align="right" sx={{ color: colors.textPrimary }}>{formatCurrency(unit)}</TableCell>
                            <TableCell align="right" sx={{ color: colors.textPrimary }}>{formatCurrency(lineTotal)}</TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell sx={{ color: colors.textPrimary }}>
                          {selectedInvoice.details?.item || 'Purchase'}
                        </TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary }}>1</TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary }}>
                          {formatCurrency(selectedInvoice.details?.price ?? selectedInvoice.amount)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary }}>
                          {formatCurrency(selectedInvoice.amount)}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ backgroundColor: colors.paper, p: 2 }}>
          <Button onClick={handleCloseItemsDialog} sx={{ color: colors.textSecondary }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SupplierInvoices;
