import React, { useState, useEffect } from 'react';
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
  Paper,
  Chip,
  Button
} from '@mui/material';
import {
  Business,
  Map,
  ShoppingCart,
  AttachMoney
} from '@mui/icons-material';
import { api } from '../services/zeusApi';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recentPartners, setRecentPartners] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [partnersRes] = await Promise.all([
        api.get('/partners?limit=10')
      ]);

      const partners = partnersRes.data.partners || [];
      
      const activePartners = partners.filter(p => p.status === 'active').length;
      const suspendedPartners = partners.filter(p => p.status === 'suspended').length;
      const totalGeofences = partners.reduce((sum, p) => sum + (p.geofenceCount || 0), 0);

      setStats({
        totalPartners: partners.length,
        activePartners,
        suspendedPartners,
        totalGeofences
      });

      setRecentPartners(partners.slice(0, 5));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
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

  if (error) {
    return (
      <Container>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  const statCards = [
    {
      title: 'Total Partners',
      value: stats.totalPartners,
      icon: <Business />,
      color: '#1976d2'
    },
    {
      title: 'Active Partners',
      value: stats.activePartners,
      icon: <Business />,
      color: '#2e7d32'
    },
    {
      title: 'Total Geofences',
      value: stats.totalGeofences,
      icon: <Map />,
      color: '#ed6c02'
    },
    {
      title: 'Suspended',
      value: stats.suspendedPartners,
      icon: <Business />,
      color: '#d32f2f'
    }
  ];

  const getStatusColor = (status) => {
    const colors = {
      active: 'success',
      suspended: 'error',
      restricted: 'warning'
    };
    return colors[status] || 'default';
  };

  return (
    <Container>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }}>
        Zeus Dashboard
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      {card.title}
                    </Typography>
                    <Typography variant="h5" component="div">
                      {card.value}
                    </Typography>
                  </Box>
                  <Box sx={{ color: card.color, fontSize: 40 }}>
                    {card.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
        Recent Partners
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Billing Plan</TableCell>
              <TableCell>Geofences</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {recentPartners.map((partner) => (
              <TableRow 
                key={partner.id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => navigate(`/partners/${partner.id}`)}
              >
                <TableCell>{partner.name}</TableCell>
                <TableCell>
                  <Chip
                    label={partner.status}
                    color={getStatusColor(partner.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>{partner.billingPlan || 'N/A'}</TableCell>
                <TableCell>{partner.geofenceCount || 0}</TableCell>
                <TableCell>
                  <Button size="small" onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/partners/${partner.id}`);
                  }}>
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
};

export default Dashboard;

