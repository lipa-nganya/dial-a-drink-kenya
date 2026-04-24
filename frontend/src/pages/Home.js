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

const HERO_IMAGE_CACHE_KEY = 'heroImageUrl:v1';
const HERO_IMAGE_UPDATED_AT_KEY = 'heroImageUpdatedAt:v1';

const getInitialHeroImage = () => {
  try {
    const cached = window.localStorage.getItem(HERO_IMAGE_CACHE_KEY);
    if (cached && typeof cached === 'string') return cached;
  } catch (_) {
    // Ignore localStorage errors and fallback to bundled image.
  }
  return '/assets/images/ads/hero-ad.png';
};

const Home = () => {
  const [popularDrinks, setPopularDrinks] = useState([]);
  const [popularDrinksLoading, setPopularDrinksLoading] = useState(true);
  // Render hero immediately (cached URL if available) to reduce LCP resource delay.
  const [heroImage, setHeroImage] = useState(getInitialHeroImage);
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
    fetchPopularDrinks();
    fetchBrandFocusDrinks();
    fetchLimitedTimeOffers();
  }, []);

  // Note: Removed frequent polling to reduce database load
  // Hero image only fetches once on page load
  // If hero image needs to update more frequently, consider using WebSocket or longer polling interval (30+ minutes)

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

        // Use stable version token so repeat visits can cache hero image.
        // updatedAt change invalidates cache when admins update the hero asset.
        const updatedMs = nextUpdatedAt ? new Date(nextUpdatedAt).getTime() : NaN;
        const tokenBase = Number.isFinite(updatedMs) ? updatedMs : 0;
        const separator = imageUrl.includes('?') ? '&' : '?';
        const cacheBustedUrl = `${imageUrl}${separator}_v=${tokenBase}`;
        setHeroImage(cacheBustedUrl);
        try {
          window.localStorage.setItem(HERO_IMAGE_CACHE_KEY, cacheBustedUrl);
          window.localStorage.setItem(HERO_IMAGE_UPDATED_AT_KEY, String(nextUpdatedAt || ''));
        } catch (_) {
          // Ignore storage write failures (private mode, quota exceeded, etc.)
        }
      }
    } catch (error) {
      console.error('Error fetching hero image:', error);
      // Keep current hero image to avoid visual thrash and late image swaps.
    }
  };

  const handleHeroImgError = (e) => {
    const attempt = (heroLoadAttemptRef.current += 1);
    const base = heroImageUrlRef.current || '/assets/images/ads/hero-ad.png';
    // Retry once with a new bust param (transient CDN / TLS issues)
    if (attempt <= 1) {
      const sep = base.includes('?') ? '&' : '?';
      e.target.src = `${base}${sep}_retry=${attempt}`;
      return;
    }
    // Last resort: bundled default; then detach handler to avoid infinite onError loops
    const fb = '/assets/images/ads/hero-ad.png';
    const sep = fb.includes('?') ? '&' : '?';
    e.target.onerror = null;
    e.target.src = `${fb}${sep}_err=1`;
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

  const fetchPopularDrinks = async () => {
    try {
      const response = await api.get('/drinks', {
        params: { popular: 'true' }
      });
      const drinks = Array.isArray(response.data) ? response.data : [];
      setPopularDrinks(drinks);
    } catch (error) {
      console.error('Error fetching popular drinks:', error);
      setPopularDrinks([]);
    } finally {
      setPopularDrinksLoading(false);
    }
  };

  const fetchBrandFocusDrinks = async () => {
    try {
      setBrandFocusLoading(true);
      // Get the selected brand focus from settings
      const brandFocusResponse = await api.get('/settings/brandFocus');
      const brandFocusId = brandFocusResponse.data?.value;
      
      if (brandFocusId) {
        // Use backend filtering to get only brand focus drinks for this brand
        const brandFocusIdNum = parseInt(brandFocusId);
        const drinksResponse = await api.get('/drinks', {
          params: { 
            brandId: brandFocusIdNum,
            brandFocus: 'true'
          }
        });
        const filtered = Array.isArray(drinksResponse.data) ? drinksResponse.data : [];
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
              minHeight: { xs: '200px', md: '300px' },
              overflow: 'hidden'
            }}
          >
            {(heroLinkType === 'product' && heroLinkTargetId) || (heroLinkType === 'brand' && heroLinkTargetId) || heroLinkType === 'brands' ? (
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
                <img
                  key={heroImage}
                  src={heroImage}
                  alt="Special Offer - Premium Drinks"
                  width={1200}
                  height={400}
                  loading="eager"
                  fetchpriority="high"
                  decoding="async"
                  style={{
                    maxWidth: '1400px',
                    width: '100%',
                    maxHeight: '300px',
                    display: 'block',
                    objectFit: 'cover',
                    aspectRatio: '3 / 1',
                    cursor: 'pointer'
                  }}
                  onError={handleHeroImgError}
                />
              </Link>
            ) : (
              <img
                key={heroImage}
                src={heroImage}
                alt="Special Offer - Premium Drinks"
                width={1200}
                height={400}
                loading="eager"
                fetchpriority="high"
                decoding="async"
                style={{
                  maxWidth: '1400px',
                  width: '100%',
                  maxHeight: '300px',
                  display: 'block',
                  objectFit: 'cover',
                  aspectRatio: '3 / 1'
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
            
            {popularDrinksLoading ? (
              <Box sx={{ minHeight: { xs: 420, md: 520 } }}>
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
                  {Array.from({ length: 8 }).map((_, idx) => (
                    <Box
                      key={`popular-skeleton-${idx}`}
                      sx={{
                        minHeight: { xs: 350, sm: 450, md: 500 },
                        borderRadius: 1,
                        backgroundColor: 'action.hover'
                      }}
                    />
                  ))}
                </Box>
              </Box>
            ) : (
              (() => {
                let sortedPopularDrinks = popularDrinks.filter(drink => drink && drink.isPopular);
                
                // Sort: available items first, then by name
                sortedPopularDrinks.sort((a, b) => {
                  // First sort by availability (available items first)
                  if (a.isAvailable !== b.isAvailable) {
                    return b.isAvailable ? 1 : -1; // true (available) comes before false (out of stock)
                  }
                  // Then sort by name alphabetically
                  const nameA = (a.name || '').toLowerCase();
                  const nameB = (b.name || '').toLowerCase();
                  return nameA.localeCompare(nameB);
                });
                
                if (sortedPopularDrinks.length === 0) {
                  return (
                    <Typography textAlign="center" color="text.secondary">
                      No popular drinks available at the moment.
                    </Typography>
                  );
                }
                
                return (
                  <Box sx={{ 
                    minHeight: { xs: 420, md: 520 },
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
                    {sortedPopularDrinks.slice(0, 8).map((drink) => (
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
              <Box sx={{ minHeight: { xs: 420, md: 520 } }}>
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
                  {Array.from({ length: 8 }).map((_, idx) => (
                    <Box
                      key={`brand-focus-skeleton-${idx}`}
                      sx={{
                        minHeight: { xs: 350, sm: 450, md: 500 },
                        borderRadius: 1,
                        backgroundColor: 'action.hover'
                      }}
                    />
                  ))}
                </Box>
              </Box>
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
                    minHeight: { xs: 420, md: 520 },
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

