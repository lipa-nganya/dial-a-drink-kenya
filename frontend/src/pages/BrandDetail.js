import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { buildBrandPath } from '../utils/brandSlug';
import DrinkCard from '../components/DrinkCard';

const BrandDetail = () => {
  const { identifier } = useParams();
  const navigate = useNavigate();
  const { colors } = useTheme();
  const [brand, setBrand] = useState(null);
  const [drinks, setDrinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBrandAndDrinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps, no-use-before-define
  }, [identifier]);

  const fetchBrandAndDrinks = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get(`/brands/${identifier}`);
      const brandData = response.data;
      setBrand(brandData);

      const canonicalPath = buildBrandPath(brandData);
      if (window.location.pathname !== canonicalPath) {
        navigate(canonicalPath, { replace: true });
      }

      const drinksResponse = await api.get(`/drinks?brandId=${brandData.id}`);
      setDrinks(drinksResponse.data);
    } catch (err) {
      console.error('Error fetching brand:', err);
      setError('Failed to load brand details. Please try again later.');
      setDrinks([]);
    } finally {
      setLoading(false);
    }
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
