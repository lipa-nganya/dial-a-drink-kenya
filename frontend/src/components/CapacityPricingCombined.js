import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Chip,
  Alert
} from '@mui/material';
import { Add, Delete, Edit, Save, Cancel } from '@mui/icons-material';

const CAPACITY_OPTIONS = [
  '1 litre',
  '750ml',
  '700ml',
  '500ml',
  '6pack',
  'twin pack',
  '12 pack',
  '300ml',
  '330ml',
  'Packet',
  'Kingsize Slim',
  'Single Wide',
  '1 piece',
  '20 pouches',
  '2500 Puffs',
  '1500 Puffs',
  '2600 Puffs'
];

const CapacityPricingCombined = ({ capacityPricing = [], capacities = [], onChange }) => {
  const [localPricing, setLocalPricing] = useState(capacityPricing);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [editCapacity, setEditCapacity] = useState('');
  const [editOriginalPrice, setEditOriginalPrice] = useState('');
  const [editCurrentPrice, setEditCurrentPrice] = useState('');
  const [priceError, setPriceError] = useState('');

  // Update local state when prop changes
  useEffect(() => {
    setLocalPricing(capacityPricing);
  }, [capacityPricing]);

  // Sync capacityPricing with capacities
  const syncCapacitiesAndPricing = (newCapacityPricing) => {
    setLocalPricing(newCapacityPricing);
    // Extract capacities from pricing
    const newCapacities = newCapacityPricing.map(p => p.capacity).filter(c => c && c !== '');
    onChange(newCapacityPricing, newCapacities);
  };

  const validatePrices = (original, current) => {
    const originalNum = parseFloat(original);
    const currentNum = parseFloat(current);
    
    if (isNaN(originalNum) || isNaN(currentNum)) {
      return { isValid: false, error: '' };
    }
    
    if (currentNum > originalNum) {
      return { 
        isValid: false, 
        error: 'Offer price cannot be greater than original price' 
      };
    }
    
    if (currentNum === originalNum) {
      return { 
        isValid: false, 
        error: 'Offer price must be less than original price. Leave empty if not on offer.' 
      };
    }
    
    return { isValid: true, error: '' };
  };

  const handleEdit = (index) => {
    const pricing = localPricing[index];
    setEditingIndex(index);
    setEditCapacity(pricing.capacity || '');
    setEditOriginalPrice(pricing.originalPrice?.toString() || '');
    // If current price equals original price, it means not on offer, so show empty
    const currentPrice = pricing.currentPrice?.toString() || pricing.price?.toString() || '';
    const originalPrice = pricing.originalPrice?.toString() || '';
    setEditCurrentPrice((currentPrice === originalPrice || !currentPrice) ? '' : currentPrice);
    setPriceError('');
  };

  const handleOriginalPriceChange = (value) => {
    setEditOriginalPrice(value);
    if (editCurrentPrice) {
      const validation = validatePrices(value, editCurrentPrice);
      setPriceError(validation.error);
    }
  };

  const handleCurrentPriceChange = (value) => {
    // Allow empty value (not on offer)
    if (value === '' || value === null || value === undefined) {
      setEditCurrentPrice('');
      setPriceError('');
      return;
    }
    setEditCurrentPrice(value);
    if (editOriginalPrice) {
      const validation = validatePrices(editOriginalPrice, value);
      setPriceError(validation.error);
    }
  };

  const handleSaveEdit = () => {
    if (!editCapacity || !editOriginalPrice) {
      return;
    }

    // Allow empty offer price (not on offer)
    if (editCurrentPrice === '' || editCurrentPrice === null || editCurrentPrice === undefined) {
      const updatedPricing = [...localPricing];
      updatedPricing[editingIndex] = {
        capacity: editCapacity,
        originalPrice: parseFloat(editOriginalPrice),
        currentPrice: parseFloat(editOriginalPrice) // Set to original price when not on offer
      };
      syncCapacitiesAndPricing(updatedPricing);
      handleCancelEdit();
      return;
    }

    // Validate if offer price is provided
    const validation = validatePrices(editOriginalPrice, editCurrentPrice);
    if (!validation.isValid) {
      setPriceError(validation.error);
      return;
    }

    const updatedPricing = [...localPricing];
    updatedPricing[editingIndex] = {
      capacity: editCapacity,
      originalPrice: parseFloat(editOriginalPrice),
      currentPrice: parseFloat(editCurrentPrice)
    };
    syncCapacitiesAndPricing(updatedPricing);
    handleCancelEdit();
  };

  const handleCancelEdit = () => {
    setEditingIndex(-1);
    setEditCapacity('');
    setEditOriginalPrice('');
    setEditCurrentPrice('');
    setPriceError('');
  };

  const handleDelete = (index) => {
    const updatedPricing = localPricing.filter((_, i) => i !== index);
    syncCapacitiesAndPricing(updatedPricing);
    if (editingIndex === index) {
      handleCancelEdit();
    } else if (editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
  };

  const handleAddNew = () => {
    const newPricing = {
      capacity: '',
      originalPrice: 0,
      currentPrice: 0
    };
    const updatedPricing = [...localPricing, newPricing];
    setLocalPricing(updatedPricing);
    setEditingIndex(updatedPricing.length - 1);
    setEditCapacity('');
    setEditOriginalPrice('');
    setEditCurrentPrice('');
  };

  const calculateDiscount = (original, current) => {
    if (original > current && original > 0) {
      return Math.round(((original - current) / original) * 100);
    }
    return 0;
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom sx={{ color: '#00E0B8', fontWeight: 600, mb: 2 }}>
        Capacities & Pricing
      </Typography>

      {/* Table Header */}
      {localPricing.length > 0 && (
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: '2fr 1fr 1fr auto',
          gap: 2,
          alignItems: 'center',
          p: 1.5,
          mb: 1,
          borderBottom: '2px solid #00E0B8',
          backgroundColor: 'rgba(0, 224, 184, 0.1)'
        }}>
          <Typography variant="subtitle2" sx={{ color: '#00E0B8', fontWeight: 600 }}>
            Capacity
          </Typography>
          <Typography variant="subtitle2" sx={{ color: '#00E0B8', fontWeight: 600 }}>
            Original Price
          </Typography>
          <Typography variant="subtitle2" sx={{ color: '#00E0B8', fontWeight: 600 }}>
            Offer Price
          </Typography>
          <Typography variant="subtitle2" sx={{ color: '#00E0B8', fontWeight: 600, textAlign: 'center' }}>
            Actions
          </Typography>
        </Box>
      )}

      {/* Display existing capacities with pricing */}
      {localPricing.length > 0 && (
        <Box sx={{ mb: 2 }}>
          {localPricing.map((pricing, index) => (
            <Box key={index} sx={{ mb: 1 }}>
              {editingIndex === index ? (
                // Edit mode - show dropdown and price fields
                <Box>
                  <Box sx={{ 
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr auto',
                    gap: 1.5,
                    alignItems: 'flex-start',
                    p: 2,
                    border: '1px solid #00E0B8',
                    borderRadius: 1,
                    backgroundColor: 'rgba(0, 224, 184, 0.05)'
                  }}>
                    <FormControl size="small" sx={{ minWidth: 180 }}>
                      <InputLabel>Capacity</InputLabel>
                      <Select
                        value={editCapacity}
                        onChange={(e) => setEditCapacity(e.target.value)}
                        label="Capacity"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            '& fieldset': { borderColor: '#00E0B8' },
                            '&:hover fieldset': { borderColor: '#00E0B8' },
                            '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
                          }
                        }}
                      >
                        {CAPACITY_OPTIONS.map((option) => (
                          <MenuItem key={option} value={option}>
                            {option}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <TextField
                      label="Original Price (KES)"
                      type="number"
                      value={editOriginalPrice}
                      onChange={(e) => handleOriginalPriceChange(e.target.value)}
                      size="small"
                      error={priceError && priceError.includes('original')}
                      sx={{ 
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': { borderColor: '#00E0B8' },
                          '&:hover fieldset': { borderColor: '#00E0B8' },
                          '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
                        }
                      }}
                    />

                    <TextField
                      label="Offer Price (KES)"
                      type="number"
                      value={editCurrentPrice}
                      onChange={(e) => handleCurrentPriceChange(e.target.value)}
                      size="small"
                      placeholder="Leave empty if not on offer"
                      error={!!priceError}
                      helperText={priceError || 'Leave empty if not on offer'}
                      sx={{ 
                        '& .MuiOutlinedInput-root': {
                          '& fieldset': { borderColor: priceError ? '#FF3366' : '#00E0B8' },
                          '&:hover fieldset': { borderColor: priceError ? '#FF3366' : '#00E0B8' },
                          '&.Mui-focused fieldset': { borderColor: priceError ? '#FF3366' : '#00E0B8' }
                        }
                      }}
                    />

                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                      <IconButton
                        onClick={handleSaveEdit}
                        disabled={!editCapacity || !editOriginalPrice || !!priceError}
                        sx={{ 
                          color: '#00E0B8',
                          '&:disabled': { color: '#666' }
                        }}
                      >
                        <Save />
                      </IconButton>
                      <IconButton
                        onClick={handleCancelEdit}
                        sx={{ color: '#FF3366' }}
                      >
                        <Cancel />
                      </IconButton>
                    </Box>
                  </Box>
                  {priceError && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      {priceError}
                    </Alert>
                  )}
                </Box>
              ) : (
                // View mode - show capacity, pricing, and action buttons
                <Box sx={{ 
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr auto',
                  gap: 2,
                  alignItems: 'center',
                  p: 1.5,
                  border: '1px solid #333',
                  borderRadius: 1,
                  backgroundColor: '#121212'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Chip
                      label={pricing.capacity}
                      size="small"
                      sx={{
                        backgroundColor: '#00E0B8',
                        color: '#0D0D0D',
                        fontWeight: 'bold'
                      }}
                    />
                  </Box>

                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    KES {(Number(pricing.originalPrice) || 0).toFixed(2)}
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {pricing.originalPrice > pricing.currentPrice ? (
                      <>
                        <Typography variant="body1" sx={{ color: '#FF3366', fontWeight: 'bold' }}>
                          KES {(Number(pricing.currentPrice) || 0).toFixed(2)}
                        </Typography>
                        {calculateDiscount(pricing.originalPrice, pricing.currentPrice) > 0 && (
                          <Chip
                            label={`${calculateDiscount(pricing.originalPrice, pricing.currentPrice)}% OFF`}
                            size="small"
                            sx={{
                              backgroundColor: '#FF3366',
                              color: '#F5F5F5',
                              fontSize: '0.7rem'
                            }}
                          />
                        )}
                      </>
                    ) : (
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                        —
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                    <IconButton
                      size="small"
                      onClick={() => handleEdit(index)}
                      sx={{ color: '#00E0B8' }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(index)}
                      sx={{ color: '#FF3366' }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Add new capacity button */}
      {editingIndex === -1 && (
        <Button
          variant="outlined"
          startIcon={<Add />}
          onClick={handleAddNew}
          sx={{
            borderColor: '#00E0B8',
            color: '#00E0B8',
            '&:hover': {
              borderColor: '#00C4A3',
              backgroundColor: 'rgba(0, 224, 184, 0.1)'
            }
          }}
        >
          Add Capacity
        </Button>
      )}
    </Box>
  );
};

export default CapacityPricingCombined;

