import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Pagination
} from '@mui/material';
import { Search } from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import BrandCard from '../components/BrandCard';

const Brands = () => {
  const { colors } = useTheme();
  const [brands, setBrands] = useState([]);
  const [filteredBrands, setFilteredBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  const itemsPerPage = 16; // 4 rows × 4 columns

  useEffect(() => {
    fetchBrands();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredBrands(brands);
    } else {
      const filtered = brands.filter(brand =>
        brand.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (brand.country && brand.country.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (brand.description && brand.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredBrands(filtered);
    }
    setCurrentPage(1); // Reset to first page when search changes
  }, [searchTerm, brands]);

  const fetchBrands = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/brands');
      setBrands(response.data);
      setFilteredBrands(response.data);
    } catch (err) {
      console.error('Error fetching brands:', err);
      setError('Failed to load brands. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Calculate pagination for filtered brands
  const totalPages = Math.ceil(filteredBrands.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBrands = filteredBrands.slice(startIndex, endIndex);

  // Update document title for SEO
  useEffect(() => {
    document.title = 'Premium Alcohol Brands in Kenya | Dial a Drink Kenya';
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Explore our extensive collection of premium alcohol brands from around the world. Discover top spirits, wines, beers, and more from renowned brands like Jameson, Baileys, Absolut, and over 300 others. Fast delivery across Kenya.');
    }
  }, []);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Box sx={{ backgroundColor: colors.background, minHeight: '100vh' }}>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          {/* SEO-Optimized Header Content */}
          <Box sx={{ mb: 4 }}>
            <Typography 
              variant="h1" 
              component="h1" 
              sx={{ 
                fontWeight: 700, 
                mb: 2, 
                color: colors.textPrimary,
                fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' }
              }}
            >
              Premium Alcohol Brands in Kenya
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ 
                color: colors.textSecondary, 
                mb: 2,
                fontSize: '1.1rem',
                lineHeight: 1.8
              }}
            >
              Discover our curated selection of over 350 premium alcohol brands from around the world. 
              From world-renowned whiskeys and gins to exquisite wines and champagnes, we bring you 
              the finest spirits delivered straight to your door across Kenya.
            </Typography>
            
            {/* Additional SEO Content */}
            <Box sx={{ mb: 3, p: 2, backgroundColor: colors.paper, borderRadius: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: colors.textPrimary }}>
                Why Choose Our Brand Collection?
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2, color: colors.textSecondary }}>
                <li>World-Class Selection: Premium brands from Scotland, Ireland, France, and beyond</li>
                <li>Authentic Products: Guaranteed genuine products from authorized distributors</li>
                <li>Fast Delivery: Express delivery available in select locations across Kenya</li>
                <li>Competitive Prices: Best prices on premium alcohol brands in Kenya</li>
                <li>Expert Curation: Handpicked collection of award-winning spirits and beverages</li>
              </Box>
            </Box>

            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search brands by name, country, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2, maxWidth: 600 }}
            />
            
            {filteredBrands.length > 0 && (
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                Showing {paginatedBrands.length} of {filteredBrands.length} brands
              </Typography>
            )}
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : filteredBrands.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="text.secondary">
                {searchTerm ? 'No brands found matching your search' : 'No brands available'}
              </Typography>
            </Box>
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
                {paginatedBrands.map((brand) => (
                  <BrandCard key={brand.id} brand={brand} />
                ))}
              </Box>
              
              {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
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

          {/* Additional SEO Footer Content */}
          {!loading && filteredBrands.length > 0 && (
            <Box sx={{ mt: 6, mb: 4 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 2, color: colors.textPrimary }}>
                Popular Brand Categories
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  <strong>Whiskey Brands:</strong> Jameson, Johnnie Walker, Jack Daniels, Glenmorangie, Chivas Regal, Macallan, and more
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  <strong>Gin Brands:</strong> Tanqueray, Beefeater, Hendricks, Gordon's, Whitley Neill, and more
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  <strong>Vodka Brands:</strong> Absolut, Smirnoff, Grey Goose, Ketel One, Skyy Vodka, and more
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  <strong>Wine Brands:</strong> South African wines, French wines, Italian wines, and more
                </Typography>
                <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                  <strong>Champagne Brands:</strong> Moet and Chandon, Veuve Cliquot, Belaire, and more
                </Typography>
              </Box>
              
              <Typography variant="body2" sx={{ color: colors.textSecondary, lineHeight: 1.8 }}>
                Dial a Drink Kenya is your trusted source for premium alcohol brands. Whether you're 
                looking for a rare Scotch whisky, a classic Irish whiskey, an award-winning gin, or 
                an exquisite French champagne, we have it all. Browse our collection of over 350 brands 
                and have your favorite spirits delivered to your door. Order now and experience the best in premium alcohol delivery in Kenya.
              </Typography>
            </Box>
          )}
        </Container>
      </Box>
  );
};

export default Brands;
