import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert
} from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';
import { orderFinancialsForReporting } from '../utils/orderFinancials';

const formatCurrency = (amount) => {
  const n = Number(amount);
  if (Number.isNaN(n)) return 'KES 0';
  return `KES ${Math.round(n).toLocaleString()}`;
};

const formatDate = (dateString) => {
  if (!dateString) return '—';
  try {
    return new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return dateString;
  }
};

const RiderSales = () => {
  const navigate = useNavigate();
  const { riderId } = useParams();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orders, setOrders] = useState([]);
  const [riderName, setRiderName] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [ordersRes, driversRes] = await Promise.all([
          api.get('/admin/orders'),
          api.get('/drivers')
        ]);
        if (cancelled) return;
        const orderList = Array.isArray(ordersRes.data) ? ordersRes.data : [];
        const driverList = Array.isArray(driversRes.data) ? driversRes.data : [];
        const driver = driverList.find((d) => Number(d.id) === Number(riderId));
        setRiderName(driver ? (driver.name || `Rider #${riderId}`) : `Rider #${riderId}`);
        setOrders(orderList.filter((o) => o.driverId != null && Number(o.driverId) === Number(riderId)));
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || err.message || 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [riderId]);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [orders]);

  return (
    <Box sx={{ p: 2 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/sales/rider-profits')}
        sx={{ mb: 2, color: colors.textSecondary }}
      >
        Back to Rider Profits
      </Button>
      <Typography variant="h5" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2 }}>
        Sales – {riderName}
      </Typography>

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
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: 'rgba(0, 224, 184, 0.12)' }}>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Order #</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Customer Name</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Delivery Address</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: colors.accentText }}>Sale Price</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: colors.accentText }}>Purchase Price</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: colors.accentText }}>Territory Delivery Fee</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: colors.accentText }}>Profit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 3, color: colors.textSecondary }}>
                      No orders found for this rider.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedOrders.map((order) => {
                    const fin = orderFinancialsForReporting(order);
                    return (
                      <TableRow key={order.id} hover>
                        <TableCell sx={{ color: colors.textPrimary }}>{order.orderNumber != null ? `#${order.orderNumber}` : order.id}</TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>{formatDate(order.createdAt)}</TableCell>
                        <TableCell sx={{ color: colors.textPrimary }}>{order.customerName || '—'}</TableCell>
                        <TableCell sx={{ color: colors.textPrimary, maxWidth: 200 }}>{order.deliveryAddress || '—'}</TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary }}>{formatCurrency(fin.totalAmount)}</TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary }}>{formatCurrency(fin.purchaseCost)}</TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary }}>{formatCurrency(fin.deliveryFee)}</TableCell>
                        <TableCell align="right" sx={{ color: fin.profit >= 0 ? '#2e7d32' : '#c62828', fontWeight: 500 }}>{formatCurrency(fin.profit)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default RiderSales;
