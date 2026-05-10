import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Container,
  Typography,
  Box,
  TextField,
  InputAdornment,
  Chip,
  CircularProgress,
  Paper,
  Stack,
} from '@mui/material';
import { Search, Star, LocalShipping, Payments } from '@mui/icons-material';
/* eslint-disable react-hooks/exhaustive-deps */
import { useParams, useSearchParams } from 'react-router-dom';
import DrinkCard from '../components/DrinkCard';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { CUSTOMER_DRINKS_LIST_PARAMS } from '../constants/customerCatalog';

/** Server page size — matches backend max clamp; fetch more only when user scrolls */
const CATALOG_PAGE_SIZE = 200;

const LocationDetails = () => {
  const { locationName } = useParams();
  const { colors } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [drinks, setDrinks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(true);
  const [location, setLocation] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [selectedSubcategory, setSelectedSubcategory] = useState(0);
  const [filteredDrinks, setFilteredDrinks] = useState([]);
  const [itemsToShow, setItemsToShow] = useState(16); // Initial items to show
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  /** More rows available from API for current filters (pagination) */
  const [hasMoreCatalog, setHasMoreCatalog] = useState(false);
  const [loadingCatalogMore, setLoadingCatalogMore] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const itemsPerLoad = 16; // Load 16 items at a time

  const nextCatalogOffsetRef = useRef(0);
  const catalogAbortRef = useRef(null);

  useEffect(() => {
    fetchLocation();
  }, [locationName]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const categoriesResponse = await api.get('/categories');
        let categoriesArray = [];
        if (categoriesResponse.data) {
          if (Array.isArray(categoriesResponse.data)) {
            categoriesArray = categoriesResponse.data;
          } else if (categoriesResponse.data.data && Array.isArray(categoriesResponse.data.data)) {
            categoriesArray = categoriesResponse.data.data;
          }
        }
        if (!Array.isArray(categoriesArray)) {
          categoriesArray = [];
        }
        categoriesArray = categoriesArray.filter(
          (cat) => cat.name && cat.name.toLowerCase() !== 'test' && cat.name.toLowerCase() !== 'popular'
        );
        if (!cancelled) setCategories(categoriesArray);
      } catch (error) {
        console.error('Error fetching categories:', error);
        if (!cancelled) setCategories([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const buildDrinksListParams = useCallback(
    (offset) => {
      const params = {
        ...CUSTOMER_DRINKS_LIST_PARAMS,
        limit: CATALOG_PAGE_SIZE,
        offset: Math.max(0, offset),
      };

      const catRaw = searchParams.get('category');
      let categoryId = 0;
      if (catRaw !== null && catRaw !== '') {
        const p = parseInt(catRaw, 10);
        if (!Number.isNaN(p)) categoryId = p;
      }

      const subRaw = searchParams.get('subcategory');
      let subcategoryId = 0;
      if (subRaw !== null && subRaw !== '') {
        const p = parseInt(subRaw, 10);
        if (!Number.isNaN(p)) subcategoryId = p;
      }

      if (debouncedSearch) {
        params.search = debouncedSearch;
      }

      if (categoryId === -1) {
        params.popular = 'true';
      } else if (categoryId > 0) {
        params.category = categoryId;
        if (subcategoryId > 0) {
          params.subCategoryId = subcategoryId;
        }
      }

      return params;
    },
    [searchParams, debouncedSearch]
  );

  const fetchCatalogReset = useCallback(async () => {
    catalogAbortRef.current?.abort();
    const ac = new AbortController();
    catalogAbortRef.current = ac;

    setLoading(true);
    setHasMoreCatalog(false);
    nextCatalogOffsetRef.current = 0;

    try {
      const params = buildDrinksListParams(0);
      const response = await api.get('/drinks', { params, signal: ac.signal });
      const chunk = Array.isArray(response.data) ? response.data : [];
      if (ac.signal.aborted) return;
      setDrinks(chunk);
      nextCatalogOffsetRef.current = chunk.length;
      setHasMoreCatalog(chunk.length === CATALOG_PAGE_SIZE);
    } catch (error) {
      if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') return;
      console.error('Error fetching drinks:', error);
      setDrinks([]);
      setHasMoreCatalog(false);
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [buildDrinksListParams]);

  useEffect(() => {
    fetchCatalogReset();
    return () => catalogAbortRef.current?.abort();
  }, [locationName, searchParams, debouncedSearch, fetchCatalogReset]);

  const loadMoreCatalog = useCallback(async () => {
    if (!hasMoreCatalog || loadingCatalogMore || loading) return;
    const offset = nextCatalogOffsetRef.current;

    setLoadingCatalogMore(true);
    try {
      const params = buildDrinksListParams(offset);
      const response = await api.get('/drinks', { params });
      const chunk = Array.isArray(response.data) ? response.data : [];
      if (chunk.length === 0) {
        setHasMoreCatalog(false);
        return;
      }
      setDrinks((prev) => {
        const prevIds = new Set(prev.map((d) => d?.id));
        const unique = chunk.filter((d) => d && !prevIds.has(d.id));
        return unique.length > 0 ? [...prev, ...unique] : prev;
      });
      nextCatalogOffsetRef.current = offset + chunk.length;
      setHasMoreCatalog(chunk.length === CATALOG_PAGE_SIZE);
    } catch (error) {
      console.error('Error loading more drinks:', error);
      setHasMoreCatalog(false);
    } finally {
      setLoadingCatalogMore(false);
    }
  }, [hasMoreCatalog, loadingCatalogMore, loading, buildDrinksListParams]);

  useEffect(() => {
    // Read category and subcategory from URL query parameters
    const categoryParam = searchParams.get('category');
    const subcategoryParam = searchParams.get('subcategory');
    
    if (categoryParam) {
      const categoryId = parseInt(categoryParam, 10);
      if (!isNaN(categoryId)) {
        setSelectedCategory(categoryId);
      }
    } else {
      setSelectedCategory(0);
    }
    
    if (subcategoryParam) {
      const subcategoryId = parseInt(subcategoryParam, 10);
      if (!isNaN(subcategoryId)) {
        setSelectedSubcategory(subcategoryId);
      }
    } else {
      setSelectedSubcategory(0);
    }
  }, [searchParams]);
  
  const prevCategoryForSubResetRef = useRef(null);

  // Fetch subcategories when category changes; only clear subcategory when category actually changes (not on URL hydrate)
  useEffect(() => {
    if (selectedCategory > 0) {
      fetchSubcategories(selectedCategory);
      const prev = prevCategoryForSubResetRef.current;
      if (prev !== null && prev !== selectedCategory && selectedSubcategory > 0) {
        setSelectedSubcategory(0);
      }
      prevCategoryForSubResetRef.current = selectedCategory;
    } else {
      prevCategoryForSubResetRef.current = selectedCategory;
      setSubcategories([]);
      setSelectedSubcategory(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  useEffect(() => {
    filterDrinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps, no-use-before-define
  }, [drinks]);

  const fetchLocation = async () => {
    try {
      setLocationLoading(true);
      const response = await api.get('/territories');
      const decodedLocationName = decodeURIComponent(locationName);
      const foundLocation = response.data.find(
        t => t.name.toLowerCase() === decodedLocationName.toLowerCase()
      );
      if (foundLocation) {
        setLocation(foundLocation);
      }
    } catch (error) {
      console.error('Error fetching location:', error);
    } finally {
      setLocationLoading(false);
    }
  };

  const fetchSubcategories = async (categoryId) => {
    try {
      const response = await api.get(`/subcategories?categoryId=${categoryId}`);
      setSubcategories(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching subcategories:', error);
      setSubcategories([]);
    }
  };

  /** Catalog filtering is done server-side (category, popular, subCategoryId, search); we only sort for display */
  const filterDrinks = () => {
    if (!Array.isArray(drinks)) {
      setFilteredDrinks([]);
      return;
    }

    const filtered = drinks.filter((drink) => drink != null);

    filtered.sort((a, b) => {
      if (a.isAvailable !== b.isAvailable) {
        return b.isAvailable ? 1 : -1;
      }
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    setFilteredDrinks(filtered);
  };

  const handleSubcategoryChange = (subcategoryId) => {
    setSelectedSubcategory(subcategoryId);
    // Update URL query parameter
    const params = { category: selectedCategory.toString() };
    if (subcategoryId > 0) {
      params.subcategory = subcategoryId.toString();
    }
    setSearchParams(params);
  };

  // Reveal more cards from the current in-memory list, then fetch the next API page when needed
  useEffect(() => {
    const handleScroll = () => {
      if (isLoadingMore || loadingCatalogMore) return;

      if (window.innerHeight + window.scrollY >= document.documentElement.offsetHeight - 1000) {
        if (itemsToShow < filteredDrinks.length) {
          setIsLoadingMore(true);
          setTimeout(() => {
            setItemsToShow((prev) => Math.min(prev + itemsPerLoad, filteredDrinks.length));
            setIsLoadingMore(false);
          }, 300);
        } else if (hasMoreCatalog) {
          loadMoreCatalog();
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [
    itemsToShow,
    filteredDrinks.length,
    isLoadingMore,
    itemsPerLoad,
    hasMoreCatalog,
    loadingCatalogMore,
    loadMoreCatalog,
  ]);

  // Reset items to show when filtered drinks change
  useEffect(() => {
    setItemsToShow(Math.min(itemsPerLoad, filteredDrinks.length));
  }, [filteredDrinks.length, itemsPerLoad]);

  const displayedDrinks = filteredDrinks.slice(0, itemsToShow);

  const formatCurrency = (amount) => {
    return `KES ${Math.round(Number(amount || 0))}`;
  };

  const displayLocationName = location ? location.name : decodeURIComponent(locationName || '');

  if (locationLoading) {
    return (
      <Box sx={{ backgroundColor: colors.background, minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ backgroundColor: colors.background, minHeight: '100vh' }}>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ mb: 3, textAlign: 'center' }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, color: colors.textPrimary }}>
            Order Now for Delivery to {displayLocationName}
          </Typography>
        </Box>

        {location && (
          <Paper
            elevation={0}
            sx={{
              mb: 4,
              borderRadius: 3,
              overflow: 'hidden',
              border: `1px solid ${colors.border || 'rgba(0, 0, 0, 0.08)'}`,
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
              backgroundColor: colors.paper,
            }}
          >
            <Box
              sx={{
                px: { xs: 2, sm: 2.5 },
                py: 2,
                background: colors.accent
                  ? `linear-gradient(135deg, ${colors.accent}18 0%, ${colors.accent}08 100%)`
                  : 'linear-gradient(135deg, rgba(0, 224, 184, 0.12) 0%, rgba(0, 224, 184, 0.04) 100%)',
                borderBottom: `1px solid ${colors.border || 'rgba(0, 0, 0, 0.06)'}`,
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    backgroundColor: colors.accent ? `${colors.accent}28` : 'rgba(0, 224, 184, 0.2)',
                    color: colors.accent || '#00E0B8',
                  }}
                >
                  <LocalShipping sx={{ fontSize: 26 }} />
                </Box>
                <Box>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 700,
                      color: colors.textPrimary,
                      letterSpacing: '0.02em',
                      lineHeight: 1.3,
                    }}
                  >
                    Delivery fees
                  </Typography>
                  <Typography variant="caption" sx={{ color: colors.textSecondary, display: 'block' }}>
                    Estimated charges for orders dispatched from each hub
                  </Typography>
                </Box>
              </Stack>
            </Box>

            <Stack
              direction="row"
              spacing={2}
              sx={{
                p: { xs: 2.5, sm: 3 },
                alignItems: 'flex-start',
              }}
            >
              <Box
                sx={{
                  mt: 0.25,
                  color: colors.accent || '#00E0B8',
                  opacity: 0.95,
                }}
              >
                <Payments sx={{ fontSize: 28 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="overline"
                  sx={{
                    color: colors.textSecondary,
                    letterSpacing: '0.08em',
                    fontWeight: 600,
                    display: 'block',
                    mb: 0.5,
                  }}
                >
                  Delivery fee
                </Typography>
                <Typography
                  variant="h5"
                  component="p"
                  sx={{
                    fontWeight: 800,
                    color: colors.textPrimary,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {formatCurrency(location.deliveryFromCBD)}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        )}

      {/* Search Bar */}
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ maxWidth: 500 }}
        />
      </Box>

      {/* Subcategory chips when a category is chosen from the header categories bar */}
      {selectedCategory > 0 && subcategories.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
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

      {/* All Drinks */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" sx={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 1 }}>
            {selectedCategory === -1 ? (
              <>
                <Star color="secondary" />
                Popular
              </>
            ) : selectedCategory === 0 ? (
              'ALL'
            ) : (
              <>
                {categories.find(c => c.id === selectedCategory)?.name}
                {selectedSubcategory > 0 && (
                  <span style={{ color: '#666', fontSize: '0.9rem' }}>
                    {' / '}
                    {subcategories.find(s => s.id === selectedSubcategory)?.name}
                  </span>
                )}
              </>
            )}
          </Typography>
          
          {/* Results Summary */}
          {filteredDrinks.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              {filteredDrinks.filter(d => d.isAvailable).length} available
            </Typography>
          )}
        </Box>
        
        {loading ? (
          <Typography textAlign="center" sx={{ fontSize: '0.9rem' }}>Loading drinks...</Typography>
        ) : filteredDrinks.length === 0 ? (
          <Typography textAlign="center" color="text.secondary" sx={{ fontSize: '0.9rem' }}>
            No drinks found matching your criteria.
          </Typography>
        ) : (
          <>
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
              {displayedDrinks.map((drink) => (
                <DrinkCard key={drink.id} drink={drink} />
              ))}
            </Box>
            
            {/* Loading indicator for lazy loading (more cards) or next catalog page */}
            {(isLoadingMore || loadingCatalogMore) && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 3 }}>
                <CircularProgress size={40} />
              </Box>
            )}
            
            {!isLoadingMore && !loadingCatalogMore && itemsToShow >= filteredDrinks.length && filteredDrinks.length > itemsPerLoad && !hasMoreCatalog && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  All {filteredDrinks.length} items loaded
                </Typography>
              </Box>
            )}
          </>
        )}
      </Box>
      </Container>
    </Box>
  );
};

export default LocationDetails;
