import React, { useState, useEffect, useMemo } from 'react';
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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Collapse,
  Grid,
  Card,
  CardContent
} from '@mui/material';
import {
  LocalShipping,
  ShoppingCart,
  Download,
} from '@mui/icons-material';
import { api } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';

const CashSubmissions = () => {
  const { isDarkMode, colors } = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Date filter state
  const [dateRange, setDateRange] = useState('last30days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Riders data
  const [riders, setRiders] = useState([]);
  const [riderPage, setRiderPage] = useState(0);
  const [riderRowsPerPage, setRiderRowsPerPage] = useState(25);
  
  // Orders data
  const [orders, setOrders] = useState([]);
  const [cashSubmissions, setCashSubmissions] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [selectedAdminId, setSelectedAdminId] = useState('all');
  const [orderPage, setOrderPage] = useState(0);
  const [orderRowsPerPage, setOrderRowsPerPage] = useState(25);

  useEffect(() => {
    if (activeTab === 0) {
      fetchRiders();
    } else if (activeTab === 1) {
      fetchOrdersAndSubmissions();
    }
  }, [activeTab, dateRange, customStartDate, customEndDate]);

  useEffect(() => {
    if (activeTab === 1) {
      fetchAdmins();
    }
  }, [activeTab]);

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
          endDate = now;
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
          endDate = new Date(today);
          break;
        case 'thisYear':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(today);
          break;
        default:
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 30);
          endDate = new Date(today);
      }
    }

    return { startDate, endDate };
  };

  const fetchRiders = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/drivers');
      setRiders(response.data || []);
    } catch (err) {
      console.error('Error fetching riders:', err);
      setError('Failed to load riders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrdersAndSubmissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const { startDate, endDate } = getDateRange(dateRange);
      
      let ordersResponse, submissionsResponse;
      
      try {
        ordersResponse = await api.get('/admin/orders');
      } catch (err) {
        console.error('❌ Error fetching orders:', err);
        throw new Error('Failed to fetch orders: ' + (err.response?.data?.error || err.message));
      }
      
      try {
        submissionsResponse = await api.get('/driver-wallet/admin/cash-submissions/all');
      } catch (err) {
        console.error('❌ Error fetching cash submissions:', err);
        console.error('❌ Response:', err.response?.data);
        console.error('❌ Status:', err.response?.status);
        // If submissions fail, continue with empty array
        submissionsResponse = { data: { success: true, data: { submissions: [], total: 0 } } };
      }
      
      console.log('📊 Orders response:', ordersResponse.data?.length || 0, 'orders');
      console.log('📊 Submissions response structure:', {
        hasData: !!submissionsResponse.data,
        hasSuccess: !!submissionsResponse.data?.success,
        hasDataData: !!submissionsResponse.data?.data,
        dataType: typeof submissionsResponse.data?.data,
        isArray: Array.isArray(submissionsResponse.data?.data)
      });
      
      const allOrdersData = ordersResponse.data || [];
      
      // Handle different response structures for cash submissions
      // sendSuccess wraps response as: { success: true, data: { submissions: [...], total: ... } }
      let allSubmissions = [];
      try {
        if (submissionsResponse.data) {
          if (submissionsResponse.data.success && submissionsResponse.data.data) {
            // Check if data has submissions property or is an array
            if (submissionsResponse.data.data.submissions) {
              allSubmissions = submissionsResponse.data.data.submissions;
            } else if (Array.isArray(submissionsResponse.data.data)) {
              allSubmissions = submissionsResponse.data.data;
            } else {
              allSubmissions = [];
            }
          } else if (submissionsResponse.data.submissions) {
            allSubmissions = submissionsResponse.data.submissions;
          } else if (Array.isArray(submissionsResponse.data)) {
            allSubmissions = submissionsResponse.data;
          } else {
            allSubmissions = [];
          }
        }
      } catch (parseError) {
        console.error('❌ Error parsing submissions response:', parseError);
        allSubmissions = [];
      }
      
      console.log('📊 Processed submissions:', allSubmissions.length);
      
      // Filter to POS orders only: deliveryAddress === 'In-Store Purchase' or adminOrder === true or status === 'pos_order'
      const posOrders = allOrdersData.filter(order => {
        const isPOS = order.deliveryAddress === 'In-Store Purchase' || 
                      order.adminOrder === true || 
                      order.status === 'pos_order';
        return isPOS;
      });
      
      console.log('📊 POS orders found:', posOrders.length);
      
      // Filter POS orders by date range
      const filteredOrders = posOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= startDate && orderDate <= endDate;
      });
      
      console.log('📊 Filtered POS orders:', filteredOrders.length);
      
      setAllOrders(allOrdersData);
      setOrders(filteredOrders);
      setCashSubmissions(allSubmissions);
    } catch (err) {
      console.error('❌ Error fetching orders and submissions:', err);
      console.error('❌ Error details:', err.response?.data);
      console.error('❌ Error status:', err.response?.status);
      setError(err.response?.data?.error || err.message || 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const response = await api.get('/admin/users');
      setAdmins(response.data || []);
    } catch (err) {
      console.error('Error fetching admins:', err);
    }
  };

  // Map POS orders to admins who serviced them
  // Try to find admin from cash submissions that include the order
  const posOrdersWithAdmin = useMemo(() => {
    if (activeTab !== 1) return [];
    
    getDateRange(dateRange); // startDate, endDate unused
    
    // Create a map of orderId -> admin from cash submissions
    const orderToAdminMap = new Map();
    
    // Check all cash submissions (pending, approved, rejected) to find admin-order associations
    cashSubmissions.forEach(submission => {
      if (submission.adminId && submission.orders && Array.isArray(submission.orders)) {
        const adminName = submission.admin?.name || submission.admin?.username || 'Unknown';
        submission.orders.forEach(order => {
          if (!orderToAdminMap.has(order.id)) {
            orderToAdminMap.set(order.id, {
              adminId: submission.adminId,
              adminName: adminName
            });
          }
        });
      }
    });
    
    // Process POS orders and assign admin if found
    return orders.map(order => {
      const adminInfo = orderToAdminMap.get(order.id);
      return {
        ...order,
        servicedByAdmin: adminInfo ? adminInfo.adminName : 'N/A',
        servicedByAdminId: adminInfo ? adminInfo.adminId : null
      };
    });
  }, [orders, cashSubmissions, dateRange, customStartDate, customEndDate, activeTab]);

  // Group POS orders by admin
  const posOrdersByAdmin = useMemo(() => {
    if (activeTab !== 1) return {};
    
    const grouped = {};
    
    posOrdersWithAdmin.forEach(order => {
      const adminKey = order.servicedByAdminId || 'unknown';
      const adminName = order.servicedByAdmin || 'N/A';
      
      if (!grouped[adminKey]) {
        grouped[adminKey] = {
          adminId: adminKey === 'unknown' ? null : adminKey,
          adminName: adminName,
          totalAmount: 0,
          orders: []
        };
      }
      
      grouped[adminKey].orders.push(order);
      grouped[adminKey].totalAmount += parseFloat(order.totalAmount || 0);
    });
    
    return grouped;
  }, [posOrdersWithAdmin, activeTab]);

  const formatCurrency = (amount) => {
    return `KES ${parseFloat(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-KE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleExportRiders = () => {
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const headers = ['Rider Name', 'Phone Number', 'Cash at Hand (KES)'];
    const csvRows = riders.map(rider => [
      escapeCSV(rider.name),
      escapeCSV(rider.phoneNumber),
      escapeCSV(parseFloat(rider.cashAtHand || 0).toFixed(2))
    ].join(','));

    const totalCash = riders.reduce((sum, rider) => sum + parseFloat(rider.cashAtHand || 0), 0);
    const summaryRow = ['TOTALS', '', escapeCSV(totalCash.toFixed(2))];

    const csvContent = [
      headers.join(','),
      ...csvRows,
      summaryRow.join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const { startDate, endDate } = getDateRange(dateRange);
    const fileName = `cash-submissions-riders-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleExportOrders = () => {
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const headers = ['Admin Name', 'Order ID', 'Customer Name', 'Order Date', 'Total Amount (KES)', 'Status'];
    const csvRows = filteredOrdersForTable.map(order => [
      escapeCSV(order.servicedByAdmin),
      escapeCSV(order.id),
      escapeCSV(order.customerName),
      escapeCSV(formatDate(order.createdAt)),
      escapeCSV(parseFloat(order.totalAmount || 0).toFixed(2)),
      escapeCSV(order.status)
    ].join(','));

    const totalAmount = filteredOrdersForTable.reduce((sum, order) => sum + parseFloat(order.totalAmount || 0), 0);
    const summaryRow = ['TOTALS', '', '', '', escapeCSV(totalAmount.toFixed(2)), ''];

    const csvContent = [
      headers.join(','),
      ...csvRows,
      summaryRow.join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const { startDate, endDate } = getDateRange(dateRange);
    const fileName = `cash-submissions-pos-orders-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const filteredRiders = riders.slice(riderPage * riderRowsPerPage, riderPage * riderRowsPerPage + riderRowsPerPage);
  
  // Filter POS orders by selected admin
  const filteredOrdersForTable = useMemo(() => {
    if (selectedAdminId === 'all') {
      return posOrdersWithAdmin;
    }
    return posOrdersWithAdmin.filter(order => order.servicedByAdminId === selectedAdminId);
  }, [posOrdersWithAdmin, selectedAdminId]);

  const paginatedOrders = filteredOrdersForTable.slice(orderPage * orderRowsPerPage, orderPage * orderRowsPerPage + orderRowsPerPage);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary, mb: 1 }}>
          Cash Submissions
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary }}>
          Track rider cash at hand and POS orders serviced by admin
        </Typography>
      </Box>

      {/* Date Filters */}
      <Paper sx={{ p: 2, mb: 3, backgroundColor: colors.paper }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel sx={{ color: colors.textSecondary }}>Date Range</InputLabel>
            <Select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value);
                setRiderPage(0);
                setOrderPage(0);
              }}
              label="Date Range"
              sx={{
                color: colors.textPrimary,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: colors.border,
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: colors.accentText,
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: colors.accentText,
                },
                '& .MuiSvgIcon-root': {
                  color: colors.accentText,
                }
              }}
            >
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="last7days">Last 7 Days</MenuItem>
              <MenuItem value="last30days">Last 30 Days</MenuItem>
              <MenuItem value="last90days">Last 90 Days</MenuItem>
              <MenuItem value="thisMonth">This Month</MenuItem>
              <MenuItem value="thisYear">This Year</MenuItem>
              <MenuItem value="custom">Custom Range</MenuItem>
            </Select>
          </FormControl>

          <Collapse
            in={dateRange === 'custom'}
            orientation="horizontal"
            sx={{
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              '& .MuiCollapse-wrapper': {
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
              }
            }}
          >
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                type="date"
                label="From"
                size="small"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setRiderPage(0);
                  setOrderPage(0);
                }}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 150 }}
              />
              <TextField
                type="date"
                label="To"
                size="small"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setRiderPage(0);
                  setOrderPage(0);
                }}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 150 }}
              />
            </Box>
          </Collapse>

          <Box sx={{ flexGrow: 1 }} />

          <Button
            variant="contained"
            startIcon={<Download />}
            onClick={activeTab === 0 ? handleExportRiders : handleExportOrders}
            disabled={loading || (activeTab === 0 ? riders.length === 0 : filteredOrdersForTable.length === 0)}
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              '&:hover': {
                backgroundColor: '#00C4A3'
              }
            }}
          >
            Export CSV
          </Button>
        </Box>
      </Paper>

      {/* Sub Tabs */}
      <Paper sx={{ mb: 3, backgroundColor: colors.paper }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => {
            setActiveTab(newValue);
            setRiderPage(0);
            setOrderPage(0);
          }}
          sx={{
            borderBottom: `1px solid ${colors.border}`,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: '0.9rem',
              fontWeight: 500,
              minHeight: 56,
              color: colors.textSecondary,
              '&.Mui-selected': {
                color: colors.accentText,
                fontWeight: 600
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: colors.accentText,
              height: 3
            }
          }}
        >
          <Tab icon={<LocalShipping />} iconPosition="start" label="Riders" />
          <Tab icon={<ShoppingCart />} iconPosition="start" label="Orders" />
        </Tabs>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Riders Tab */}
      {activeTab === 0 && (
        <Paper sx={{ backgroundColor: colors.paper }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Rider Name</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Phone Number</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Cash at Hand</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredRiders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                            No riders found.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRiders.map((rider) => (
                        <TableRow key={rider.id} hover>
                          <TableCell>{rider.name}</TableCell>
                          <TableCell>{rider.phoneNumber}</TableCell>
                          <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                            {formatCurrency(rider.cashAtHand)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={riders.length}
                rowsPerPage={riderRowsPerPage}
                page={riderPage}
                onPageChange={(event, newPage) => setRiderPage(newPage)}
                onRowsPerPageChange={(event) => {
                  setRiderRowsPerPage(parseInt(event.target.value, 10));
                  setRiderPage(0);
                }}
                sx={{
                  color: colors.textPrimary,
                  '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                    color: colors.textPrimary
                  }
                }}
              />
            </>
          )}
        </Paper>
      )}

      {/* Orders Tab */}
      {activeTab === 1 && (
        <Box>
          {/* Admin Filter */}
          <Paper sx={{ p: 2, mb: 3, backgroundColor: colors.paper }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel sx={{ color: colors.textSecondary }}>Filter by Admin</InputLabel>
                <Select
                  value={selectedAdminId}
                  onChange={(e) => {
                    setSelectedAdminId(e.target.value);
                    setOrderPage(0);
                  }}
                  label="Filter by Admin"
                  sx={{
                    color: colors.textPrimary,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: colors.border,
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: colors.accentText,
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: colors.accentText,
                    },
                    '& .MuiSvgIcon-root': {
                      color: colors.accentText,
                    }
                  }}
                >
                  <MenuItem value="all">All Admins</MenuItem>
                  {admins.map((admin) => (
                    <MenuItem key={admin.id} value={admin.id}>
                      {admin.name || admin.username}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {selectedAdminId !== 'all' && posOrdersByAdmin[selectedAdminId] && (
                <Card sx={{ backgroundColor: colors.accentText + '15', flex: 1, minWidth: 200 }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                      Total POS Orders Amount
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: colors.accentText }}>
                      {formatCurrency(posOrdersByAdmin[selectedAdminId].totalAmount)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                      {posOrdersByAdmin[selectedAdminId].orders.length} order(s)
                    </Typography>
                  </CardContent>
                </Card>
              )}

              {selectedAdminId === 'all' && (
                <Grid container spacing={2} sx={{ flex: 1 }}>
                  {Object.values(posOrdersByAdmin).map((adminData) => (
                    <Grid item xs={12} sm={6} md={4} key={adminData.adminId || 'unknown'}>
                      <Card sx={{ backgroundColor: colors.accentText + '15' }}>
                        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                            {adminData.adminName}
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: colors.accentText }}>
                            {formatCurrency(adminData.totalAmount)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                            {adminData.orders.length} order(s)
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          </Paper>

          {/* Orders Table */}
          <Paper sx={{ backgroundColor: colors.paper }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Admin</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Order ID</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Customer Name</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Order Date</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Total Amount</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                            <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                              No orders found for the selected criteria.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedOrders.map((order) => (
                          <TableRow key={order.id} hover>
                            <TableCell>{order.servicedByAdmin || 'N/A'}</TableCell>
                            <TableCell>#{order.id}</TableCell>
                            <TableCell>{order.customerName}</TableCell>
                            <TableCell>{formatDate(order.createdAt)}</TableCell>
                            <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                              {formatCurrency(order.totalAmount)}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={order.status}
                                size="small"
                                sx={{
                                  backgroundColor: order.status === 'completed' || order.status === 'pos_order' ? colors.accentText + '20' : colors.border,
                                  color: order.status === 'completed' || order.status === 'pos_order' ? colors.accentText : colors.textPrimary
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  rowsPerPageOptions={[10, 25, 50, 100]}
                  component="div"
                  count={filteredOrdersForTable.length}
                  rowsPerPage={orderRowsPerPage}
                  page={orderPage}
                  onPageChange={(event, newPage) => setOrderPage(newPage)}
                  onRowsPerPageChange={(event) => {
                    setOrderRowsPerPage(parseInt(event.target.value, 10));
                    setOrderPage(0);
                  }}
                  sx={{
                    color: colors.textPrimary,
                    '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                      color: colors.textPrimary
                    }
                  }}
                />
              </>
            )}
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default CashSubmissions;
