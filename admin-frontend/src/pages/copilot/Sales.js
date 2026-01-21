import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  TextField,
  Button,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  ShoppingCart,
  Person,
  AttachMoney,
  TrendingUp,
  DateRange,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import { api } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';

const Sales = () => {
  const { isDarkMode, colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [dateRange, setDateRange] = useState('last30');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, customStartDate, customEndDate]);

  const getDateRange = () => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    let start = new Date();

    switch (dateRange) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case 'last7':
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case 'last30':
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        break;
      case 'last90':
        start.setDate(start.getDate() - 90);
        start.setHours(0, 0, 0, 0);
        break;
      case 'thisMonth':
        start = new Date(end.getFullYear(), end.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        break;
      case 'thisYear':
        start = new Date(end.getFullYear(), 0, 1);
        start.setHours(0, 0, 0, 0);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          end.setTime(new Date(customEndDate).getTime());
          end.setHours(23, 59, 59, 999);
        }
        break;
      default:
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
    }

    return { start, end };
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { start, end } = getDateRange();
      const response = await api.get('/admin/sales-analytics', {
        params: {
          startDate: start.toISOString(),
          endDate: end.toISOString()
        }
      });
      
      if (response.data.success) {
        setAnalytics(response.data);
      } else {
        setError(response.data.error || 'Failed to fetch sales analytics');
      }
    } catch (err) {
      console.error('Error fetching sales analytics:', err);
      setError(err.response?.data?.error || err.message || 'Failed to fetch sales analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!analytics) {
    return (
      <Alert severity="info">
        No sales data available
      </Alert>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1, color: colors.textPrimary }}>
          Sales Analytics
        </Typography>
        <Typography variant="body1" sx={{ color: colors.textSecondary }}>
          Track online sales, admin sales, and admin cash at hand
        </Typography>
      </Box>

      {/* Date Range Filters */}
      <Card sx={{ mb: 4, backgroundColor: colors.paper }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DateRange sx={{ color: colors.accentText }} />
              <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                Date Range
              </Typography>
            </Box>
            <Button
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              sx={{ color: colors.accentText }}
            >
              {filtersExpanded ? <ExpandLess /> : <ExpandMore />}
            </Button>
          </Box>
          <Collapse in={filtersExpanded} orientation="horizontal">
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Date Range</InputLabel>
                <Select
                  value={dateRange}
                  label="Date Range"
                  onChange={(e) => setDateRange(e.target.value)}
                >
                  <MenuItem value="today">Today</MenuItem>
                  <MenuItem value="last7">Last 7 Days</MenuItem>
                  <MenuItem value="last30">Last 30 Days</MenuItem>
                  <MenuItem value="last90">Last 90 Days</MenuItem>
                  <MenuItem value="thisMonth">This Month</MenuItem>
                  <MenuItem value="thisYear">This Year</MenuItem>
                  <MenuItem value="custom">Custom Range</MenuItem>
                </Select>
              </FormControl>
              {dateRange === 'custom' && (
                <>
                  <TextField
                    size="small"
                    type="date"
                    label="Start Date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 150 }}
                  />
                  <TextField
                    size="small"
                    type="date"
                    label="End Date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 150 }}
                  />
                </>
              )}
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ backgroundColor: colors.paper, height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <ShoppingCart sx={{ color: colors.accentText, mr: 1, fontSize: 32 }} />
                <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                  Online Sales
                </Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, color: colors.accentText, mb: 1 }}>
                {formatCurrency(analytics.onlineSales.total)}
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                {analytics.onlineSales.orderCount} orders from customer site
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ backgroundColor: colors.paper, height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Person sx={{ color: '#FFA500', mr: 1, fontSize: 32 }} />
                <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                  Admin Sales
                </Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, color: '#FFA500', mb: 1 }}>
                {formatCurrency(analytics.adminSales.total)}
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                {analytics.adminSales.totalOrderCount} orders posted by admins
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ backgroundColor: colors.paper, height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AttachMoney sx={{ color: '#00E0B8', mr: 1, fontSize: 32 }} />
                <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                  Admin Cash at Hand
                </Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, color: '#00E0B8', mb: 1 }}>
                {formatCurrency(analytics.adminCashAtHand.calculatedCashAtHand)}
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                Cash received: {formatCurrency(analytics.adminCashAtHand.cashReceived)}
              </Typography>
              <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block', mt: 0.5 }}>
                Remitted: {formatCurrency(analytics.adminCashAtHand.cashRemitted)} | 
                Submitted: {formatCurrency(analytics.adminCashAtHand.cashSubmitted)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Online Sales Table */}
      {analytics.onlineSales.orders.length > 0 && (
        <Card sx={{ mb: 4, backgroundColor: colors.paper }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <ShoppingCart sx={{ color: colors.accentText, mr: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                Online Sales ({analytics.onlineSales.orderCount})
              </Typography>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Order ID</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Amount</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Payment Status</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Payment Method</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analytics.onlineSales.orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell sx={{ color: colors.textPrimary }}>#{order.id}</TableCell>
                      <TableCell sx={{ color: colors.textSecondary }}>
                        {formatDate(order.createdAt)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                        {formatCurrency(order.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={order.paymentStatus}
                          size="small"
                          color={order.paymentStatus === 'paid' ? 'success' : 'warning'}
                        />
                      </TableCell>
                      <TableCell sx={{ color: colors.textSecondary }}>
                        {order.paymentMethod || 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Admin Sales by Admin */}
      {analytics.adminSales.byAdmin.length > 0 && (
        <Card sx={{ backgroundColor: colors.paper }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Person sx={{ color: '#FFA500', mr: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                Sales by Admin ({analytics.adminSales.byAdmin.length} admins)
              </Typography>
            </Box>
            {analytics.adminSales.byAdmin.map((admin) => (
              <Card key={admin.adminId} sx={{ mb: 3, backgroundColor: isDarkMode ? 'rgba(255, 165, 0, 0.1)' : 'rgba(255, 165, 0, 0.05)' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                        {admin.adminName}
                      </Typography>
                      <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                        {admin.orderCount} orders
                      </Typography>
                    </Box>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#FFA500' }}>
                      {formatCurrency(admin.totalSales)}
                    </Typography>
                  </Box>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600, color: colors.accentText }}>Order ID</TableCell>
                          <TableCell sx={{ fontWeight: 600, color: colors.accentText }}>Date</TableCell>
                          <TableCell sx={{ fontWeight: 600, color: colors.accentText }} align="right">Amount</TableCell>
                          <TableCell sx={{ fontWeight: 600, color: colors.accentText }}>Payment Status</TableCell>
                          <TableCell sx={{ fontWeight: 600, color: colors.accentText }}>Payment Method</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {admin.orders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell sx={{ color: colors.textPrimary }}>#{order.id}</TableCell>
                            <TableCell sx={{ color: colors.textSecondary }}>
                              {formatDate(order.createdAt)}
                            </TableCell>
                            <TableCell align="right" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                              {formatCurrency(order.totalAmount)}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={order.paymentStatus}
                                size="small"
                                color={order.paymentStatus === 'paid' ? 'success' : 'warning'}
                              />
                            </TableCell>
                            <TableCell sx={{ color: colors.textSecondary }}>
                              {order.paymentMethod || 'N/A'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty States */}
      {analytics.onlineSales.orders.length === 0 && analytics.adminSales.byAdmin.length === 0 && (
        <Card sx={{ backgroundColor: colors.paper }}>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <ShoppingCart sx={{ fontSize: 64, color: colors.textSecondary, mb: 2 }} />
              <Typography variant="h6" sx={{ color: colors.textPrimary, mb: 1 }}>
                No sales data found
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                No sales recorded for the selected date range.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}
    </Container>
  );
};

export default Sales;
