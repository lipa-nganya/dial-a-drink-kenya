import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem
} from '@mui/material';
import {
  Add,
  Receipt
} from '@mui/icons-material';
import { api } from '../services/zeusApi';

const Billing = () => {
  const [invoices, setInvoices] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    partnerId: '',
    period: '',
    amount: '',
    dueDate: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [invoicesRes, partnersRes] = await Promise.all([
        api.get('/invoices'),
        api.get('/partners')
      ]);
      setInvoices(invoicesRes.data.invoices || []);
      setPartners(partnersRes.data.partners || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = () => {
    setFormData({
      partnerId: '',
      period: '',
      amount: '',
      dueDate: '',
      notes: ''
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const handleSubmit = async () => {
    try {
      await api.post('/invoices', formData);
      handleCloseDialog();
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create invoice');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'default',
      issued: 'info',
      paid: 'success',
      overdue: 'error'
    };
    return colors[status] || 'default';
  };

  if (loading) {
    return (
      <Container>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container>
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1">
          Billing & Invoices
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleOpenDialog}
        >
          Create Invoice
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Invoice Number</TableCell>
              <TableCell>Partner</TableCell>
              <TableCell>Period</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell>Paid Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell>{invoice.invoiceNumber}</TableCell>
                <TableCell>{invoice.partnerName || `Partner ${invoice.partnerId}`}</TableCell>
                <TableCell>{invoice.period}</TableCell>
                <TableCell>KES {parseFloat(invoice.amount || 0).toLocaleString()}</TableCell>
                <TableCell>
                  <Chip
                    label={invoice.status}
                    color={getStatusColor(invoice.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A'}
                </TableCell>
                <TableCell>
                  {invoice.paidDate ? new Date(invoice.paidDate).toLocaleDateString() : 'N/A'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Create Invoice</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            select
            label="Partner"
            value={formData.partnerId}
            onChange={(e) => setFormData({ ...formData, partnerId: e.target.value })}
            margin="normal"
            required
          >
            {partners.map((partner) => (
              <MenuItem key={partner.id} value={partner.id}>
                {partner.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            label="Period"
            value={formData.period}
            onChange={(e) => setFormData({ ...formData, period: e.target.value })}
            margin="normal"
            required
            placeholder="e.g., 2024-01"
          />
          <TextField
            fullWidth
            label="Amount"
            type="number"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Due Date"
            type="date"
            value={formData.dueDate}
            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Billing;
