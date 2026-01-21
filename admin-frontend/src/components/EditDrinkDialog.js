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
  MenuItem,
  InputAdornment
} from '@mui/material';
import {
  Close,
  CloudUpload,
  AttachMoney
} from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import CapacityPricingCombined from './CapacityPricingCombined';

const EditDrinkDialog = ({ open, onClose, drink, onSave }) => {
  const { isDarkMode, colors } = useTheme();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isAvailable: true,
    isPopular: false,
    isBrandFocus: false,
    limitedTimeOffer: false,
    image: '',
    categoryId: '',
    subCategoryId: '',
    brandId: '',
    capacity: [],
    capacityPricing: [],
    abv: '',
    stock: 0,
    purchasePrice: ''
  });
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [imagePreview, setImagePreview] = useState('');

  useEffect(() => {
    if (drink) {
      // Get brandId from drink.brandId or drink.brand?.id
      const brandId = drink.brandId || (drink.brand && drink.brand.id) || '';
      
      // Debug purchasePrice
      console.log('🔍 EditDrinkDialog - Loading drink:', {
        id: drink.id,
        name: drink.name,
        purchasePrice: drink.purchasePrice,
        purchasePriceType: typeof drink.purchasePrice,
        hasPurchasePrice: 'purchasePrice' in drink,
        allKeys: Object.keys(drink)
      });
      
      const purchasePriceValue = drink.purchasePrice !== undefined && drink.purchasePrice !== null 
        ? String(drink.purchasePrice).trim() 
        : '';
      
      console.log('🔍 PurchasePrice value to set:', purchasePriceValue);
      
      const newFormData = {
        name: drink.name || '',
        description: drink.description || '',
        isAvailable: drink.isAvailable !== undefined ? drink.isAvailable : true,
        isPopular: drink.isPopular || false,
        isBrandFocus: drink.isBrandFocus || false,
        limitedTimeOffer: drink.limitedTimeOffer || false,
        image: drink.image || '',
        categoryId: drink.categoryId || '',
        subCategoryId: drink.subCategoryId || '',
        brandId: brandId ? brandId.toString() : '',
        capacity: Array.isArray(drink.capacity) ? drink.capacity : (drink.capacity ? [drink.capacity] : []),
        capacityPricing: Array.isArray(drink.capacityPricing) ? drink.capacityPricing : [],
        abv: drink.abv || '',
        stock: drink.stock !== undefined && drink.stock !== null ? drink.stock : 0,
        purchasePrice: purchasePriceValue
      };
      
      console.log('🔍 FormData being set:', {
        purchasePrice: newFormData.purchasePrice,
        purchasePriceType: typeof newFormData.purchasePrice,
        purchasePriceLength: newFormData.purchasePrice ? newFormData.purchasePrice.length : 0
      });
      
      setFormData(newFormData);
      // Fetch subcategories for the drink's category
      if (drink.categoryId) {
        fetchSubcategories(drink.categoryId);
      }
      setImagePreview(drink.image || '');
    } else {
      // Reset form for new drink creation
      setFormData({
        name: '',
        description: '',
        isAvailable: true,
        isPopular: false,
        isBrandFocus: false,
        limitedTimeOffer: false,
        image: '',
        categoryId: '',
        subCategoryId: '',
        brandId: '',
        capacity: [],
        capacityPricing: [],
        abv: '',
        stock: 0,
        purchasePrice: ''
      });
      setImagePreview('');
      setSubcategories([]);
    }
    setError(null);
  }, [drink, open]);

  useEffect(() => {
    fetchCategories();
    fetchBrands();
  }, []);
  
  // Debug: Log formData.purchasePrice changes
  useEffect(() => {
    if (formData.purchasePrice !== undefined) {
      console.log('🔍 FormData purchasePrice changed:', {
        value: formData.purchasePrice,
        type: typeof formData.purchasePrice,
        isEmpty: !formData.purchasePrice || formData.purchasePrice === ''
      });
    }
  }, [formData.purchasePrice]);

  const fetchBrands = async () => {
    try {
      const response = await api.get('/brands/all');
      setBrands(response.data || []);
    } catch (error) {
      console.error('Error fetching brands:', error);
      setBrands([]);
    }
  };

  // Fetch subcategories when category changes
  useEffect(() => {
    if (formData.categoryId) {
      fetchSubcategories(formData.categoryId).then((fetchedSubcategories) => {
        // After fetching subcategories, check if current subcategory belongs to new category
        if (formData.subCategoryId && fetchedSubcategories.length > 0) {
          // Verify the subcategory belongs to the selected category
          const subcategoryExists = fetchedSubcategories.some(
            sub => sub.id === parseInt(formData.subCategoryId)
          );
          if (!subcategoryExists) {
            // Reset subcategory if it doesn't belong to the new category
            setFormData(prev => ({ ...prev, subCategoryId: '' }));
          }
        }
      });
    } else {
      setSubcategories([]);
      setFormData(prev => ({ ...prev, subCategoryId: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.categoryId]);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchSubcategories = async (categoryId) => {
    try {
      const response = await api.get(`/subcategories?categoryId=${categoryId}`);
      setSubcategories(response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching subcategories:', error);
      setSubcategories([]);
      return [];
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
        isBrandFocus: !!formData.isBrandFocus,
        limitedTimeOffer: !!formData.limitedTimeOffer,
        image: formData.image,
        categoryId: parseInt(formData.categoryId),
        subCategoryId: formData.subCategoryId ? parseInt(formData.subCategoryId) : null,
        brandId: formData.brandId ? parseInt(formData.brandId) : null,
        capacity: formData.capacity,
        capacityPricing: formData.capacityPricing,
        abv: formData.abv ? parseFloat(formData.abv) : null,
        // Stock is not included - admins cannot update stock quantity
        purchasePrice: formData.purchasePrice ? parseFloat(formData.purchasePrice) : null
      };

      if (drink && drink.id) {
        // Update existing drink
        console.log('Updating drink:', drink.id);
        await api.put(`/admin/drinks/${drink.id}`, saveData);
        
        // Stock updates are not allowed for admins - removed stock update call
        
        console.log('Drink updated successfully');
      } else {
        // Create new drink
        console.log('Creating new drink');
        const response = await api.post('/admin/drinks', saveData);
        const newDrinkId = response.data.id;
        
        // Stock updates are not allowed for admins - removed stock update call
        
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
          backgroundColor: colors.paper,
          color: colors.textPrimary
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        color: colors.accentText,
        fontWeight: 700,
        borderBottom: `1px solid ${colors.border}`
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
          <Typography variant="h6" sx={{ color: colors.accentText, mb: 2 }}>
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
                '& fieldset': { borderColor: colors.border },
                '&:hover fieldset': { borderColor: colors.accent },
                '&.Mui-focused fieldset': { borderColor: colors.accent }
              }
            }}
          />

          <FormControl
            fullWidth
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: colors.border },
                '&:hover fieldset': { borderColor: colors.accent },
                '&.Mui-focused fieldset': { borderColor: colors.accent }
              }
            }}
          >
            <InputLabel id="category-select-label" sx={{ color: colors.textPrimary }}>
              Category
            </InputLabel>
            <Select
              labelId="category-select-label"
              value={formData.categoryId}
              onChange={(e) => handleInputChange('categoryId', e.target.value)}
              label="Category"
              sx={{
                color: colors.textPrimary,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: colors.border,
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: colors.accent,
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: colors.accent,
                },
                '& .MuiSvgIcon-root': {
                  color: colors.accent,
                }
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    backgroundColor: colors.paper,
                    color: colors.textPrimary,
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

          {/* Subcategory Selection */}
          {formData.categoryId && subcategories.length > 0 && (
            <FormControl
              fullWidth
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: colors.border },
                  '&:hover fieldset': { borderColor: colors.accent },
                  '&.Mui-focused fieldset': { borderColor: colors.accent }
                }
              }}
            >
              <InputLabel id="subcategory-select-label" sx={{ color: colors.textPrimary }}>
                Subcategory (Optional)
              </InputLabel>
              <Select
                labelId="subcategory-select-label"
                value={formData.subCategoryId || ''}
                onChange={(e) => handleInputChange('subCategoryId', e.target.value)}
                label="Subcategory (Optional)"
                sx={{
                  color: colors.textPrimary,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: colors.border,
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: colors.accent,
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: colors.accent,
                  },
                  '& .MuiSvgIcon-root': {
                    color: colors.accent,
                  }
                }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: colors.paper,
                      color: colors.textPrimary,
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
                  <em>No Subcategory</em>
                </MenuItem>
                {subcategories.map(subcategory => (
                  <MenuItem key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Brand Selection */}
          <FormControl
            fullWidth
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: colors.border },
                '&:hover fieldset': { borderColor: colors.accent },
                '&.Mui-focused fieldset': { borderColor: colors.accent }
              }
            }}
          >
            <InputLabel id="brand-select-label" sx={{ color: colors.textPrimary }}>
              Brand (Optional)
            </InputLabel>
            <Select
              labelId="brand-select-label"
              value={formData.brandId || ''}
              onChange={(e) => handleInputChange('brandId', e.target.value)}
              label="Brand (Optional)"
              sx={{
                color: colors.textPrimary,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: colors.border,
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: colors.accent,
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: colors.accent,
                },
                '& .MuiSvgIcon-root': {
                  color: colors.accent,
                }
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    backgroundColor: colors.paper,
                    color: colors.textPrimary,
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
                <em>No Brand</em>
              </MenuItem>
              {brands.filter(brand => brand.isActive).map((brand) => (
                <MenuItem key={brand.id} value={brand.id.toString()}>
                  {brand.name}
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
                '& fieldset': { borderColor: colors.border },
                '&:hover fieldset': { borderColor: colors.accent },
                '&.Mui-focused fieldset': { borderColor: colors.accent }
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
                '& fieldset': { borderColor: colors.border },
                '&:hover fieldset': { borderColor: colors.accent },
                '&.Mui-focused fieldset': { borderColor: colors.accent }
              }
            }}
          />

          <TextField
            fullWidth
            label="Stock Quantity"
            type="number"
            inputProps={{ step: "1", min: "0", readOnly: true }}
            value={formData.stock}
            disabled
            helperText="Stock quantity cannot be edited by admins"
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: colors.border },
                '&:hover fieldset': { borderColor: colors.border },
                '&.Mui-focused fieldset': { borderColor: colors.border }
              }
            }}
          />

          <TextField
            fullWidth
            label="Purchase Price"
            type="number"
            inputProps={{ step: "0.01", min: "0" }}
            value={formData.purchasePrice}
            onChange={(e) => handleInputChange('purchasePrice', e.target.value)}
            helperText="Cost price of the item. Selling price will be automatically set to 70% of purchase price."
            InputProps={{
              startAdornment: <InputAdornment position="start">KES</InputAdornment>
            }}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: colors.border },
                '&:hover fieldset': { borderColor: colors.accent },
                '&.Mui-focused fieldset': { borderColor: colors.accent }
              }
            }}
          />
        </Box>

        <Box sx={{ width: '100%', mt: 2 }}>
          {/* Image Upload */}
          <Typography variant="h6" sx={{ color: colors.accentText, mb: 2 }}>
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
                  borderColor: colors.accent,
                  color: colors.accentText,
                  '&:hover': {
                    borderColor: colors.accent,
                    backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 224, 184, 0.05)'
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
                  border: `2px solid ${colors.accent}`
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </Box>
          )}
        </Box>

        <Divider sx={{ my: 3, borderColor: colors.border, width: '100%' }} />

        <Box sx={{ width: '100%' }}>
          {/* Capacities and Pricing */}
          <Typography variant="h6" sx={{ color: colors.accentText, mb: 2 }}>
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

        <Divider sx={{ my: 3, borderColor: colors.border, width: '100%' }} />

        <Grid container spacing={3}>

          {/* Status */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ color: colors.accentText, mb: 2 }}>
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
                      color: colors.accent,
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: colors.accent,
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
                      color: colors.error,
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: colors.error,
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
                  checked={formData.isBrandFocus}
                  onChange={(e) => handleInputChange('isBrandFocus', e.target.checked)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#FFA500',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#FFA500',
                    },
                  }}
                />
              }
              label="Brand Focus"
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
                      color: colors.accent,
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: colors.accent,
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
            backgroundColor: colors.accent,
            color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
            '&:hover': { backgroundColor: isDarkMode ? '#00C4A3' : '#00B89A' }
          }}
        >
          {loading ? 'Saving...' : (drink && drink.id ? 'Save Changes' : 'Create Drink')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditDrinkDialog;
