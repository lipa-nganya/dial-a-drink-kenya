/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Star } from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import DrinkCard from '../components/DrinkCard';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { getSimilarDrinkSuggestions, drinkNameMatchesSearch } from '../utils/drinkSearch';

const Menu = () => {
  const { colors } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [drinks, setDrinks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [selectedSubcategory, setSelectedSubcategory] = useState(0);
  const [filteredDrinks, setFilteredDrinks] = useState([]);
  const [displayedDrinks, setDisplayedDrinks] = useState([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const itemsPerLoad = 20; // Number of items to display each time
  const [itemsToShow, setItemsToShow] = useState(itemsPerLoad);

  // Sort: '' = default (availability then name), 'popularity' | 'price_asc' | 'price_desc' | 'quantity'
  const [sortBy, setSortBy] = useState('');
  // When sort by quantity is selected, filter by a specific capacity ('' = show all)
  const [quantityCapacityFilter, setQuantityCapacityFilter] = useState('');

  // Unique capacities from drinks that pass current category/search/subcategory filter (for quantity dropdown)
  // Must be defined before any useEffect or JSX that references it
  const availableCapacityOptions = React.useMemo(() => {
    if (!Array.isArray(drinks) || sortBy !== 'quantity') return [];
    let base = drinks.filter(d => d != null);
    if (searchTerm) {
      base = base.filter(d => drinkNameMatchesSearch(d, searchTerm));
    }
    if (selectedCategory === -1) base = base.filter(d => d.isPopular);
    else if (selectedCategory > 0) {
      base = base.filter(d => d.categoryId === selectedCategory);
      if (selectedSubcategory > 0) base = base.filter(d => d.subCategoryId === selectedSubcategory);
    }
    const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, '');
    const byNorm = new Map();
    base.forEach(drink => {
      if (Array.isArray(drink.capacityPricing) && drink.capacityPricing.length > 0) {
        drink.capacityPricing.forEach(p => {
          const c = p.capacity != null ? p.capacity : p.size;
          if (c != null && String(c).trim()) {
            const n = norm(c);
            if (!byNorm.has(n)) byNorm.set(n, String(c).trim());
          }
        });
      }
      if (Array.isArray(drink.capacity) && drink.capacity.length > 0) {
        drink.capacity.forEach(c => {
          if (c != null && String(c).trim()) {
            const n = norm(c);
            if (!byNorm.has(n)) byNorm.set(n, String(c).trim());
          }
        });
      }
    });
    return Array.from(byNorm.values()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [drinks, sortBy, searchTerm, selectedCategory, selectedSubcategory]);

  useEffect(() => {
    fetchData();
  }, []);

  // Scroll detection: infinite scroll and categories collapse no longer used (categories in header)
  useEffect(() => {
    let ticking = false;
    
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollTop = window.scrollY || document.documentElement.scrollTop;
          const windowHeight = window.innerHeight;
          const documentHeight = document.documentElement.scrollHeight;
          
          // Infinite scroll: Load more when near bottom
          if (scrollTop + windowHeight >= documentHeight - 400 && !isLoadingMore) {
            if (itemsToShow < filteredDrinks.length) {
              setIsLoadingMore(true);
              setTimeout(() => {
                setItemsToShow(prev => Math.min(prev + itemsPerLoad, filteredDrinks.length));
                setIsLoadingMore(false);
              }, 150);
            }
          }
          
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [filteredDrinks.length, itemsToShow, isLoadingMore]);

  useEffect(() => {
    // Read category and subcategory from URL query parameters
    const categoryParam = searchParams.get('category');
    const subcategoryParam = searchParams.get('subcategory');
    const searchParam = searchParams.get('search');
    
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

    if (searchParam != null) {
      setSearchTerm(searchParam);
    }
  }, [searchParams]);
  
  // Fetch subcategories when category changes
  useEffect(() => {
    if (selectedCategory > 0) {
      fetchSubcategories(selectedCategory);
      // Reset subcategory when category changes (but don't update URL here to avoid loops)
      if (selectedSubcategory > 0) {
        setSelectedSubcategory(0);
      }
    } else {
      setSubcategories([]);
      setSelectedSubcategory(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    filterDrinks();
  }, [drinks, searchTerm, selectedCategory, selectedSubcategory, sortBy, quantityCapacityFilter]);

  // Reset displayed items when filters change
  useEffect(() => {
    setItemsToShow(itemsPerLoad);
    // Scroll to top smoothly when category/search changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedCategory, selectedSubcategory, searchTerm, sortBy, quantityCapacityFilter]);

  // Update displayed drinks when filtered drinks or itemsToShow changes
  useEffect(() => {
    setDisplayedDrinks(filteredDrinks.slice(0, itemsToShow));
  }, [filteredDrinks, itemsToShow]);

  // When sort is quantity and selected capacity is no longer in the options (e.g. after category change), clear it
  useEffect(() => {
    if (sortBy === 'quantity' && quantityCapacityFilter && availableCapacityOptions.length > 0 && !availableCapacityOptions.includes(quantityCapacityFilter)) {
      setQuantityCapacityFilter('');
    }
  }, [sortBy, quantityCapacityFilter, availableCapacityOptions]);

  // When name search matches nothing, suggest related products
  const similarSuggestions = React.useMemo(() => {
    if (loading) return [];
    const q = (searchTerm || '').trim();
    if (!q) return [];
    if (filteredDrinks.length > 0) return [];
    return getSimilarDrinkSuggestions(drinks, q, selectedCategory, { limit: 12 });
  }, [loading, searchTerm, filteredDrinks.length, drinks, selectedCategory]);

  const fetchData = async () => {
    try {
      const [drinksResponse, categoriesResponse] = await Promise.all([
        api.get('/drinks'),
        api.get('/categories')
      ]);
      
      // Defensive: Ensure drinks is always an array
      const drinksArray = Array.isArray(drinksResponse.data) ? drinksResponse.data : [];
      setDrinks(drinksArray);
      
      // Defensive: Ensure categories is always an array
      let categoriesArray = [];
      if (categoriesResponse.data) {
        if (Array.isArray(categoriesResponse.data)) {
          categoriesArray = categoriesResponse.data;
        } else if (categoriesResponse.data.data && Array.isArray(categoriesResponse.data.data)) {
          // Wrapped response: { data: [...] }
          categoriesArray = categoriesResponse.data.data;
        }
      }
      
      if (!Array.isArray(categoriesArray)) {
        console.warn('Categories response is not an array:', categoriesResponse.data);
        categoriesArray = [];
      }
      
      // Filter out "Test" and "Popular" categories
      categoriesArray = categoriesArray.filter(cat => 
        cat.name && cat.name.toLowerCase() !== 'test' && cat.name.toLowerCase() !== 'popular'
      );
      
      setCategories(categoriesArray);
    } catch (error) {
      console.error('Error fetching data:', error);
      setDrinks([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubcategories = async (categoryId) => {
    try {
      const response = await api.get(`/subcategories?categoryId=${categoryId}`);
      setSubcategories(response.data);
    } catch (error) {
      console.error('Error fetching subcategories:', error);
      setSubcategories([]);
    }
  };

  const filterDrinks = () => {
    // Safety check: ensure drinks is an array
    if (!Array.isArray(drinks)) {
      setFilteredDrinks([]);
      return;
    }

    // Filter out any null/undefined drinks
    let filtered = drinks.filter(drink => drink != null);

    // Filter by search term (drink name only, case-insensitive)
    if (searchTerm) {
      filtered = filtered.filter((drink) => drink && drinkNameMatchesSearch(drink, searchTerm));
    }

    // Filter by category or popular
    if (selectedCategory === -1) {
      // Popular tab selected
      filtered = filtered.filter(drink => drink && drink.isPopular);
    } else if (selectedCategory > 0) {
      // Regular category selected
      filtered = filtered.filter(drink => drink && drink.categoryId === selectedCategory);
      
      // Filter by subcategory if one is selected
      if (selectedSubcategory > 0) {
        filtered = filtered.filter(drink => drink && drink.subCategoryId === selectedSubcategory);
      }
    }

    // For price sort: exclude out of stock and Test category (per requirement)
    if (sortBy === 'price_asc' || sortBy === 'price_desc') {
      filtered = filtered.filter(drink => {
        if (!drink.isAvailable) return false;
        const catName = (drink.category && drink.category.name) ? drink.category.name.toLowerCase() : '';
        if (catName === 'test') return false;
        return true;
      });
    }

    // When sort by quantity and a capacity is selected, only show products that offer that capacity
    if (sortBy === 'quantity' && quantityCapacityFilter) {
      filtered = filtered.filter(drink => drinkHasCapacity(drink, quantityCapacityFilter));
    }

    // Apply sort
    if (sortBy === 'popularity') {
      // Popular first (isPopular === true at top), then by clicks descending (highest first)
      filtered.sort((a, b) => {
        if (a.isPopular !== b.isPopular) return a.isPopular ? -1 : 1;
        const clicksA = a.clicks != null ? Number(a.clicks) : 0;
        const clicksB = b.clicks != null ? Number(b.clicks) : 0;
        return clicksB - clicksA;
      });
    } else if (sortBy === 'price_asc') {
      filtered.sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));
    } else if (sortBy === 'price_desc') {
      filtered.sort((a, b) => getEffectivePrice(b) - getEffectivePrice(a));
    } else if (sortBy === 'quantity') {
      // Sort by number of available capacities (most options first)
      filtered.sort((a, b) => getCapacityCount(b) - getCapacityCount(a));
    } else {
      // Default: available first, then by name
      filtered.sort((a, b) => {
        if (a.isAvailable !== b.isAvailable) {
          return b.isAvailable ? 1 : -1;
        }
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
    }

    setFilteredDrinks(filtered);
  };

  const getEffectivePrice = (drink) => {
    if (!drink) return 0;
    const pricing = drink.capacityPricing;
    if (Array.isArray(pricing) && pricing.length > 0) {
      let min = Infinity;
      for (const p of pricing) {
        const v = parseFloat(p.currentPrice ?? p.price ?? p.originalPrice) || 0;
        if (v > 0 && v < min) min = v;
      }
      return min === Infinity ? parseFloat(drink.price) || 0 : min;
    }
    return parseFloat(drink.price) || 0;
  };

  const getCapacityCount = (drink) => {
    if (!drink) return 0;
    if (Array.isArray(drink.capacityPricing) && drink.capacityPricing.length > 0) {
      return drink.capacityPricing.length;
    }
    if (Array.isArray(drink.capacity) && drink.capacity.length > 0) {
      return drink.capacity.length;
    }
    return 0;
  };

  const drinkHasCapacity = (drink, capacityStr) => {
    if (!drink || !capacityStr) return false;
    const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, '');
    const target = norm(capacityStr);
    const values = [];
    if (Array.isArray(drink.capacityPricing) && drink.capacityPricing.length > 0) {
      drink.capacityPricing.forEach(p => { const c = p.capacity != null ? p.capacity : p.size; if (c != null) values.push(c); });
    }
    if (Array.isArray(drink.capacity) && drink.capacity.length > 0) {
      drink.capacity.forEach(c => { if (c != null) values.push(c); });
    }
    return values.some(c => norm(c) === target);
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

  return (
    <Box sx={{ backgroundColor: colors.background, minHeight: '100vh', overflow: 'visible', position: 'relative' }}>
      <Container maxWidth="lg" sx={{ py: 4, overflow: 'visible', position: 'relative' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Our Menu
        </Typography>

      {/* Subcategory Chips - Show when a category is selected (from header categories bar) */}
      {selectedCategory > 0 && subcategories.length > 0 && (
        <Box sx={{ 
          mb: 2, 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: 1
        }}>
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
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
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="menu-sort-label">Sort by</InputLabel>
              <Select
                labelId="menu-sort-label"
                value={sortBy}
                label="Sort by"
                onChange={(e) => {
                  setSortBy(e.target.value);
                  if (e.target.value !== 'quantity') setQuantityCapacityFilter('');
                }}
                sx={{
                  backgroundColor: colors.paper || '#fff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border || 'rgba(0,0,0,0.23)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: colors.textSecondary || 'rgba(0,0,0,0.4)' }
                }}
              >
                <MenuItem value="">Default (availability, then name)</MenuItem>
                <MenuItem value="popularity">Popularity (highest to lowest)</MenuItem>
                <MenuItem value="price_asc">Price (lowest to highest)</MenuItem>
                <MenuItem value="price_desc">Price (highest to lowest)</MenuItem>
                <MenuItem value="quantity">Quantity (available capacities)</MenuItem>
              </Select>
            </FormControl>
            {sortBy === 'quantity' && availableCapacityOptions.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel id="menu-quantity-label">Quantity</InputLabel>
                <Select
                  labelId="menu-quantity-label"
                  value={quantityCapacityFilter}
                  label="Quantity"
                  onChange={(e) => setQuantityCapacityFilter(e.target.value)}
                  sx={{
                    backgroundColor: colors.paper || '#fff',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border || 'rgba(0,0,0,0.23)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: colors.textSecondary || 'rgba(0,0,0,0.4)' }
                  }}
                >
                  <MenuItem value="">All capacities</MenuItem>
                  {availableCapacityOptions.map((cap) => (
                    <MenuItem key={cap} value={cap}>{cap}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {filteredDrinks.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                {filteredDrinks.filter(d => d.isAvailable).length} available
              </Typography>
            )}
          </Box>
        </Box>
        
        {loading ? (
          <Typography textAlign="center" sx={{ fontSize: '0.9rem' }}>Loading drinks...</Typography>
        ) : filteredDrinks.length === 0 ? (
          <Box>
            <Typography textAlign="center" color="text.secondary" sx={{ fontSize: '0.9rem', mb: 2 }}>
              {searchTerm.trim()
                ? 'No drinks found with that name.'
                : 'No drinks found matching your criteria.'}
            </Typography>
            {similarSuggestions.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, textAlign: 'center' }}>
                  You might also like
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'repeat(2, 1fr)',
                      sm: 'repeat(2, 1fr)',
                      md: 'repeat(3, 1fr)',
                      lg: 'repeat(4, 1fr)',
                    },
                    gap: { xs: 1, sm: 2 },
                    width: '100%',
                  }}
                >
                  {similarSuggestions.map((drink) => (
                    <DrinkCard key={`similar-${drink.id}`} drink={drink} />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        ) : (
          <>
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
              {displayedDrinks.map((drink) => (
                <DrinkCard key={drink.id} drink={drink} />
              ))}
            </Box>
            
            {/* Loading indicator for infinite scroll */}
            {isLoadingMore && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 3 }}>
                <CircularProgress size={40} />
              </Box>
            )}
            
            {/* Show message when all items are loaded */}
            {!isLoadingMore && itemsToShow >= filteredDrinks.length && filteredDrinks.length > itemsPerLoad && (
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

export default Menu;

