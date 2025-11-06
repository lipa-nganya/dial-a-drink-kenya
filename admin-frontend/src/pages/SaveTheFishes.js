import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import {
  LocalFlorist,
  Savings,
  Search
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useEasterEgg } from '../contexts/EasterEggContext';

const SaveTheFishes = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { colors, isDarkMode } = useTheme();
  const { isEasterEggActive } = useEasterEgg();
  const navigate = useNavigate();

  // Redirect to dashboard if easter egg is deactivated
  useEffect(() => {
    if (!isEasterEggActive) {
      navigate('/dashboard', { replace: true });
    }
  }, [isEasterEggActive, navigate]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get('/admin/save-the-fishes');
      setStats(response.data);
      setError(null);
    } catch (error) {
      console.error('Error fetching Save the Fishes stats:', error);
      setError(error.response?.data?.error || 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only fetch stats if easter egg is active
    if (isEasterEggActive) {
      fetchStats();
      // Refresh every 30 seconds
      const interval = setInterval(fetchStats, 30000);
      return () => clearInterval(interval);
    }
  }, [isEasterEggActive, fetchStats]);

  // Don't render anything if easter egg is not active (after all hooks)
  if (!isEasterEggActive) {
    return null;
  }

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box mb={4}>
        <Typography variant="h4" component="h1" sx={{ mb: 2, color: colors.textPrimary, fontWeight: 700 }}>
          <LocalFlorist sx={{ mr: 1, verticalAlign: 'middle', color: colors.accentText }} />
          Save the Fishes
        </Typography>
        <Typography variant="body1" sx={{ color: colors.textSecondary, mb: 3 }}>
          Track how many Google API calls we've saved by caching addresses in our database!
        </Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Total Addresses Saved */}
        <Grid item xs={12} md={4}>
          <Card sx={{ backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>
                    Fishes Saved
                  </Typography>
                  <Typography variant="h3" sx={{ color: colors.accentText, fontWeight: 700 }}>
                    {stats?.totalAddresses || 0}
                  </Typography>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, mt: 1 }}>
                    Unique addresses
                  </Typography>
                </Box>
                <LocalFlorist sx={{ fontSize: 48, color: colors.accentText, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Total Cost Saved */}
        <Grid item xs={12} md={4}>
          <Card sx={{ backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>
                    Cost Savings
                  </Typography>
                  <Typography variant="h3" sx={{ color: colors.accentText, fontWeight: 700 }}>
                    KES {stats?.totalCostSaved?.toFixed(2) || '0.00'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, mt: 1 }}>
                    Saved from API calls
                  </Typography>
                </Box>
                <Savings sx={{ fontSize: 48, color: colors.accentText, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* API Calls Saved */}
        <Grid item xs={12} md={4}>
          <Card sx={{ backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>
                    API Calls Saved
                  </Typography>
                  <Typography variant="h3" sx={{ color: colors.accentText, fontWeight: 700 }}>
                    {stats?.totalApiCallsSaved || 0}
                  </Typography>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, mt: 1 }}>
                    Google API calls avoided
                  </Typography>
                </Box>
                <Search sx={{ fontSize: 48, color: colors.accentText, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Top Searched Addresses */}
      <Card sx={{ backgroundColor: colors.paper, border: `1px solid ${colors.border}` }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, color: colors.textPrimary, fontWeight: 600 }}>
            Top Searched Addresses
          </Typography>
          {stats?.topAddresses && stats.topAddresses.length > 0 ? (
            <TableContainer component={Paper} sx={{ backgroundColor: 'transparent', boxShadow: 'none' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: colors.textSecondary, fontWeight: 600 }}>Address</TableCell>
                    <TableCell align="right" sx={{ color: colors.textSecondary, fontWeight: 600 }}>Searches</TableCell>
                    <TableCell align="right" sx={{ color: colors.textSecondary, fontWeight: 600 }}>API Calls Saved</TableCell>
                    <TableCell align="right" sx={{ color: colors.textSecondary, fontWeight: 600 }}>Cost Saved (KES)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.topAddresses.map((address, index) => (
                    <TableRow key={address.id} sx={{ '&:hover': { backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.05)' : 'rgba(0, 0, 0, 0.02)' } }}>
                      <TableCell sx={{ color: colors.textPrimary }}>
                        {address.address}
                      </TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>
                        {address.searchCount}
                      </TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>
                        {address.apiCallsSaved}
                      </TableCell>
                      <TableCell align="right" sx={{ color: colors.accentText, fontWeight: 600 }}>
                        {address.costSaved.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" sx={{ color: colors.textSecondary, py: 2 }}>
              No addresses saved yet. Start searching addresses to see them appear here!
            </Typography>
          )}
        </CardContent>
      </Card>
    </Container>
  );
};

export default SaveTheFishes;

