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
  Chip
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  Warning,
  TrendingDown,
  AttachMoney,
  CheckCircle,
  TrendingUp
} from '@mui/icons-material';
import { api } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';

const Inventory = () => {
  const { isDarkMode, colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    fetchAnalytics();
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
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
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analytics.outOfStock.items.map((item) => (
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
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>
                        {formatCurrency(item.purchasePrice)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>
                        {formatCurrency(item.price || item.originalPrice)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
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
    </Container>
  );
};

export default Inventory;
