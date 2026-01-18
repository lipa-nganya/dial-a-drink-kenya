import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
  Chip,
  Grid,
  Card,
  CardContent
} from '@mui/material';
import { Search, LocalBar, AttachMoney } from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const Pricelist = () => {
  const { colors } = useTheme();
  const [drinks, setDrinks] = useState([]);
  const [filteredDrinks, setFilteredDrinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchDrinks();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredDrinks(drinks);
    } else {
      const filtered = drinks.filter(drink =>
        drink.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (drink.category?.name && drink.category.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (drink.brand?.name && drink.brand.name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredDrinks(filtered);
    }
  }, [searchTerm, drinks]);

  const fetchDrinks = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/drinks');
      // Filter only available drinks and sort by category and name
      const availableDrinks = response.data
        .filter(drink => drink.isAvailable !== false)
        .sort((a, b) => {
          const categoryCompare = (a.category?.name || '').localeCompare(b.category?.name || '');
          if (categoryCompare !== 0) return categoryCompare;
          return a.name.localeCompare(b.name);
        });
      setDrinks(availableDrinks);
      setFilteredDrinks(availableDrinks);
    } catch (err) {
      console.error('Error fetching drinks:', err);
      setError('Failed to load pricelist. Please try again later.');
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

  const formatCapacity = (drink) => {
    if (drink.capacity) {
      return drink.capacity;
    }
    return 'N/A';
  };

  // Group drinks by category for better organization
  const groupedDrinks = filteredDrinks.reduce((acc, drink) => {
    const categoryName = drink.category?.name || 'Other';
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(drink);
    return acc;
  }, {});

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <AttachMoney sx={{ fontSize: 40, color: colors.accentText }} />
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, color: colors.textPrimary }}>
            Our Pricelist
          </Typography>
        </Box>
        <Typography variant="body1" sx={{ color: colors.textSecondary, mb: 3 }}>
          Browse our complete selection of premium beverages with competitive pricing. Prices are subject to change.
        </Typography>

        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search by name, category, or brand..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 4 }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {filteredDrinks.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            {searchTerm ? 'No items found matching your search' : 'No items available in pricelist'}
          </Typography>
        </Box>
      ) : (
        <Box>
          {Object.keys(groupedDrinks).map((categoryName) => (
            <Box key={categoryName} sx={{ mb: 4 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, color: colors.textPrimary, mb: 2 }}>
                {categoryName}
              </Typography>
              <TableContainer component={Paper} sx={{ mb: 3 }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: colors.paper }}>
                      <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Product Name</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Size</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Price</TableCell>
                      {searchTerm === '' && (
                        <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Brand</TableCell>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {groupedDrinks[categoryName].map((drink) => (
                      <TableRow key={drink.id} hover>
                        <TableCell sx={{ color: colors.textPrimary }}>
                          {drink.name}
                          {drink.abv && (
                            <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block' }}>
                              ABV: {drink.abv}%
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ color: colors.textSecondary }}>
                          {formatCapacity(drink)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                          {drink.originalPrice && parseFloat(drink.originalPrice) > parseFloat(drink.price) ? (
                            <Box>
                              <Typography
                                variant="body2"
                                sx={{
                                  textDecoration: 'line-through',
                                  color: colors.textSecondary,
                                  display: 'inline',
                                  mr: 1
                                }}
                              >
                                {formatCurrency(drink.originalPrice)}
                              </Typography>
                              <Typography variant="body1" sx={{ color: colors.accentText, display: 'inline' }}>
                                {formatCurrency(drink.price)}
                              </Typography>
                            </Box>
                          ) : (
                            formatCurrency(drink.price)
                          )}
                        </TableCell>
                        {searchTerm === '' && (
                          <TableCell sx={{ color: colors.textSecondary }}>
                            {drink.brand?.name || 'N/A'}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ mt: 4, p: 3, backgroundColor: colors.paper, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: colors.textPrimary, mb: 2 }}>
          Pricing Information
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>
          • All prices are in Kenyan Shillings (KES)
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>
          • Prices are subject to change without prior notice
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>
          • Delivery fees apply and vary by location
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary }}>
          • For bulk orders or special pricing, please contact us at +254 723 688 108
        </Typography>
      </Box>
    </Container>
  );
};

export default Pricelist;
