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
  InputAdornment
} from '@mui/material';
import { Search, AttachMoney } from '@mui/icons-material';
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

  const parseNumber = (value) => {
    const n = parseFloat(value);
    return Number.isNaN(n) ? 0 : n;
  };

  const getCapacityLabelFromEntry = (entry) => {
    if (!entry) return null;
    return entry.capacity ?? entry.size ?? entry.effectiveCapacity ?? null;
  };

  // Flatten a single drink into "one row per available capacity"
  // so the customer pricelist matches the admin price list behavior.
  const getCapacityRows = (drink) => {
    if (!drink) return [];

    const capacityPricing = Array.isArray(drink.capacityPricing) ? drink.capacityPricing : [];

    // Prefer capacityPricing (it already has per-capacity selling prices)
    if (capacityPricing.length > 0) {
      const rows = capacityPricing
        .map((entry) => {
          const cap = getCapacityLabelFromEntry(entry);
          if (!cap) return null;

          const sellingPriceRaw =
            entry.currentPrice ??
            entry.price ??
            entry.originalPrice ??
            drink.price ??
            drink.originalPrice ??
            0;

          const price = parseNumber(sellingPriceRaw);
          if (price <= 0) return null;

          const originalPriceRaw = entry.originalPrice ?? drink.originalPrice ?? price;
          const originalPrice = parseNumber(originalPriceRaw);

          return {
            drinkId: drink.id,
            productName: drink.name,
            categoryName: drink.category?.name || 'Other',
            brandName: drink.brand?.name || '',
            abv: drink.abv,
            capacity: String(cap),
            price,
            originalPrice
          };
        })
        .filter(Boolean);

      if (rows.length > 0) return rows;
    }

    // Fallback: use the legacy `capacity` / `price` fields.
    const basePrice = parseNumber(drink.price ?? drink.originalPrice ?? 0);
    if (basePrice <= 0) return [];

    const capacities = Array.isArray(drink.capacity)
      ? Array.from(new Set(drink.capacity.map((c) => String(c || '').trim()).filter(Boolean)))
      : drink.capacity
      ? [String(drink.capacity)]
      : [];

    if (capacities.length === 0) {
      return [
        {
          drinkId: drink.id,
          productName: drink.name,
          categoryName: drink.category?.name || 'Other',
          brandName: drink.brand?.name || '',
          abv: drink.abv,
          capacity: 'N/A',
          price: basePrice,
          originalPrice: parseNumber(drink.originalPrice ?? basePrice)
        }
      ];
    }

    return capacities.map((cap) => ({
      drinkId: drink.id,
      productName: drink.name,
      categoryName: drink.category?.name || 'Other',
      brandName: drink.brand?.name || '',
      abv: drink.abv,
      capacity: cap,
      price: basePrice,
      originalPrice: parseNumber(drink.originalPrice ?? basePrice)
    }));
  };

  // Flatten drinks into capacity-rows and group by category.
  // Each capacity is its own row (matches admin price list).
  const groupedCapacityRows = filteredDrinks.reduce((acc, drink) => {
    const rows = getCapacityRows(drink);
    const categoryName = drink.category?.name || 'Other';

    if (!acc[categoryName]) acc[categoryName] = [];
    acc[categoryName].push(...rows);
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
          {Object.keys(groupedCapacityRows).map((categoryName) => (
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
                    {groupedCapacityRows[categoryName].map((row) => (
                      <TableRow key={`${row.drinkId}-${row.capacity}`} hover>
                        <TableCell sx={{ color: colors.textPrimary }}>
                          {row.productName}
                          {row.abv && (
                            <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block' }}>
                              ABV: {row.abv}%
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ color: colors.textSecondary }}>
                          {row.capacity}
                        </TableCell>
                        <TableCell align="right" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                          {row.originalPrice > row.price ? (
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
                                {formatCurrency(row.originalPrice)}
                              </Typography>
                              <Typography variant="body1" sx={{ color: colors.accentText, display: 'inline' }}>
                                {formatCurrency(row.price)}
                              </Typography>
                            </Box>
                          ) : (
                            formatCurrency(row.price)
                          )}
                        </TableCell>
                        {searchTerm === '' && (
                          <TableCell sx={{ color: colors.textSecondary }}>
                            {row.brandName || 'N/A'}
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
