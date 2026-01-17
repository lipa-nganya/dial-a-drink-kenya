import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  TextField,
  InputAdornment,
  Grid
} from '@mui/material';
import { Search, LocalShipping } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

// Predefined list of Nairobi locations
const NAIROBI_LOCATIONS = [
  'Adams Arcade',
  'Athi River',
  'Buruburu',
  'Donholm',
  'Eastleigh',
  'Embakasi',
  'Embakasi Village',
  'Gigiri',
  'Hurlingham',
  'Juja',
  'Kangemi',
  'Karen',
  'Kasarani',
  'Kawangware',
  'Kibera',
  'Kiambu Road',
  'Kikuyu',
  'Kilimani',
  'Kileleshwa',
  'Kiserian',
  'Kitengela',
  'Langata',
  'Lavington',
  'Limuru',
  'Machakos',
  'Mlolongo',
  'Muthaiga',
  'Nairobi CBD',
  'Ngara',
  'Ngong',
  'Ngong Road',
  'Nyari',
  'Nyayo Estate',
  'Ongata Rongai',
  'Pangani',
  'Parklands',
  'Ridgeways',
  'Riverside',
  'Rosslyn',
  'Ruaka',
  'Ruaraka',
  'Ruiru',
  'Runda',
  'South B',
  'South C',
  'Spring Valley',
  'Syokimau',
  'Thika',
  'Thika Road',
  'Upper Hill',
  'Umoja',
  'Westlands',
  'Westlands CBD',
  'Yaya'
].sort();

const DeliveryLocations = () => {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const [filteredLocations, setFilteredLocations] = useState(NAIROBI_LOCATIONS);
  const [searchTerm, setSearchTerm] = useState('');

  const handleLocationClick = (locationName) => {
    const encodedName = encodeURIComponent(locationName);
    navigate(`/delivery-location/${encodedName}`);
  };

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredLocations(NAIROBI_LOCATIONS);
    } else {
      const filtered = NAIROBI_LOCATIONS.filter(location =>
        location.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredLocations(filtered);
    }
  }, [searchTerm]);


  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <LocalShipping sx={{ fontSize: 40, color: colors.accentText }} />
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, color: colors.textPrimary }}>
            Delivery Locations
          </Typography>
        </Box>
        <Typography variant="body1" sx={{ color: colors.textSecondary, mb: 3 }}>
          We deliver to the following locations in Nairobi. Delivery fees vary by location.
        </Typography>

        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search delivery locations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 4 }}
        />
      </Box>

      {filteredLocations.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            {searchTerm ? 'No locations found matching your search' : 'No delivery locations available'}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filteredLocations.map((location) => (
            <Grid item xs={12} md={4} key={location}>
              <Box
                onClick={() => handleLocationClick(location)}
                sx={{
                  py: 2,
                  px: 2,
                  cursor: 'pointer',
                  textAlign: 'center',
                  borderRadius: 1,
                  border: `1px solid ${colors.border || 'rgba(0, 0, 0, 0.12)'}`,
                  backgroundColor: colors.paper,
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: colors.hover || 'rgba(0, 0, 0, 0.04)',
                    borderColor: colors.accentText,
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                <Typography variant="body1" sx={{ fontWeight: 500, color: colors.textPrimary }}>
                  {location}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      )}

      <Box sx={{ mt: 4, p: 3, backgroundColor: colors.paper, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: colors.textPrimary, mb: 2 }}>
          Delivery Information
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>
          • Standard delivery times vary by location
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>
          • Minimum order value may apply
        </Typography>
        <Typography variant="body2" sx={{ color: colors.textSecondary }}>
          • For locations not listed, please contact us at +254 723 688 108
        </Typography>
      </Box>
    </Container>
  );
};

export default DeliveryLocations;
