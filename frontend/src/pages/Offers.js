import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Box,
  Card,
  CardContent,
  CardMedia,
  Button,
  Chip,
  Alert
} from '@mui/material';
import { LocalOffer, ShoppingCart } from '@mui/icons-material';
import { api } from '../services/api';
import { useCart } from '../contexts/CartContext';
import CountdownTimer from '../components/CountdownTimer';

const Offers = () => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addToCart } = useCart();

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

  const handleAddToCart = (drink) => {
    addToCart(drink);
  };

  const calculateDiscount = (originalPrice, currentPrice) => {
    if (!originalPrice || !currentPrice) return 0;
    const discount = ((Number(originalPrice) - Number(currentPrice)) / Number(originalPrice)) * 100;
    return Math.round(discount);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Loading offers...
        </Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (offers.length === 0) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box textAlign="center">
          <LocalOffer sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h4" component="h1" gutterBottom>
            No Active Offers
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Check back later for amazing deals!
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Countdown Timer */}
      <Box sx={{ mb: 4 }}>
        <CountdownTimer />
      </Box>

      <Box textAlign="center" mb={4}>
        <Typography 
          variant="h3" 
          component="h1" 
          gutterBottom
          sx={{ 
            fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
            fontWeight: 700,
            color: '#00E0B8'
          }}
        >
          🔥 Special Offers
        </Typography>
        <Typography 
          variant="h6" 
          color="text.secondary"
          sx={{ mb: 3 }}
        >
          Limited time deals - Don't miss out!
        </Typography>
      </Box>

      <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
        {offers.map((drink) => {
          const discount = calculateDiscount(drink.originalPrice, drink.price);
          return (
            <Grid item xs={12} sm={6} md={4} key={drink.id}>
              <Card 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'visible',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 25px rgba(0, 224, 184, 0.15)',
                    transition: 'all 0.3s ease'
                  }
                }}
              >
                {/* Discount Badge */}
                {discount > 0 && (
                  <Chip
                    label={`${discount}% OFF`}
                    color="secondary"
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      zIndex: 1,
                      fontWeight: 'bold',
                      backgroundColor: '#FF3366',
                      color: 'white'
                    }}
                  />
                )}

                <CardMedia
                  component="img"
                  height="200"
                  image={drink.image || 'https://via.placeholder.com/300x200/00E0B8/FFFFFF?text=Drink'}
                  alt={drink.name}
                  sx={{ objectFit: 'cover' }}
                />
                
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <Typography 
                    variant="h6" 
                    component="h2" 
                    gutterBottom
                    sx={{ fontWeight: 600 }}
                  >
                    {drink.name}
                  </Typography>
                  
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ mb: 2, flexGrow: 1 }}
                  >
                    {drink.description}
                  </Typography>

                  {/* Capacity Pricing Display */}
                  {console.log('Offers - drink data:', { id: drink.id, name: drink.name, capacityPricing: drink.capacityPricing })}
                  {Array.isArray(drink.capacityPricing) && drink.capacityPricing.length > 0 ? (
                    <Box sx={{ mb: 2 }}>
                      {drink.capacityPricing.map((pricing, index) => (
                        <Box key={index} sx={{ mb: 1, p: 1, backgroundColor: '#121212', borderRadius: 1, border: '1px solid #333' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Chip
                              label={pricing.capacity}
                              size="small"
                              sx={{
                                backgroundColor: '#00E0B8',
                                color: '#0D0D0D',
                                fontSize: '0.7rem',
                                fontWeight: 'bold'
                              }}
                            />
                            {pricing.originalPrice > pricing.currentPrice && (
                              <Chip
                                label={`${Math.round(((pricing.originalPrice - pricing.currentPrice) / pricing.originalPrice) * 100)}% OFF`}
                                size="small"
                                sx={{
                                  backgroundColor: '#FF3366',
                                  color: '#F5F5F5',
                                  fontSize: '0.65rem'
                                }}
                              />
                            )}
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {pricing.originalPrice > pricing.currentPrice ? (
                              <>
                                <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.secondary', fontSize: '0.75rem' }}>
                                  KES {pricing.originalPrice.toFixed(2)}
                                </Typography>
                                <Typography variant="body1" sx={{ color: '#FF3366', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                  KES {pricing.currentPrice.toFixed(2)}
                                </Typography>
                              </>
                            ) : (
                              <Typography variant="body1" sx={{ color: '#00E0B8', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                KES {pricing.currentPrice.toFixed(2)}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    /* Fallback to old pricing display */
                    <Box sx={{ mb: 2 }}>
                      {drink.originalPrice && Number(drink.originalPrice) > Number(drink.price) ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography 
                            variant="h6" 
                            sx={{ 
                              color: '#00E0B8',
                              fontWeight: 'bold'
                            }}
                          >
                            KES {Number(drink.price).toFixed(2)}
                          </Typography>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              textDecoration: 'line-through',
                              color: 'text.secondary'
                            }}
                          >
                            KES {Number(drink.originalPrice).toFixed(2)}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            color: '#00E0B8',
                            fontWeight: 'bold'
                          }}
                        >
                          KES {Number(drink.price).toFixed(2)}
                        </Typography>
                      )}
                    </Box>
                  )}

                  {/* ABV Display */}
                  {drink.abv && (
                    <Box sx={{ mb: 2 }}>
                      <Chip
                        label={`${Number(drink.abv)}% ABV`}
                        size="small"
                        sx={{
                          backgroundColor: '#FF3366',
                          color: '#F5F5F5',
                          fontSize: '0.75rem'
                        }}
                      />
                    </Box>
                  )}

                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<ShoppingCart />}
                    onClick={() => handleAddToCart(drink)}
                    sx={{
                      backgroundColor: '#00E0B8',
                      color: '#0D0D0D',
                      fontWeight: 600,
                      '&:hover': {
                        backgroundColor: '#00C4A3',
                        transform: 'translateY(-1px)'
                      }
                    }}
                  >
                    ADD TO CART
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Container>
  );
};

export default Offers;
