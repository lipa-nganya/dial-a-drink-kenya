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
  InputAdornment,
  Chip
} from '@mui/material';
import {
  Close,
  CloudUpload,
  AttachMoney,
  Add
} from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import CapacityPricingCombined from './CapacityPricingCombined';

// Normalize capacityPricing from API (may have price only, or originalPrice/currentPrice)
function normalizeCapacityPricingForForm(capacityPricing) {
  const raw = capacityPricing ?? null;
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' && !Array.isArray(raw) ? [raw] : []);
  return arr.filter(Boolean).map((entry) => {
    const capacity = (entry.capacity ?? entry.size ?? '').toString().trim();
    if (!capacity) return null;
    const price = parseFloat(entry.price ?? entry.currentPrice ?? entry.originalPrice);
    const originalPrice = entry.originalPrice != null ? parseFloat(entry.originalPrice) : (Number.isFinite(price) ? price : 0);
    const currentPrice = entry.currentPrice != null ? parseFloat(entry.currentPrice) : (Number.isFinite(price) ? price : originalPrice);
    return {
      capacity,
      originalPrice: Number.isFinite(originalPrice) ? originalPrice : 0,
      currentPrice: Number.isFinite(currentPrice) ? currentPrice : originalPrice
    };
  }).filter(Boolean);
}

