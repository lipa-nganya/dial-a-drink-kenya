import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Grid,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Dashboard,
  Assignment,
  Inventory,
  AttachMoney,
  ShoppingCart,
  LocalBar,
  TrendingUp,
  TrendingDown,
  Security,
  Notifications
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import io from 'socket.io-client';

const AdminOverview = () => {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [socket, setSocket] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Initialize socket connection - use production URL
    const socketUrl = window.location.hostname.includes('onrender.com') 
      ? 'https://dialadrink-backend.onrender.com'
      : 'http://localhost:5001';
    const newSocket = io(socketUrl);
    newSocket.emit('join-admin');
    
    newSocket.on('new-order', (data) => {
      setNotification({
        message: data.message,
        order: data.order
      });
      // Play notification sound
      playNotificationSound();
      // Refresh stats
      fetchStats();
    });

    setSocket(newSocket);

    // Fetch initial data
    fetchStats();

    return () => {
      newSocket.close();
    };
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setError(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  const playNotificationSound = () => {
    try {
      // Create a simple beep sound with better browser compatibility
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Resume audio context if suspended (required for autoplay policies)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Create a more noticeable notification sound
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.6);
      
      console.log('🔔 Notification sound played');
    } catch (error) {
      console.warn('Could not play notification sound:', error);
      // Fallback: show browser notification if sound fails
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New Order Received!', {
          body: 'A new order has been placed',
          icon: '/favicon.ico'
        });
      }
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading dashboard...</Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">Error loading dashboard: {error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ color: '#00E0B8', fontWeight: 700 }}>
          🎛️ Admin Dashboard
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Manage your Dial A Drink business
        </Typography>
      </Box>

      {/* Quick Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: '#121212', height: '100%' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <ShoppingCart sx={{ fontSize: 40, color: '#00E0B8', mb: 1 }} />
              <Typography variant="h4" sx={{ color: '#00E0B8', fontWeight: 700 }}>
                {stats.totalOrders || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Orders
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: '#121212', height: '100%' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <TrendingUp sx={{ fontSize: 40, color: '#FF3366', mb: 1 }} />
              <Typography variant="h4" sx={{ color: '#FF3366', fontWeight: 700 }}>
                {stats.pendingOrders || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Pending Orders
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: '#121212', height: '100%' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <LocalBar sx={{ fontSize: 40, color: '#00E0B8', mb: 1 }} />
              <Typography variant="h4" sx={{ color: '#00E0B8', fontWeight: 700 }}>
                {stats.totalDrinks || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Drinks
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ backgroundColor: '#121212', height: '100%' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <TrendingDown sx={{ fontSize: 40, color: '#00E0B8', mb: 1 }} />
              <Typography variant="h4" sx={{ color: '#00E0B8', fontWeight: 700 }}>
                {stats.availableDrinks || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Available Drinks
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Navigation Cards */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card 
            sx={{ 
              height: '100%',
              cursor: 'pointer',
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 8px 20px rgba(0, 224, 184, 0.2)'
              }
            }}
            onClick={() => navigate('/admin/orders')}
          >
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Assignment sx={{ fontSize: 64, color: '#00E0B8', mb: 2 }} />
              <Typography variant="h5" sx={{ color: '#00E0B8', fontWeight: 600, mb: 1 }}>
                📋 Orders Management
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                View and manage customer orders, update order status, and track order history
              </Typography>
              <Button 
                variant="contained" 
                size="large"
                sx={{
                  backgroundColor: '#00E0B8',
                  color: '#0D0D0D',
                  '&:hover': { backgroundColor: '#00C4A3' }
                }}
              >
                Manage Orders
              </Button>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card 
            sx={{ 
              height: '100%',
              cursor: 'pointer',
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 8px 20px rgba(0, 224, 184, 0.2)'
              }
            }}
            onClick={() => navigate('/admin/inventory')}
          >
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Inventory sx={{ fontSize: 64, color: '#00E0B8', mb: 2 }} />
              <Typography variant="h5" sx={{ color: '#00E0B8', fontWeight: 600, mb: 1 }}>
                📦 Inventory Management
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Manage drink availability, update stock status, and view inventory statistics
              </Typography>
              <Button 
                variant="contained" 
                size="large"
                sx={{
                  backgroundColor: '#00E0B8',
                  color: '#0D0D0D',
                  '&:hover': { backgroundColor: '#00C4A3' }
                }}
              >
                Manage Inventory
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Notification Alert */}
      {notification && (
        <Alert 
          severity="success" 
          sx={{ mt: 3 }}
          onClose={() => setNotification(null)}
        >
          {notification.message}
        </Alert>
      )}
    </Container>
  );
};

export default AdminOverview;
