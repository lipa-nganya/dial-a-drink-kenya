import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Button,
  IconButton,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  ArrowBack,
  LocalShipping,
  AttachMoney,
  Assessment,
  Phone,
  Email,
  Person,
  Download,
  CalendarToday
} from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';
import { getOrderStatusChipProps, getPaymentStatusChipProps } from '../utils/chipStyles';

const RiderDetails = () => {
  const { riderId } = useParams();
  const navigate = useNavigate();
  const { isDarkMode, colors } = useTheme();
  const [rider, setRider] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Date filter state
  const [dateRange, setDateRange] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Export dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchRiderDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riderId]);

  useEffect(() => {
    if (activeTab === 1) {
      fetchOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, dateRange, customStartDate, customEndDate]);

  const getDateRange = (range) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let startDate, endDate;
    
    if (range === 'custom' && customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(customEndDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      switch (range) {
        case 'today':
          startDate = new Date(today);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          break;
        case 'last7days':
          endDate = new Date(today);
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'last30days':
          endDate = new Date(today);
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 30);
          break;
        case 'last90days':
          endDate = new Date(today);
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 90);
          break;
        case 'thisMonth':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now);
          break;
        case 'lastMonth':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0);
          break;
        default:
          return { startDate: null, endDate: null };
      }
    }
    
    return { startDate, endDate };
  };

  const fetchRiderDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const riderResponse = await api.get(`/drivers/${riderId}`);
      const riderData = riderResponse.data;

      setRider(riderData);
    } catch (error) {
      console.error('Error fetching rider details:', error);
      setError('Failed to load rider details');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const { startDate, endDate } = getDateRange(dateRange);
      
      // Build query params
      const params = new URLSearchParams();
      if (startDate && endDate) {
        params.append('startDate', startDate.toISOString());
        params.append('endDate', endDate.toISOString());
      }

      // Fetch orders assigned to this rider
      const ordersResponse = await api.get(`/driver-orders/${riderId}?${params.toString()}`);
      const allOrders = ordersResponse.data?.orders || ordersResponse.data || [];

      setOrders(allOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders;
  }, [orders]);

  const paginatedOrders = useMemo(() => {
    return filteredOrders.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredOrders, page, rowsPerPage]);

  const formatCurrency = (amount) => {
    return `KES ${Number(amount || 0).toFixed(2)}`;
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

  const handleExport = async () => {
    setExporting(true);
    try {
      // Create CSV content
      const headers = ['Order ID', 'Customer Name', 'Customer Phone', 'Amount', 'Status', 'Payment Status', 'Date'];
      const rows = filteredOrders.map(order => [
        order.id,
        order.customerName || 'N/A',
        order.customerPhone || 'N/A',
        order.totalAmount || 0,
        order.status || 'N/A',
        order.paymentStatus || 'N/A',
        formatDate(order.createdAt)
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `rider-${rider?.name || riderId}-orders-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportDialogOpen(false);
    } catch (error) {
      console.error('Error exporting orders:', error);
      alert('Failed to export orders');
    } finally {
      setExporting(false);
    }
  };

  if (loading && !rider) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !rider) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton
            onClick={() => navigate('/drivers')}
            sx={{ mr: 2, color: colors.textPrimary }}
          >
            <ArrowBack />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary }}>
            Rider Details
          </Typography>
        </Box>
        <Alert severity="error">{error || 'Rider not found'}</Alert>
      </Box>
    );
  }

  if (!rider) return null;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton
          onClick={() => navigate('/drivers')}
          sx={{ mr: 2, color: colors.textPrimary }}
        >
          <ArrowBack />
        </IconButton>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary }}>
            {rider.name} - Details
          </Typography>
          <Typography variant="body2" sx={{ color: colors.textSecondary, mt: 0.5 }}>
            {rider.phoneNumber} • {rider.email || 'No email'}
          </Typography>
        </Box>
      </Box>

      <Paper sx={{ backgroundColor: colors.paper, mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{
            borderBottom: `1px solid ${colors.border}`,
            '& .MuiTab-root': {
              color: colors.textSecondary,
              fontWeight: 600,
              '&.Mui-selected': {
                color: colors.accentText
              }
            }
          }}
        >
          <Tab label="Profile" />
          <Tab label="Orders" />
        </Tabs>
      </Paper>

      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={{ backgroundColor: colors.paper }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: colors.accentText }}>
                  Personal Information
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Person sx={{ color: colors.accentText }} />
                    <Typography variant="body1">
                      <strong>Name:</strong> {rider.name}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Phone sx={{ color: colors.accentText }} />
                    <Typography variant="body1">
                      <strong>Phone:</strong> {rider.phoneNumber}
                    </Typography>
                  </Box>
                  {rider.email && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Email sx={{ color: colors.accentText }} />
                      <Typography variant="body1">
                        <strong>Email:</strong> {rider.email}
                      </Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocalShipping sx={{ color: colors.accentText }} />
                    <Typography variant="body1">
                      <strong>Status:</strong> 
                      <Chip
                        label={rider.status || 'offline'}
                        size="small"
                        sx={{
                          ml: 1,
                          backgroundColor: rider.status === 'online' ? colors.accentText : colors.textSecondary,
                          color: isDarkMode ? '#0D0D0D' : '#FFFFFF'
                        }}
                      />
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ backgroundColor: colors.paper }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: colors.accentText }}>
                  Financial Information
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                      Credit Limit
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                      {formatCurrency(rider.creditLimit || 0)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                      Cash at Hand
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                      {formatCurrency(rider.cashAtHand || 0)}
                    </Typography>
                  </Box>
                  {rider.driverPayAmount && (
                    <Box>
                      <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                        Total Earnings
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: colors.accentText }}>
                        {formatCurrency(rider.driverPayAmount)}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 1 && (
        <Box>
          {/* Date Filters and Export */}
          <Paper sx={{ backgroundColor: colors.paper, p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Date Range</InputLabel>
                <Select
                  value={dateRange}
                  label="Date Range"
                  onChange={(e) => {
                    setDateRange(e.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="all">All Time</MenuItem>
                  <MenuItem value="today">Today</MenuItem>
                  <MenuItem value="last7days">Last 7 Days</MenuItem>
                  <MenuItem value="last30days">Last 30 Days</MenuItem>
                  <MenuItem value="last90days">Last 90 Days</MenuItem>
                  <MenuItem value="thisMonth">This Month</MenuItem>
                  <MenuItem value="lastMonth">Last Month</MenuItem>
                  <MenuItem value="custom">Custom Range</MenuItem>
                </Select>
              </FormControl>
              
              {dateRange === 'custom' && (
                <>
                  <TextField
                    size="small"
                    label="Start Date"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => {
                      setCustomStartDate(e.target.value);
                      setPage(0);
                    }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ minWidth: 150 }}
                  />
                  <TextField
                    size="small"
                    label="End Date"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => {
                      setCustomEndDate(e.target.value);
                      setPage(0);
                    }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ minWidth: 150 }}
                  />
                </>
              )}
              
              <Box sx={{ flexGrow: 1 }} />
              
              <Button
                variant="contained"
                startIcon={<Download />}
                onClick={() => setExportDialogOpen(true)}
                sx={{
                  backgroundColor: colors.accentText,
                  color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                  '&:hover': {
                    backgroundColor: '#00C4A3'
                  }
                }}
              >
                Export
              </Button>
            </Box>
          </Paper>

          {/* Orders Table */}
          <Paper sx={{ backgroundColor: colors.paper }}>
            <Box sx={{ p: 2, borderBottom: `1px solid ${colors.border}` }}>
              <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                Orders ({filteredOrders.length})
              </Typography>
            </Box>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Order ID</TableCell>
                        <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Customer</TableCell>
                        <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Amount</TableCell>
                        <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Status</TableCell>
                        <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Payment</TableCell>
                        <TableCell sx={{ color: colors.accentText, fontWeight: 600 }}>Date</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: colors.textSecondary }}>
                            No orders found
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedOrders.map((order) => {
                          const statusProps = getOrderStatusChipProps(order.status);
                          const paymentProps = getPaymentStatusChipProps(order.paymentStatus, order.status);

                          return (
                            <TableRow key={order.id} hover>
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
                                {formatDate(order.createdAt)}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  component="div"
                  count={filteredOrders.length}
                  page={page}
                  onPageChange={(event, newPage) => setPage(newPage)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(event) => {
                    setRowsPerPage(parseInt(event.target.value, 10));
                    setPage(0);
                  }}
                  rowsPerPageOptions={[10, 25, 50, 100]}
                  sx={{
                    borderTop: `1px solid ${colors.border}`,
                    '& .MuiTablePagination-toolbar': {
                      color: colors.textPrimary
                    }
                  }}
                />
              </>
            )}
          </Paper>
        </Box>
      )}

      {/* Export Confirmation Dialog */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)}>
        <DialogTitle>Export Orders</DialogTitle>
        <DialogContent>
          <Typography>
            Export {filteredOrders.length} order(s) to CSV?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleExport}
            variant="contained"
            disabled={exporting}
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF'
            }}
          >
            {exporting ? 'Exporting...' : 'Export'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RiderDetails;