// Derive capacity array from drink (capacity or capacityPricing)
function deriveCapacitiesForForm(drink) {
  const cap = drink.capacity;
  if (Array.isArray(cap) && cap.length > 0) return cap.map(c => (c != null ? String(c).trim() : '')).filter(Boolean);
  if (cap != null && cap !== '') return [String(cap).trim()];
  const pricing = drink.capacityPricing ?? drink.capacity_pricing;
  if (Array.isArray(pricing) && pricing.length > 0) {
    return pricing.map(p => (p?.capacity ?? p?.size ?? '').toString().trim()).filter(Boolean);
  }
  return [];
}

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
    nbv: '',
    stock: 0,
    purchasePrice: '',
    pageTitle: '',
    keywords: '',
    youtubeUrl: '',
    tags: []
  });
  const [newTag, setNewTag] = useState('');
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [imagePreview, setImagePreview] = useState('');

  const applyDrinkToForm = (d) => {
    const brandId = d.brandId || (d.brand && d.brand.id) || '';
    const purchasePriceValue =
      d.purchasePrice !== undefined && d.purchasePrice !== null ? String(d.purchasePrice).trim() : '';

    const capacityPricingRaw = d.capacityPricing ?? d.capacity_pricing ?? null;
    let capacityPricingNormalized = normalizeCapacityPricingForForm(capacityPricingRaw);
    let capacityDerived = deriveCapacitiesForForm(d);
    if (capacityPricingNormalized.length === 0 && (d.price != null || d.originalPrice != null)) {
      const p = Number(d.price ?? d.originalPrice) || 0;
      const op = Number(d.originalPrice ?? d.price) || p;
      capacityPricingNormalized = [{ capacity: 'Default', originalPrice: op, currentPrice: p }];
      if (capacityDerived.length === 0) capacityDerived = ['Default'];
    }
    setFormData({
      name: d.name || '',
      description: d.description || '',
      isAvailable: d.isAvailable !== undefined ? d.isAvailable : true,
      isPopular: d.isPopular || false,
      isBrandFocus: d.isBrandFocus || false,
      limitedTimeOffer: d.limitedTimeOffer || false,
      image: d.image || '',
      categoryId: d.categoryId || '',
      subCategoryId: d.subCategoryId || '',
      brandId: brandId ? brandId.toString() : '',
      capacity: capacityDerived,
      capacityPricing: capacityPricingNormalized,
      abv: d.abv || '',
      nbv: d.nbv !== undefined && d.nbv !== null && d.nbv !== '' ? String(d.nbv) : '',
      stock: d.stock !== undefined && d.stock !== null ? d.stock : 0,
      purchasePrice: purchasePriceValue,
      pageTitle: d.pageTitle || '',
      keywords: d.keywords || '',
      youtubeUrl: d.youtubeUrl || '',
      tags: Array.isArray(d.tags) ? d.tags : d.tags ? [d.tags] : []
    });
    if (d.categoryId) {
      fetchSubcategories(d.categoryId);
    }
    setImagePreview(d.image || '');
  };

  // Inventory list payload is slim; load full drink (SEO, tags, etc.) when editing.
  useEffect(() => {
    if (!open) return;

    if (!drink) {
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
        nbv: '',
        stock: 0,
        purchasePrice: '',
        pageTitle: '',
        keywords: '',
        youtubeUrl: '',
        tags: []
      });
      setImagePreview('');
      setSubcategories([]);
      setError(null);
      return;
    }

    if (!drink.id) {
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setError(null);
    applyDrinkToForm(drink);

    api
      .get(`/admin/drinks/${drink.id}`)
      .then(({ data }) => {
        if (cancelled || !data) return;
        applyDrinkToForm(data);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('EditDrinkDialog: failed to load full drink, using list row', err);
        applyDrinkToForm(drink);
        setError(err.response?.data?.error || err.message || 'Could not load full product');
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyDrinkToForm closes over fetchSubcategories
  }, [open, drink?.id]);

  // Ensure the dialog always reflects the latest categories/brands,
  // especially after adding them in Copilot Inventory Settings.
  useEffect(() => {
    if (!open) return;
    fetchCategories();
    fetchBrands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  
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
      // Handle empty array case to prevent Infinity
      const priceValues = formData.capacityPricing
        .map(p => parseFloat(p.currentPrice || p.price || 0))
        .filter(val => !isNaN(val) && val > 0);
      const lowestPrice = priceValues.length > 0 ? Math.min(...priceValues) : 0;

      // Get the lowest original price from capacity pricing for the originalPrice field
      const originalPriceValues = formData.capacityPricing
        .map(p => parseFloat(p.originalPrice || p.currentPrice || p.price || 0))
        .filter(val => !isNaN(val) && val > 0);
      const lowestOriginalPrice = originalPriceValues.length > 0 ? Math.min(...originalPriceValues) : lowestPrice;

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
        nbv: formData.nbv !== undefined && formData.nbv !== null && String(formData.nbv).trim() !== ''
          ? (isNaN(parseFloat(formData.nbv)) ? null : parseFloat(formData.nbv))
          : null,
        // Stock is not included
        // Always include purchasePrice - allow 0 or empty (set to null)
        purchasePrice: formData.purchasePrice && String(formData.purchasePrice).trim() !== '' 
          ? (isNaN(parseFloat(formData.purchasePrice)) ? null : parseFloat(formData.purchasePrice))
          : null,
        pageTitle: formData.pageTitle ? formData.pageTitle.trim() : null,
        keywords: formData.keywords ? formData.keywords.trim() : null,
        youtubeUrl: formData.youtubeUrl ? formData.youtubeUrl.trim() : null,
        tags: Array.isArray(formData.tags) ? formData.tags : []
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
        await api.post('/admin/drinks', saveData);
        
        // Stock updates are not allowed for admins - removed stock update call
        
        console.log('Drink created successfully');
      }
      
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving drink:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        saveData: drink && drink.id ? 'Update' : 'Create',
        capacityPricingLength: formData.capacityPricing?.length || 0
      });
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Failed to save drink';
      setError(errorMessage);
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

          {(() => {
            const categoryName = (categories.find(c => Number(c.id) === Number(formData.categoryId))?.name || drink?.category?.name || '').toLowerCase();
            const subCategoryName = (subcategories.find(s => Number(s.id) === Number(formData.subCategoryId))?.name || drink?.subCategory?.name || '').toLowerCase();
            const isVape = categoryName.includes('vape') || subCategoryName.includes('vape');
            const isPouch = categoryName.includes('pouch') || categoryName.includes('nicotine') || subCategoryName.includes('pouch') || subCategoryName.includes('nicotine');
            if (!isVape && !isPouch) return null;
            return (
              <TextField
                fullWidth
                label={isVape ? 'NBV (%)' : 'NBV (mg)'}
                type="number"
                inputProps={{ step: isVape ? '0.1' : '1', min: '0' }}
                value={formData.nbv}
                onChange={(e) => handleInputChange('nbv', e.target.value)}
                helperText={isVape ? 'Nicotine by volume as percentage' : 'Nicotine in milligrams per pouch'}
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: colors.border },
                    '&:hover fieldset': { borderColor: colors.accent },
                    '&.Mui-focused fieldset': { borderColor: colors.accent }
                  }
                }}
              />
            );
          })()}

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

        <Divider sx={{ my: 3, borderColor: colors.border, width: '100%' }} />

        <Box sx={{ width: '100%' }}>
          {/* Product SEO Section */}
          <Typography variant="h6" sx={{ color: colors.accentText, mb: 2 }}>
            Product SEO
          </Typography>

          <TextField
            fullWidth
            label="Page Title"
            value={formData.pageTitle}
            onChange={(e) => handleInputChange('pageTitle', e.target.value)}
            placeholder="Enter page title for SEO"
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
            label="Keywords"
            value={formData.keywords}
            onChange={(e) => handleInputChange('keywords', e.target.value)}
            placeholder="Enter keywords separated by commas"
            helperText="Separate multiple keywords with commas"
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
            label="YouTube URL"
            value={formData.youtubeUrl}
            onChange={(e) => handleInputChange('youtubeUrl', e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            helperText="Enter the full YouTube video URL"
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: colors.border },
                '&:hover fieldset': { borderColor: colors.accent },
                '&.Mui-focused fieldset': { borderColor: colors.accent }
              }
            }}
          />

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ color: colors.textPrimary, mb: 1 }}>
              Tags
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              {formData.tags && formData.tags.length > 0 ? (
                formData.tags.map((tag, index) => (
                  <Chip
                    key={index}
                    label={tag}
                    onDelete={() => {
                      const newTags = formData.tags.filter((_, i) => i !== index);
                      handleInputChange('tags', newTags);
                    }}
                    sx={{
                      backgroundColor: colors.accent,
                      color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                      '& .MuiChip-deleteIcon': {
                        color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                        '&:hover': {
                          color: isDarkMode ? '#333' : '#E0E0E0'
                        }
                      }
                    }}
                  />
                ))
              ) : (
                <Typography variant="body2" sx={{ color: colors.textSecondary, fontStyle: 'italic' }}>
                  No tags added yet
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                label="Add Tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && newTag.trim()) {
                    const trimmedTag = newTag.trim();
                    if (!formData.tags || !formData.tags.includes(trimmedTag)) {
                      handleInputChange('tags', [...(formData.tags || []), trimmedTag]);
                      setNewTag('');
                    }
                  }
                }}
                placeholder="Enter tag and press Enter"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: colors.border },
                    '&:hover fieldset': { borderColor: colors.accent },
                    '&.Mui-focused fieldset': { borderColor: colors.accent }
                  }
                }}
              />
              <Button
                variant="outlined"
                startIcon={<Add />}
                onClick={() => {
                  if (newTag.trim()) {
                    const trimmedTag = newTag.trim();
                    if (!formData.tags || !formData.tags.includes(trimmedTag)) {
                      handleInputChange('tags', [...(formData.tags || []), trimmedTag]);
                      setNewTag('');
                    }
                  }
                }}
                disabled={!newTag.trim() || (formData.tags && formData.tags.includes(newTag.trim()))}
                sx={{
                  borderColor: colors.accent,
                  color: colors.accentText,
                  '&:hover': {
                    borderColor: colors.accent,
                    backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 224, 184, 0.05)'
                  }
                }}
              >
                Add
              </Button>
            </Box>
          </Box>
        </Box>
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
