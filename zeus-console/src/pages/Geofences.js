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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  IconButton,
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Map,
  Upload,
  Description,
  CheckCircle,
  Error as ErrorIcon
} from '@mui/icons-material';
import { api } from '../services/zeusApi';

const Geofences = () => {
  const [geofences, setGeofences] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState(null);
  const [globalGeofence, setGlobalGeofence] = useState(null);
  const [globalDialogOpen, setGlobalDialogOpen] = useState(false);
  const [globalFormData, setGlobalFormData] = useState({
    name: '',
    description: '',
    geometry: ''
  });
  const [geojsonFile, setGeojsonFile] = useState(null);
  const [uploadMethod, setUploadMethod] = useState('manual');
  const [formData, setFormData] = useState({
    partnerId: '',
    name: '',
    geometry: '',
    active: true
  });
  const [validatingId, setValidatingId] = useState(null);
  const [validationResults, setValidationResults] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [geofencesRes, partnersRes, globalGeofenceRes] = await Promise.all([
        api.get('/geofences'),
        api.get('/partners'),
        api.get('/global-geofence')
      ]);
      setGeofences(geofencesRes.data.geofences || []);
      setPartners(partnersRes.data.partners || []);
      setGlobalGeofence(globalGeofenceRes.data.globalGeofence);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (geofence = null) => {
    if (geofence) {
      setEditingGeofence(geofence);
      setFormData({
        partnerId: geofence.partnerId,
        name: geofence.name,
        geometry: JSON.stringify(geofence.geometry, null, 2),
        active: geofence.active
      });
    } else {
      setEditingGeofence(null);
      setFormData({
        partnerId: '',
        name: '',
        geometry: '',
        active: true
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingGeofence(null);
  };

  const handleSubmit = async () => {
    try {
      let geometry;
      try {
        geometry = JSON.parse(formData.geometry);
      } catch (e) {
        setError('Invalid JSON format for geometry');
        return;
      }

      const payload = {
        partnerId: parseInt(formData.partnerId),
        name: formData.name,
        geometry: geometry,
        active: formData.active
      };

      if (editingGeofence) {
        await api.patch(`/geofences/${editingGeofence.id}`, payload);
      } else {
        await api.post('/geofences', payload);
      }
      handleCloseDialog();
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save geofence');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this geofence?')) {
      return;
    }

    try {
      await api.delete(`/geofences/${id}`);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete geofence');
    }
  };

  const getSourceColor = (source) => {
    return source === 'zeus' ? 'primary' : 'default';
  };

  const handleOpenGlobalDialog = (geofence = null) => {
    if (geofence) {
      setGlobalFormData({
        name: geofence.name,
        description: geofence.description || '',
        geometry: JSON.stringify(geofence.geometry, null, 2)
      });
      setUploadMethod('manual');
    } else {
      setGlobalFormData({
        name: '',
        description: '',
        geometry: ''
      });
      setUploadMethod('file');
    }
    setGeojsonFile(null);
    setGlobalDialogOpen(true);
  };

  const handleCloseGlobalDialog = () => {
    setGlobalDialogOpen(false);
  };

  const handleGeojsonFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setGeojsonFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target.result;
          const parsed = JSON.parse(content);
          
          let geometry = null;
          if (parsed.type === 'Feature') {
            geometry = parsed.geometry;
          } else if (parsed.type === 'FeatureCollection' && parsed.features && parsed.features.length > 0) {
            geometry = parsed.features[0].geometry;
          } else if (parsed.type === 'Polygon' || parsed.type === 'MultiPolygon') {
            geometry = parsed;
          }
          
          if (geometry) {
            setGlobalFormData({
              ...globalFormData,
              geometry: JSON.stringify(geometry, null, 2)
            });
            setUploadMethod('file');
          } else {
            setError('GeoJSON file must contain a Feature, FeatureCollection, Polygon, or MultiPolygon');
          }
        } catch (err) {
          setError(`Failed to parse GeoJSON file: ${err.message}`);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSubmitGlobalGeofence = async () => {
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', globalFormData.name);
      if (globalFormData.description) {
        formDataToSend.append('description', globalFormData.description);
      }
      
      if (geojsonFile && uploadMethod === 'file') {
        formDataToSend.append('geojson', geojsonFile);
      } else {
        let geometry;
        try {
          geometry = JSON.parse(globalFormData.geometry);
        } catch (e) {
          setError('Invalid JSON format for geometry');
          return;
        }
        formDataToSend.append('geometry', JSON.stringify(geometry));
      }

      await api.post('/global-geofence', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      handleCloseGlobalDialog();
      fetchData();
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save global geofence');
    }
  };

  const handleDeleteGlobalGeofence = async (id) => {
    if (!window.confirm('Are you sure you want to delete the global geofence? This will remove the umbrella boundary for all partners.')) {
      return;
    }

    try {
      await api.delete(`/global-geofence/${id}`);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete global geofence');
    }
  };

  const handleValidate = async (geofenceId) => {
    setValidatingId(geofenceId);
    try {
      const response = await api.post(`/geofences/${geofenceId}/validate`);
      setValidationResults({
        ...validationResults,
        [geofenceId]: {
          valid: response.data.valid,
          message: response.data.message,
          timestamp: new Date()
        }
      });
    } catch (err) {
      setValidationResults({
        ...validationResults,
        [geofenceId]: {
          valid: false,
          message: err.response?.data?.message || 'Validation failed',
          timestamp: new Date()
        }
      });
    } finally {
      setValidatingId(null);
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
    <Container>
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1">
          Geofence Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Create Geofence
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 4, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h5" gutterBottom>
              Global Delivery Boundary
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              The global geofence acts as an umbrella boundary. All partner geofences must be within this boundary.
            </Typography>
          </Box>
          <Box>
            {globalGeofence ? (
              <>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<Edit />}
                  onClick={() => handleOpenGlobalDialog(globalGeofence)}
                  sx={{ mr: 1 }}
                >
                  Edit
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={<Delete />}
                  onClick={() => handleDeleteGlobalGeofence(globalGeofence.id)}
                >
                  Delete
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                color="secondary"
                startIcon={<Add />}
                onClick={() => handleOpenGlobalDialog()}
              >
                Create Global Geofence
              </Button>
            )}
          </Box>
        </Box>
        {globalGeofence && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            <Typography variant="subtitle1" color="text.primary" gutterBottom>
              <strong>{globalGeofence.name}</strong>
            </Typography>
            {globalGeofence.description && (
              <Typography variant="body2" color="text.secondary" paragraph>
                {globalGeofence.description}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              Created: {new Date(globalGeofence.createdAt).toLocaleString()}
            </Typography>
          </Box>
        )}
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Partner</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>Validation</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {geofences.map((geofence) => {
              const validation = validationResults[geofence.id];
              return (
                <TableRow key={geofence.id}>
                  <TableCell>{geofence.name}</TableCell>
                  <TableCell>{geofence.partnerName || `Partner ${geofence.partnerId}`}</TableCell>
                  <TableCell>
                    <Chip
                      label={geofence.source}
                      color={getSourceColor(geofence.source)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={geofence.active ? 'Active' : 'Inactive'}
                      color={geofence.active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box>
                      {validation ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          {validation.valid ? (
                            <CheckCircle color="success" fontSize="small" />
                          ) : (
                            <ErrorIcon color="error" fontSize="small" />
                          )}
                          <Typography
                            variant="caption"
                            color={validation.valid ? 'success.main' : 'error.main'}
                            sx={{ flex: 1 }}
                            title={validation.message}
                          >
                            {validation.valid ? 'Valid' : 'Invalid'}
                          </Typography>
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => handleValidate(geofence.id)}
                            disabled={validatingId === geofence.id}
                            sx={{ minWidth: 'auto', p: 0.5 }}
                            title="Re-validate"
                          >
                            {validatingId === geofence.id ? (
                              <CircularProgress size={14} />
                            ) : (
                              <CheckCircle fontSize="small" />
                            )}
                          </Button>
                        </Box>
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleValidate(geofence.id)}
                          disabled={validatingId === geofence.id}
                          startIcon={validatingId === geofence.id ? <CircularProgress size={16} /> : <CheckCircle />}
                          fullWidth
                        >
                          {validatingId === geofence.id ? 'Validating...' : 'Validate'}
                        </Button>
                      )}
                      {validation && (
                        <Typography 
                          variant="caption" 
                          color={validation.valid ? 'text.secondary' : 'error.main'} 
                          display="block" 
                          sx={{ fontSize: '0.7rem', wordBreak: 'break-word' }}
                        >
                          {validation.message}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(geofence)}
                      title="Edit"
                    >
                      <Edit />
                    </IconButton>
                    {geofence.source === 'zeus' && (
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(geofence.id)}
                        title="Delete"
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingGeofence ? 'Edit Geofence' : 'Create Geofence'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            select
            label="Partner"
            value={formData.partnerId}
            onChange={(e) => setFormData({ ...formData, partnerId: e.target.value })}
            margin="normal"
            required
            disabled={!!editingGeofence}
          >
            {partners.map((partner) => (
              <MenuItem key={partner.id} value={partner.id}>
                {partner.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            label="Geofence Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="GeoJSON Geometry"
            value={formData.geometry}
            onChange={(e) => setFormData({ ...formData, geometry: e.target.value })}
            margin="normal"
            required
            multiline
            rows={10}
            helperText="Enter GeoJSON Polygon or MultiPolygon geometry"
          />
          <FormControlLabel
            control={
              <Switch
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              />
            }
            label="Active"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingGeofence ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={globalDialogOpen} onClose={handleCloseGlobalDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {globalGeofence ? 'Edit Global Geofence' : 'Create Global Geofence'}
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            The global geofence acts as an umbrella boundary. All partner geofences must be completely within this boundary.
          </Alert>
          <TextField
            fullWidth
            label="Name"
            value={globalFormData.name}
            onChange={(e) => setGlobalFormData({ ...globalFormData, name: e.target.value })}
            margin="normal"
            required
            placeholder="e.g., Kenya Delivery Boundary"
          />
          <TextField
            fullWidth
            label="Description"
            value={globalFormData.description}
            onChange={(e) => setGlobalFormData({ ...globalFormData, description: e.target.value })}
            margin="normal"
            multiline
            rows={2}
            placeholder="Optional description of the global boundary"
          />
          
          <Box sx={{ mt: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Upload Method
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant={uploadMethod === 'file' ? 'contained' : 'outlined'}
                startIcon={<Upload />}
                onClick={() => {
                  setUploadMethod('file');
                  setGeojsonFile(null);
                  setGlobalFormData({ ...globalFormData, geometry: '' });
                }}
              >
                Upload GeoJSON File
              </Button>
              <Button
                variant={uploadMethod === 'manual' ? 'contained' : 'outlined'}
                startIcon={<Description />}
                onClick={() => {
                  setUploadMethod('manual');
                  setGeojsonFile(null);
                }}
              >
                Enter Manually
              </Button>
            </Box>
          </Box>

          {uploadMethod === 'file' && (
            <Box sx={{ mb: 2 }}>
              <input
                accept=".geojson,.json,application/json,application/geo+json"
                style={{ display: 'none' }}
                id="geojson-file-upload"
                type="file"
                onChange={handleGeojsonFileChange}
              />
              <label htmlFor="geojson-file-upload">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<Upload />}
                  fullWidth
                  sx={{ mb: 1 }}
                >
                  {geojsonFile ? geojsonFile.name : 'Choose GeoJSON File'}
                </Button>
              </label>
              <Typography variant="caption" color="text.secondary" display="block">
                Upload a GeoJSON file (.geojson or .json). Supports Feature, FeatureCollection, Polygon, or MultiPolygon.
              </Typography>
            </Box>
          )}

          <TextField
            fullWidth
            label="GeoJSON Geometry"
            value={globalFormData.geometry}
            onChange={(e) => setGlobalFormData({ ...globalFormData, geometry: e.target.value })}
            margin="normal"
            required={uploadMethod === 'manual'}
            disabled={uploadMethod === 'file' && !geojsonFile}
            multiline
            rows={10}
            helperText={
              uploadMethod === 'file'
                ? 'Geometry will be populated from uploaded file'
                : 'Enter GeoJSON Polygon or MultiPolygon geometry. This will be the umbrella boundary for all partners.'
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseGlobalDialog}>Cancel</Button>
          <Button 
            onClick={handleSubmitGlobalGeofence} 
            variant="contained"
            disabled={!globalFormData.name || (!globalFormData.geometry && !geojsonFile)}
          >
            {globalGeofence ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Geofences;
