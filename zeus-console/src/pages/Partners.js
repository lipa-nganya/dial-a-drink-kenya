import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Snackbar
} from '@mui/material';
import {
  Add,
  Edit,
  Delete
} from '@mui/icons-material';
import { api } from '../services/zeusApi';
import { useNavigate } from 'react-router-dom';

const Partners = () => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [partnerToDelete, setPartnerToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [formData, setFormData] = useState({
    name: '',
    billingPlan: 'standard',
    apiRateLimit: 1000,
    allowedCities: [],
    allowedVehicleTypes: []
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    try {
      const response = await api.get('/partners');
      setPartners(response.data.partners || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load partners');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (partner = null) => {
    if (partner) {
      setEditingPartner(partner);
      setFormData({
        name: partner.name,
        billingPlan: partner.billingPlan || 'standard',
        apiRateLimit: partner.apiRateLimit || 1000,
        allowedCities: partner.allowedCities || [],
        allowedVehicleTypes: partner.allowedVehicleTypes || []
      });
    } else {
      setEditingPartner(null);
      setFormData({
        name: '',
        billingPlan: 'standard',
        apiRateLimit: 1000,
        allowedCities: [],
        allowedVehicleTypes: []
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPartner(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingPartner) {
        await api.patch(`/partners/${editingPartner.id}`, formData);
      } else {
        await api.post('/partners', formData);
      }
      handleCloseDialog();
      fetchPartners();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save partner');
    }
  };

  const handleDeleteClick = (partner, e) => {
    e.stopPropagation();
    setPartnerToDelete(partner);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!partnerToDelete) return;

    setDeleting(true);
    try {
      await api.delete(`/partners/${partnerToDelete.id}`);
      setDeleteDialogOpen(false);
      const partnerName = partnerToDelete.name;
      setPartnerToDelete(null);
      fetchPartners();
      // Show success toast
      setSnackbar({
        open: true,
        message: `Partner "${partnerName}" deleted successfully`,
        severity: 'success'
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete partner');
      setDeleteDialogOpen(false);
      // Show error toast
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to delete partner',
        severity: 'error'
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setPartnerToDelete(null);
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'success',
      suspended: 'error',
      restricted: 'warning'
    };
    return colors[status] || 'default';
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
    <Container>
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1">
          Partner Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Create Partner
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Billing Plan</TableCell>
              <TableCell>API Rate Limit</TableCell>
              <TableCell>Geofences</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {partners.map((partner) => (
              <TableRow 
                key={partner.id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => navigate(`/partners/${partner.id}`)}
              >
                <TableCell>{partner.name}</TableCell>
                <TableCell>
                  {partner.email ? (
                    <Typography variant="body2" color="text.secondary">
                      {partner.email}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                      No email
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={partner.status}
                    color={getStatusColor(partner.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>{partner.billingPlan || 'N/A'}</TableCell>
                <TableCell>{partner.apiRateLimit || 0}</TableCell>
                <TableCell>{partner.geofenceCount || 0}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button 
                      size="small" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDialog(partner);
                      }}
                      startIcon={<Edit />}
                    >
                      Edit
                    </Button>
                    <Button 
                      size="small" 
                      color="error"
                      onClick={(e) => handleDeleteClick(partner, e)}
                      startIcon={<Delete />}
                    >
                      Delete
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingPartner ? 'Edit Partner' : 'Create Partner'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Partner Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            select
            label="Billing Plan"
            value={formData.billingPlan}
            onChange={(e) => setFormData({ ...formData, billingPlan: e.target.value })}
            margin="normal"
          >
            <MenuItem value="standard">Standard</MenuItem>
            <MenuItem value="enterprise">Enterprise</MenuItem>
            <MenuItem value="custom">Custom</MenuItem>
          </TextField>
          <TextField
            fullWidth
            label="API Rate Limit"
            type="number"
            value={formData.apiRateLimit}
            onChange={(e) => setFormData({ ...formData, apiRateLimit: parseInt(e.target.value) || 0 })}
            margin="normal"
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingPartner ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>Delete Partner</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{partnerToDelete?.name}</strong>?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            This action cannot be undone. This will permanently delete:
            <ul style={{ marginTop: 8, marginBottom: 0 }}>
              <li>The partner account</li>
              <li>All associated users</li>
              <li>All geofences</li>
              <li>All partner orders</li>
              <li>Usage records and invoices</li>
            </ul>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained"
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Toast */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Partners;
