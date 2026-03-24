/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  Typography,
  Box,
} from '@mui/material';
import { Star } from '@mui/icons-material';
import { useTheme } from '../contexts/ThemeContext';
import DrinkCard from '../components/DrinkCard';
import CountdownTimer from '../components/CountdownTimer';
import { api } from '../services/api';
import { getBackendUrl } from '../utils/backendUrl';
import { Link } from 'react-router-dom';
import { buildBrandPath } from '../utils/brandSlug';

const Home = () => {
  const [drinks, setDrinks] = useState([]);
  const [drinksLoading, setDrinksLoading] = useState(true);
  /** null = not loaded yet (avoid flashing cached bundled default hero before API returns) */
  const [heroImage, setHeroImage] = useState(null);
  const heroImageUrlRef = useRef(null); // Base image URL from settings (no cache-bust query)
  const heroImageUpdatedAtRef = useRef(null); // Tracks Settings.updatedAt from API
  const heroLoadAttemptRef = useRef(0); // For img onError retry with new cache-bust
  const [heroLinkType, setHeroLinkType] = useState('none'); // 'none' | 'product' | 'brand'
  const [heroLinkTargetId, setHeroLinkTargetId] = useState(''); // product id or brand id
  const [heroBrandPath, setHeroBrandPath] = useState('');
  const [brandFocusDrinks, setBrandFocusDrinks] = useState([]);
  const [brandFocusLoading, setBrandFocusLoading] = useState(true);
  const [limitedTimeOffers, setLimitedTimeOffers] = useState([]);
  const [limitedTimeOffersLoading, setLimitedTimeOffersLoading] = useState(true);
  const [countdownActive, setCountdownActive] = useState(false);
  const { colors } = useTheme();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchHeroImage();
    fetchHeroLinkSettings();
    fetchDrinks();
    fetchBrandFocusDrinks();
    fetchLimitedTimeOffers();
  }, []);

  // Refetch hero image when page becomes visible (user switches back to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchHeroImage();
        fetchHeroLinkSettings();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also refetch periodically (every 5 minutes) to catch updates
    const intervalId = setInterval(() => {
      fetchHeroImage();
      fetchHeroLinkSettings();
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    heroLoadAttemptRef.current = 0;
    try {
      // Bust HTTP caches on the settings response itself
      const response = await api.get('/settings/heroImage', {
        params: { _t: Date.now() }
      });
      if (response.data && response.data.value) {
        const imageUrl = getImageUrl(response.data.value);
        const nextUpdatedAt = response.data.updatedAt || null;

        heroImageUrlRef.current = imageUrl;
        heroImageUpdatedAtRef.current = nextUpdatedAt;

        // Always append a fresh cache-buster on every successful fetch so:
        // - Same URL + replaced file still reloads
        // - Missing/unchanged updatedAt in API still updates the img src
        // - Per-fetch Date.now() avoids CDN/browser serving an old byte stream
        const updatedMs = nextUpdatedAt ? new Date(nextUpdatedAt).getTime() : NaN;
        const tokenBase = Number.isFinite(updatedMs) ? updatedMs : 0;
        const separator = imageUrl.includes('?') ? '&' : '?';
        const cacheBustedUrl = `${imageUrl}${separator}_v=${tokenBase}&_r=${Date.now()}`;
        setHeroImage(cacheBustedUrl);
      }
    } catch (error) {
      console.error('Error fetching hero image:', error);
      const fallback = '/assets/images/ads/hero-ad.png';
      const separator = fallback.includes('?') ? '&' : '?';
      setHeroImage(`${fallback}${separator}_v=fallback&_r=${Date.now()}`);
    }
  };

  const handleHeroImgError = (e) => {
    const attempt = (heroLoadAttemptRef.current += 1);
    const base = heroImageUrlRef.current || '/assets/images/ads/hero-ad.png';
    // Retry once with a new bust param (transient CDN / TLS issues)
    if (attempt <= 1) {
      const sep = base.includes('?') ? '&' : '?';
      e.target.src = `${base}${sep}_retry=${attempt}&_r=${Date.now()}`;
      return;
    }
    // Last resort: bundled default; then detach handler to avoid infinite onError loops
    const fb = '/assets/images/ads/hero-ad.png';
    const sep = fb.includes('?') ? '&' : '?';
    e.target.onerror = null;
    e.target.src = `${fb}${sep}_err=1&_r=${Date.now()}`;
  };

  const fetchHeroLinkSettings = async () => {
    try {
      const [typeRes, targetRes] = await Promise.all([
        api.get('/settings/heroImageLinkType').catch(() => ({ data: { value: 'none' } })),
        api.get('/settings/heroImageLinkTargetId').catch(() => ({ data: { value: '' } }))
      ]);
      setHeroLinkType(typeRes.data?.value || 'none');
      const targetId = targetRes.data?.value != null ? String(targetRes.data.value) : '';
      setHeroLinkTargetId(targetId);

      if ((typeRes.data?.value || 'none') === 'brand' && targetId) {
        try {
          const brandRes = await api.get(`/brands/${targetId}`);
          setHeroBrandPath(buildBrandPath(brandRes.data));
        } catch (brandError) {
          console.error('Error resolving hero brand slug:', brandError);
          setHeroBrandPath(`/brands/${targetId}`);
        }
      } else {
        setHeroBrandPath('');
      }
    } catch (error) {
      console.error('Error fetching hero link settings:', error);
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

  const fetchLimitedTimeOffers = async () => {
    try {
      setLimitedTimeOffersLoading(true);
      // Check if countdown is active
      const countdownResponse = await api.get('/countdown/current');
      const countdownData = countdownResponse.data;
      
      if (!countdownData?.active) {
        setCountdownActive(false);
        setLimitedTimeOffers([]);
        return;
      }
      
      setCountdownActive(true);
      
      // Fetch limited time offers
      const response = await api.get('/drinks/offers');
      setLimitedTimeOffers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching limited time offers:', error);
      setLimitedTimeOffers([]);
      setCountdownActive(false);
    } finally {
      setLimitedTimeOffersLoading(false);
    }
  };

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
          
          {/* Advertising Image - Wider on Desktop */}
          <Box
            sx={{
              mt: 4,
              mb: 3,
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              maxHeight: { xs: '250px', md: '300px' },
              overflow: 'hidden'
            }}
          >
            {heroImage == null ? (
              <Box
                sx={{
                  width: '100%',
                  maxWidth: { xs: '100%', md: '1400px' },
                  minHeight: { xs: 200, md: 240 },
                  mx: 'auto',
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                  animation: 'pulse 1.5s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 0.6 },
                    '50%': { opacity: 0.9 },
                  },
                }}
                aria-hidden
              />
            ) : (heroLinkType === 'product' && heroLinkTargetId) || (heroLinkType === 'brand' && heroLinkTargetId) || heroLinkType === 'brands' ? (
              <Link
                to={
                  heroLinkType === 'product'
                    ? `/product/${heroLinkTargetId}`
                    : heroLinkType === 'brand'
                    ? (heroBrandPath || `/brands/${heroLinkTargetId}`)
                    : '/brands'
                }
                style={{ display: 'block', width: '100%', textAlign: 'center' }}
                aria-label={
                  heroLinkType === 'product'
                    ? 'View product'
                    : heroLinkType === 'brand'
                    ? 'View brand'
                    : 'View all brands'
                }
              >
                <Box
                  component="img"
                  key={heroImage}
                  src={heroImage}
                  alt="Special Offer - Premium Drinks"
                  sx={{
                    maxWidth: { xs: '100%', md: '1400px' },
                    width: { xs: '100%', md: '100%' },
                    maxHeight: { xs: '250px', md: '300px' },
                    height: 'auto',
                    display: 'block',
                    objectFit: 'contain',
                    cursor: 'pointer'
                  }}
                  onError={handleHeroImgError}
                />
              </Link>
            ) : (
              <Box
                component="img"
                key={heroImage}
                src={heroImage}
                alt="Special Offer - Premium Drinks"
                sx={{
                  maxWidth: { xs: '100%', md: '1400px' },
                  width: { xs: '100%', md: '100%' },
                  maxHeight: { xs: '250px', md: '300px' },
                  height: 'auto',
                  display: 'block',
                  objectFit: 'contain'
                }}
                onError={handleHeroImgError}
              />
            )}
          </Box>

          {/* Limited Time Offers Section */}
          {countdownActive && limitedTimeOffers.length > 0 && (
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
                Limited Time Offers
              </Typography>
              
              {limitedTimeOffersLoading ? (
                <Typography textAlign="center">Loading limited time offers...</Typography>
              ) : (
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
                  {[...limitedTimeOffers].sort((a, b) => {
                    // First sort by availability (available items first)
                    if (a.isAvailable !== b.isAvailable) {
                      return b.isAvailable ? 1 : -1;
                    }
                    // Then sort by name alphabetically
                    const nameA = (a.name || '').toLowerCase();
                    const nameB = (b.name || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                  }).map((drink) => (
                    <DrinkCard key={drink.id} drink={drink} />
                  ))}
                </Box>
              )}
            </Box>
          )}

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
                      xs: 'repeat(2, 1fr)',
                      sm: 'repeat(2, 1fr)',
                      md: 'repeat(3, 1fr)',
                      lg: 'repeat(4, 1fr)'
                    },
                    gap: { xs: 1, sm: 2 },
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
                if (brandFocusDrinks.length === 0) {
                  return (
                    <Typography textAlign="center" color="text.secondary">
                      No brand focus items available at the moment.
                    </Typography>
                  );
                }
                
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
                      xs: 'repeat(2, 1fr)',
                      sm: 'repeat(2, 1fr)',
                      md: 'repeat(3, 1fr)',
                      lg: 'repeat(4, 1fr)'
                    },
                    gap: { xs: 1, sm: 2 },
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
        </Container>
      </Box>
    </Box>
  );
};

export default Home;

