import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Box,
  Button
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import CategoryCard from '../components/CategoryCard';
import CountdownTimer from '../components/CountdownTimer';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';

const Home = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [heroImage, setHeroImage] = useState('/assets/images/ads/hero-ad.png');
  const navigate = useNavigate();
  const { colors, isDarkMode } = useTheme();

  useEffect(() => {
    fetchCategories();
    fetchHeroImage();
  }, []);

  const fetchHeroImage = async () => {
    try {
      const response = await api.get('/settings/heroImage');
      if (response.data && response.data.value) {
        setHeroImage(response.data.value);
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
      setLoading(false);
    }
  };

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
              {loading ? (
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

