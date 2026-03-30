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
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import Visibility from '@mui/icons-material/Visibility';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';
import { orderFinancialsForReporting } from '../utils/orderFinancials';

const formatCurrency = (amount) => {
  const n = Number(amount);
  if (Number.isNaN(n)) return 'KES 0';
  return `KES ${Math.round(n).toLocaleString()}`;
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SalesSummary = () => {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [viewItemsOpen, setViewItemsOpen] = useState(false);
  const [viewItemsData, setViewItemsData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // All orders (delivery + POS / admin orders) – no filter
        const [ordersRes, driversRes] = await Promise.all([
          api.get('/admin/orders'),
          api.get('/drivers')
        ]);
        if (cancelled) return;
        const orderList = Array.isArray(ordersRes.data) ? ordersRes.data : [];
        const driverList = Array.isArray(driversRes.data) ? driversRes.data : [];
        setOrders(orderList);
        setDrivers(driverList);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || err.message || 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const dailySummary = useMemo(() => {
    const byDate = new Map();
    orders.forEach((order) => {
      const d = order.createdAt ? new Date(order.createdAt).toISOString().slice(0, 10) : null;
      if (!d) return;
      if (!byDate.has(d)) {
        byDate.set(d, {
          date: d,
          salesCount: 0,
          salesValue: 0,
          purchaseValue: 0,
          deliveryFee: 0, // territory delivery fee (internal)
          profit: 0,
          orders: []
        });
      }
      const row = byDate.get(d);
      const fin = orderFinancialsForReporting(order);
      row.salesCount += 1;
      row.salesValue += fin.totalAmount;
      row.purchaseValue += fin.purchaseCost;
      row.deliveryFee += fin.deliveryFee;
      row.profit += fin.profit;
      row.orders.push(order);
    });
    return Array.from(byDate.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [orders]);

  const handleViewItems = (dayRow) => {
    const getRiderLabel = (order) => {
      const isPos = order.adminOrder === true || order.status === 'pos_order';
      if (isPos || order.driverId == null) return 'POS';
      const driver = drivers.find((d) => Number(d.id) === Number(order.driverId));
      return driver ? (driver.name || `Rider #${order.driverId}`) : `Rider #${order.driverId}`;
    };
    const items = [];
    (dayRow.orders || []).forEach((order) => {
      const riderLabel = getRiderLabel(order);
      const fin = orderFinancialsForReporting(order);
      (fin.items || []).forEach((it) => {
        const qty = parseInt(it.quantity, 10) || 0;
        const sellingPrice = parseFloat(it.price) || 0;
        const purchasePrice = it.drink?.purchasePrice != null && it.drink.purchasePrice !== ''
          ? parseFloat(it.drink.purchasePrice)
          : 0;
        items.push({
          product: it.drink?.name || 'Unknown',
          quantity: qty,
          purchasePrice,
          sellingPrice,
          subtotal: sellingPrice * qty,
          riderLabel
        });
      });
    });
    const dayOfWeek = (() => {
      const d = new Date(dayRow.date + 'T12:00:00');
      return DAY_NAMES[d.getDay()];
    })();
    setViewItemsData({
      date: dayRow.date,
      dayOfWeek,
      items
    });
    setViewItemsOpen(true);
  };

  const closeViewItems = () => {
    setViewItemsOpen(false);
    setViewItemsData(null);
  };

  return (
    <Box sx={{ p: 2 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/sales')}
        sx={{ mb: 2, color: colors.textSecondary }}
      >
        Back to Sales
      </Button>
      <Typography variant="h5" sx={{ color: colors.textPrimary, fontWeight: 600, mb: 2 }}>
        Sales Summary
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
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Day of week &amp; Date</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: colors.accentText }}>Total Sales #</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: colors.accentText }}>Sales Value</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: colors.accentText }}>Purchase Value</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: colors.accentText }}>Territory Delivery Fee</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: colors.accentText }}>Profit</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dailySummary.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3, color: colors.textSecondary }}>
                      No sales data.
                    </TableCell>
                  </TableRow>
                ) : (
                  dailySummary.map((row) => {
                    const dayOfWeek = (() => {
                      const d = new Date(row.date + 'T12:00:00');
                      return DAY_NAMES[d.getDay()];
                    })();
                    const dateFormatted = new Date(row.date + 'T12:00:00').toLocaleDateString('en-KE', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    });
                    return (
                      <TableRow key={row.date} hover>
                        <TableCell sx={{ color: colors.textPrimary }}>
                          {dayOfWeek}, {dateFormatted}
                        </TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary }}>{row.salesCount}</TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary }}>{formatCurrency(row.salesValue)}</TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary }}>{formatCurrency(row.purchaseValue)}</TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary }}>{formatCurrency(row.deliveryFee)}</TableCell>
                        <TableCell align="right" sx={{ color: row.profit >= 0 ? '#2e7d32' : '#c62828', fontWeight: 500 }}>{formatCurrency(row.profit)}</TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Visibility />}
                            onClick={() => handleViewItems(row)}
                            sx={{ textTransform: 'none' }}
                          >
                            View Items
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Dialog open={viewItemsOpen} onClose={closeViewItems} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: colors.textPrimary }}>
          {viewItemsData
            ? `Sales Details for ${viewItemsData.dayOfWeek} ${new Date(viewItemsData.date + 'T12:00:00').toLocaleDateString('en-KE', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}`
            : 'Sales Details'}
        </DialogTitle>
        <DialogContent>
          {viewItemsData && viewItemsData.items && viewItemsData.items.length > 0 ? (
            <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'rgba(0, 224, 184, 0.12)' }}>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Rider name</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Product</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: colors.accentText }}>Quantity</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: colors.accentText }}>Purchase Price</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: colors.accentText }}>Selling Price</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: colors.accentText }}>Subtotal</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {viewItemsData.items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ color: colors.textPrimary, fontWeight: 500 }}>{item.riderLabel}</TableCell>
                      <TableCell sx={{ color: colors.textPrimary }}>{item.product}</TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>{item.quantity}</TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>{formatCurrency(item.purchasePrice)}</TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>{formatCurrency(item.sellingPrice)}</TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>{formatCurrency(item.subtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" sx={{ color: colors.textSecondary, py: 2 }}>
              No line items.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeViewItems} sx={{ color: colors.textSecondary }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SalesSummary;
