import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  Typography,
  Box,
  TextField,
  InputAdornment,
  Button,
  Chip,
  Pagination
} from '@mui/material';
import { Search, Star, ExpandMore, ExpandLess } from '@mui/icons-material';
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
  const [currentPage, setCurrentPage] = useState(1);
  const [categoriesExpanded, setCategoriesExpanded] = useState(true);
  const isScrolledRef = useRef(false);
  const manuallyExpandedRef = useRef(false);
  const manualExpandTimeRef = useRef(0);
  const scrollTimeoutRef = useRef(null);
  
  const itemsPerPage = 16; // 4 rows × 4 columns

  useEffect(() => {
    fetchData();
  }, []);

  // Handle scroll detection for mobile category collapse
  useEffect(() => {
    let ticking = false;
    let lastScrollY = 0;
    
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollPosition = window.scrollY || window.pageYOffset;
          const isMobile = window.innerWidth < 600;
          
          lastScrollY = scrollPosition;
          
          // Only apply on mobile
          if (isMobile) {
            // If manually expanded, completely ignore scroll events - keep categories visible
            if (manuallyExpandedRef.current) {
              // Clear any pending collapse timeouts
              if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
                scrollTimeoutRef.current = null;
              }
              ticking = false;
              return; // Exit immediately - don't process scroll, keep categories visible
            }
            
            // Clear any pending collapse timeout if not manually expanded
            if (scrollTimeoutRef.current) {
              clearTimeout(scrollTimeoutRef.current);
              scrollTimeoutRef.current = null;
            }
            
            // Auto-collapse when scrolling down past 50px (only if NOT manually expanded)
            if (scrollPosition > 50 && !manuallyExpandedRef.current) {
              setCategoriesExpanded(prev => {
                if (prev) {
                  isScrolledRef.current = true;
                  return false;
                }
                return prev;
              });
            } 
            // Expand when scrolling back to top (only if NOT manually expanded)
            else if (scrollPosition <= 50 && !manuallyExpandedRef.current) {
              setCategoriesExpanded(prev => {
                if (!prev && isScrolledRef.current) {
                  isScrolledRef.current = false;
                  return true;
                }
                return prev;
              });
            }
          }
          
          ticking = false;
        });
        ticking = true;
      }
    };

    // Also handle resize to reset on desktop
    const handleResize = () => {
      if (window.innerWidth >= 600) {
        setCategoriesExpanded(true);
        isScrolledRef.current = false;
        manuallyExpandedRef.current = false;
        manualExpandTimeRef.current = 0;
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []); // Empty deps - use refs for state

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
  }, [drinks, searchTerm, selectedCategory, selectedSubcategory]);

  // Reset pagination when category or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchTerm]);

  const fetchData = async () => {
    try {
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

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // Calculate pagination for filtered drinks
  const totalPages = Math.ceil(filteredDrinks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDrinks = filteredDrinks.slice(startIndex, endIndex);

  return (
    <Box sx={{ backgroundColor: colors.background, minHeight: '100vh' }}>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Our Menu
        </Typography>

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
        {/* Mobile Toggle Button - Only show on mobile */}
        <Box
          sx={{
            display: { xs: 'flex', sm: 'none' },
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: categoriesExpanded ? 1 : 0,
            transition: 'margin 0.3s ease-in-out'
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, color: colors.textPrimary }}>
            Categories
          </Typography>
          <Button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const scrollPosition = window.scrollY || window.pageYOffset;
              const newExpandedState = !categoriesExpanded;
              
              // Clear any pending scroll timeout before toggling
              if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
                scrollTimeoutRef.current = null;
              }
              
              // Update refs and state
              if (newExpandedState) {
                // Expanding: mark as manually expanded if scrolled, so it won't auto-collapse
                if (scrollPosition > 50) {
                  manuallyExpandedRef.current = true;
                } else {
                  // At top, reset manual expand flag
                  manuallyExpandedRef.current = false;
                  isScrolledRef.current = false;
                }
                setCategoriesExpanded(true);
              } else {
                // Collapsing: user wants to hide, clear manual expand flag
                manuallyExpandedRef.current = false;
                manualExpandTimeRef.current = 0;
                setCategoriesExpanded(false);
              }
            }}
            sx={{
              minWidth: 'auto',
              px: 1,
              py: 0.5,
              color: colors.textPrimary
            }}
          >
            {categoriesExpanded ? <ExpandLess /> : <ExpandMore />}
          </Button>
        </Box>

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
            width: '100%',
            maxHeight: { 
              xs: categoriesExpanded ? '1000px' : '0px', 
              sm: 'none' 
            },
            overflow: { 
              xs: 'hidden', 
              sm: 'visible' 
            },
            opacity: { 
              xs: categoriesExpanded ? 1 : 0, 
              sm: 1 
            },
            transition: { 
              xs: 'max-height 0.3s ease-in-out, opacity 0.3s ease-in-out, transform 0.3s ease-in-out',
              sm: 'none'
            },
            transform: { 
              xs: categoriesExpanded ? 'translateY(0)' : 'translateY(-10px)', 
              sm: 'translateY(0)' 
            }
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
            gap: 1,
            maxHeight: { xs: categoriesExpanded ? '200px' : '0px', sm: 'none' },
            overflow: { xs: 'hidden', sm: 'visible' },
            opacity: { xs: categoriesExpanded ? 1 : 0, sm: 1 },
            transition: 'max-height 0.3s ease-in-out, opacity 0.3s ease-in-out',
            transform: { xs: categoriesExpanded ? 'translateY(0)' : 'translateY(-10px)', sm: 'translateY(0)' },
            transitionProperty: { xs: 'max-height, opacity, transform', sm: 'none' }
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
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
                lg: 'repeat(4, 1fr)'
              },
              gap: 2,
              width: '100%'
            }}>
              {paginatedDrinks.map((drink) => (
                <DrinkCard key={drink.id} drink={drink} />
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
                />
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

