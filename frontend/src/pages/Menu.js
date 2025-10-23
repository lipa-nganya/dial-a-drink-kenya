import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Box,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Chip
} from '@mui/material';
import { Search, Star } from '@mui/icons-material';
import DrinkCard from '../components/DrinkCard';
import { api } from '../services/api';

const Menu = () => {
  const [drinks, setDrinks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [filteredDrinks, setFilteredDrinks] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterDrinks();
  }, [drinks, searchTerm, selectedCategory]);

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

  const filterDrinks = () => {
    let filtered = drinks;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(drink =>
        drink.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        drink.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory > 0) {
      filtered = filtered.filter(drink => drink.categoryId === selectedCategory);
    }

    setFilteredDrinks(filtered);
  };

  const handleCategoryChange = (event, newValue) => {
    setSelectedCategory(newValue);
  };

  const popularDrinks = drinks.filter(drink => drink.isPopular);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Our Menu
      </Typography>

      {/* Search Bar */}
      <Box sx={{ mb: 4 }}>
        <TextField
          fullWidth
          placeholder="Search drinks..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ maxWidth: 600 }}
        />
      </Box>

      {/* Category Tabs */}
      <Box sx={{ mb: 4 }}>
        <Tabs
          value={selectedCategory}
          onChange={handleCategoryChange}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="All" />
          {categories.map((category) => (
            <Tab key={category.id} label={category.name} value={category.id} />
          ))}
        </Tabs>
      </Box>

      {/* Popular Drinks */}
      {selectedCategory === 0 && !searchTerm && (
        <Box sx={{ mb: 6 }}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Star color="secondary" />
            Popular Drinks
          </Typography>
          <Grid container spacing={3}>
            {popularDrinks.map((drink) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={drink.id}>
                <DrinkCard drink={drink} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* All Drinks */}
      <Box>
        <Typography variant="h5" gutterBottom>
          {selectedCategory === 0 ? 'All Drinks' : categories.find(c => c.id === selectedCategory)?.name}
        </Typography>
        
        {loading ? (
          <Typography textAlign="center">Loading drinks...</Typography>
        ) : filteredDrinks.length === 0 ? (
          <Typography textAlign="center" color="text.secondary">
            No drinks found matching your criteria.
          </Typography>
        ) : (
          <Grid container spacing={3}>
            {filteredDrinks.map((drink) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={drink.id}>
                <DrinkCard drink={drink} />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Container>
  );
};

export default Menu;

