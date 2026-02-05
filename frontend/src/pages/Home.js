/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Box,
  Button,
  TextField,
  InputAdornment,
  Chip
} from '@mui/material';
import { Search as SearchIcon, Star } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import DrinkCard from '../components/DrinkCard';
import CountdownTimer from '../components/CountdownTimer';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';
import { getBackendUrl } from '../utils/backendUrl';

const Home = () => {
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [drinks, setDrinks] = useState([]);
  const [drinksLoading, setDrinksLoading] = useState(true);
  const [heroImage, setHeroImage] = useState('/assets/images/ads/hero-ad.png');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [subcategories, setSubcategories] = useState([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState(0);
  const [brandFocusDrinks, setBrandFocusDrinks] = useState([]);
  const [brandFocusLoading, setBrandFocusLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [categoriesCollapsed, setCategoriesCollapsed] = useState(false);
  const navigate = useNavigate();
  const { colors } = useTheme();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchCategories();
    fetchHeroImage();
    fetchDrinks();
    fetchBrandFocusDrinks();
  }, []);

  // Scroll detection for collapsing categories and fixing search (throttled to avoid stutter)
  useEffect(() => {
    let rafId = null;
    let lastScrollY = -1;
    let lastShouldFix = null;
    let lastShouldCollapse = null;

    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      if (scrollY === lastScrollY) return;
      lastScrollY = scrollY;
      const shouldCollapse = scrollY > 200;
      const shouldFixSearch = scrollY > 100;

      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (lastShouldFix !== shouldFixSearch) {
          lastShouldFix = shouldFixSearch;
          setIsScrolled(shouldFixSearch);
        }
        if (lastShouldCollapse !== shouldCollapse) {
          lastShouldCollapse = shouldCollapse;
          setCategoriesCollapsed(shouldCollapse);
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  // Fetch subcategories when category changes
  useEffect(() => {
    if (selectedCategory > 0) {
      fetchSubcategories(selectedCategory);
      setSelectedSubcategory(0);
    } else {
      setSubcategories([]);
      setSelectedSubcategory(0);
    }
  }, [selectedCategory]);

  const fetchSubcategories = async (categoryId) => {
    try {
      const response = await api.get(`/subcategories?categoryId=${categoryId}`);
      setSubcategories(response.data);
    } catch (error) {
      console.error('Error fetching subcategories:', error);
      setSubcategories([]);
    }
  };

  const handleCategoryChange = (categoryId) => {
    setSelectedCategory(categoryId);
    navigate(categoryId > 0 ? `/menu?category=${categoryId}` : '/menu');
  };

  const handleSubcategoryChange = (subcategoryId) => {
    setSelectedSubcategory(subcategoryId);
    navigate(`/menu?category=${selectedCategory}${subcategoryId > 0 ? `&subcategory=${subcategoryId}` : ''}`);
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return '/assets/images/ads/hero-ad.png';
    
    // If it's already a full URL (http/https), return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      // If it's localhost, replace with backend URL
      if (imagePath.includes('localhost:5001')) {
        const backendUrl = getBackendUrl();
        return imagePath.replace('http://localhost:5001', backendUrl);
      }
      return imagePath;
    }
    
    // For relative paths, construct the full URL using backend URL utility
    const backendUrl = getBackendUrl();
    return `${backendUrl}${imagePath}`;
  };

  const fetchHeroImage = async () => {
    try {
      const response = await api.get('/settings/heroImage');
      if (response.data && response.data.value) {
        const imageUrl = getImageUrl(response.data.value);
        setHeroImage(imageUrl);
      }
    } catch (error) {
      console.error('Error fetching hero image:', error);
      // Keep default image if fetch fails
    }
  };

  const fetchCategories = async () => {
    try {
      // Note: API URL is resolved dynamically in api.js interceptor
      const response = await api.get('/categories');
      console.log('Categories response:', response.data);
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
      console.error('Error details:', error.response?.data || error.message);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const fetchDrinks = async () => {
    try {
      const response = await api.get('/drinks');
      setDrinks(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching drinks:', error);
    } finally {
      setDrinksLoading(false);
    }
  };

  const fetchBrandFocusDrinks = async () => {
    try {
      setBrandFocusLoading(true);
      // Get the selected brand focus from settings
      const brandFocusResponse = await api.get('/settings/brandFocus');
      const brandFocusId = brandFocusResponse.data?.value;
      
      if (brandFocusId) {
        // Fetch drinks with brand focus enabled for the selected brand
        const drinksResponse = await api.get('/drinks');
        const allDrinks = Array.isArray(drinksResponse.data) ? drinksResponse.data : [];
        const brandFocusIdNum = parseInt(brandFocusId);
        const filtered = allDrinks.filter(drink => {
          // Check if drink has brand focus enabled
          if (drink.isBrandFocus !== true) return false;
          
          // Check brand match - use brandId as primary check, brand.id as fallback
          const drinkBrandId = drink.brandId || (drink.brand && drink.brand.id);
          return drinkBrandId === brandFocusIdNum;
        });
        console.log('Brand Focus - Setting ID:', brandFocusIdNum, 'Filtered drinks:', filtered.length, filtered.map(d => ({ id: d.id, name: d.name, brandId: d.brandId })));
        setBrandFocusDrinks(filtered);
      } else {
        setBrandFocusDrinks([]);
      }
    } catch (error) {
      console.error('Error fetching brand focus drinks:', error);
      setBrandFocusDrinks([]);
    } finally {
      setBrandFocusLoading(false);
    }
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  let filteredDrinks = normalizedSearch
    ? drinks.filter((drink) => {
        if (!drink) return false;
        const name = typeof drink.name === 'string' ? drink.name.toLowerCase() : '';
        const description = typeof drink.description === 'string' ? drink.description.toLowerCase() : '';
        const sku = typeof drink.sku === 'string' ? drink.sku.toLowerCase() : '';
        return (
          name.includes(normalizedSearch) ||
          description.includes(normalizedSearch) ||
          sku.includes(normalizedSearch)
        );
      })
    : [];
  
  // Sort: available items first, then by name
  filteredDrinks.sort((a, b) => {
    // First sort by availability (available items first)
    if (a.isAvailable !== b.isAvailable) {
      return b.isAvailable ? 1 : -1; // true (available) comes before false (out of stock)
    }
    // Then sort by name alphabetically
    const nameA = (a.name || '').toLowerCase();
    const nameB = (b.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  return (
    <Box
      sx={{
        backgroundColor: colors.background,
        minHeight: '100vh',
        overflow: 'visible',
        overflowX: 'hidden'
      }}
    >
      {/* Hero Section */}
      <Box
        sx={{
          backgroundColor: colors.background,
          color: colors.textPrimary,
          textAlign: 'center',
          overflow: 'visible'
        }}
      >
        <Container maxWidth="lg">
          {/* Countdown Timer Above Image */}
          <CountdownTimer />
          
          {/* Advertising Image - Reduced Size */}
          <Box
            sx={{
              mt: 4,
              mb: 3,
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              maxHeight: '300px',
              overflow: 'hidden'
            }}
          >
            <img
              src={heroImage}
              alt="Special Offer - Premium Drinks"
              style={{
                maxWidth: '100%',
                maxHeight: '300px',
                height: 'auto',
                display: 'block',
                objectFit: 'contain'
              }}
              onError={(e) => {
                // Fallback to default if image doesn't exist
                e.target.src = '/assets/images/ads/hero-ad.png';
              }}
            />
          </Box>
          <Button
            variant="contained"
            size="medium"
            sx={{
              backgroundColor: '#00E0B8',
              color: '#0D0D0D',
              px: { xs: 2.5, sm: 3 },
              py: { xs: 1, sm: 1.25 },
              fontSize: { xs: '0.8rem', sm: '0.9rem' },
              fontWeight: 600,
              mb: 2,
              '&:hover': {
                backgroundColor: '#00C4A3',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(0, 224, 184, 0.3)'
              }
            }}
            onClick={() => navigate('/offers')}
          >
            Limited Offers
          </Button>

          {/* Search Bar - Fixed when scrolling */}
          <Box
            sx={{
              mb: 4,
              maxWidth: 480,
              mx: 'auto',
              position: isScrolled ? 'fixed' : 'relative',
              top: isScrolled ? { xs: '56px', sm: '64px' } : 'auto',
              left: isScrolled ? '50%' : 'auto',
              transform: isScrolled ? 'translateX(-50%)' : 'none',
              zIndex: isScrolled ? 100 : 'auto',
              width: isScrolled ? '90%' : '100%',
              backgroundColor: isScrolled ? '#FFFFFF' : 'transparent',
              boxShadow: isScrolled ? '0 2px 8px rgba(0, 0, 0, 0.1)' : 'none',
              borderRadius: isScrolled ? 2 : 0,
              transition: 'all 0.3s ease-in-out'
            }}
          >
            <TextField
              fullWidth
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search drinks"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                )
              }}
              variant="outlined"
              size="medium"
              sx={{
                backgroundColor: '#FFFFFF',
                borderRadius: 2,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
            />
          </Box>

          {/* Spacer to prevent content jump when search is fixed */}
          {isScrolled && (
            <Box sx={{ height: '80px', mb: 2 }} />
          )}

          {/* Search Results */}
          {normalizedSearch && (
            <Box sx={{ mb: 6 }}>
              <Typography
                variant="h5"
                component="h3"
                sx={{ mb: 2, textAlign: 'center', fontSize: { xs: '1.5rem', sm: '1.75rem' } }}
              >
                Search Results
              </Typography>

              {drinksLoading ? (
                <Typography textAlign="center">Searching inventory...</Typography>
              ) : filteredDrinks.length === 0 ? (
                <Typography textAlign="center">
                  No drinks found for "{searchTerm}". Try a different search.
                </Typography>
              ) : (
                <Grid
                  container
                  spacing={{ xs: 2, sm: 3 }}
                  sx={{
                    justifyContent: { xs: 'center', md: 'flex-start' }
                  }}
                >
                  {filteredDrinks.slice(0, 8).map((drink) => (
                    <Grid
                      item
                      xs={12}
                      sm={6}
                      md={3}
                      key={drink.id}
                      sx={{ display: 'flex' }}
                    >
                      <DrinkCard drink={drink} />
                    </Grid>
                  ))}
                </Grid>
              )}

              {filteredDrinks.length > 8 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/menu')}
                  >
                    View all results
                  </Button>
                </Box>
              )}
            </Box>
          )}

          {/* Categories Section - Hidden on scroll (no transform when collapsed to avoid scroll lock) */}
          <Box 
            sx={{ 
              position: 'sticky',
              top: isScrolled ? { xs: '120px', sm: '128px' } : { xs: '56px', sm: '64px' },
              zIndex: 99,
              backgroundColor: colors.background,
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
              {categoriesLoading ? (
                <Typography textAlign="center" sx={{ gridColumn: '1 / -1' }}>Loading categories...</Typography>
              ) : categories.length === 0 ? (
                <Typography textAlign="center" color="error" sx={{ gridColumn: '1 / -1' }}>
                  No categories found.
                </Typography>
              ) : (
                <>
                  <Button
                    variant={selectedCategory === 0 ? 'contained' : 'outlined'}
                    onClick={() => handleCategoryChange(0)}
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
                    onClick={() => handleCategoryChange(-1)}
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
                      onClick={() => handleCategoryChange(category.id)}
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
                          color: '#000000'
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
                </>
              )}
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

          {/* Popular Drinks Section */}
          <Box sx={{ mt: 6, mb: 4 }}>
            <Typography 
              variant="h4" 
              component="h2" 
              textAlign="center" 
              gutterBottom
              sx={{ 
                fontSize: { xs: '1.75rem', sm: '2.125rem' },
                mb: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1
              }}
            >
              <Star sx={{ color: '#FFD700' }} />
              Popular Drinks
            </Typography>
            
            {drinksLoading ? (
              <Typography textAlign="center">Loading popular drinks...</Typography>
            ) : (
              (() => {
                let popularDrinks = drinks.filter(drink => drink && drink.isPopular);
                
                // Sort: available items first, then by name
                popularDrinks.sort((a, b) => {
                  // First sort by availability (available items first)
                  if (a.isAvailable !== b.isAvailable) {
                    return b.isAvailable ? 1 : -1; // true (available) comes before false (out of stock)
                  }
                  // Then sort by name alphabetically
                  const nameA = (a.name || '').toLowerCase();
                  const nameB = (b.name || '').toLowerCase();
                  return nameA.localeCompare(nameB);
                });
                
                if (popularDrinks.length === 0) {
                  return (
                    <Typography textAlign="center" color="text.secondary">
                      No popular drinks available at the moment.
                    </Typography>
                  );
                }
                
                return (
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
                    {popularDrinks.slice(0, 8).map((drink) => (
                      <DrinkCard key={drink.id} drink={drink} />
                    ))}
                  </Box>
                );
              })()
            )}
          </Box>

          {/* Brand Focus Section */}
          {brandFocusDrinks.length > 0 && (
            <Box sx={{ mt: 6, mb: 4 }}>
              <Typography 
                variant="h4" 
                component="h2" 
                textAlign="center" 
                gutterBottom
                sx={{ 
                  fontSize: { xs: '1.75rem', sm: '2.125rem' },
                  mb: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1
                }}
              >
                <Star sx={{ color: '#FFA500' }} />
                Brand Focus
              </Typography>
              
              {brandFocusLoading ? (
                <Typography textAlign="center">Loading brand focus items...</Typography>
              ) : (
                (() => {
                  // Sort: available items first, then by name
                  const sortedBrandFocusDrinks = [...brandFocusDrinks].sort((a, b) => {
                    // First sort by availability (available items first)
                    if (a.isAvailable !== b.isAvailable) {
                      return b.isAvailable ? 1 : -1; // true (available) comes before false (out of stock)
                    }
                    // Then sort by name alphabetically
                    const nameA = (a.name || '').toLowerCase();
                    const nameB = (b.name || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                  });
                  
                  return (
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
                      {sortedBrandFocusDrinks.slice(0, 8).map((drink) => (
                        <DrinkCard key={drink.id} drink={drink} />
                      ))}
                    </Box>
                  );
                })()
              )}
            </Box>
          )}
        </Container>
      </Box>
    </Box>
  );
};

export default Home;

