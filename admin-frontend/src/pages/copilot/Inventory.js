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
  CircularProgress,
  Alert,
  Chip,
  TextField,
  IconButton,
  TablePagination,
  Snackbar
} from '@mui/material';
import {
  Warning,
  TrendingDown,
  AttachMoney,
  CheckCircle,
  TrendingUp,
  Edit,
  Save,
  Cancel
} from '@mui/icons-material';
import { api } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';

const Inventory = () => {
  const { isDarkMode, colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [zeroPurchasePriceItems, setZeroPurchasePriceItems] = useState([]);
  const [loadingZeroPrice, setLoadingZeroPrice] = useState(true);
  
  // Pagination states
  const [outOfStockPage, setOutOfStockPage] = useState(0);
  const [outOfStockRowsPerPage, setOutOfStockRowsPerPage] = useState(10);
  // TODO: These will be used for slow moving items pagination in future
  // const [slowMovingPage, setSlowMovingPage] = useState(0);
  // const [slowMovingRowsPerPage, setSlowMovingRowsPerPage] = useState(10);
  const [zeroPricePage, setZeroPricePage] = useState(0);
  const [zeroPriceRowsPerPage, setZeroPriceRowsPerPage] = useState(10);
  
  // Editing states
  const [editingItem, setEditingItem] = useState(null);
  const [editPurchasePrice, setEditPurchasePrice] = useState('');
  const [editSellingPrice, setEditSellingPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchAnalytics();
    fetchZeroPurchasePriceItems();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/admin/inventory-analytics');
      if (response.data.success) {
        setAnalytics(response.data);
      } else {
        setError(response.data.error || 'Failed to fetch inventory analytics');
      }
    } catch (err) {
      console.error('Error fetching inventory analytics:', err);
      setError(err.response?.data?.error || err.message || 'Failed to fetch inventory analytics');
    } finally {
      setLoading(false);
    }
  };

  const fetchZeroPurchasePriceItems = async () => {
    try {
      setLoadingZeroPrice(true);
      const response = await api.get('/admin/drinks');
      const drinks = response.data || [];
      
      // Filter items where purchasePrice is 0, null, or undefined
      const zeroPriceItems = drinks.filter(drink => {
        const purchasePrice = drink.purchasePrice;
        return purchasePrice === null || 
               purchasePrice === undefined || 
               purchasePrice === '' ||
               parseFloat(purchasePrice) === 0;
      });
      
      setZeroPurchasePriceItems(zeroPriceItems);
    } catch (err) {
      console.error('Error fetching zero purchase price items:', err);
    } finally {
      setLoadingZeroPrice(false);
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

  const handleEditClick = (item) => {
    setEditingItem(item.id);
    setEditPurchasePrice(item.purchasePrice || item.purchasePrice === 0 ? String(item.purchasePrice) : '');
    setEditSellingPrice(item.price || item.originalPrice ? String(item.price || item.originalPrice) : '');
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditPurchasePrice('');
    setEditSellingPrice('');
  };

  const handleSave = async (item) => {
    try {
      setSaving(true);
      
      // Get categoryId - could be from item.categoryId or item.category.id
      const categoryId = item.categoryId || item.category?.id;
      if (!categoryId) {
        setSnackbar({ 
          open: true, 
          message: 'Cannot update: Category ID is missing', 
          severity: 'error' 
        });
        setSaving(false);
        return;
      }
      
      const updates = {
        name: item.name || '', // Required by backend
        categoryId: categoryId // Required by backend
      };
      
      // Only update purchase price if it was changed
      if (editPurchasePrice !== '' && editPurchasePrice !== null && editPurchasePrice !== undefined) {
        const parsedPurchasePrice = parseFloat(editPurchasePrice);
        if (!isNaN(parsedPurchasePrice) && parsedPurchasePrice >= 0) {
          updates.purchasePrice = parsedPurchasePrice;
        }
      }
      
      // Only update selling price if it was changed
      if (editSellingPrice !== '' && editSellingPrice !== null && editSellingPrice !== undefined) {
        const parsedSellingPrice = parseFloat(editSellingPrice);
        if (!isNaN(parsedSellingPrice) && parsedSellingPrice >= 0) {
          updates.price = parsedSellingPrice;
        }
      }
      
      await api.put(`/admin/drinks/${item.id}`, updates);
      
      setSnackbar({ 
        open: true, 
        message: 'Item updated successfully', 
        severity: 'success' 
      });
      
      // Refresh both analytics and zero price items
      await Promise.all([
        fetchAnalytics(),
        fetchZeroPurchasePriceItems()
      ]);
      
      handleCancelEdit();
    } catch (err) {
      console.error('Error saving item:', err);
      setSnackbar({ 
        open: true, 
        message: err.response?.data?.error || 'Failed to update item', 
        severity: 'error' 
      });
    } finally {
      setSaving(false);
    }
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
        No inventory data available
      </Alert>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1, color: colors.textPrimary }}>
          Inventory Analytics
        </Typography>
        <Typography variant="body1" sx={{ color: colors.textSecondary }}>
          Stock valuation, out of stock items, and slow-moving inventory insights
        </Typography>
      </Box>

      {/* Stock Valuation Card */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ backgroundColor: colors.paper, height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AttachMoney sx={{ color: colors.accentText, mr: 1, fontSize: 32 }} />
                <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                  Stock Valuation
                </Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, color: colors.accentText, mb: 1 }}>
                {formatCurrency(analytics.stockValuation.total)}
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                Total value of {analytics.stockValuation.itemCount} items in stock
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ backgroundColor: colors.paper, height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Warning sx={{ color: '#FF3366', mr: 1, fontSize: 32 }} />
                <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                  Out of Stock
                </Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, color: '#FF3366', mb: 1 }}>
                {analytics.outOfStock.count}
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                Items currently out of stock
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ backgroundColor: colors.paper, height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingDown sx={{ color: '#FFA500', mr: 1, fontSize: 32 }} />
                <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                  Slow-Moving Stock
                </Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, color: '#FFA500', mb: 1 }}>
                {analytics.slowMoving.count}
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                No sales in ≥ {analytics.slowMoving.thresholdMonths} months
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ backgroundColor: colors.paper, height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Warning sx={{ color: '#FFA500', mr: 1, fontSize: 32 }} />
                <Typography variant="h6" sx={{ color: colors.textPrimary }}>
                  Zero Purchase Price
                </Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 700, color: '#FFA500', mb: 1 }}>
                {loadingZeroPrice ? '...' : zeroPurchasePriceItems.length}
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                Items missing purchase price
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Out of Stock Items Table */}
      {analytics.outOfStock.items.length > 0 && (
        <Card sx={{ mb: 4, backgroundColor: colors.paper }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Warning sx={{ color: '#FF3366', mr: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                Out of Stock Items ({analytics.outOfStock.count})
              </Typography>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Item Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Stock</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Purchase Price</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Selling Price</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analytics.outOfStock.items
                    .slice(outOfStockPage * outOfStockRowsPerPage, outOfStockPage * outOfStockRowsPerPage + outOfStockRowsPerPage)
                    .map((item) => (
                    <TableRow key={item.id}>
                      <TableCell sx={{ color: colors.textPrimary }}>{item.name}</TableCell>
                      <TableCell>
                        {item.category ? (
                          <Chip
                            label={item.category.name}
                            size="small"
                            sx={{
                              backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.2)' : 'rgba(0, 224, 184, 0.1)',
                              color: colors.accentText
                            }}
                          />
                        ) : (
                          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                            Uncategorized
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ color: '#FF3366', fontWeight: 600 }}>
                        {item.stock}
                      </TableCell>
                      <TableCell align="right">
                        {editingItem === item.id ? (
                          <TextField
                            type="number"
                            size="small"
                            value={editPurchasePrice}
                            onChange={(e) => setEditPurchasePrice(e.target.value)}
                            sx={{ width: '100px' }}
                            inputProps={{ min: 0, step: 0.01 }}
                          />
                        ) : (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                            <Typography sx={{ color: colors.textPrimary }}>
                              {formatCurrency(item.purchasePrice)}
                            </Typography>
                            <IconButton size="small" onClick={() => handleEditClick(item)}>
                              <Edit fontSize="small" />
                            </IconButton>
                          </Box>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {editingItem === item.id ? (
                          <TextField
                            type="number"
                            size="small"
                            value={editSellingPrice}
                            onChange={(e) => setEditSellingPrice(e.target.value)}
                            sx={{ width: '100px' }}
                            inputProps={{ min: 0, step: 0.01 }}
                          />
                        ) : (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                            <Typography sx={{ color: colors.textPrimary }}>
                              {formatCurrency(item.price || item.originalPrice)}
                            </Typography>
                            {editingItem !== item.id && (
                              <IconButton size="small" onClick={() => handleEditClick(item)}>
                                <Edit fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {editingItem === item.id ? (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton 
                              size="small" 
                              color="primary" 
                              onClick={() => handleSave(item)}
                              disabled={saving}
                            >
                              <Save fontSize="small" />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              color="error" 
                              onClick={handleCancelEdit}
                              disabled={saving}
                            >
                              <Cancel fontSize="small" />
                            </IconButton>
                          </Box>
                        ) : (
                          <IconButton size="small" onClick={() => handleEditClick(item)}>
                            <Edit fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={analytics.outOfStock.items.length}
              page={outOfStockPage}
              onPageChange={(e, newPage) => setOutOfStockPage(newPage)}
              rowsPerPage={outOfStockRowsPerPage}
              onRowsPerPageChange={(e) => {
                setOutOfStockRowsPerPage(parseInt(e.target.value, 10));
                setOutOfStockPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </CardContent>
        </Card>
      )}

      {/* Items with Zero Purchase Price */}
      {!loadingZeroPrice && zeroPurchasePriceItems.length > 0 && (
        <Card sx={{ mb: 4, backgroundColor: colors.paper }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Warning sx={{ color: '#FFA500', mr: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                Items with Zero Purchase Price ({zeroPurchasePriceItems.length})
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
              Items that have a purchase price of 0 or no purchase price set. These items need purchase prices to calculate profit accurately.
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Item Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Stock</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Purchase Price</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Selling Price</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {zeroPurchasePriceItems
                    .slice(zeroPricePage * zeroPriceRowsPerPage, zeroPricePage * zeroPriceRowsPerPage + zeroPriceRowsPerPage)
                    .map((item) => (
                    <TableRow key={item.id}>
                      <TableCell sx={{ color: colors.textPrimary }}>{item.name}</TableCell>
                      <TableCell>
                        {item.category ? (
                          <Chip
                            label={item.category.name}
                            size="small"
                            sx={{
                              backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.2)' : 'rgba(0, 224, 184, 0.1)',
                              color: colors.accentText
                            }}
                          />
                        ) : (
                          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                            Uncategorized
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>
                        {item.stock || 0}
                      </TableCell>
                      <TableCell align="right">
                        {editingItem === item.id ? (
                          <TextField
                            type="number"
                            size="small"
                            value={editPurchasePrice}
                            onChange={(e) => setEditPurchasePrice(e.target.value)}
                            sx={{ width: '100px' }}
                            inputProps={{ min: 0, step: 0.01 }}
                            placeholder="0.00"
                          />
                        ) : (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                            <Typography sx={{ color: '#FFA500', fontWeight: 600 }}>
                              {item.purchasePrice === null || item.purchasePrice === undefined || item.purchasePrice === '' 
                                ? 'Not Set' 
                                : formatCurrency(0)}
                            </Typography>
                            <IconButton size="small" onClick={() => handleEditClick(item)}>
                              <Edit fontSize="small" />
                            </IconButton>
                          </Box>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {editingItem === item.id ? (
                          <TextField
                            type="number"
                            size="small"
                            value={editSellingPrice}
                            onChange={(e) => setEditSellingPrice(e.target.value)}
                            sx={{ width: '100px' }}
                            inputProps={{ min: 0, step: 0.01 }}
                          />
                        ) : (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                            <Typography sx={{ color: colors.textPrimary }}>
                              {formatCurrency(item.price || item.originalPrice || 0)}
                            </Typography>
                            {editingItem !== item.id && (
                              <IconButton size="small" onClick={() => handleEditClick(item)}>
                                <Edit fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {editingItem === item.id ? (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton 
                              size="small" 
                              color="primary" 
                              onClick={() => handleSave(item)}
                              disabled={saving}
                            >
                              <Save fontSize="small" />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              color="error" 
                              onClick={handleCancelEdit}
                              disabled={saving}
                            >
                              <Cancel fontSize="small" />
                            </IconButton>
                          </Box>
                        ) : (
                          <IconButton size="small" onClick={() => handleEditClick(item)}>
                            <Edit fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={zeroPurchasePriceItems.length}
              page={zeroPricePage}
              onPageChange={(e, newPage) => setZeroPricePage(newPage)}
              rowsPerPage={zeroPriceRowsPerPage}
              onRowsPerPageChange={(e) => {
                setZeroPriceRowsPerPage(parseInt(e.target.value, 10));
                setZeroPricePage(0);
              }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </CardContent>
        </Card>
      )}

      {/* Slow-Moving Stock Table */}
      {analytics.slowMoving.items.length > 0 && (
        <Card sx={{ backgroundColor: colors.paper }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <TrendingDown sx={{ color: '#FFA500', mr: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                Slow-Moving Stock ({analytics.slowMoving.count})
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 2 }}>
              Items with no sales in the last {analytics.slowMoving.thresholdMonths} months
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Item Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Stock</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Purchase Price</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Selling Price</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Last Sold</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analytics.slowMoving.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell sx={{ color: colors.textPrimary }}>{item.name}</TableCell>
                      <TableCell>
                        {item.category ? (
                          <Chip
                            label={item.category.name}
                            size="small"
                            sx={{
                              backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.2)' : 'rgba(0, 224, 184, 0.1)',
                              color: colors.accentText
                            }}
                          />
                        ) : (
                          <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                            Uncategorized
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>
                        {item.stock}
                      </TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>
                        {formatCurrency(item.purchasePrice)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>
                        {formatCurrency(item.price || item.originalPrice)}
                      </TableCell>
                      <TableCell sx={{ color: colors.textSecondary }}>
                        {item.lastSoldDate
                          ? new Date(item.lastSoldDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })
                          : 'Never'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Empty States */}
      {analytics.outOfStock.items.length === 0 && (
        <Card sx={{ mb: 4, backgroundColor: colors.paper }}>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircle sx={{ fontSize: 64, color: colors.accentText, mb: 2 }} />
              <Typography variant="h6" sx={{ color: colors.textPrimary, mb: 1 }}>
                All items in stock!
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                No items are currently out of stock.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {analytics.slowMoving.items.length === 0 && (
        <Card sx={{ backgroundColor: colors.paper }}>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <TrendingUp sx={{ fontSize: 64, color: colors.accentText, mb: 2 }} />
              <Typography variant="h6" sx={{ color: colors.textPrimary, mb: 1 }}>
                All items are moving well!
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                No slow-moving items found. All items have had sales in the last {analytics.slowMoving.thresholdMonths} months.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Inventory;
