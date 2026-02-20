import React, { useState, useEffect, useMemo } from 'react';
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
  CircularProgress,
  Alert,
  TablePagination,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Collapse,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Download,
  Store
} from '@mui/icons-material';
import { useTheme } from '../../contexts/ThemeContext';
import { api } from '../../services/api';

const Analysis = () => {
  const { isDarkMode, colors } = useTheme();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [dateRange, setDateRange] = useState('last30days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showPOSOnly, setShowPOSOnly] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/admin/orders');
      const ordersData = response.data || [];
      
      // Debug: Check if purchasePrice is included in drink data
      if (ordersData.length > 0) {
        const sampleOrder = ordersData.find(o => (o.items && o.items.length > 0) || (o.orderItems && o.orderItems.length > 0));
        if (sampleOrder) {
          const items = sampleOrder.items || sampleOrder.orderItems || [];
          if (items.length > 0 && items[0].drink) {
            const sampleDrink = items[0].drink;
            console.log('🔍 Sample drink data from API:', {
              orderId: sampleOrder.id,
              drinkId: sampleDrink.id,
              drinkName: sampleDrink.name,
              hasPurchasePriceField: 'purchasePrice' in sampleDrink,
              purchasePrice: sampleDrink.purchasePrice,
              purchasePriceType: typeof sampleDrink.purchasePrice,
              allKeys: Object.keys(sampleDrink)
            });
          } else {
            console.warn('⚠️ Sample order has no items:', sampleOrder.id, 'Keys:', Object.keys(sampleOrder));
          }
        }
      }
      
      setOrders(ordersData);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = (range) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let startDate, endDate;
    
    // Handle custom date range
    if (range === 'custom' && customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(customEndDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      switch (range) {
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
          endDate = new Date(today);
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 30);
      }
    }
    
    return { startDate, endDate };
  };

  // Filter and process orders
  const filteredOrders = useMemo(() => {
    const { startDate, endDate } = getDateRange(dateRange);
    
    return orders
      .filter(order => {
        // Only include completed orders, exclude cancelled
        if (order.status === 'cancelled') {
          return false;
        }
        if (order.status !== 'completed') {
          return false;
        }
        
        // Filter by date range
        const orderDate = new Date(order.createdAt);
        if (orderDate < startDate || orderDate > endDate) {
          return false;
        }
        
        // Filter by POS if enabled
        if (showPOSOnly) {
          const isPOS = order.adminOrder === true || 
                       order.status === 'pos_order' ||
                       (order.deliveryAddress && order.deliveryAddress.includes('In-Store Purchase'));
          return isPOS;
        }
        
        return true;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, dateRange, customStartDate, customEndDate, showPOSOnly, getDateRange]);

  // Check if order is POS
  const isPOSOrder = (order) => {
    return order.adminOrder === true || 
           order.status === 'pos_order' ||
           (order.deliveryAddress && order.deliveryAddress.includes('In-Store Purchase'));
  };

  // Calculate profit/loss for an order
  const calculateProfitLoss = (order) => {
    let totalSellingPrice = parseFloat(order.totalAmount) || 0;
    let totalPurchasePrice = 0;
    const deliveryFee = parseFloat(order.deliveryFee) || 0;
    let itemsWithPurchasePrice = 0;
    let itemsWithoutPurchasePrice = 0;

    // Use items or orderItems (backend maps both for compatibility)
    const orderItems = order.items || order.orderItems || [];
    
    // Calculate total purchase price from order items
    if (Array.isArray(orderItems) && orderItems.length > 0) {
      orderItems.forEach(item => {
        if (item.drink) {
          // purchasePrice comes as string from API (e.g., "1.43")
          const purchasePriceRaw = item.drink.purchasePrice;
          
          // Parse purchasePrice - handle null, undefined, empty string, or valid number
          let purchasePrice = null;
          if (purchasePriceRaw !== null && purchasePriceRaw !== undefined) {
            const strValue = String(purchasePriceRaw).trim();
            if (strValue !== '' && strValue !== 'null' && strValue !== 'undefined') {
              const parsed = parseFloat(strValue);
              if (!isNaN(parsed) && isFinite(parsed)) {
                purchasePrice = parsed;
              }
            }
          }
          
          const quantity = parseInt(item.quantity) || 0;
          
          // If purchasePrice is a valid number (including 0), use it
          if (purchasePrice !== null && purchasePrice >= 0) {
            const itemPurchaseTotal = purchasePrice * quantity;
            totalPurchasePrice += itemPurchaseTotal;
            itemsWithPurchasePrice++;
            
            // Debug logging for 1659 Sauvignon Blanc
            if (item.drink.name && item.drink.name.includes('1659 Sauvignon Blanc')) {
              console.log(`🔍 1659 Sauvignon Blanc Purchase Price Calculation:`, {
                orderId: order.id,
                drinkName: item.drink.name,
                drinkId: item.drink.id,
                purchasePriceRaw,
                purchasePriceParsed: purchasePrice,
                quantity,
                itemPurchaseTotal,
                runningTotal: totalPurchasePrice
              });
            }
          } else {
            itemsWithoutPurchasePrice++;
            // Log missing purchase price for debugging
            console.warn(`⚠️ Order #${order.id}: Item "${item.drink.name || 'Unknown'}" (ID: ${item.drink.id || 'N/A'}) missing purchasePrice.`, {
              purchasePriceRaw,
              purchasePriceRawType: typeof purchasePriceRaw,
              purchasePrice,
              hasPurchasePriceField: 'purchasePrice' in item.drink,
              drinkKeys: item.drink ? Object.keys(item.drink) : 'N/A'
            });
          }
        } else {
          itemsWithoutPurchasePrice++;
          console.warn(`⚠️ Order #${order.id}: Item missing drink data. Item keys:`, Object.keys(item));
        }
      });
    } else {
      // Log if order has no items
      console.warn(`Order #${order.id}: No items array found or empty. Has items:`, !!order.items, 'Has orderItems:', !!order.orderItems, 'Order keys:', Object.keys(order));
      itemsWithoutPurchasePrice = 1; // Mark as missing data
    }

    // Profit/Loss = Total Selling Price - Total Purchase Price - Delivery Fee
    const profitLoss = totalSellingPrice - totalPurchasePrice - deliveryFee;
    
    // Debug logging for orders with 1659 Sauvignon Blanc
    const has1659 = orderItems.some(item => item.drink && item.drink.name && item.drink.name.includes('1659 Sauvignon Blanc'));
    if (has1659) {
      console.log(`🔍 Order #${order.id} Final Calculation:`, {
        totalSellingPrice,
        totalPurchasePrice,
        deliveryFee,
        profitLoss,
        itemsWithPurchasePrice,
        itemsWithoutPurchasePrice,
        orderItems: orderItems.map(item => ({
          drinkName: item.drink?.name,
          quantity: item.quantity,
          purchasePrice: item.drink?.purchasePrice
        }))
      });
    }
    
    return {
      profitLoss,
      totalSellingPrice,
      totalPurchasePrice,
      deliveryFee,
      isProfit: profitLoss >= 0,
      itemsWithPurchasePrice,
      itemsWithoutPurchasePrice,
      hasPurchasePriceData: itemsWithPurchasePrice > 0
    };
  };

  const formatCurrency = (amount) => {
    return `KES ${Math.round(parseFloat(amount || 0))}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-KE', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Calculate totals
  const totals = filteredOrders.reduce((acc, order) => {
    const calc = calculateProfitLoss(order);
    return {
      totalSellingPrice: acc.totalSellingPrice + calc.totalSellingPrice,
      totalPurchasePrice: acc.totalPurchasePrice + calc.totalPurchasePrice,
      totalDeliveryFee: acc.totalDeliveryFee + calc.deliveryFee,
      totalProfitLoss: acc.totalProfitLoss + calc.profitLoss
    };
  }, { totalSellingPrice: 0, totalPurchasePrice: 0, totalDeliveryFee: 0, totalProfitLoss: 0 });

  // Pagination
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const paginatedOrders = filteredOrders.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      alert('No orders to export');
      return;
    }

    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const headers = [
      'Order ID',
      'Date',
      'Customer Name',
      'Selling Price',
      'Purchase Price',
      'Delivery Fee',
      'Profit/Loss',
      'Status',
      'POS Order'
    ];

    const csvRows = filteredOrders.map(order => {
      const calc = calculateProfitLoss(order);
      const orderDate = new Date(order.createdAt);
      const dateStr = orderDate.toLocaleDateString('en-KE');
      const timeStr = orderDate.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
      
      return [
        order.id,
        `${dateStr} ${timeStr}`,
        escapeCSV(order.customerName || 'N/A'),
        Math.round(calc.totalSellingPrice),
        Math.round(calc.totalPurchasePrice),
        Math.round(calc.deliveryFee),
        Math.round(calc.profitLoss),
        escapeCSV(order.status || 'N/A'),
        isPOSOrder(order) ? 'Yes' : 'No'
      ].join(',');
    });

    // Add summary row
    const summaryRow = [
      '',
      'TOTALS',
      '',
      Math.round(totals.totalSellingPrice),
      Math.round(totals.totalPurchasePrice),
      Math.round(totals.totalDeliveryFee),
      Math.round(totals.totalProfitLoss),
      '',
      `Total: ${filteredOrders.length} orders`
    ];

    const csvContent = [
      headers.join(','),
      ...csvRows,
      summaryRow.join(',')
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const { startDate, endDate } = getDateRange(dateRange);
    const fileName = `pnl-analysis-${startDate.toISOString().split('T')[0]}-to-${endDate.toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary, mb: 1 }}>
          P&L Analysis
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary }}>
          Profit and Loss analysis for individual orders (Completed orders only)
        </Typography>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3, backgroundColor: colors.paper }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel sx={{ color: colors.textSecondary }}>Date Range</InputLabel>
            <Select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value);
                setPage(0);
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
                  setPage(0);
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
                  setPage(0);
                }}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 150 }}
              />
            </Box>
          </Collapse>

          <FormControlLabel
            control={
              <Switch
                checked={showPOSOnly}
                onChange={(e) => {
                  setShowPOSOnly(e.target.checked);
                  setPage(0);
                }}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: colors.accentText,
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: colors.accentText,
                  },
                }}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Store sx={{ fontSize: 18 }} />
                <Typography variant="body2" sx={{ color: colors.textPrimary }}>
                  POS Orders Only
                </Typography>
              </Box>
            }
          />

          <Button
            variant="contained"
            startIcon={<Download />}
            onClick={handleExportCSV}
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

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress sx={{ color: colors.accentText }} />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : (
        <>
          {/* Summary Cards */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
            <Paper sx={{ p: 2, backgroundColor: colors.paper }}>
              <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>
                Total Selling Price
              </Typography>
              <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                {formatCurrency(totals.totalSellingPrice)}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, backgroundColor: colors.paper }}>
              <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>
                Total Purchase Price
              </Typography>
              <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                {formatCurrency(totals.totalPurchasePrice)}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, backgroundColor: colors.paper }}>
              <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>
                Total Delivery Fee
              </Typography>
              <Typography variant="h6" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                {formatCurrency(totals.totalDeliveryFee)}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, backgroundColor: colors.paper }}>
              <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>
                Net Profit/Loss
              </Typography>
              <Typography 
                variant="h6" 
                sx={{ 
                  color: totals.totalProfitLoss >= 0 ? '#4CAF50' : '#F44336', 
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5
                }}
              >
                {totals.totalProfitLoss >= 0 ? (
                  <TrendingUp sx={{ fontSize: 20 }} />
                ) : (
                  <TrendingDown sx={{ fontSize: 20 }} />
                )}
                {formatCurrency(totals.totalProfitLoss)}
              </Typography>
            </Paper>
          </Box>

          {/* Orders Table */}
          <Paper sx={{ backgroundColor: colors.paper }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Order ID</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Customer</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Selling Price</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Purchase Price</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Delivery Fee</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Profit/Loss</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                          {showPOSOnly ? 'No POS orders found' : 'No completed orders found'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedOrders.map((order) => {
                      const calc = calculateProfitLoss(order);
                      const posOrder = isPOSOrder(order);
                      return (
                        <TableRow 
                          key={order.id} 
                          hover
                          sx={{
                            backgroundColor: posOrder ? 'rgba(255, 193, 7, 0.1)' : 'transparent',
                            '&:hover': {
                              backgroundColor: posOrder ? 'rgba(255, 193, 7, 0.2)' : undefined
                            }
                          }}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              #{order.id}
                              {posOrder && (
                                <Chip
                                  icon={<Store />}
                                  label="POS"
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.7rem',
                                    backgroundColor: '#FFC107',
                                    color: '#000',
                                    fontWeight: 600
                                  }}
                                />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>{formatDate(order.createdAt)}</TableCell>
                          <TableCell>{order.customerName || 'N/A'}</TableCell>
                          <TableCell>{formatCurrency(calc.totalSellingPrice)}</TableCell>
                          <TableCell>
                            {calc.hasPurchasePriceData || calc.totalPurchasePrice === 0 ? (
                              formatCurrency(calc.totalPurchasePrice)
                            ) : (
                              <Typography variant="body2" sx={{ color: colors.textSecondary, fontStyle: 'italic' }}>
                                {calc.itemsWithoutPurchasePrice > 0 
                                  ? `No purchase price data (${calc.itemsWithoutPurchasePrice} items)`
                                  : 'No items'}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>{formatCurrency(calc.deliveryFee)}</TableCell>
                          <TableCell>
                            <Chip
                              label={calc.isProfit ? `Profit: ${formatCurrency(calc.profitLoss)}` : `Loss: ${formatCurrency(Math.abs(calc.profitLoss))}`}
                              color={calc.isProfit ? 'success' : 'error'}
                              size="small"
                              icon={calc.isProfit ? <TrendingUp /> : <TrendingDown />}
                              sx={{
                                fontWeight: 600,
                                '& .MuiChip-icon': {
                                  color: 'inherit'
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={order.status || 'N/A'}
                              size="small"
                              sx={{
                                backgroundColor: order.status === 'completed' ? '#4CAF50' : 
                                                order.status === 'delivered' ? '#2196F3' :
                                                '#FF9800',
                                color: '#fff',
                                fontWeight: 500
                              }}
                            />
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
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[10, 25, 50, 100]}
              sx={{
                color: colors.textPrimary,
                '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                  color: colors.textPrimary
                }
              }}
            />
          </Paper>
        </>
      )}
    </Box>
  );
};

export default Analysis;
