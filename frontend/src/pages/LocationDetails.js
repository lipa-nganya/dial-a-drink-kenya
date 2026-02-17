import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  TextField,
  InputAdornment,
  Button,
  Chip,
  CircularProgress
} from '@mui/material';
import { Search, Star } from '@mui/icons-material';
/* eslint-disable react-hooks/exhaustive-deps */
import { useParams, useSearchParams } from 'react-router-dom';
import DrinkCard from '../components/DrinkCard';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const LocationDetails = () => {
  const { locationName } = useParams();
  const { colors } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [drinks, setDrinks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [selectedSubcategory, setSelectedSubcategory] = useState(0);
  const [filteredDrinks, setFilteredDrinks] = useState([]);
  const [itemsToShow, setItemsToShow] = useState(16); // Initial items to show
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const itemsPerLoad = 16; // Load 16 items at a time

    // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchLocation();
    fetchData();
  }, [locationName]);

  useEffect(() => {
    // Read category and subcategory from URL query parameters
    const categoryParam = searchParams.get('category');
    const subcategoryParam = searchParams.get('subcategory');
    
    if (categoryParam) {
      const categoryId = parseInt(categoryParam, 10);
      if (!isNaN(categoryId)) {
        setSelectedCategory(categoryId);
      }
    } else {
      setSelectedCategory(0);
    }
    
    if (subcategoryParam) {
      const subcategoryId = parseInt(subcategoryParam, 10);
      if (!isNaN(subcategoryId)) {
        setSelectedSubcategory(subcategoryId);
      }
    } else {
      setSelectedSubcategory(0);
    }
  }, [searchParams]);
  
  // Fetch subcategories when category changes
  useEffect(() => {
    if (selectedCategory > 0) {
      fetchSubcategories(selectedCategory);
      // Reset subcategory when category changes (but don't update URL here to avoid loops)
      if (selectedSubcategory > 0) {
        setSelectedSubcategory(0);
      }
    } else {
      setSubcategories([]);
      setSelectedSubcategory(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  useEffect(() => {
    filterDrinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps, no-use-before-define
  }, [drinks, searchTerm, selectedCategory, selectedSubcategory]);

  // Reset pagination when category or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchTerm]);

  const fetchLocation = async () => {
    try {
      setLocationLoading(true);
      const response = await api.get('/territories');
      const decodedLocationName = decodeURIComponent(locationName);
      const foundLocation = response.data.find(
        t => t.name.toLowerCase() === decodedLocationName.toLowerCase()
      );
      if (foundLocation) {
        setLocation(foundLocation);
      }
    } catch (error) {
      console.error('Error fetching location:', error);
    } finally {
      setLocationLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [drinksResponse, categoriesResponse] = await Promise.all([
        api.get('/drinks'),
        api.get('/categories')
      ]);
      setDrinks(drinksResponse.data);
      setCategories(categoriesResponse.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubcategories = async (categoryId) => {
    try {
      const response = await api.get(`/subcategories?categoryId=${categoryId}`);
      setSubcategories(response.data);
    } catch (error) {
      console.error('Error fetching subcategories:', error);
      setSubcategories([]);
    }
  };

  const filterDrinks = () => {
    // Safety check: ensure drinks is an array
    if (!Array.isArray(drinks)) {
      setFilteredDrinks([]);
      return;
    }

    // Filter out any null/undefined drinks
    let filtered = drinks.filter(drink => drink != null);

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(drink => {
        if (!drink) return false;
        const nameMatch = drink.name && typeof drink.name === 'string' 
          ? drink.name.toLowerCase().includes(searchTerm.toLowerCase()) 
          : false;
        const descMatch = drink.description && typeof drink.description === 'string'
          ? drink.description.toLowerCase().includes(searchTerm.toLowerCase())
          : false;
        return nameMatch || descMatch;
      });
    }

    // Filter by category or popular
    if (selectedCategory === -1) {
      // Popular tab selected
      filtered = filtered.filter(drink => drink && drink.isPopular);
    } else if (selectedCategory > 0) {
      // Regular category selected
      filtered = filtered.filter(drink => drink && drink.categoryId === selectedCategory);
      
      // Filter by subcategory if one is selected
      if (selectedSubcategory > 0) {
        filtered = filtered.filter(drink => drink && drink.subCategoryId === selectedSubcategory);
      }
    }
    // If selectedCategory === 0, show all drinks (no filter)

    // Sort: available items first, then by name
    filtered.sort((a, b) => {
      // First sort by availability (available items first)
      if (a.isAvailable !== b.isAvailable) {
        return b.isAvailable ? 1 : -1; // true (available) comes before false (out of stock)
      }
      // Then sort by name alphabetically
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    setFilteredDrinks(filtered);
  };

  const handleCategoryChange = (event, newValue) => {
    setSelectedCategory(newValue);
    setSelectedSubcategory(0); // Reset subcategory when category changes
    // Update URL query parameter
    if (newValue > 0) {
      setSearchParams({ category: newValue.toString() });
    } else {
      // Clear category param for "All" (0) or "Popular" (-1)
      setSearchParams({});
    }
  };

  const handleSubcategoryChange = (subcategoryId) => {
    setSelectedSubcategory(subcategoryId);
    // Update URL query parameter
    const params = { category: selectedCategory.toString() };
    if (subcategoryId > 0) {
      params.subcategory = subcategoryId.toString();
    }
    setSearchParams(params);
  };

  // Lazy loading: Load more items when scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (isLoadingMore) return;
      
      // Check if user is near bottom of page
      if (window.innerHeight + window.scrollY >= document.documentElement.offsetHeight - 1000) {
        if (itemsToShow < filteredDrinks.length) {
          setIsLoadingMore(true);
          // Simulate loading delay for better UX
          setTimeout(() => {
            setItemsToShow(prev => Math.min(prev + itemsPerLoad, filteredDrinks.length));
            setIsLoadingMore(false);
          }, 300);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [itemsToShow, filteredDrinks.length, isLoadingMore, itemsPerLoad]);

  // Reset items to show when filtered drinks change
  useEffect(() => {
    setItemsToShow(Math.min(itemsPerLoad, filteredDrinks.length));
  }, [filteredDrinks.length, itemsPerLoad]);

  const displayedDrinks = filteredDrinks.slice(0, itemsToShow);

  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return 'Free';
    return `KES ${parseFloat(amount).toFixed(0)}`;
  };

  const displayLocationName = location ? location.name : decodeURIComponent(locationName || '');

  if (locationLoading) {
    return (
      <Box sx={{ backgroundColor: colors.background, minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ backgroundColor: colors.background, minHeight: '100vh' }}>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ mb: 3, textAlign: 'center' }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, color: colors.textPrimary }}>
            Order Now for Delivery to {displayLocationName}
          </Typography>
        </Box>

        {location && (
          <Box sx={{ mb: 3, p: 2, backgroundColor: colors.paper, borderRadius: 2 }}>
            <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>
              <strong>Delivery Fees:</strong>
            </Typography>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                From CBD: {formatCurrency(location.deliveryFromCBD)}
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                From Ruaka: {formatCurrency(location.deliveryFromRuaka)}
              </Typography>
            </Box>
          </Box>
        )}

      {/* Search Bar */}
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ maxWidth: 500 }}
        />
      </Box>

      {/* Category Buttons - Sticky */}
      <Box 
        sx={{ 
          position: 'sticky',
          top: { xs: '56px', sm: '64px' }, // Account for AppBar height (56px on mobile, 64px on desktop)
          zIndex: 99, // Lower than AppBar (which is typically 1100)
          backgroundColor: colors.background,
          pt: 1,
          pb: 1,
          mb: 2,
          borderBottom: `1px solid rgba(0, 0, 0, 0.1)`
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, 1fr)',
              sm: 'repeat(3, 1fr)',
              md: 'repeat(4, 1fr)',
              lg: 'repeat(5, 1fr)',
              xl: 'repeat(6, 1fr)'
            },
            gap: 1,
            width: '100%'
          }}
        >
          <Button
            variant={selectedCategory === 0 ? 'contained' : 'outlined'}
            onClick={() => handleCategoryChange(null, 0)}
            sx={{
              py: 0.75,
              fontSize: '0.75rem',
              fontWeight: selectedCategory === 0 ? 600 : 400,
              textTransform: 'none',
              borderRadius: 1.5,
              minHeight: '36px',
              color: '#000000',
              '&.MuiButton-contained': {
                color: '#000000',
                backgroundColor: 'transparent',
                boxShadow: 'none',
                border: '2px solid rgba(0, 0, 0, 0.5)',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)'
                }
              },
              '&.MuiButton-outlined': {
                color: '#000000',
                borderColor: 'rgba(0, 0, 0, 0.23)'
              }
            }}
          >
            All
          </Button>
          <Button
            variant={selectedCategory === -1 ? 'contained' : 'outlined'}
            onClick={() => handleCategoryChange(null, -1)}
            startIcon={<Star sx={{ fontSize: '0.75rem' }} />}
            sx={{
              py: 0.75,
              fontSize: '0.75rem',
              fontWeight: selectedCategory === -1 ? 600 : 400,
              textTransform: 'none',
              borderRadius: 1.5,
              minHeight: '36px',
              color: '#000000',
              '&.MuiButton-contained': {
                color: '#000000',
                backgroundColor: 'transparent',
                boxShadow: 'none',
                border: '2px solid rgba(0, 0, 0, 0.5)',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)'
                }
              },
              '&.MuiButton-outlined': {
                color: '#000000',
                borderColor: 'rgba(0, 0, 0, 0.23)'
              }
            }}
          >
            Popular
          </Button>
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? 'contained' : 'outlined'}
              onClick={() => handleCategoryChange(null, category.id)}
              sx={{
                py: 0.75,
                fontSize: '0.75rem',
                fontWeight: selectedCategory === category.id ? 600 : 400,
                textTransform: 'none',
                borderRadius: 1.5,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minHeight: '36px',
                color: '#000000',
                '&.MuiButton-contained': {
                  color: '#000000',
                  backgroundColor: 'transparent',
                  boxShadow: 'none',
                  border: '2px solid rgba(0, 0, 0, 0.5)',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                  }
                },
                '&.MuiButton-outlined': {
                  color: '#000000',
                  borderColor: 'rgba(0, 0, 0, 0.23)'
                }
              }}
            >
              {category.name}
            </Button>
          ))}
        </Box>

        {/* Subcategory Chips - Show when a category is selected */}
        {selectedCategory > 0 && subcategories.length > 0 && (
          <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Chip
              label="All"
              onClick={() => handleSubcategoryChange(0)}
              color={selectedSubcategory === 0 ? 'primary' : 'default'}
              variant={selectedSubcategory === 0 ? 'filled' : 'outlined'}
              sx={{ cursor: 'pointer' }}
            />
            {subcategories.map((subcategory) => (
              <Chip
                key={subcategory.id}
                label={subcategory.name}
                onClick={() => handleSubcategoryChange(subcategory.id)}
                color={selectedSubcategory === subcategory.id ? 'primary' : 'default'}
                variant={selectedSubcategory === subcategory.id ? 'filled' : 'outlined'}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* All Drinks */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" sx={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 1 }}>
            {selectedCategory === -1 ? (
              <>
                <Star color="secondary" />
                Popular
              </>
            ) : selectedCategory === 0 ? (
              'ALL'
            ) : (
              <>
                {categories.find(c => c.id === selectedCategory)?.name}
                {selectedSubcategory > 0 && (
                  <span style={{ color: '#666', fontSize: '0.9rem' }}>
                    {' / '}
                    {subcategories.find(s => s.id === selectedSubcategory)?.name}
                  </span>
                )}
              </>
            )}
          </Typography>
          
          {/* Results Summary */}
          {filteredDrinks.length > 0 && (
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {filteredDrinks.filter(d => d.isAvailable).length} available
              </Typography>
              {filteredDrinks.filter(d => !d.isAvailable).length > 0 && (
                <Typography variant="body2" color="error" sx={{ fontWeight: 'bold' }}>
                  {filteredDrinks.filter(d => !d.isAvailable).length} out of stock
                </Typography>
              )}
            </Box>
          )}
        </Box>
        
        {loading ? (
          <Typography textAlign="center" sx={{ fontSize: '0.9rem' }}>Loading drinks...</Typography>
        ) : filteredDrinks.length === 0 ? (
          <Typography textAlign="center" color="text.secondary" sx={{ fontSize: '0.9rem' }}>
            No drinks found matching your criteria.
          </Typography>
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
              width: '100%'
            }}>
              {displayedDrinks.map((drink) => (
                <DrinkCard key={drink.id} drink={drink} />
              ))}
            </Box>
            
            {/* Loading indicator for lazy loading */}
            {isLoadingMore && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 3 }}>
                <CircularProgress size={40} />
              </Box>
            )}
            
            {/* Show message when all items are loaded */}
            {!isLoadingMore && itemsToShow >= filteredDrinks.length && filteredDrinks.length > itemsPerLoad && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  All {filteredDrinks.length} items loaded
                </Typography>
              </Box>
            )}
          </>
        )}
      </Box>
      </Container>
    </Box>
  );
};

export default LocationDetails;
