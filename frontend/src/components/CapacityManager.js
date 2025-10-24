import React, { useState } from 'react';
import {
  Box,
  Chip,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Typography
} from '@mui/material';
import { Add, Delete } from '@mui/icons-material';

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

const CapacityManager = ({ capacities = [], onChange }) => {
  const [newCapacity, setNewCapacity] = useState('');

  const handleAddCapacity = () => {
    if (newCapacity && !capacities.includes(newCapacity)) {
      const updatedCapacities = [...capacities, newCapacity];
      onChange(updatedCapacities);
      setNewCapacity('');
    }
  };

  const handleRemoveCapacity = (capacityToRemove) => {
    const updatedCapacities = capacities.filter(cap => cap !== capacityToRemove);
    onChange(updatedCapacities);
  };

  const handleSelectCapacity = (capacity) => {
    if (capacity && !capacities.includes(capacity)) {
      const updatedCapacities = [...capacities, capacity];
      onChange(updatedCapacities);
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom sx={{ color: '#00E0B8', fontWeight: 600 }}>
        Capacities
      </Typography>
      
      {/* Display current capacities */}
      {capacities.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {capacities.map((capacity, index) => (
            <Chip
              key={index}
              label={capacity}
              onDelete={() => handleRemoveCapacity(capacity)}
              deleteIcon={<Delete />}
              sx={{
                backgroundColor: '#121212',
                color: '#00E0B8',
                border: '1px solid #00E0B8',
                '& .MuiChip-deleteIcon': {
                  color: '#FF3366'
                }
              }}
            />
          ))}
        </Box>
      )}

      {/* Add new capacity */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Select Capacity</InputLabel>
          <Select
            value={newCapacity}
            onChange={(e) => setNewCapacity(e.target.value)}
            label="Select Capacity"
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
        
        <Button
          variant="outlined"
          startIcon={<Add />}
          onClick={handleAddCapacity}
          disabled={!newCapacity || capacities.includes(newCapacity)}
          sx={{
            borderColor: '#00E0B8',
            color: '#00E0B8',
            '&:hover': {
              borderColor: '#00C4A3',
              backgroundColor: 'rgba(0, 224, 184, 0.1)'
            },
            '&:disabled': {
              borderColor: '#666',
              color: '#666'
            }
          }}
        >
          Add
        </Button>
      </Box>

      {/* Custom capacity input */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          fullWidth
          label="Custom Capacity"
          value={newCapacity}
          onChange={(e) => setNewCapacity(e.target.value)}
          placeholder="Enter custom capacity"
          sx={{
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: '#00E0B8' },
              '&:hover fieldset': { borderColor: '#00E0B8' },
              '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
            }
          }}
        />
        
        <Button
          variant="outlined"
          startIcon={<Add />}
          onClick={handleAddCapacity}
          disabled={!newCapacity || capacities.includes(newCapacity)}
          sx={{
            borderColor: '#00E0B8',
            color: '#00E0B8',
            '&:hover': {
              borderColor: '#00C4A3',
              backgroundColor: 'rgba(0, 224, 184, 0.1)'
            },
            '&:disabled': {
              borderColor: '#666',
              color: '#666'
            }
          }}
        >
          Add Custom
        </Button>
      </Box>
    </Box>
  );
};

export default CapacityManager;
