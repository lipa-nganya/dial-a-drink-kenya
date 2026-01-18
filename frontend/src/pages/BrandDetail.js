import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardMedia,
  Button,
  CircularProgress,
  Alert,
  Divider,
  Chip
} from '@mui/material';
import { ArrowBack, LocalBar } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { getBackendUrl } from '../utils/backendUrl';
import DrinkCard from '../components/DrinkCard';

const BrandDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { colors } = useTheme();
  const [brand, setBrand] = useState(null);
  const [drinks, setDrinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBrand();
    fetchBrandDrinks();
  }, [id]);

  const fetchBrand = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/brands/${id}`);
      setBrand(response.data);
    } catch (err) {
      console.error('Error fetching brand:', err);
      setError('Failed to load brand details. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const fetchBrandDrinks = async () => {
    try {
      const response = await api.get(`/drinks?brandId=${id}`);
      setDrinks(response.data);
    } catch (err) {
      console.error('Error fetching brand drinks:', err);
    }
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    
    const backendUrl = getBackendUrl();
    return `${backendUrl}${imagePath}`;
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error || !brand) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">{error || 'Brand not found'}</Alert>
        <Button onClick={() => navigate('/brands')} sx={{ mt: 2 }} startIcon={<ArrowBack />}>
          Back to Brands
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/brands')}
        sx={{ mb: 3, color: colors.textPrimary }}
      >
        Back to Brands
      </Button>

      <Box sx={{ mb: 4 }}>
        <Grid container spacing={4} alignItems="center">
          <Grid item xs={12} md={4}>
            {getImageUrl(brand.image) ? (
              <Card>
                <CardMedia
                  component="img"
                  image={getImageUrl(brand.image)}
                  alt={brand.name}
                  sx={{ 
                    objectFit: 'contain', 
                    p: 3, 
                    backgroundColor: '#fff',
                    height: '300px',
                    width: '100%'
                  }}
                />
              </Card>
            ) : (
              <Box
                sx={{
                  height: 300,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f5f5f5',
                  color: '#666',
                  borderRadius: 2
                }}
              >
                <LocalBar sx={{ fontSize: 80 }} />
              </Box>
            )}
          </Grid>
          <Grid item xs={12} md={8}>
            <Typography variant="h3" component="h1" sx={{ fontWeight: 700, mb: 2, color: colors.textPrimary }}>
              {brand.name}
            </Typography>
            {brand.description && (
              <Typography variant="body1" sx={{ color: colors.textSecondary, lineHeight: 1.8, fontSize: '1.1rem' }}>
                {brand.description}
              </Typography>
            )}
            {brand.country && (
              <Box sx={{ mt: 2 }}>
                <Chip label={`From ${brand.country}`} sx={{ mt: 1 }} />
              </Box>
            )}
          </Grid>
        </Grid>
      </Box>

      <Divider sx={{ my: 4 }} />

      {drinks.length > 0 ? (
        <Box>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 3, color: colors.textPrimary }}>
            Products from {brand.name}
          </Typography>
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
            {drinks.map((drink) => (
              <DrinkCard key={drink.id} drink={drink} />
            ))}
          </Box>
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No products available for this brand
          </Typography>
        </Box>
      )}
    </Container>
  );
};

export default BrandDetail;
