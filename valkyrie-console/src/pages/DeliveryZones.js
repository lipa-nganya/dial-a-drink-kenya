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
  CircularProgress,
  Alert,
  IconButton,
  FormControlLabel,
  Switch,
  Divider,
  Tabs,
  Tab
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Map,
  Upload,
  CloudUpload,
  Download,
  Search
} from '@mui/icons-material';
import { api } from '../services/valkyrieApi';
import LocationSelector from '../components/LocationSelector';

const DeliveryZones = () => {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    geometry: '',
    active: true
  });
  const [partnerId, setPartnerId] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [zoneCreationMethod, setZoneCreationMethod] = useState('search'); // 'search' or 'upload'
  const [generatedGeoJSON, setGeneratedGeoJSON] = useState(null);

  useEffect(() => {
    // Get partner ID from stored token/user data
    const partner = JSON.parse(localStorage.getItem('valkyriePartner') || '{}');
    setPartnerId(partner.id);
    if (partner.id) {
      fetchZones(partner.id);
    }
  }, []);

  const fetchZones = async (pid) => {
    try {
      // Use Valkyrie API endpoint for delivery zones
      const response = await api.get('/zones');
      setZones(response.data.zones || []);
    } catch (err) {
      console.warn('Could not fetch zones:', err);
      setZones([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (zone = null) => {
    if (zone) {
      setEditingZone(zone);
      setFormData({
        name: zone.name,
        geometry: JSON.stringify(zone.geometry, null, 2),
        active: zone.active
      });
      
      // Check if zone was generated from locations (has sourceLocations in properties)
      const geometry = zone.geometry;
      let locationsFromZone = [];
      
      // Handle both Feature format and direct geometry with properties
      let geometryProps = null;
      if (geometry && geometry.type === 'Feature' && geometry.properties) {
        geometryProps = geometry.properties;
      } else if (geometry && geometry.properties) {
        geometryProps = geometry.properties;
      }
      
      if (geometryProps && geometryProps.sourceLocations) {
        locationsFromZone = geometryProps.sourceLocations;
        setZoneCreationMethod('search');
        setSelectedLocations(locationsFromZone);
        
        // Reconstruct the GeoJSON Feature for display
        const geometryOnly = geometry.type === 'Feature' ? geometry.geometry : geometry;
        setGeneratedGeoJSON({
          type: 'Feature',
          properties: geometryProps,
          geometry: geometryOnly
        });
      } else {
        setZoneCreationMethod('upload');
        setSelectedLocations([]);
        setGeneratedGeoJSON(null);
      }
    } else {
      setEditingZone(null);
      setFormData({
        name: '',
        geometry: '',
        active: true
      });
      setZoneCreationMethod('search'); // Default to search method for new zones
      setSelectedLocations([]);
      setGeneratedGeoJSON(null);
    }
    setUploadSuccess(null);
    setError(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingZone(null);
    setSelectedLocations([]);
    setGeneratedGeoJSON(null);
    setZoneCreationMethod('search');
  };

  const handleGenerateGeoJSON = async () => {
    if (selectedLocations.length < 3) {
      setError('Please select at least 3 locations to generate a delivery zone');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Use places API (not under /valkyrie/v1)
      // Determine API URL based on hostname (same logic as valkyrieApi)
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
      const isLocalHost = ['localhost', '127.0.0.1'].includes(hostname) || hostname.endsWith('.local');
      const isLanHost = /^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])/.test(hostname || '');
      
      const placesApiUrl = (isLocalHost || isLanHost)
        ? 'http://localhost:5001/api'
        : (process.env.REACT_APP_VALKYRIE_API_URL?.replace('/valkyrie/v1', '') || 'https://dialadrink-backend-910510650031.us-central1.run.app/api');
      
      const response = await fetch(`${placesApiUrl}/places/generate-geojson`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('valkyrieToken')}`
        },
        body: JSON.stringify({ locations: selectedLocations })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        const geojson = data.geojson;
        const geometry = data.geometry;

        setGeneratedGeoJSON(geojson);
        // Store the full Feature (with properties including sourceLocations) for saving
        // This preserves the location data for editing later
        setFormData({
          ...formData,
          geometry: JSON.stringify(geojson, null, 2), // Store full Feature, not just geometry
          name: formData.name || geojson.properties.name || 'Generated Delivery Zone'
        });

        setUploadSuccess(`GeoJSON generated successfully from ${selectedLocations.length} locations!`);
      } else {
        setError(data.message || 'Failed to generate GeoJSON');
      }
    } catch (err) {
      setError(err.message || 'Failed to generate GeoJSON');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadGeoJSON = () => {
    if (!generatedGeoJSON) return;

    const dataStr = JSON.stringify(generatedGeoJSON, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${formData.name || 'delivery-zone'}.geojson`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    if (!partnerId) {
      setError('Partner ID not found');
      return;
    }

    try {
      let geometry;
      try {
        geometry = JSON.parse(formData.geometry);
      } catch (e) {
        setError('Invalid JSON format for geometry');
        return;
      }

      // Validate geometry is within Zeus boundaries
      // This validation happens server-side, but we can show a warning
      // Send the full geometry (Feature with properties) to preserve sourceLocations
      const payload = {
        partnerId: partnerId,
        name: formData.name,
        geometry: geometry, // Full geometry with properties if it's a Feature
        active: formData.active,
        source: 'partner'
      };

      if (editingZone) {
        // Partners can only update their own geofences
        if (editingZone.source === 'zeus') {
          setError('Cannot edit Zeus-managed geofences');
          return;
        }
        await api.patch(`/zones/${editingZone.id}`, {
          name: formData.name,
          geometry: geometry,
          active: formData.active
        });
      } else {
        // Create new geofence - will be validated against Zeus boundaries
        await api.post('/zones', {
          name: formData.name,
          geometry: geometry,
          active: formData.active
        });
      }
      handleCloseDialog();
      fetchZones(partnerId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save delivery zone. Ensure it is within Zeus-defined boundaries.');
    }
  };

  const handleDelete = async (id, source) => {
    if (source === 'zeus') {
      setError('Cannot delete Zeus-managed geofences');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this delivery zone?')) {
      return;
    }

    try {
      await api.delete(`/zones/${id}`);
      fetchZones(partnerId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete delivery zone');
    }
  };

  const handleToggleActive = async (id, currentActive, source) => {
    if (source === 'zeus') {
      setError('Cannot modify Zeus-managed geofences');
      return;
    }

    try {
      await api.patch(`/zones/${id}`, { active: !currentActive });
      fetchZones(partnerId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update zone status');
    }
  };

  const validateGeoJSON = (geojson) => {
    const errors = [];

    // Check if it's a valid JSON
    if (!geojson || typeof geojson !== 'object') {
      errors.push('Invalid JSON format');
      return { valid: false, errors };
    }

    // Handle FeatureCollection
    if (geojson.type === 'FeatureCollection') {
      if (!geojson.features || !Array.isArray(geojson.features)) {
        errors.push('FeatureCollection must have a features array');
        return { valid: false, errors };
      }
      if (geojson.features.length === 0) {
        errors.push('FeatureCollection must have at least one feature');
        return { valid: false, errors };
      }
      // Validate each feature
      geojson.features.forEach((feature, index) => {
        if (!feature.geometry) {
          errors.push(`Feature ${index + 1}: Missing geometry`);
        } else if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') {
          errors.push(`Feature ${index + 1}: Geometry type must be Polygon or MultiPolygon, got ${feature.geometry.type}`);
        }
      });
      return { valid: errors.length === 0, errors };
    }

    // Handle Feature
    if (geojson.type === 'Feature') {
      if (!geojson.geometry) {
        errors.push('Feature must have a geometry property');
        return { valid: false, errors };
      }
      if (geojson.geometry.type !== 'Polygon' && geojson.geometry.type !== 'MultiPolygon') {
        errors.push(`Geometry type must be Polygon or MultiPolygon, got ${geojson.geometry.type}`);
        return { valid: false, errors };
      }
      return { valid: errors.length === 0, errors, geometry: geojson.geometry };
    }

    // Handle direct Geometry
    if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon') {
      if (!geojson.coordinates || !Array.isArray(geojson.coordinates)) {
        errors.push('Geometry must have coordinates array');
        return { valid: false, errors };
      }
      return { valid: errors.length === 0, errors, geometry: geojson };
    }

    errors.push(`Unsupported GeoJSON type: ${geojson.type}. Expected FeatureCollection, Feature, Polygon, or MultiPolygon`);
    return { valid: false, errors };
  };

  const extractGeometry = (geojson) => {
    // If it's a FeatureCollection, use the first feature's geometry
    if (geojson.type === 'FeatureCollection' && geojson.features && geojson.features.length > 0) {
      return geojson.features[0].geometry;
    }
    // If it's a Feature, use its geometry
    if (geojson.type === 'Feature' && geojson.geometry) {
      return geojson.geometry;
    }
    // If it's a direct geometry, use it
    if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon') {
      return geojson;
    }
    return null;
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadSuccess(null);
    setError(null);
    setUploading(true);

    try {
      // Read file content
      const fileContent = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      });

      // Parse JSON
      let geojson;
      try {
        geojson = JSON.parse(fileContent);
      } catch (e) {
        setError(`Invalid JSON: ${e.message}`);
        setUploading(false);
        event.target.value = '';
        return;
      }

      // Validate GeoJSON
      const validation = validateGeoJSON(geojson);
      if (!validation.valid) {
        setError(`GeoJSON validation failed:\n${validation.errors.join('\n')}`);
        setUploading(false);
        event.target.value = '';
        return;
      }

      // Extract geometry
      const geometry = extractGeometry(geojson);
      if (!geometry) {
        setError('Could not extract geometry from GeoJSON');
        setUploading(false);
        event.target.value = '';
        return;
      }

      // Extract name from GeoJSON properties or use filename
      let zoneName = file.name.replace('.geojson', '').replace('.json', '');
      if (geojson.type === 'Feature' && geojson.properties && geojson.properties.name) {
        zoneName = geojson.properties.name;
      } else if (geojson.type === 'FeatureCollection' && geojson.features && geojson.features[0] && geojson.features[0].properties && geojson.features[0].properties.name) {
        zoneName = geojson.features[0].properties.name;
      }

      // Populate form with extracted data
      setFormData({
        ...formData,
        name: zoneName || formData.name,
        geometry: JSON.stringify(geometry, null, 2)
      });

      setUploadSuccess(`GeoJSON file loaded successfully! Zone name: "${zoneName || 'Enter a name'}"`);
      
      // Clear file input
      event.target.value = '';
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to read GeoJSON file';
      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
          Delivery Zones
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Add Zone
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}


      <Alert severity="info" sx={{ mb: 2 }}>
        Delivery zones define where you can create orders. Partner-created zones must be within Zeus-defined boundaries.
      </Alert>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>Uploaded</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {zones.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No delivery zones configured. Contact Zeus admin to set up zones.
                </TableCell>
              </TableRow>
            ) : (
              zones.map((zone) => (
                <TableRow key={zone.id}>
                  <TableCell>{zone.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={zone.source === 'zeus' ? 'Zeus Managed' : 'Partner Managed'}
                      color={zone.source === 'zeus' ? 'primary' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={zone.active ? 'Active' : 'Inactive'}
                      color={zone.active ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(zone.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {zone.source === 'partner' && (
                      <>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(zone)}
                          title="Edit"
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleToggleActive(zone.id, zone.active, zone.source)}
                          title={zone.active ? 'Deactivate' : 'Activate'}
                        >
                          <Switch size="small" checked={zone.active} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(zone.id, zone.source)}
                          title="Delete"
                          color="error"
                        >
                          <Delete />
                        </IconButton>
                      </>
                    )}
                    {zone.source === 'zeus' && (
                      <Typography variant="body2" color="textSecondary">
                        Read-only
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingZone ? 'Edit Delivery Zone' : 'Create Delivery Zone'}
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Your delivery zone must be entirely within Zeus-defined boundaries. Invalid zones will be rejected. Your customers will only be able to order from the delivery zone defined in the geojson.
          </Alert>

          {uploadSuccess && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setUploadSuccess(null)}>
              {uploadSuccess}
            </Alert>
          )}

          {!editingZone && (
            <Box sx={{ mb: 2 }}>
              <Tabs
                value={zoneCreationMethod}
                onChange={(e, newValue) => setZoneCreationMethod(newValue)}
                sx={{ mb: 2 }}
              >
                <Tab icon={<Search />} iconPosition="start" label="Search Locations" value="search" />
                <Tab icon={<Upload />} iconPosition="start" label="Upload GeoJSON" value="upload" />
              </Tabs>
            </Box>
          )}

          {(zoneCreationMethod === 'search' || (editingZone && selectedLocations.length > 0)) ? (
            <Box>
              <LocationSelector
                onLocationsChange={setSelectedLocations}
                selectedLocations={selectedLocations}
              />

              {selectedLocations.length >= 3 && !editingZone && (
                <Box sx={{ mt: 3 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleGenerateGeoJSON}
                    disabled={uploading}
                    startIcon={uploading ? <CircularProgress size={20} /> : <Map />}
                    sx={{ mb: 2 }}
                  >
                    {uploading ? 'Generating GeoJSON...' : `Generate Zone from ${selectedLocations.length} Locations`}
                  </Button>

                  {generatedGeoJSON && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                      <Typography variant="body2" gutterBottom>
                        GeoJSON generated successfully! Review the geometry below and download if needed.
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Download />}
                        onClick={handleDownloadGeoJSON}
                        sx={{ mt: 1 }}
                      >
                        Download GeoJSON
                      </Button>
                    </Alert>
                  )}
                </Box>
              )}

              {selectedLocations.length > 0 && selectedLocations.length < 3 && !editingZone && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Please select at least 3 locations to generate a delivery zone polygon.
                </Alert>
              )}

              {editingZone && selectedLocations.length > 0 && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    Showing {selectedLocations.length} location(s) used to generate this zone. You can modify the locations and regenerate, or edit the geometry directly below.
                  </Typography>
                </Alert>
              )}
            </Box>
          ) : (
            <Box>
              <Box sx={{ mb: 2 }}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<CloudUpload />}
                  disabled={uploading}
                  fullWidth
                >
                  {uploading ? 'Loading GeoJSON...' : 'Upload GeoJSON File'}
                  <input
                    type="file"
                    hidden
                    accept=".geojson,.json"
                    onChange={handleFileUpload}
                  />
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Upload a GeoJSON file to automatically populate the zone name and geometry
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }}>OR</Divider>
            </Box>
          )}

          <TextField
            fullWidth
            label="Zone Name"
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
            helperText="Enter GeoJSON Polygon or MultiPolygon. Must be within Zeus boundaries."
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
          <Button onClick={handleSubmit} variant="contained" disabled={uploading}>
            {editingZone ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default DeliveryZones;

