import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Box,
  Button,
  TextField,
  InputAdornment
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useNavigate } from 'react-router-dom';
import CategoryCard from '../components/CategoryCard';
import DrinkCard from '../components/DrinkCard';
import CountdownTimer from '../components/CountdownTimer';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';

const Home = () => {
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [drinks, setDrinks] = useState([]);
  const [drinksLoading, setDrinksLoading] = useState(true);
  const [heroImage, setHeroImage] = useState('/assets/images/ads/hero-ad.png');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const { colors, isDarkMode } = useTheme();

  useEffect(() => {
    fetchCategories();
    fetchHeroImage();
    fetchDrinks();
  }, []);

  const getImageUrl = (imagePath) => {
    if (!imagePath) return '/assets/images/ads/hero-ad.png';
    
    // If it's already a full URL (http/https), return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      // If it's localhost, replace with backend URL
      if (imagePath.includes('localhost:5001')) {
        const isHosted = window.location.hostname.includes('onrender.com') || 
                        window.location.hostname.includes('run.app');
        const backendUrl = isHosted 
          ? 'https://dialadrink-backend-910510650031.us-central1.run.app'
          : 'http://localhost:5001';
        return imagePath.replace('http://localhost:5001', backendUrl);
      }
      return imagePath;
    }
    
    // For relative paths, construct the full URL
    const isHosted = window.location.hostname.includes('onrender.com') ||
                    window.location.hostname.includes('run.app');
    const backendUrl = isHosted 
      ? 'https://dialadrink-backend-910510650031.us-central1.run.app'
      : 'http://localhost:5001';
    
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
      console.log('Fetching categories from:', process.env.REACT_APP_API_URL || 'http://localhost:5001/api');
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

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredDrinks = normalizedSearch
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

  return (
    <Box sx={{ backgroundColor: colors.background, minHeight: '100vh' }}>
      {/* Hero Section */}
      <Box
        sx={{
          backgroundColor: colors.background,
          color: colors.textPrimary,
          textAlign: 'center'
        }}
      >
        <Container maxWidth="lg">
          {/* Countdown Timer Above Image */}
          <CountdownTimer />
          
          {/* Advertising Image - Full Size */}
          <Box
            sx={{
              mb: 4,
              width: '100%',
              display: 'flex',
              justifyContent: 'center'
            }}
          >
            <img
              src={heroImage}
              alt="Special Offer - Premium Drinks"
              style={{
                maxWidth: '100%',
                height: 'auto',
                display: 'block'
              }}
              onError={(e) => {
                // Fallback to default if image doesn't exist
                e.target.src = '/assets/images/ads/hero-ad.png';
              }}
            />
          </Box>
          <Button
            variant="contained"
            size="large"
            sx={{
              backgroundColor: '#00E0B8',
              color: '#0D0D0D',
              px: { xs: 3, sm: 4 },
              py: { xs: 1.5, sm: 2 },
              fontSize: { xs: '0.9rem', sm: '1rem' },
              fontWeight: 600,
              mb: 4,
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

          {/* Search Bar */}
          <Box
            sx={{
              mb: 4,
              maxWidth: 480,
              mx: 'auto'
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
                backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF',
                borderRadius: 2,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
            />
          </Box>

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

          {/* Categories Section */}
          <Box sx={{ py: { xs: 4, sm: 6 } }}>
            <Typography 
              variant="h4" 
              component="h2" 
              textAlign="center" 
              gutterBottom
              sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}
            >
              Browse by Category
            </Typography>
            <Grid 
              container 
              spacing={{ xs: 2, sm: 3, md: 3 }}
              sx={{ 
                mt: 2
              }}
            >
              {categoriesLoading ? (
                <Grid item xs={12}>
                  <Typography textAlign="center">Loading categories...</Typography>
                </Grid>
              ) : categories.length === 0 ? (
                <Grid item xs={12}>
                  <Typography textAlign="center" color="error">
                    No categories found. Check console for errors.
                  </Typography>
                </Grid>
              ) : (
                categories.map((category) => (
                  <Grid 
                    size={{ xs: 12, sm: 6, md: 3, lg: 3 }}
                    key={category.id}
                    sx={{
                      display: 'flex'
                    }}
                  >
                    <CategoryCard category={category} />
                  </Grid>
                ))
              )}
            </Grid>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default Home;

