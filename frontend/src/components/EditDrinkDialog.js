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
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Divider
} from '@mui/material';
import {
  Close,
  CloudUpload,
  LocalOffer,
  AttachMoney,
  Image as ImageIcon
} from '@mui/icons-material';
import { api } from '../services/api';
import CapacityManager from './CapacityManager';
import CapacityPricingManager from './CapacityPricingManager';

const EditDrinkDialog = ({ open, onClose, drink, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    originalPrice: '',
    isAvailable: true,
    isPopular: false,
    isOnOffer: false,
    image: '',
    categoryId: '',
    capacity: [],
    capacityPricing: [],
    abv: ''
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
        price: drink.price || '',
        originalPrice: drink.originalPrice || '',
        isAvailable: drink.isAvailable || false,
        isPopular: drink.isPopular || false,
        isOnOffer: drink.isOnOffer || false,
        image: drink.image || '',
        categoryId: drink.categoryId || '',
          capacity: Array.isArray(drink.capacity) ? drink.capacity : (drink.capacity ? [drink.capacity] : []),
        capacityPricing: Array.isArray(drink.capacityPricing) ? drink.capacityPricing : [],
        abv: drink.abv || ''
      });
      setImagePreview(drink.image || '');
    }
  }, [drink]);

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

  const handleOfferToggle = (isOnOffer) => {
    setFormData(prev => ({
      ...prev,
      isOnOffer,
      // If turning off offer, revert price to original
      price: isOnOffer ? prev.price : (prev.originalPrice || prev.price)
    }));
  };

  const calculateDiscount = () => {
    if (!formData.originalPrice || !formData.price) return 0;
    const original = Number(formData.originalPrice);
    const current = Number(formData.price);
    if (original <= current) return 0;
    return Math.round(((original - current) / original) * 100);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      // Prepare update data
      const updateData = {
        name: formData.name,
        description: formData.description,
        price: formData.price,
        isAvailable: formData.isAvailable,
        isPopular: formData.isPopular,
        isOnOffer: formData.isOnOffer,
        image: formData.image,
        categoryId: formData.categoryId,
        capacity: formData.capacity,
        capacityPricing: formData.capacityPricing,
        abv: formData.abv
      };

      // If setting as offer, store original price
      if (formData.isOnOffer && formData.originalPrice) {
        updateData.originalPrice = formData.originalPrice;
      }

      console.log('Sending update data:', updateData);
      console.log('Capacity pricing:', formData.capacityPricing);
      
      await api.patch(`/admin/drinks/${drink.id}`, updateData);
      console.log('Drink updated successfully');
      
      onSave();
      onClose();
    } catch (error) {
      console.error('Error updating drink:', error);
      setError(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  const discount = calculateDiscount();

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
        fontWeight: 700
      }}>
        Edit Drink
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ color: '#00E0B8', mb: 2 }}>
              Basic Information
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Drink Name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: '#00E0B8' },
                  '&:hover fieldset': { borderColor: '#00E0B8' },
                  '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
                }
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              select
              label="Category"
              value={formData.categoryId}
              onChange={(e) => handleInputChange('categoryId', e.target.value)}
              SelectProps={{ native: true }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: '#00E0B8' },
                  '&:hover fieldset': { borderColor: '#00E0B8' },
                  '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
                }
              }}
            >
              <option value="">Select Category</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: '#00E0B8' },
                  '&:hover fieldset': { borderColor: '#00E0B8' },
                  '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
                }
              }}
            />
          </Grid>

          {/* Image Upload */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ color: '#00E0B8', mb: 2 }}>
              Image
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Box sx={{ flex: 1 }}>
                <TextField
                  fullWidth
                  label="Image URL"
                  value={formData.image}
                  onChange={(e) => {
                    handleInputChange('image', e.target.value);
                    setImagePreview(e.target.value);
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { borderColor: '#00E0B8' },
                      '&:hover fieldset': { borderColor: '#00E0B8' },
                      '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
                    }
                  }}
                />
              </Box>
              <input
                accept="image/*"
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
                  Upload
                </Button>
              </label>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Max file size: 2MB. For best performance, use image URLs instead of file uploads.
              </Typography>
            </Box>
            {imagePreview && (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
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
          </Grid>

          <Divider sx={{ my: 2, borderColor: '#333' }} />

          {/* Pricing */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ color: '#00E0B8', mb: 2 }}>
              Pricing & Offers
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Original Price (KES)"
              type="number"
              value={formData.originalPrice}
              onChange={(e) => handleInputChange('originalPrice', e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: '#00E0B8' },
                  '&:hover fieldset': { borderColor: '#00E0B8' },
                  '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
                }
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Current Price (KES)"
              type="number"
              value={formData.price}
              onChange={(e) => handleInputChange('price', e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: '#00E0B8' },
                  '&:hover fieldset': { borderColor: '#00E0B8' },
                  '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
                }
              }}
            />
          </Grid>

          {/* Capacity Management */}
          <Grid item xs={12}>
            <CapacityManager
              capacities={formData.capacity}
              onChange={(capacities) => handleInputChange('capacity', capacities)}
            />
          </Grid>

          {/* Capacity Pricing Management */}
          <Grid item xs={12}>
            <CapacityPricingManager
              capacityPricing={formData.capacityPricing}
              onChange={(pricing) => handleInputChange('capacityPricing', pricing)}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="ABV (%)"
              type="number"
              inputProps={{ step: "0.1", min: "0", max: "100" }}
              value={formData.abv}
              onChange={(e) => handleInputChange('abv', e.target.value)}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: '#00E0B8' },
                  '&:hover fieldset': { borderColor: '#00E0B8' },
                  '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
                }
              }}
            />
          </Grid>

          {formData.isOnOffer && discount > 0 && (
            <Grid item xs={12}>
              <Chip
                icon={<LocalOffer />}
                label={`${discount}% OFF`}
                sx={{
                  backgroundColor: '#FF3366',
                  color: '#F5F5F5',
                  fontWeight: 'bold'
                }}
              />
            </Grid>
          )}

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isOnOffer}
                  onChange={(e) => handleOfferToggle(e.target.checked)}
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
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocalOffer sx={{ color: '#FF3366' }} />
                  <Typography sx={{ color: '#FF3366', fontWeight: 600 }}>
                    Set as Special Offer
                  </Typography>
                </Box>
              }
            />
          </Grid>

          <Divider sx={{ my: 2, borderColor: '#333' }} />

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
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditDrinkDialog;
