import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Grid,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  IconButton,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Close,
  CloudUpload,
  AttachMoney,
  Image as ImageIcon
} from '@mui/icons-material';
import { api } from '../services/api';
import CapacityPricingCombined from './CapacityPricingCombined';

const EditDrinkDialog = ({ open, onClose, drink, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isAvailable: true,
    isPopular: false,
    limitedTimeOffer: false,
    image: '',
    categoryId: '',
    capacity: [],
    capacityPricing: [],
    abv: '',
    stock: 0
  });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [imagePreview, setImagePreview] = useState('');

  useEffect(() => {
    if (drink) {
      setFormData({
        name: drink.name || '',
        description: drink.description || '',
        isAvailable: drink.isAvailable !== undefined ? drink.isAvailable : true,
        isPopular: drink.isPopular || false,
        limitedTimeOffer: drink.limitedTimeOffer || false,
        image: drink.image || '',
        categoryId: drink.categoryId || '',
        capacity: Array.isArray(drink.capacity) ? drink.capacity : (drink.capacity ? [drink.capacity] : []),
        capacityPricing: Array.isArray(drink.capacityPricing) ? drink.capacityPricing : [],
        abv: drink.abv || '',
        stock: drink.stock !== undefined && drink.stock !== null ? drink.stock : 0
      });
      setImagePreview(drink.image || '');
    } else {
      // Reset form for new drink creation
      setFormData({
        name: '',
        description: '',
        isAvailable: true,
        isPopular: false,
        limitedTimeOffer: false,
        image: '',
        categoryId: '',
        capacity: [],
        capacityPricing: [],
        abv: '',
        stock: 0
      });
      setImagePreview('');
    }
    setError(null);
  }, [drink, open]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Check file size (limit to 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError('Image file is too large. Please choose an image smaller than 2MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
        setFormData(prev => ({
          ...prev,
          image: e.target.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validation - check for empty strings and ensure categoryId is a number
      if (!formData.name || formData.name.trim() === '') {
        setError('Name is required');
        setLoading(false);
        return;
      }
      
      if (!formData.categoryId || formData.categoryId === '') {
        setError('Category is required');
        setLoading(false);
        return;
      }

      // Validate that at least one capacity is added
      if (!formData.capacityPricing || formData.capacityPricing.length === 0) {
        setError('At least one capacity with pricing is required');
        setLoading(false);
        return;
      }

      // Get the lowest current price from capacity pricing for the main price field
      const lowestPrice = Math.min(
        ...formData.capacityPricing.map(p => parseFloat(p.currentPrice || p.price || 0))
      );

      // Get the lowest original price from capacity pricing for the originalPrice field
      const lowestOriginalPrice = Math.min(
        ...formData.capacityPricing.map(p => parseFloat(p.originalPrice || p.currentPrice || p.price || 0))
      );

      // Prepare data
      const saveData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: lowestPrice, // Use lowest price from capacities
        originalPrice: lowestOriginalPrice, // Use lowest original price from capacities
        isAvailable: formData.isAvailable,
        isPopular: formData.isPopular,
        limitedTimeOffer: !!formData.limitedTimeOffer,
        image: formData.image,
        categoryId: parseInt(formData.categoryId),
        capacity: formData.capacity,
        capacityPricing: formData.capacityPricing,
        abv: formData.abv ? parseFloat(formData.abv) : null,
        stock: formData.stock !== undefined && formData.stock !== null ? parseInt(formData.stock) || 0 : 0
      };

      if (drink && drink.id) {
        // Update existing drink
        console.log('Updating drink:', drink.id);
        await api.put(`/admin/drinks/${drink.id}`, saveData);
        
        // Also update stock via inventory endpoint
        try {
          await api.post('/inventory/update-stock', {
            drinkId: drink.id,
            stock: parseInt(formData.stock) || 0
          });
        } catch (stockError) {
          console.warn('Failed to update stock via inventory endpoint:', stockError);
          // Continue even if stock update fails - main drink update succeeded
        }
        
        console.log('Drink updated successfully');
      } else {
        // Create new drink
        console.log('Creating new drink');
        const response = await api.post('/admin/drinks', saveData);
        const newDrinkId = response.data.id;
        
        // Update stock for new drink
        if (newDrinkId && (formData.stock !== undefined && formData.stock !== null)) {
          try {
            await api.post('/inventory/update-stock', {
              drinkId: newDrinkId,
              stock: parseInt(formData.stock) || 0
            });
          } catch (stockError) {
            console.warn('Failed to update stock for new drink:', stockError);
          }
        }
        
        console.log('Drink created successfully');
      }
      
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving drink:', error);
      setError(error.response?.data?.error || error.message || 'Failed to save drink');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#121212',
          color: '#F5F5F5'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        color: '#00E0B8',
        fontWeight: 700,
        borderBottom: '1px solid #333'
      }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 700 }}>
          {drink && drink.id ? 'Edit Drink' : 'Create new Item'}
        </Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ width: '100%' }}>
          {/* Basic Information */}
          <Typography variant="h6" sx={{ color: '#00E0B8', mb: 2 }}>
            Basic Information
          </Typography>

          <TextField
            fullWidth
            label="Drink Name"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#00E0B8' },
                '&:hover fieldset': { borderColor: '#00E0B8' },
                '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
              }
            }}
          />

          <FormControl
            fullWidth
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#00E0B8' },
                '&:hover fieldset': { borderColor: '#00E0B8' },
                '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
              }
            }}
          >
            <InputLabel id="category-select-label" sx={{ color: '#00E0B8' }}>
              Category
            </InputLabel>
            <Select
              labelId="category-select-label"
              value={formData.categoryId}
              onChange={(e) => handleInputChange('categoryId', e.target.value)}
              label="Category"
              sx={{
                color: '#F5F5F5',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#00E0B8',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#00E0B8',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#00E0B8',
                },
                '& .MuiSvgIcon-root': {
                  color: '#00E0B8',
                }
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    backgroundColor: '#1E1E1E',
                    color: '#F5F5F5',
                    '& .MuiMenuItem-root': {
                      '&:hover': {
                        backgroundColor: 'rgba(0, 224, 184, 0.1)',
                      },
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(0, 224, 184, 0.2)',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 224, 184, 0.3)',
                        }
                      }
                    }
                  }
                }
              }}
            >
              <MenuItem value="">
                <em>Select Category</em>
              </MenuItem>
              {categories.map(category => (
                <MenuItem key={category.id} value={category.id}>
                  {category.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#00E0B8' },
                '&:hover fieldset': { borderColor: '#00E0B8' },
                '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
              }
            }}
          />

          <TextField
            fullWidth
            label="ABV (%)"
            type="number"
            inputProps={{ step: "0.1", min: "0", max: "100" }}
            value={formData.abv}
            onChange={(e) => handleInputChange('abv', e.target.value)}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#00E0B8' },
                '&:hover fieldset': { borderColor: '#00E0B8' },
                '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
              }
            }}
          />

          <TextField
            fullWidth
            label="Stock Quantity"
            type="number"
            inputProps={{ step: "1", min: "0" }}
            value={formData.stock}
            onChange={(e) => handleInputChange('stock', e.target.value)}
            helperText="Number of items currently in stock"
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#00E0B8' },
                '&:hover fieldset': { borderColor: '#00E0B8' },
                '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
              }
            }}
          />
        </Box>

        <Box sx={{ width: '100%', mt: 2 }}>
          {/* Image Upload */}
          <Typography variant="h6" sx={{ color: '#00E0B8', mb: 2 }}>
            Image
          </Typography>
          <Box sx={{ mb: 2 }}>
            <input
              accept="image/*,.webp"
              style={{ display: 'none' }}
              id="image-upload"
              type="file"
              onChange={handleImageChange}
            />
            <label htmlFor="image-upload">
              <Button
                variant="outlined"
                component="span"
                startIcon={<CloudUpload />}
                sx={{
                  borderColor: '#00E0B8',
                  color: '#00E0B8',
                  '&:hover': {
                    borderColor: '#00C4A3',
                    backgroundColor: 'rgba(0, 224, 184, 0.1)'
                  }
                }}
              >
                Upload Image
              </Button>
            </label>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Max file size: 2MB
            </Typography>
          </Box>
          {imagePreview && (
            <Box sx={{ mt: 2, textAlign: 'left' }}>
              <img
                src={imagePreview}
                alt="Preview"
                style={{
                  maxWidth: '200px',
                  maxHeight: '150px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  border: '2px solid #00E0B8'
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </Box>
          )}
        </Box>

        <Divider sx={{ my: 3, borderColor: '#333', width: '100%' }} />

        <Box sx={{ width: '100%' }}>
          {/* Capacities and Pricing */}
          <Typography variant="h6" sx={{ color: '#00E0B8', mb: 2 }}>
            Capacities and Pricing
          </Typography>

          <Box sx={{ mb: 2 }}>
            <CapacityPricingCombined
              capacityPricing={formData.capacityPricing || []}
              capacities={formData.capacity || []}
              onChange={(pricing, capacities) => {
                handleInputChange('capacityPricing', pricing);
                handleInputChange('capacity', capacities);
              }}
            />
          </Box>
        </Box>

        <Divider sx={{ my: 3, borderColor: '#333', width: '100%' }} />

        <Grid container spacing={3}>

          {/* Status */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ color: '#00E0B8', mb: 2 }}>
              Status
            </Typography>
          </Grid>

          <Grid item xs={12} sm={4}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isAvailable}
                  onChange={(e) => handleInputChange('isAvailable', e.target.checked)}
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
              label="Available"
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isPopular}
                  onChange={(e) => handleInputChange('isPopular', e.target.checked)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#FF3366',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#FF3366',
                    },
                  }}
                />
              }
              label="Popular"
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.limitedTimeOffer}
                  onChange={(e) => handleInputChange('limitedTimeOffer', e.target.checked)}
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
              label="Limited Time Offer"
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button
          onClick={onClose}
          sx={{ color: 'text.secondary' }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <AttachMoney />}
          sx={{
            backgroundColor: '#00E0B8',
            color: '#0D0D0D',
            '&:hover': { backgroundColor: '#00C4A3' }
          }}
        >
          {loading ? 'Saving...' : (drink && drink.id ? 'Save Changes' : 'Create Drink')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditDrinkDialog;
