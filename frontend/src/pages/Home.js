import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Box,
  Paper,
  TextField,
  InputAdornment,
  Button
} from '@mui/material';
import { Search, LocalBar, Speed, Security, Support } from '@mui/icons-material';
import CategoryCard from '../components/CategoryCard';
import { api } from '../services/api';

const Home = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

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

  const features = [
    {
      icon: <Speed />,
      title: 'Fast Delivery',
      description: 'Get your drinks delivered within 30 minutes'
    },
    {
      icon: <Security />,
      title: 'Secure Payment',
      description: 'Safe and secure payment methods'
    },
    {
      icon: <Support />,
      title: '24/7 Support',
      description: 'Round the clock customer support'
    }
  ];

  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%)',
          color: 'white',
          py: 8,
          textAlign: 'center'
        }}
      >
        <Container maxWidth="md">
          <LocalBar sx={{ fontSize: { xs: 40, sm: 60 }, mb: 2 }} />
          <Typography 
            variant="h2" 
            component="h1" 
            gutterBottom
            sx={{ 
              fontSize: { xs: '2rem', sm: '3rem', md: '3.75rem' },
              lineHeight: 1.2
            }}
          >
            Dial A Drink Kenya
          </Typography>
          <Typography 
            variant="h5" 
            sx={{ 
              mb: 4, 
              opacity: 0.9,
              fontSize: { xs: '1.1rem', sm: '1.5rem' }
            }}
          >
            Premium drinks delivered to your doorstep
          </Typography>
          <Button
            variant="contained"
            size="large"
            sx={{
              backgroundColor: 'white',
              color: '#FF6B6B',
              px: { xs: 3, sm: 4 },
              py: { xs: 1.5, sm: 2 },
              fontSize: { xs: '0.9rem', sm: '1rem' },
              '&:hover': {
                backgroundColor: '#f5f5f5'
              }
            }}
            href="/menu"
          >
            Browse Menu
          </Button>
        </Container>
      </Box>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ py: { xs: 4, sm: 6 } }}>
        <Typography 
          variant="h4" 
          component="h2" 
          textAlign="center" 
          gutterBottom
          sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}
        >
          Why Choose Us?
        </Typography>
        <Grid container spacing={{ xs: 2, sm: 4 }} sx={{ mt: 2 }}>
          {features.map((feature, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Paper
                sx={{
                  p: { xs: 2, sm: 3 },
                  textAlign: 'center',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}
              >
                <Box sx={{ color: '#FF6B6B', mb: 2, fontSize: { xs: 32, sm: 40 } }}>
                  {feature.icon}
                </Box>
                <Typography 
                  variant="h6" 
                  gutterBottom
                  sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
                >
                  {feature.title}
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                >
                  {feature.description}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Categories Section */}
      <Box sx={{ backgroundColor: '#F8F9FA', py: { xs: 4, sm: 6 } }}>
        <Container maxWidth="lg">
          <Typography 
            variant="h4" 
            component="h2" 
            textAlign="center" 
            gutterBottom
            sx={{ fontSize: { xs: '1.75rem', sm: '2.125rem' } }}
          >
            Browse by Category
          </Typography>
          <Grid container spacing={{ xs: 2, sm: 4 }} sx={{ mt: 2 }}>
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
              <>
                <Grid item xs={12}>
                  <Typography textAlign="center" color="success.main">
                    Found {categories.length} categories
                  </Typography>
                </Grid>
                {categories.map((category) => (
                  <Grid item xs={12} sm={6} md={4} key={category.id}>
                    <CategoryCard category={category} />
                  </Grid>
                ))}
              </>
            )}
          </Grid>
        </Container>
      </Box>
    </Box>
  );
};

export default Home;

