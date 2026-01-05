import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Switch
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { api } from '../services/valkyrieApi';

const Drivers = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      const response = await api.get('/drivers');
      setDrivers(response.data.drivers || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load drivers');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (driverId, currentActive) => {
    try {
      await api.patch(`/drivers/${driverId}/status`, { active: !currentActive });
      fetchDrivers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update driver status');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'success',
      inactive: 'default',
      on_delivery: 'info',
      offline: 'warning'
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
          Valkyrie Fleet
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          disabled
        >
          Add Driver
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
              <TableCell>Phone</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Ownership</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {drivers.map((driver) => (
              <TableRow key={driver.id}>
                <TableCell>{driver.name}</TableCell>
                <TableCell>{driver.phoneNumber}</TableCell>
                <TableCell>
                  <Chip
                    label={driver.status}
                    color={getStatusColor(driver.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={driver.ownershipType === 'partner_owned' ? 'Partner Owned' : 'DeliveryOS'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    checked={driver.active}
                    onChange={() => handleToggleActive(driver.id, driver.active)}
                  />
                </TableCell>
                <TableCell>
                  {/* Future: View driver details */}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
};

export default Drivers;














