import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Chip,
  Grid,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  LocalBar,
  CheckCircle,
  Cancel,
  Edit,
  Visibility,
  VisibilityOff,
  Inventory,
  TrendingUp,
  TrendingDown
} from '@mui/icons-material';
import { api } from '../../services/api';
import EditDrinkDialog from '../../components/EditDrinkDialog';

const InventoryPage = () => {
  const [drinks, setDrinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedDrink, setSelectedDrink] = useState(null);

  useEffect(() => {
    fetchDrinks();
  }, []);

  const fetchDrinks = async () => {
    try {
      const response = await api.get('/admin/drinks');
      setDrinks(response.data);
    } catch (error) {
      console.error('Error fetching drinks:', error);
      setError(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAvailabilityToggle = async (drinkId, isAvailable) => {
    try {
      await api.patch(`/admin/drinks/${drinkId}/availability`, { isAvailable });
      setDrinks(drinks.map(drink => 
        drink.id === drinkId ? { ...drink, isAvailable } : drink
      ));
    } catch (error) {
      console.error('Error updating drink availability:', error);
    }
  };

  const getAvailabilityColor = (isAvailable) => {
    return isAvailable ? 'success' : 'error';
  };

  const getAvailabilityIcon = (isAvailable) => {
    return isAvailable ? <CheckCircle /> : <Cancel />;
  };

  const handleEditDrink = (drink) => {
    setSelectedDrink(drink);
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setSelectedDrink(null);
  };

  const handleSaveDrink = () => {
    fetchDrinks(); // Refresh the drinks list
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading inventory...</Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">Error loading inventory: {error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ color: '#00E0B8', fontWeight: 700 }}>
          📦 Inventory Management
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Manage drink availability and stock status
        </Typography>
      </Box>

      {drinks.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <LocalBar sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No drinks found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add drinks to your inventory to manage them here
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {drinks.map((drink) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={drink.id}>
              <Card 
                sx={{ 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 20px rgba(0, 224, 184, 0.15)'
                  }
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  {/* Drink Image */}
                  <Box sx={{ mb: 2, textAlign: 'center' }}>
                    <img
                      src={drink.image || 'https://via.placeholder.com/200x200/0D0D0D/FFFFFF?text=No+Image'}
                      alt={drink.name}
                      style={{
                        width: '100%',
                        height: '150px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        backgroundColor: '#121212'
                      }}
                      onError={(e) => {
                        e.target.src = 'https://via.placeholder.com/200x200/0D0D0D/FFFFFF?text=No+Image';
                      }}
                    />
                  </Box>

                  {/* Drink Info */}
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="h6" sx={{ color: '#00E0B8', fontWeight: 600, mb: 1 }}>
                      {drink.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {drink.description}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      {drink.isOnOffer && drink.originalPrice ? (
                        <>
                          <Typography 
                            variant="body2" 
                            color="text.secondary" 
                            sx={{ textDecoration: 'line-through' }}
                          >
                            KES {Number(drink.originalPrice).toFixed(2)}
                          </Typography>
                          <Typography variant="h6" sx={{ color: '#FF3366', fontWeight: 700 }}>
                            KES {Number(drink.price).toFixed(2)}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="h6" sx={{ color: '#FF3366', fontWeight: 700 }}>
                          KES {Number(drink.price).toFixed(2)}
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {/* Capacity and ABV */}
                  {((Array.isArray(drink.capacity) && drink.capacity.length > 0) || drink.abv) && (
                    <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {Array.isArray(drink.capacity) && drink.capacity.length > 0 && drink.capacity.map((cap, index) => (
                        <Chip
                          key={index}
                          label={cap}
                          size="small"
                          sx={{
                            backgroundColor: '#121212',
                            color: '#00E0B8',
                            border: '1px solid #00E0B8'
                          }}
                        />
                      ))}
                      {drink.abv && (
                        <Chip
                          label={`${Number(drink.abv)}% ABV`}
                          size="small"
                          sx={{
                            backgroundColor: '#FF3366',
                            color: '#F5F5F5'
                          }}
                        />
                      )}
                    </Box>
                  )}

                  {/* Category */}
                  {drink.category && (
                    <Box sx={{ mb: 2 }}>
                      <Chip
                        label={drink.category.name}
                        size="small"
                        sx={{
                          backgroundColor: '#121212',
                          color: '#00E0B8',
                          border: '1px solid #00E0B8'
                        }}
                      />
                    </Box>
                  )}

                  {/* Status Indicators */}
                  <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      icon={getAvailabilityIcon(drink.isAvailable)}
                      label={drink.isAvailable ? 'Available' : 'Out of Stock'}
                      color={getAvailabilityColor(drink.isAvailable)}
                      size="small"
                    />
                    {drink.isPopular && (
                      <Chip
                        label="Popular"
                        size="small"
                        sx={{
                          backgroundColor: '#FF3366',
                          color: '#F5F5F5'
                        }}
                      />
                    )}
                    {drink.isOnOffer && (
                      <Chip
                        label="On Offer"
                        size="small"
                        sx={{
                          backgroundColor: '#00E0B8',
                          color: '#0D0D0D'
                        }}
                      />
                    )}
                  </Box>

                  {/* Availability Toggle */}
                  <Box sx={{ mb: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={drink.isAvailable}
                          onChange={(e) => handleAvailabilityToggle(drink.id, e.target.checked)}
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: '#00E0B8',
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: '#00E0B8',
                            },
                          }}
                        />
                      }
                      label={
                        <Typography variant="body2" color="text.secondary">
                          {drink.isAvailable ? 'Available' : 'Out of Stock'}
                        </Typography>
                      }
                    />
                  </Box>

                  {/* Action Buttons */}
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                    <Tooltip title="View Details">
                      <IconButton size="small" color="primary">
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit Drink">
                      <IconButton 
                        size="small" 
                        color="secondary"
                        onClick={() => handleEditDrink(drink)}
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {/* Last Updated */}
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                    Updated: {new Date(drink.updatedAt).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Summary Stats */}
      <Box sx={{ mt: 4 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#121212' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <Inventory sx={{ fontSize: 40, color: '#00E0B8', mb: 1 }} />
                <Typography variant="h4" sx={{ color: '#00E0B8', fontWeight: 700 }}>
                  {drinks.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Drinks
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#121212' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <TrendingUp sx={{ fontSize: 40, color: '#00E0B8', mb: 1 }} />
                <Typography variant="h4" sx={{ color: '#00E0B8', fontWeight: 700 }}>
                  {drinks.filter(drink => drink.isAvailable).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Available
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#121212' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <TrendingDown sx={{ fontSize: 40, color: '#FF3366', mb: 1 }} />
                <Typography variant="h4" sx={{ color: '#FF3366', fontWeight: 700 }}>
                  {drinks.filter(drink => !drink.isAvailable).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Out of Stock
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#121212' }}>
              <CardContent sx={{ textAlign: 'center' }}>
                <LocalBar sx={{ fontSize: 40, color: '#00E0B8', mb: 1 }} />
                <Typography variant="h4" sx={{ color: '#00E0B8', fontWeight: 700 }}>
                  {drinks.filter(drink => drink.isPopular).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Popular Items
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Edit Drink Dialog */}
      <EditDrinkDialog
        open={editDialogOpen}
        onClose={handleCloseEditDialog}
        drink={selectedDrink}
        onSave={handleSaveDrink}
      />
    </Container>
  );
};

export default InventoryPage;
