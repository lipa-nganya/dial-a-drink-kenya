import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  LocalShipping,
  CheckCircle,
  People,
  AttachMoney
} from '@mui/icons-material';
import { api } from '../services/valkyrieApi';

const Overview = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [ordersRes] = await Promise.all([
        api.get('/orders?limit=100')
      ]);

      const orders = ordersRes.data.orders || [];
      const activeOrders = orders.filter(o => ['pending', 'confirmed', 'preparing', 'out_for_delivery'].includes(o.status));
      const completedOrders = orders.filter(o => o.status === 'delivered' || o.status === 'completed');
      const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.totalAmount || 0), 0);

      setStats({
        activeOrders: activeOrders.length,
        completedOrders: completedOrders.length,
        totalOrders: orders.length,
        totalRevenue
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load statistics');
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
      title: 'Active Deliveries',
      value: stats.activeOrders,
      icon: <LocalShipping />,
      color: '#1976d2'
    },
    {
      title: 'Completed',
      value: stats.completedOrders,
      icon: <CheckCircle />,
      color: '#2e7d32'
    },
    {
      title: 'Total Orders',
      value: stats.totalOrders,
      icon: <People />,
      color: '#ed6c02'
    },
    {
      title: 'Total Revenue',
      value: `KES ${stats.totalRevenue.toLocaleString()}`,
      icon: <AttachMoney />,
      color: '#9c27b0'
    }
  ];

  return (
    <Container>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }}>
        Valkyrie Overview
      </Typography>

      <Grid container spacing={3}>
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
    </Container>
  );
};

export default Overview;














