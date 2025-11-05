import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Card,
  CardContent,
  Divider,
  Chip
} from '@mui/material';
import { Add, Delete, Edit } from '@mui/icons-material';

const CAPACITY_OPTIONS = [
  '1 litre',
  '750ml',
  '700ml',
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

const CapacityPricingManager = ({ capacityPricing = [], onChange }) => {
  const [editingIndex, setEditingIndex] = useState(-1);
  const [newCapacity, setNewCapacity] = useState('');
  const [newOriginalPrice, setNewOriginalPrice] = useState('');
  const [newCurrentPrice, setNewCurrentPrice] = useState('');

  const handleAddCapacity = () => {
    if (newCapacity && newOriginalPrice && newCurrentPrice) {
      const newPricing = {
        capacity: newCapacity,
        originalPrice: parseFloat(newOriginalPrice),
        currentPrice: parseFloat(newCurrentPrice)
      };
      
      const updatedPricing = [...capacityPricing, newPricing];
      onChange(updatedPricing);
      
      // Reset form
      setNewCapacity('');
      setNewOriginalPrice('');
      setNewCurrentPrice('');
    }
  };

  const handleEditCapacity = (index) => {
    setEditingIndex(index);
    const pricing = capacityPricing[index];
    setNewCapacity(pricing.capacity);
    setNewOriginalPrice(pricing.originalPrice.toString());
    setNewCurrentPrice(pricing.currentPrice.toString());
  };

  const handleUpdateCapacity = () => {
    if (newCapacity && newOriginalPrice && newCurrentPrice) {
      const updatedPricing = [...capacityPricing];
      updatedPricing[editingIndex] = {
        capacity: newCapacity,
        originalPrice: parseFloat(newOriginalPrice),
        currentPrice: parseFloat(newCurrentPrice)
      };
      
      onChange(updatedPricing);
      
      // Reset form
      setEditingIndex(-1);
      setNewCapacity('');
      setNewOriginalPrice('');
      setNewCurrentPrice('');
    }
  };

  const handleDeleteCapacity = (index) => {
    const updatedPricing = capacityPricing.filter((_, i) => i !== index);
    onChange(updatedPricing);
  };

  const handleCancelEdit = () => {
    setEditingIndex(-1);
    setNewCapacity('');
    setNewOriginalPrice('');
    setNewCurrentPrice('');
  };

  const calculateDiscount = (original, current) => {
    if (original > current) {
      return Math.round(((original - current) / original) * 100);
    }
    return 0;
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom sx={{ color: '#00E0B8', fontWeight: 600 }}>
        Capacity Pricing
      </Typography>
      
      {/* Display existing capacity pricing */}
      {capacityPricing.length > 0 && (
        <Box sx={{ mb: 3 }}>
          {capacityPricing.map((pricing, index) => (
            <Card key={index} sx={{ mb: 2, backgroundColor: '#121212', border: '1px solid #333' }}>
              <CardContent sx={{ py: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={pricing.capacity}
                      size="small"
                      sx={{
                        backgroundColor: '#00E0B8',
                        color: '#0D0D0D',
                        fontWeight: 'bold'
                      }}
                    />
                    {pricing.originalPrice > pricing.currentPrice && (
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
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleEditCapacity(index)}
                      sx={{ color: '#00E0B8' }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteCapacity(index)}
                      sx={{ color: '#FF3366' }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  {pricing.originalPrice > pricing.currentPrice ? (
                    <>
                      <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                        KES {(Number(pricing.originalPrice) || 0).toFixed(2)}
                      </Typography>
                      <Typography variant="h6" sx={{ color: '#FF3366', fontWeight: 'bold' }}>
                        KES {(Number(pricing.currentPrice) || 0).toFixed(2)}
                      </Typography>
                    </>
                  ) : (
                    <Typography variant="h6" sx={{ color: '#00E0B8', fontWeight: 'bold' }}>
                      KES {(Number(pricing.currentPrice) || 0).toFixed(2)}
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Add/Edit form */}
      <Card sx={{ backgroundColor: '#121212', border: '1px solid #333' }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom sx={{ color: '#00E0B8' }}>
            {editingIndex >= 0 ? 'Edit Capacity Pricing' : 'Add New Capacity Pricing'}
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <TextField
              select
              label="Capacity"
              value={newCapacity}
              onChange={(e) => setNewCapacity(e.target.value)}
              SelectProps={{ native: true }}
              sx={{ minWidth: 150 }}
              size="small"
            >
              <option value="">Select Capacity</option>
              {CAPACITY_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </TextField>
            
            <TextField
              label="Original Price (KES)"
              type="number"
              value={newOriginalPrice}
              onChange={(e) => setNewOriginalPrice(e.target.value)}
              size="small"
              sx={{ minWidth: 150 }}
            />
            
            <TextField
              label="Current Price (KES)"
              type="number"
              value={newCurrentPrice}
              onChange={(e) => setNewCurrentPrice(e.target.value)}
              size="small"
              sx={{ minWidth: 150 }}
            />
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={editingIndex >= 0 ? handleUpdateCapacity : handleAddCapacity}
              disabled={!newCapacity || !newOriginalPrice || !newCurrentPrice}
              sx={{
                borderColor: '#00E0B8',
                color: '#00E0B8',
                '&:hover': {
                  borderColor: '#00C4A3',
                  backgroundColor: 'rgba(0, 224, 184, 0.1)'
                }
              }}
            >
              {editingIndex >= 0 ? 'Update' : 'Add'}
            </Button>
            
            {editingIndex >= 0 && (
              <Button
                variant="outlined"
                onClick={handleCancelEdit}
                sx={{
                  borderColor: '#FF3366',
                  color: '#FF3366',
                  '&:hover': {
                    borderColor: '#FF5252',
                    backgroundColor: 'rgba(255, 51, 102, 0.1)'
                  }
                }}
              >
                Cancel
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default CapacityPricingManager;
