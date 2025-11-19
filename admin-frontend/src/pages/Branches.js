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
  Chip,
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
  Store,
  CheckCircle,
  Cancel
} from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import AddressAutocomplete from '../components/AddressAutocomplete';

const Branches = () => {
  const { isDarkMode, colors } = useTheme();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    isActive: true
  });
  const [deletingBranchId, setDeletingBranchId] = useState(null);

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const response = await api.get('/branches');
      setBranches(response.data);
      setError('');
    } catch (err) {
      console.error('Error fetching branches:', err);
      setError(err.response?.data?.error || 'Failed to load branches');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (branch = null) => {
    if (branch) {
      setEditingBranch(branch);
      setFormData({
        name: branch.name,
        address: branch.address,
        isActive: branch.isActive
      });
    } else {
      setEditingBranch(null);
      setFormData({
        name: '',
        address: '',
        isActive: true
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingBranch(null);
    setFormData({
      name: '',
      address: '',
      isActive: true
    });
    setError('');
  };

  const handleSubmit = async () => {
    try {
      setError('');
      if (!formData.name || !formData.address) {
        setError('Name and address are required');
        return;
      }

      if (editingBranch) {
        await api.put(`/branches/${editingBranch.id}`, formData);
      } else {
        await api.post('/branches', formData);
      }

      handleCloseDialog();
      fetchBranches();
    } catch (err) {
      console.error('Error saving branch:', err);
      setError(err.response?.data?.error || 'Failed to save branch');
    }
  };

  const handleDelete = async (branchId) => {
    if (!window.confirm('Are you sure you want to deactivate this branch? Orders cannot be assigned to inactive branches.')) {
      return;
    }

    try {
      setDeletingBranchId(branchId);
      await api.delete(`/branches/${branchId}`);
      fetchBranches();
    } catch (err) {
      console.error('Error deleting branch:', err);
      alert(err.response?.data?.error || 'Failed to delete branch');
    } finally {
      setDeletingBranchId(null);
    }
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
          <Store sx={{ color: colors.accentText, fontSize: 40 }} />
          <Typography variant="h4" component="h1" sx={{ color: colors.accentText, fontWeight: 700 }}>
            Branch Management
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
          Add Branch
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
              <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>ID</TableCell>
              <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Address</TableCell>
              <TableCell sx={{ fontWeight: 700, color: colors.accentText }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700, color: colors.accentText }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {branches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ color: colors.textSecondary, py: 4 }}>
                  No branches found. Add your first branch to get started.
                </TableCell>
              </TableRow>
            ) : (
              branches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell sx={{ color: colors.textPrimary }}>{branch.id}</TableCell>
                  <TableCell sx={{ color: colors.textPrimary }}>{branch.name}</TableCell>
                  <TableCell sx={{ color: colors.textPrimary }}>{branch.address}</TableCell>
                  <TableCell>
                    <Chip
                      icon={branch.isActive ? <CheckCircle /> : <Cancel />}
                      label={branch.isActive ? 'Active' : 'Inactive'}
                      color={branch.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit Branch">
                      <IconButton
                        onClick={() => handleOpenDialog(branch)}
                        size="small"
                        sx={{ color: colors.accentText }}
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Deactivate Branch">
                      <IconButton
                        onClick={() => handleDelete(branch.id)}
                        disabled={deletingBranchId === branch.id}
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
          {editingBranch ? 'Edit Branch' : 'Add New Branch'}
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: colors.paper }}>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Branch Name"
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
            <Box sx={{ mt: 2, mb: 1 }}>
              <AddressAutocomplete
                label="Branch Address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Start typing the branch address..."
                helperText="Select an address from Google Maps (used for distance calculations)"
              />
            </Box>
            {editingBranch && (
              <Box sx={{ mt: 2 }}>
                <Chip
                  icon={formData.isActive ? <CheckCircle /> : <Cancel />}
                  label={formData.isActive ? 'Active' : 'Inactive'}
                  color={formData.isActive ? 'success' : 'default'}
                  onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                  sx={{ cursor: 'pointer' }}
                />
              </Box>
            )}
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
            {editingBranch ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Branches;

