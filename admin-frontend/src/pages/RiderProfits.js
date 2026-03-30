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
import List from '@mui/icons-material/List';
import Summarize from '@mui/icons-material/Summarize';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';

const formatCurrency = (amount) => {
  const n = Number(amount);
  if (Number.isNaN(n)) return 'KES 0';
  return `KES ${Math.round(n).toLocaleString()}`;
};

function orderFinancials(order) {
  const items = order.items || order.orderItems || [];
  const totalAmount = parseFloat(order.totalAmount) || 0;
  const tipAmount = parseFloat(order.tipAmount) || 0;
  const itemsTotal = items.reduce((sum, it) => sum + (parseFloat(it.price || 0) * (parseInt(it.quantity, 10) || 0)), 0);
  const convenienceFee =
    order.convenienceFee != null && order.convenienceFee !== ''
      ? parseFloat(order.convenienceFee)
      : Math.max(0, totalAmount - tipAmount - itemsTotal);
  const territoryDeliveryFee =
    order.territoryDeliveryFee != null && order.territoryDeliveryFee !== ''
      ? parseFloat(order.territoryDeliveryFee)
      : convenienceFee;
  let purchaseCost = 0;
  items.forEach((it) => {
    const pp = it.drink?.purchasePrice != null && it.drink.purchasePrice !== ''
      ? parseFloat(it.drink.purchasePrice)
      : null;
    if (pp != null && !Number.isNaN(pp) && pp >= 0) {
      purchaseCost += pp * (parseInt(it.quantity, 10) || 0);
    }
  });
  const profit = totalAmount - purchaseCost - territoryDeliveryFee;
  return { totalAmount, itemsTotal, deliveryFee: territoryDeliveryFee, purchaseCost, profit, items };
}

const RiderProfits = () => {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);

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

  const riderStats = useMemo(() => {
    const byDriver = new Map();
    orders.forEach((order) => {
      const driverId = order.driverId;
      if (driverId == null) return;
      const fin = orderFinancials(order);
      if (!byDriver.has(driverId)) {
        byDriver.set(driverId, {
          driverId,
          totalSalesValue: 0,
          totalPurchaseValue: 0,
          totalDeliveryFee: 0,
          totalProfit: 0,
          orderCount: 0
        });
      }
      const s = byDriver.get(driverId);
      s.totalSalesValue += fin.totalAmount;
      s.totalPurchaseValue += fin.purchaseCost;
      s.totalDeliveryFee += fin.deliveryFee;
      s.totalProfit += fin.profit;
      s.orderCount += 1;
    });
    const driverIds = Array.from(byDriver.keys());
    return driverIds.map((id) => {
      const s = byDriver.get(id);
      const driver = drivers.find((d) => Number(d.id) === Number(id));
      return {
        ...s,
        riderName: driver ? (driver.name || `Rider #${id}`) : `Rider #${id}`
      };
    }).sort((a, b) => (a.riderName || '').localeCompare(b.riderName || ''));
  }, [orders, drivers]);

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
        Rider Profits
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
                <TableRow sx={{ backgroundColor: colors.accent ? 'rgba(0, 224, 184, 0.12)' : 'rgba(0,0,0,0.05)' }}>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText || colors.textPrimary }}>Rider Name</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: colors.accentText || colors.textPrimary }}>Total Sales Value</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: colors.accentText || colors.textPrimary }}>Total Purchase Value</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: colors.accentText || colors.textPrimary }}>Total Territory Delivery Fee</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: colors.accentText || colors.textPrimary }}>Total Profit</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: colors.accentText || colors.textPrimary }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {riderStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3, color: colors.textSecondary }}>
                      No rider sales data found.
                    </TableCell>
                  </TableRow>
                ) : (
                  riderStats.map((row) => (
                    <TableRow key={row.driverId} hover>
                      <TableCell sx={{ color: colors.textPrimary, fontWeight: 500 }}>{row.riderName}</TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>{formatCurrency(row.totalSalesValue)}</TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>{formatCurrency(row.totalPurchaseValue)}</TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>{formatCurrency(row.totalDeliveryFee)}</TableCell>
                      <TableCell align="right" sx={{ color: row.totalProfit >= 0 ? '#2e7d32' : '#c62828', fontWeight: 500 }}>
                        {formatCurrency(row.totalProfit)}
                      </TableCell>
                      <TableCell sx={{ color: colors.textPrimary }}>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<List />}
                            onClick={() => navigate(`/sales/rider-profits/${row.driverId}/sales`)}
                            sx={{ textTransform: 'none' }}
                          >
                            Sales
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Summarize />}
                            onClick={() => navigate(`/sales/rider-profits/${row.driverId}/summary`)}
                            sx={{ textTransform: 'none' }}
                          >
                            Sales Summary
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default RiderProfits;
