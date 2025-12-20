import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Chip,
  Pagination
} from '@mui/material';
import { Search, Star } from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import DrinkCard from '../components/DrinkCard';
import { api } from '../services/api';

const Menu = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [drinks, setDrinks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [selectedSubcategory, setSelectedSubcategory] = useState(0);
  const [filteredDrinks, setFilteredDrinks] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  
  const itemsPerPage = 16; // 4 rows × 4 columns

  useEffect(() => {
    fetchData();
  }, []);

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

  useEffect(() => {
    filterDrinks();
  }, [drinks, searchTerm, selectedCategory, selectedSubcategory]);

  // Reset pagination when category or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchTerm]);

  const fetchData = async () => {
    try {
      const [drinksResponse, categoriesResponse] = await Promise.all([
        api.get('/drinks'),
        api.get('/categories')
      ]);
      setDrinks(drinksResponse.data);
      setCategories(categoriesResponse.data);
    } catch (error) {
      console.error('Error fetching data:', error);
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

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(drink => {
        if (!drink) return false;
        const nameMatch = drink.name && typeof drink.name === 'string' 
          ? drink.name.toLowerCase().includes(searchTerm.toLowerCase()) 
          : false;
        const descMatch = drink.description && typeof drink.description === 'string'
          ? drink.description.toLowerCase().includes(searchTerm.toLowerCase())
          : false;
        return nameMatch || descMatch;
      });
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
    // If selectedCategory === 0, show all drinks (no filter)

    setFilteredDrinks(filtered);
  };

  const handleCategoryChange = (event, newValue) => {
    setSelectedCategory(newValue);
    setSelectedSubcategory(0); // Reset subcategory when category changes
    // Update URL query parameter
    if (newValue > 0) {
      setSearchParams({ category: newValue.toString() });
    } else {
      // Clear category param for "All" (0) or "Popular" (-1)
      setSearchParams({});
    }
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

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // Calculate pagination for filtered drinks
  const totalPages = Math.ceil(filteredDrinks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDrinks = filteredDrinks.slice(startIndex, endIndex);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Our Menu
      </Typography>

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

      {/* Category Tabs */}
      <Box sx={{ mb: 2 }}>
        <Tabs
          value={selectedCategory}
          onChange={handleCategoryChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ '& .MuiTab-root': { fontSize: '0.8rem', py: 1 } }}
        >
          <Tab label="All" value={0} />
          <Tab 
            label="Popular" 
            value={-1}
            icon={<Star sx={{ fontSize: '0.9rem', mb: 0.5 }} />}
            iconPosition="start"
          />
          {categories.map((category) => (
            <Tab key={category.id} label={category.name} value={category.id} />
          ))}
        </Tabs>
      </Box>

      {/* Subcategory Chips - Show when a category is selected */}
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
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {filteredDrinks.filter(d => d.isAvailable).length} available
              </Typography>
              {filteredDrinks.filter(d => !d.isAvailable).length > 0 && (
                <Typography variant="body2" color="error" sx={{ fontWeight: 'bold' }}>
                  {filteredDrinks.filter(d => !d.isAvailable).length} out of stock
                </Typography>
              )}
            </Box>
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
              {paginatedDrinks.map((drink) => (
                <DrinkCard key={drink.id} drink={drink} />
              ))}
            </Box>
            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                <Pagination
                  count={totalPages}
                  page={currentPage}
                  onChange={handlePageChange}
                  color="primary"
                  size="large"
                />
              </Box>
            )}
          </>
        )}
      </Box>
    </Container>
  );
};

export default Menu;

