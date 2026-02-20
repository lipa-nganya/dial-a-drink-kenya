import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Chip,
  Button,
  IconButton,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  ArrowBack,
  Download,
  PictureAsPdf
} from '@mui/icons-material';
import { useTheme } from '../../contexts/ThemeContext';
import { api } from '../../services/api';
import { getOrderStatusChipProps, getPaymentStatusChipProps } from '../../utils/chipStyles';

const SalesDateDetails = () => {
  const { date } = useParams();
  const navigate = useNavigate();
  const { isDarkMode, colors } = useTheme();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOrdersForDate();
    // eslint-disable-next-line react-hooks/exhaustive-deps, no-use-before-define
  }, [date]);

  const fetchOrdersForDate = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/admin/orders');
      const allOrders = response.data || [];
      
      // Filter orders for the specific date
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      const dateOrders = allOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === targetDate.getTime();
      });
      
      // Sort by creation time (newest first)
      dateOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      setOrders(dateOrders);
    } catch (error) {
      console.error('Error fetching orders for date:', error);
      setError('Failed to load orders for this date');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `KES ${Math.round(Number(amount || 0))}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleDownloadReceipt = async (orderId) => {
    try {
      const response = await api.get(`/orders/${orderId}/receipt`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `receipt-order-${orderId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading receipt:', error);
      alert('Failed to download receipt: ' + (error.response?.data?.error || error.message));
    }
  };

  const calculateTotalRevenue = () => {
    if (!orders || orders.length === 0) {
      return 0;
    }

    return orders.reduce((sum, order) => {
      // Calculate revenue for this order
      const orderAmount = parseFloat(order.totalAmount) || 0;
      const tipAmount = parseFloat(order.tipAmount) || 0;
      const revenue = orderAmount - tipAmount;
      
      // Skip orders with no amount
      if (orderAmount <= 0) {
        return sum;
      }
      
      // Check if order is paid - multiple ways to determine this
      const isPaid = order.paymentStatus === 'paid' || 
                    (order.transactions && Array.isArray(order.transactions) && 
                     order.transactions.some(t => 
                       t && t.transactionType === 'payment' && 
                       (t.status === 'completed' || t.paymentStatus === 'paid')
                     ));
      
      // Check if order is completed/delivered (indicates it was fulfilled and likely paid)
      const isCompleted = order.status === 'completed' || order.status === 'delivered';
      
      // Include revenue if:
      // 1. Order is explicitly marked as paid
      // 2. Order is completed/delivered (indicates payment was received)
      // 3. Order is pay_on_delivery (will be paid on delivery)
      // 4. Order is confirmed (likely paid or will be paid)
      // Note: We're more inclusive here to ensure we capture all revenue
      if (isPaid || isCompleted || order.paymentType === 'pay_on_delivery' || 
          order.status === 'confirmed' || order.status === 'out_for_delivery') {
        return sum + revenue;
      }
      return sum;
    }, 0);
  };

  const handleExportCSV = () => {
    if (orders.length === 0) {
      alert('No data to export');
      return;
    }

    // CSV Headers
    const headers = [
      'Order ID',
      'Customer Name',
      'Customer Phone',
      'Customer Email',
      'Total Amount (KES)',
      'Tip Amount (KES)',
      'Revenue (KES)',
      'Order Status',
      'Payment Status',
      'Payment Method',
      'Payment Type',
      'Date',
      'Time',
      'Delivery Address',
      'Driver Name',
      'Driver Phone',
      'Notes'
    ];

    // Convert orders to CSV rows
    const csvRows = orders.map(order => {
      const orderAmount = parseFloat(order.totalAmount) || 0;
      const tipAmount = parseFloat(order.tipAmount) || 0;
      const revenue = orderAmount - tipAmount;
      
      const orderDate = new Date(order.createdAt);
      const dateStr = orderDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const timeStr = orderDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      // Escape commas and quotes in CSV values
      const escapeCSV = (value) => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      return [
        order.id,
        escapeCSV(order.customerName || 'Guest'),
        escapeCSV(order.customerPhone || ''),
        escapeCSV(order.customerEmail || ''),
        Math.round(orderAmount),
        Math.round(tipAmount),
        Math.round(revenue),
        escapeCSV(order.status || ''),
        escapeCSV(order.paymentStatus || ''),
        escapeCSV(order.paymentMethod || ''),
        escapeCSV(order.paymentType || ''),
        dateStr,
        timeStr,
        escapeCSV(order.deliveryAddress || ''),
        escapeCSV(order.driver?.name || ''),
        escapeCSV(order.driver?.phoneNumber || ''),
        escapeCSV(order.notes || '')
      ].join(',');
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...csvRows
    ].join('\n');

    // Add summary row
    const totalRevenue = calculateTotalRevenue();
    const summaryRow = [
      '',
      '',
      '',
      '',
      Math.round(orders.reduce((sum, o) => sum + (parseFloat(o.totalAmount) || 0), 0)),
      Math.round(orders.reduce((sum, o) => sum + (parseFloat(o.tipAmount) || 0), 0)),
      Math.round(totalRevenue),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      `Total: ${orders.length} orders`
    ];
    const finalCSV = csvContent + '\n' + summaryRow.join(',');

    // Create blob and download
    const blob = new Blob([finalCSV], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = `sales-report-${date}.csv`;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton
            onClick={() => navigate('/copilot/reports')}
            sx={{ mr: 2, color: colors.textPrimary }}
          >
            <ArrowBack />
          </IconButton>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary }}>
              Sales Details - {formatDate(date)}
            </Typography>
            <Typography variant="body2" sx={{ color: colors.textSecondary, mt: 0.5 }}>
              {orders.length} {orders.length === 1 ? 'order' : 'orders'} • Total Revenue: {formatCurrency(calculateTotalRevenue())}
            </Typography>
          </Box>
        </Box>
        {orders.length > 0 && (
          <Button
            variant="contained"
            startIcon={<Download />}
            onClick={handleExportCSV}
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#000' : '#fff',
              '&:hover': {
                backgroundColor: colors.accent
              }
            }}
          >
            Export CSV
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {orders.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: colors.paper }}>
          <Typography variant="body1" sx={{ color: colors.textSecondary }}>
            No orders found for this date
          </Typography>
        </Paper>
      ) : (
        <Paper sx={{ backgroundColor: colors.paper }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Order ID</TableCell>
                  <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Customer</TableCell>
                  <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Amount</TableCell>
                  <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Payment</TableCell>
                  <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Time</TableCell>
                  <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map((order) => {
                  const statusProps = getOrderStatusChipProps(order.status);
                  const paymentProps = getPaymentStatusChipProps(order.paymentStatus, order.status);
                  
                  return (
                    <TableRow key={order.id}>
                      <TableCell sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                        #{order.id}
                      </TableCell>
                      <TableCell sx={{ color: colors.textPrimary }}>
                        {order.customerName || 'Guest'}
                      </TableCell>
                      <TableCell sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                        {formatCurrency(order.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={statusProps.label}
                          icon={statusProps.icon}
                          color={statusProps.color}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {paymentProps && (
                          <Chip
                            label={paymentProps.label}
                            icon={paymentProps.icon}
                            color={paymentProps.color}
                            size="small"
                          />
                        )}
                      </TableCell>
                      <TableCell sx={{ color: colors.textSecondary }}>
                        {new Date(order.createdAt).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => navigate(`/orders`)}
                            sx={{
                              borderColor: colors.accentText,
                              color: colors.accentText,
                              '&:hover': {
                                borderColor: colors.accent,
                                backgroundColor: 'rgba(0, 224, 184, 0.1)'
                              }
                            }}
                          >
                            View
                          </Button>
                          {(order.paymentStatus === 'paid' || order.status === 'completed' || order.status === 'delivered') && (
                            <IconButton
                              size="small"
                              onClick={() => handleDownloadReceipt(order.id)}
                              sx={{
                                color: colors.accentText,
                                '&:hover': {
                                  backgroundColor: 'rgba(0, 224, 184, 0.1)'
                                }
                              }}
                            >
                              <PictureAsPdf fontSize="small" />
                            </IconButton>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default SalesDateDetails;

