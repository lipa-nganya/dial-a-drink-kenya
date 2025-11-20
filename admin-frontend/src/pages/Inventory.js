import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardMedia,
  CardContent,
  Button,
  Chip,
  Grid,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Divider,
  Pagination
} from '@mui/material';
import {
  LocalBar,
  CheckCircle,
  Cancel,
  Edit,
  Visibility,
  VisibilityOff,
  Inventory,
  TrendingUp,
  TrendingDown,
  Search,
  FilterList,
  Clear,
  Add,
  LocalOffer,
  QrCodeScanner
} from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import EditDrinkDialog from '../components/EditDrinkDialog';

const InventoryPage = () => {
  const { isDarkMode, colors } = useTheme();
  const [drinks, setDrinks] = useState([]);
  const [filteredDrinks, setFilteredDrinks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedDrink, setSelectedDrink] = useState(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [offerFilter, setOfferFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  
  const itemsPerPage = 16; // 4 rows × 4 columns

  // Helper function to get full image URL
  const getImageUrl = (imagePath) => {
    if (!imagePath) return '';
    
    // If it's a base64 data URL, return as is
    if (imagePath.startsWith('data:')) {
      return imagePath;
    }
    
    // If it's already a full URL, return as is
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    
    // For relative paths, construct the full URL
    const isHosted =
      window.location.hostname.includes('onrender.com') ||
      window.location.hostname.includes('run.app');
    const baseUrl = isHosted
      ? 'https://dialadrink-backend-910510650031.us-central1.run.app'
      : 'http://localhost:5001';
    
    return `${baseUrl}${imagePath}`;
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterDrinks();
  }, [drinks, searchTerm, selectedCategory, availabilityFilter, offerFilter]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, availabilityFilter, offerFilter]);

  const fetchData = async () => {
    try {
      const [drinksResponse, categoriesResponse] = await Promise.all([
        api.get('/admin/drinks'),
        api.get('/categories')
      ]);
      setDrinks(drinksResponse.data);
      setCategories(categoriesResponse.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to check if a drink is on offer
  const isDrinkOnOffer = (drink) => {
    // Check if explicitly marked as on offer
    if (drink.isOnOffer === true) {
      return true;
    }
    
    // Check if has discounts in capacityPricing
    if (Array.isArray(drink.capacityPricing) && drink.capacityPricing.length > 0) {
      const hasDiscount = drink.capacityPricing.some(pricing => {
        if (!pricing || typeof pricing !== 'object') return false;
        const originalPrice = parseFloat(pricing.originalPrice) || 0;
        const currentPrice = parseFloat(pricing.currentPrice) || parseFloat(pricing.price) || 0;
        return originalPrice > currentPrice && originalPrice > 0 && currentPrice >= 0;
      });
      if (hasDiscount) {
        return true;
      }
    }
    
    // Check if has discount at main price level
    const originalPrice = parseFloat(drink.originalPrice) || 0;
    const currentPrice = parseFloat(drink.price) || 0;
    if (originalPrice > currentPrice && originalPrice > 0 && currentPrice >= 0) {
      return true;
    }
    
    return false;
  };

  const filterDrinks = () => {
    let filtered = [...drinks];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(drink =>
        (drink.name && drink.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (drink.description && drink.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

        // Category filter
        if (selectedCategory) {
          if (selectedCategory === 'popular') {
            filtered = filtered.filter(drink => drink.isPopular === true);
          } else {
            filtered = filtered.filter(drink =>
              drink.category && drink.category.name === selectedCategory
            );
          }
        }

    // Availability filter
    if (availabilityFilter !== 'all') {
      filtered = filtered.filter(drink =>
        availabilityFilter === 'available' ? drink.isAvailable : !drink.isAvailable
      );
    }

    // On Offer filter
    if (offerFilter !== 'all') {
      if (offerFilter === 'limited') {
        filtered = filtered.filter(drink => drink.limitedTimeOffer === true);
      } else {
        filtered = filtered.filter(drink =>
          offerFilter === 'on-offer' ? isDrinkOnOffer(drink) : !isDrinkOnOffer(drink)
        );
      }
    }

    setFilteredDrinks(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setAvailabilityFilter('all');
    setOfferFilter('all');
  };

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // Calculate pagination for filtered drinks
  const totalPages = Math.ceil(filteredDrinks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDrinks = filteredDrinks.slice(startIndex, endIndex);

  const summaryCards = [
    {
      icon: <Inventory sx={{ fontSize: 40, color: '#00E0B8', mb: 1 }} />,
      value: filteredDrinks.length,
      label: drinks.length !== filteredDrinks.length ? 'Filtered Drinks' : 'Total Drinks',
      sublabel: drinks.length !== filteredDrinks.length ? `of ${drinks.length} total` : null
    },
    {
      icon: <TrendingUp sx={{ fontSize: 40, color: '#00E0B8', mb: 1 }} />,
      value: filteredDrinks.filter(drink => drink.isAvailable).length,
      label: 'Available'
    },
    {
      icon: <TrendingDown sx={{ fontSize: 40, color: '#FF3366', mb: 1 }} />,
      value: filteredDrinks.filter(drink => !drink.isAvailable).length,
      label: 'Out of Stock'
    },
    {
      icon: <LocalBar sx={{ fontSize: 40, color: '#00E0B8', mb: 1 }} />,
      value: filteredDrinks.filter(drink => drink.isPopular).length,
      label: 'Popular Items'
    },
    {
      icon: <LocalOffer sx={{ fontSize: 40, color: '#00E0B8', mb: 1 }} />,
      value: filteredDrinks.filter(drink => drink.limitedTimeOffer).length,
      label: 'Limited Time Items'
    }
  ];

  const handleAvailabilityToggle = async (drinkId, isAvailable) => {
    try {
      await api.patch(`/admin/drinks/${drinkId}/availability`, { isAvailable });
      setDrinks(drinks.map(drink => 
        drink.id === drinkId ? { ...drink, isAvailable } : drink
      ));
    } catch (error) {
      console.error('Error updating drink availability:', error);
    }
  };

  const handleStockUpdate = async (drinkId, newStock) => {
    try {
      const stockValue = parseInt(newStock) || 0;
      if (isNaN(stockValue) || stockValue < 0) {
        setError('Stock must be a non-negative whole number');
        return;
      }

      await api.post('/inventory/update-stock', { drinkId, stock: stockValue });
      setDrinks(drinks.map(drink => 
        drink.id === drinkId ? { ...drink, stock: stockValue } : drink
      ));
      // Clear any previous errors on success
      setError(null);
    } catch (error) {
      console.error('Error updating stock:', error);
      setError(error.response?.data?.error || 'Failed to update stock');
    }
  };

  const getAvailabilityColor = (isAvailable) => {
    return isAvailable ? 'success' : 'error';
  };

  const getAvailabilityIcon = (isAvailable) => {
    return isAvailable ? <CheckCircle /> : <Cancel />;
  };

  const handleEditDrink = (drink) => {
    setSelectedDrink(drink);
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setSelectedDrink(null);
  };

  const handleSaveDrink = () => {
    fetchData(); // Refresh the drinks list
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading inventory...</Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">Error loading inventory: {error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom sx={{ color: colors.accentText, fontWeight: 700 }}>
            Inventory Management
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Manage inventory availability and stock status
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setSelectedDrink(null);
            setEditDialogOpen(true);
          }}
          sx={{
            backgroundColor: colors.accentText,
            color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
            '&:hover': { backgroundColor: '#00C4A3' }
          }}
        >
          Create New Item
        </Button>
      </Box>

      {/* Summary Stats */}
      <Box sx={{ mb: 4 }}>
        <Grid
          container
          spacing={2}
          justifyContent="center"
          alignItems="stretch"
        >
          {summaryCards.map((card, index) => (
            <Grid key={index} item xs={12} sm={6} md={4} lg={2} sx={{ display: 'flex' }}>
              <Card sx={{ backgroundColor: colors.paper, flexGrow: 1 }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  {card.icon}
                  <Typography variant="h4" sx={{ color: colors.accentText, fontWeight: 700 }}>
                    {card.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {card.label}
                  </Typography>
                  {card.sublabel && (
                    <Typography variant="caption" color="text.secondary">
                      {card.sublabel}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Search and Filter Section */}
      <Paper sx={{ p: 3, mb: 4, backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <FilterList sx={{ color: colors.accentText, mr: 1 }} />
          <Typography variant="h6" sx={{ color: colors.accentText, fontWeight: 600 }}>
            Search & Filter
          </Typography>
        </Box>
        
        <Grid container spacing={3} alignItems="center">
          {/* Search Input */}
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              placeholder="Search by name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: colors.accentText }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: colors.textPrimary,
                  '& fieldset': {
                    borderColor: colors.border,
                  },
                  '&:hover fieldset': {
                    borderColor: colors.accentText,
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: colors.accentText,
                  },
                },
                '& .MuiInputBase-input::placeholder': {
                  color: colors.textSecondary,
                  opacity: 1,
                },
              }}
            />
          </Grid>

          {/* Category Filter */}
          <Grid size={{ xs: 12, md: 3 }}>
            <FormControl fullWidth sx={{ minWidth: 120 }}>
              <InputLabel sx={{ color: colors.textPrimary }}>Category</InputLabel>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                label="Category"
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
                  },
                }}
              >
                <MenuItem value="">All Categories</MenuItem>
                <MenuItem value="popular">Popular</MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.name}>
                    {category.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Availability Filter */}
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: colors.textPrimary }}>Availability</InputLabel>
              <Select
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
                label="Availability"
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
                  },
                }}
              >
                <MenuItem value="all">All Items</MenuItem>
                <MenuItem value="available">Available Only</MenuItem>
                <MenuItem value="out-of-stock">Out of Stock Only</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* On Offer Filter */}
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: colors.textPrimary }}>On Offer</InputLabel>
              <Select
                value={offerFilter}
                onChange={(e) => setOfferFilter(e.target.value)}
                label="On Offer"
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
                  },
                }}
              >
                <MenuItem value="all">All Items</MenuItem>
                <MenuItem value="on-offer">On Offer Only</MenuItem>
                <MenuItem value="limited">Limited Time Only</MenuItem>
                <MenuItem value="not-on-offer">Not On Offer</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Clear Filters Button */}
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Clear />}
              onClick={clearFilters}
              sx={{
                color: colors.accentText,
                borderColor: colors.accentText,
                '&:hover': {
                  borderColor: colors.accentText,
                  backgroundColor: 'rgba(0, 224, 184, 0.1)',
                },
              }}
            >
              Clear Filters
            </Button>
          </Grid>
        </Grid>

        {/* Filter Results Summary */}
        {(searchTerm || selectedCategory || availabilityFilter !== 'all' || offerFilter !== 'all') && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Showing {filteredDrinks.length} of {drinks.length} drinks
              {searchTerm && ` matching "${searchTerm}"`}
              {selectedCategory && ` in ${selectedCategory}`}
              {availabilityFilter !== 'all' && ` (${availabilityFilter === 'available' ? 'Available' : 'Out of Stock'})`}
              {offerFilter !== 'all' && ` (${offerFilter === 'on-offer' ? 'On Offer' : offerFilter === 'limited' ? 'Limited Time' : 'Not On Offer'})`}
            </Typography>
          </Box>
        )}
      </Paper>

      {filteredDrinks.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <LocalBar sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              {drinks.length === 0 ? 'No drinks found' : 'No drinks match your filters'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {drinks.length === 0 
                ? 'Add drinks to your inventory to manage them here'
                : 'Try adjusting your search criteria or clear filters to see all drinks'
              }
            </Typography>
            {drinks.length > 0 && (
              <Button
                variant="outlined"
                startIcon={<Clear />}
                onClick={clearFilters}
                sx={{ mt: 2, color: colors.accentText, borderColor: colors.accentText }}
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Box sx={{ 
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
              lg: 'repeat(4, 1fr)'
            },
            gap: 2,
            justifyContent: 'center'
          }}>
            {paginatedDrinks.map((drink) => (
              <Card 
                key={drink.id}
                sx={{ 
                  width: '100%',
                  height: '100%',
                  minHeight: '380px',
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: '#ffffff',
                  transition: 'transform 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 2
                  }
                }}
              >
                <CardMedia
                  component="img"
                  height="120"
                  image={getImageUrl(drink.image)}
                  alt={drink.name}
                  sx={{ objectFit: 'contain', p: 1, backgroundColor: '#ffffff' }}
                />
                <CardContent sx={{ flexGrow: 1, overflow: 'visible', display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff' }}>
                  {/* Status Label Above Name */}
                  <Box sx={{ mb: 0.5, display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                    {drink.barcode && (
                      <Chip
                        icon={<QrCodeScanner />}
                        label="Barcode"
                        size="small"
                        sx={{ 
                          fontSize: '0.65rem', 
                          height: '20px',
                          backgroundColor: '#4CAF50',
                          color: '#fff'
                        }}
                      />
                    )}
                    {drink.stock !== undefined && drink.stock !== null && (
                      <Chip
                        icon={<Inventory />}
                        label={`Stock: ${drink.stock}`}
                        size="small"
                        sx={{ 
                          fontSize: '0.65rem', 
                          height: '20px',
                          backgroundColor: drink.stock > 0 ? '#2196F3' : '#F44336',
                          color: '#fff'
                        }}
                      />
                    )}
                    {!drink.isAvailable && (
                      <Chip
                        icon={<Cancel />}
                        label="Out of Stock"
                        size="small"
                        sx={{ 
                          fontSize: '0.65rem', 
                          height: '20px',
                          backgroundColor: '#666',
                          color: '#F5F5F5'
                        }}
                      />
                    )}
                    {drink.isAvailable && drink.isPopular && (
                      <Chip
                        icon={<LocalBar />}
                        label="Popular"
                        size="small"
                        sx={{ 
                          fontSize: '0.65rem', 
                          height: '20px',
                          backgroundColor: '#FF3366',
                          color: '#F5F5F5'
                        }}
                      />
                    )}
                    {drink.limitedTimeOffer && (
                      <Chip
                        icon={<LocalOffer />}
                        label="Limited Time"
                        size="small"
                        sx={{ 
                          fontSize: '0.65rem', 
                          height: '20px',
                          backgroundColor: '#00E0B8',
                          color: '#0D0D0D'
                        }}
                      />
                    )}
                  </Box>

                  {/* Drink Name */}
                  <Typography variant="subtitle1" component="div" sx={{ fontSize: '0.9rem', fontWeight: 'bold', mb: 0.5, color: colors.textPrimary }}>
                    {drink.name}
                  </Typography>

                  {/* Hide description for Soft Drinks */}
                  {drink.category?.name !== 'Soft Drinks' && drink.description && (
                    <Typography
                      variant="body2"
                      sx={{ mb: 1, minHeight: '30px', fontSize: '0.75rem', color: colors.textPrimary }}
                    >
                      {drink.description}
                    </Typography>
                  )}

                  {/* Price Display */}
                  <Box sx={{ mb: 1 }}>
                    {drink.isOnOffer && drink.originalPrice ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            textDecoration: 'line-through', 
                            color: '#666', 
                            fontSize: '0.65rem' 
                          }}
                        >
                          KES {Number(drink.originalPrice).toFixed(2)}
                        </Typography>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: '#FF3366', 
                            fontWeight: 'bold', 
                            fontSize: '0.7rem' 
                          }}
                        >
                          KES {Number(drink.price).toFixed(2)}
                        </Typography>
                      </Box>
                    ) : (
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: colors.textPrimary, 
                            fontWeight: 'bold', 
                            fontSize: '0.7rem' 
                          }}
                        >
                          KES {Number(drink.price).toFixed(2)}
                        </Typography>
                    )}
                  </Box>

                  {/* Stock Quantity Display with Quick Edit */}
                  <Box sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <Inventory 
                        sx={{ 
                          fontSize: '0.9rem', 
                          color: (drink.stock !== undefined && drink.stock !== null && drink.stock > 0) ? '#2196F3' : '#F44336' 
                        }} 
                      />
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: (drink.stock !== undefined && drink.stock !== null && drink.stock > 0) ? '#2196F3' : '#F44336',
                          fontWeight: 'bold',
                          fontSize: '0.75rem'
                        }}
                      >
                        Stock: {drink.stock !== undefined && drink.stock !== null ? drink.stock : 0}
                      </Typography>
                    </Box>
                    <TextField
                      size="small"
                      type="number"
                      inputProps={{ step: "1", min: "0" }}
                      value={drink.stock !== undefined && drink.stock !== null ? drink.stock : 0}
                      onChange={(e) => {
                        const newStock = e.target.value;
                        // Update immediately in UI for better UX
                        setDrinks(drinks.map(d => 
                          d.id === drink.id ? { ...d, stock: newStock === '' ? 0 : parseInt(newStock) || 0 } : d
                        ));
                      }}
                      onBlur={(e) => {
                        const newStock = parseInt(e.target.value) || 0;
                        if (newStock !== drink.stock) {
                          handleStockUpdate(drink.id, newStock);
                        }
                      }}
                      sx={{
                        width: '100%',
                        '& .MuiOutlinedInput-root': {
                          fontSize: '0.7rem',
                          height: '28px',
                          '& input': {
                            padding: '4px 8px',
                            textAlign: 'center'
                          },
                          '& fieldset': {
                            borderColor: colors.border,
                          },
                          '&:hover fieldset': {
                            borderColor: colors.accentText,
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: colors.accentText,
                          },
                        },
                      }}
                    />
                  </Box>

                  {/* ABV Display */}
                  {drink.abv && (
                    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', mb: 1, mt: 0 }}>
                      <Chip
                        label={`${Number(drink.abv)}% ABV`}
                        size="small"
                        sx={{
                          backgroundColor: '#FF3366',
                          color: '#F5F5F5',
                          fontSize: '0.65rem',
                          height: '20px'
                        }}
                      />
                    </Box>
                  )}

                  {/* Category */}
                  {drink.category && (
                    <Box sx={{ mb: 1 }}>
                      <Chip
                        label={drink.category.name}
                        size="small"
                        sx={{
                          fontSize: '0.65rem',
                          height: '20px',
                          backgroundColor: isDarkMode ? '#121212' : colors.paper,
                          color: colors.accentText,
                          border: `1px solid ${colors.border}`
                        }}
                      />
                    </Box>
                  )}

                  {/* Availability Toggle */}
                  <Box sx={{ mb: 1, mt: 'auto' }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={drink.isAvailable}
                          onChange={(e) => handleAvailabilityToggle(drink.id, e.target.checked)}
                          size="small"
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: '#00E0B8',
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: '#00E0B8',
                            },
                          }}
                        />
                      }
                      label={
                        <Typography variant="body2" sx={{ fontSize: '0.7rem', color: colors.textPrimary }}>
                          {drink.isAvailable ? 'Available' : 'Out of Stock'}
                        </Typography>
                      }
                    />
                  </Box>

                  {/* Edit Button */}
                  <Box sx={{ mt: 'auto', mb: 1 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<Edit />}
                      onClick={() => handleEditDrink(drink)}
                      size="small"
                      sx={{
                        backgroundColor: colors.accentText,
                        color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        py: 0.5,
                        '&:hover': {
                          backgroundColor: '#00C4A3',
                          transform: 'translateY(-1px)'
                        }
                      }}
                    >
                      Edit Product
                    </Button>
                  </Box>

                  {/* Last Updated */}
                  <Typography variant="caption" sx={{ fontSize: '0.6rem', color: colors.textSecondary, mt: 0.5, display: 'block', textAlign: 'center' }}>
                    Updated: {new Date(drink.updatedAt).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={handlePageChange}
                color="primary"
                size="large"
                sx={{
                  '& .MuiPaginationItem-root': {
                    color: colors.textPrimary,
                  },
                  '& .MuiPaginationItem-root.Mui-selected': {
                    backgroundColor: colors.accentText,
                    color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                    '&:hover': {
                      backgroundColor: '#00C4A3',
                    },
                  },
                  '& .MuiPaginationItem-root:hover': {
                    backgroundColor: 'rgba(0, 224, 184, 0.1)',
                  },
                }}
              />
            </Box>
          )}
        </>
      )}

      {/* Edit Drink Dialog */}
      <EditDrinkDialog
        open={editDialogOpen}
        onClose={handleCloseEditDialog}
        drink={selectedDrink}
        onSave={handleSaveDrink}
      />
    </Container>
  );
};

export default InventoryPage;
