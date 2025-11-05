import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Alert
} from '@mui/material';
import { LocalOffer } from '@mui/icons-material';
import { api } from '../services/api';
import DrinkCard from '../components/DrinkCard';
import CountdownTimer from '../components/CountdownTimer';

const Offers = () => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    try {
      console.log('Fetching offers...');
      const response = await api.get('/drinks/offers');
      console.log('Offers response:', response.data);
      setOffers(response.data);
    } catch (error) {
      console.error('Error fetching offers:', error);
      setError('Failed to load offers');
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h5" component="h1" gutterBottom sx={{ fontSize: '1.2rem' }}>
          Loading offers...
        </Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ fontSize: '0.9rem' }}>{error}</Alert>
      </Container>
    );
  }

  if (offers.length === 0) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box textAlign="center">
          <LocalOffer sx={{ fontSize: 60, color: 'text.secondary', mb: 1 }} />
          <Typography variant="h5" component="h1" gutterBottom sx={{ fontSize: '1.2rem' }}>
            No Active Offers
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontSize: '0.9rem' }}>
            Check back later for amazing deals!
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Countdown Timer */}
      <Box sx={{ mb: 2 }}>
        <CountdownTimer />
      </Box>

      <Box textAlign="center" mb={2}>
        <Typography 
          variant="h4" 
          component="h1" 
          gutterBottom
          sx={{ 
            fontSize: { xs: '1.2rem', sm: '1.4rem', md: '1.6rem' },
            fontWeight: 700,
            color: '#000000'
          }}
        >
          Special Offers
        </Typography>
        <Typography 
          variant="body1" 
          color="text.secondary"
          sx={{ mb: 2, fontSize: '0.9rem' }}
        >
          Limited time deals - Don't miss out!
        </Typography>
      </Box>

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
        {offers.map((drink) => (
          <DrinkCard key={drink.id} drink={drink} />
        ))}
      </Box>
    </Container>
  );
};

export default Offers;
