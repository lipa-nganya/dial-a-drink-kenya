/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  TextField,
  InputAdornment,
  Button,
  Chip,
  CircularProgress,
} from '@mui/material';
import { Search, Star } from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import DrinkCard from '../components/DrinkCard';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const Menu = () => {
  const { colors } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [drinks, setDrinks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [selectedSubcategory, setSelectedSubcategory] = useState(0);
  const [filteredDrinks, setFilteredDrinks] = useState([]);
  const [displayedDrinks, setDisplayedDrinks] = useState([]);
  const [categoriesCollapsed, setCategoriesCollapsed] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const itemsPerLoad = 20; // Number of items to display each time
  const [itemsToShow, setItemsToShow] = useState(itemsPerLoad);

  useEffect(() => {
    fetchData();
  }, []);

  // Scroll detection: fix search only, collapse categories (categories hide after 200px scroll)
  // Updated: 2026-02-05 - Ensure categories menu hiding works correctly
  useEffect(() => {
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY || window.pageYOffset;
          const shouldFixSearch = scrollY > 100;
          const shouldCollapse = scrollY > 200; // Categories disappear after 200px scroll
          
          setIsScrolled(shouldFixSearch);
          setCategoriesCollapsed(shouldCollapse);

          // Infinite scroll: Load more when near bottom
          const windowHeight = window.innerHeight;
          const documentHeight = document.documentElement.scrollHeight;
          const scrollTop = window.scrollY || document.documentElement.scrollTop;
          
          // Load more when user is within 400px of bottom
          if (scrollTop + windowHeight >= documentHeight - 400 && !isLoadingMore) {
            if (itemsToShow < filteredDrinks.length) {
              setIsLoadingMore(true);
              // Small delay for smooth loading animation
              setTimeout(() => {
                setItemsToShow(prev => Math.min(prev + itemsPerLoad, filteredDrinks.length));
                setIsLoadingMore(false);
              }, 150);
            }
          }
          
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [filteredDrinks.length, itemsToShow, isLoadingMore]);

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

    // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    filterDrinks();
  }, [drinks, searchTerm, selectedCategory, selectedSubcategory]);

  // Reset displayed items when filters change
  useEffect(() => {
    setItemsToShow(itemsPerLoad);
    // Scroll to top smoothly when category/search changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedCategory, selectedSubcategory, searchTerm]);

  // Update displayed drinks when filtered drinks or itemsToShow changes
  useEffect(() => {
    setDisplayedDrinks(filteredDrinks.slice(0, itemsToShow));
  }, [filteredDrinks, itemsToShow]);

  const fetchData = async () => {
    try {
      const [drinksResponse, categoriesResponse] = await Promise.all([
        api.get('/drinks'),
        api.get('/categories')
      ]);
      
      // Defensive: Ensure drinks is always an array
      const drinksArray = Array.isArray(drinksResponse.data) ? drinksResponse.data : [];
      setDrinks(drinksArray);
      
      // Defensive: Ensure categories is always an array
      let categoriesArray = [];
      if (categoriesResponse.data) {
        if (Array.isArray(categoriesResponse.data)) {
          categoriesArray = categoriesResponse.data;
        } else if (categoriesResponse.data.data && Array.isArray(categoriesResponse.data.data)) {
          categoriesArray = categoriesResponse.data.data;
        }
      }
      if (!Array.isArray(categoriesArray)) {
        console.warn('Categories response is not an array:', categoriesResponse.data);
        categoriesArray = [];
      }
      setCategories(categoriesArray);
    } catch (error) {
      console.error('Error fetching data:', error);
      setDrinks([]);
      setCategories([]);
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

  return (
    <Box sx={{ backgroundColor: colors.background, minHeight: '100vh', overflow: 'visible', position: 'relative' }}>
      <Container maxWidth="lg" sx={{ py: 4, overflow: 'visible', position: 'relative' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Our Menu
        </Typography>

      {/* Search Bar - fixed when scrolling; only this stays visible */}
      <Box
        sx={{
          mb: 2,
          maxWidth: 500,
          position: isScrolled ? 'fixed' : 'relative',
          top: isScrolled ? { xs: '56px', sm: '64px' } : 'auto',
          left: isScrolled ? '50%' : 'auto',
          transform: isScrolled ? 'translateX(-50%)' : 'none',
          zIndex: isScrolled ? 100 : 'auto',
          width: isScrolled ? 'calc(100% - 32px)' : '100%',
          backgroundColor: isScrolled ? colors.background : 'transparent',
          boxShadow: isScrolled ? '0 2px 8px rgba(0, 0, 0, 0.1)' : 'none',
          borderRadius: isScrolled ? 2 : 0,
          transition: 'all 0.2s ease',
        }}
      >
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
        />
      </Box>

      {/* Spacer to prevent content jump when search is fixed */}
      {isScrolled && <Box sx={{ height: 56, mb: 2 }} />}

      {/* Category Buttons - disappear when user scrolls (not sticky) */}
      <Box 
        sx={{ 
          position: 'relative',
          pt: categoriesCollapsed ? 0 : 1,
          pb: categoriesCollapsed ? 0 : 1,
          mb: categoriesCollapsed ? 0 : 2,
          borderBottom: categoriesCollapsed ? 'none' : `1px solid rgba(0, 0, 0, 0.1)`,
          transition: 'opacity 0.2s ease, max-height 0.2s ease',
          opacity: categoriesCollapsed ? 0 : 1,
          maxHeight: categoriesCollapsed ? 0 : 'none',
          overflow: 'hidden',
          visibility: categoriesCollapsed ? 'hidden' : 'visible',
          pointerEvents: categoriesCollapsed ? 'none' : 'auto'
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
          <Box sx={{ 
            mt: 2, 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: 1
          }}>
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
                xs: 'repeat(2, 1fr)',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
                lg: 'repeat(4, 1fr)'
              },
              gap: { xs: 1, sm: 2 },
              width: '100%'
            }}>
              {displayedDrinks.map((drink) => (
                <DrinkCard key={drink.id} drink={drink} />
              ))}
            </Box>
            
            {/* Loading indicator for infinite scroll */}
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

export default Menu;

