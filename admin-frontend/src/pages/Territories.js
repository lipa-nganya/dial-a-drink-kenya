import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Tooltip
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Map
} from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const Territories = () => {
  const { isDarkMode, colors } = useTheme();
  const [territories, setTerritories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTerritory, setEditingTerritory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    deliveryFromCBD: '0',
    deliveryFromRuaka: '0'
  });
  const [deletingTerritoryId, setDeletingTerritoryId] = useState(null);

  useEffect(() => {
    fetchTerritories();
  }, []);

  const fetchTerritories = async () => {
    try {
      setLoading(true);
      const response = await api.get('/territories');
      setTerritories(response.data);
      setError('');
    } catch (err) {
      console.error('Error fetching territories:', err);
      setError(err.response?.data?.error || 'Failed to load territories');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (territory = null) => {
    if (territory) {
      setEditingTerritory(territory);
      setFormData({
        name: territory.name,
        deliveryFromCBD: territory.deliveryFromCBD?.toString() || '0',
        deliveryFromRuaka: territory.deliveryFromRuaka?.toString() || '0'
      });
    } else {
      setEditingTerritory(null);
      setFormData({
        name: '',
        deliveryFromCBD: '0',
        deliveryFromRuaka: '0'
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTerritory(null);
    setFormData({
      name: '',
      deliveryFromCBD: '0',
      deliveryFromRuaka: '0'
    });
    setError('');
  };

  const handleSubmit = async () => {
    try {
      setError('');
      if (!formData.name) {
        setError('Territory name is required');
        return;
      }

      const payload = {
        name: formData.name.trim(),
        deliveryFromCBD: parseFloat(formData.deliveryFromCBD) || 0,
        deliveryFromRuaka: parseFloat(formData.deliveryFromRuaka) || 0
      };

      if (editingTerritory) {
        await api.put(`/territories/${editingTerritory.id}`, payload);
      } else {
        await api.post('/territories', payload);
      }

      handleCloseDialog();
      fetchTerritories();
    } catch (err) {
      console.error('Error saving territory:', err);
      setError(err.response?.data?.error || 'Failed to save territory');
    }
  };

  const handleDelete = async (territoryId) => {
    if (!window.confirm('Are you sure you want to delete this territory? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingTerritoryId(territoryId);
      await api.delete(`/territories/${territoryId}`);
      fetchTerritories();
    } catch (err) {
      console.error('Error deleting territory:', err);
      alert(err.response?.data?.error || 'Failed to delete territory');
    } finally {
      setDeletingTerritoryId(null);
    }
  };

  const formatCurrency = (amount) => {
    return `KES ${parseFloat(amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  if (loading) {
    return (
      <Container>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Map sx={{ color: colors.accentText, fontSize: 40 }} />
          <Typography variant="h4" component="h1" sx={{ color: colors.accentText, fontWeight: 700 }}>
            Territory Management
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{
            backgroundColor: colors.accentText,
            color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
            '&:hover': { backgroundColor: '#00C4A3' }
          }}
        >
          Add Territory
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} sx={{ backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Territory</TableCell>
              <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Delivery From CBD</TableCell>
              <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Delivery From Ruaka</TableCell>
              <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {territories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ color: colors.textSecondary, py: 4 }}>
                  No territories found. Add your first territory to get started.
                </TableCell>
              </TableRow>
            ) : (
              territories.map((territory) => (
                <TableRow key={territory.id}>
                  <TableCell sx={{ color: colors.textPrimary, fontWeight: 500 }}>{territory.name}</TableCell>
                  <TableCell sx={{ color: colors.textPrimary }}>{formatCurrency(territory.deliveryFromCBD)}</TableCell>
                  <TableCell sx={{ color: colors.textPrimary }}>{formatCurrency(territory.deliveryFromRuaka)}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit Territory">
                      <IconButton
                        onClick={() => handleOpenDialog(territory)}
                        size="small"
                        sx={{ color: colors.accentText }}
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Territory">
                      <IconButton
                        onClick={() => handleDelete(territory.id)}
                        disabled={deletingTerritoryId === territory.id}
                        size="small"
                        sx={{ color: '#FF3366' }}
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: colors.paper,
            border: `1px solid ${colors.border}`
          }
        }}
      >
        <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>
          {editingTerritory ? 'Edit Territory' : 'Add New Territory'}
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: colors.paper }}>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Territory Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              margin="normal"
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                  '& fieldset': { borderColor: colors.border },
                  '&:hover fieldset': { borderColor: colors.accentText },
                  '&.Mui-focused fieldset': { borderColor: colors.accentText }
                },
                '& .MuiInputBase-input': {
                  color: colors.textPrimary
                },
                '& .MuiInputLabel-root': {
                  color: colors.textSecondary
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: colors.accentText
                }
              }}
            />
            <TextField
              fullWidth
              label="Delivery From CBD (KES)"
              type="number"
              value={formData.deliveryFromCBD}
              onChange={(e) => setFormData({ ...formData, deliveryFromCBD: e.target.value })}
              margin="normal"
              inputProps={{ min: 0, step: 1 }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                  '& fieldset': { borderColor: colors.border },
                  '&:hover fieldset': { borderColor: colors.accentText },
                  '&.Mui-focused fieldset': { borderColor: colors.accentText }
                },
                '& .MuiInputBase-input': {
                  color: colors.textPrimary
                },
                '& .MuiInputLabel-root': {
                  color: colors.textSecondary
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: colors.accentText
                }
              }}
            />
            <TextField
              fullWidth
              label="Delivery From Ruaka (KES)"
              type="number"
              value={formData.deliveryFromRuaka}
              onChange={(e) => setFormData({ ...formData, deliveryFromRuaka: e.target.value })}
              margin="normal"
              inputProps={{ min: 0, step: 1 }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                  '& fieldset': { borderColor: colors.border },
                  '&:hover fieldset': { borderColor: colors.accentText },
                  '&.Mui-focused fieldset': { borderColor: colors.accentText }
                },
                '& .MuiInputBase-input': {
                  color: colors.textPrimary
                },
                '& .MuiInputLabel-root': {
                  color: colors.textSecondary
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: colors.accentText
                }
              }}
            />
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: colors.paper, p: 2 }}>
          <Button 
            onClick={handleCloseDialog}
            sx={{ color: colors.textSecondary }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              '&:hover': { backgroundColor: '#00C4A3' }
            }}
          >
            {editingTerritory ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Territories;

