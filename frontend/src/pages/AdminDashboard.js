import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Grid, 
  Card, 
  CardContent, 
  Button,
  Switch,
  FormControlLabel,
  Chip,
  Alert,
  Snackbar,
  TextField
} from '@mui/material';
import { io } from 'socket.io-client';
import { api } from '../services/api';

const AdminDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [drinks, setDrinks] = useState([]);
  const [stats, setStats] = useState({});
  const [notification, setNotification] = useState(null);
  const [socket, setSocket] = useState(null);
  const [countdowns, setCountdowns] = useState([]);
  const [showCountdownForm, setShowCountdownForm] = useState(false);
  const [countdownForm, setCountdownForm] = useState({
    title: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    // Initialize socket connection - use production URL
    const isHosted =
      window.location.hostname.includes('onrender.com') ||
      window.location.hostname.includes('run.app');
    const socketUrl = isHosted
      ? 'https://dialadrink-backend-910510650031.us-central1.run.app'
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
      // Refresh orders
      fetchOrders();
    });

    setSocket(newSocket);

    // Fetch initial data
    fetchOrders();
    fetchDrinks();
    fetchStats();
    fetchCountdowns();

    return () => {
      newSocket.close();
    };
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await api.get('/admin/orders');
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const fetchDrinks = async () => {
    try {
      const response = await api.get('/admin/drinks');
      setDrinks(response.data);
    } catch (error) {
      console.error('Error fetching drinks:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
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

  const updateDrinkAvailability = async (drinkId, isAvailable) => {
    try {
      await api.patch(`/admin/drinks/${drinkId}/availability`, { isAvailable });
      fetchDrinks();
    } catch (error) {
      console.error('Error updating drink availability:', error);
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      console.log(`Updating order ${orderId} to status: ${status}`);
      const response = await api.patch(`/admin/orders/${orderId}/status`, { status });
      console.log('Order status updated successfully:', response.data);
      fetchOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      console.error('Error details:', error.response?.data || error.message);
    }
  };

  const fetchCountdowns = async () => {
    try {
      console.log('Fetching countdowns...');
      const response = await api.get('/countdown');
      console.log('Countdowns response:', response.data);
      setCountdowns(response.data);
    } catch (error) {
      console.error('Error fetching countdowns:', error);
      console.error('Error details:', error.response?.data || error.message);
    }
  };

  const createCountdown = async () => {
    try {
      console.log('Creating countdown with data:', countdownForm);
      const response = await api.post('/countdown', countdownForm);
      console.log('Countdown created successfully:', response.data);
      setCountdownForm({ title: '', startDate: '', endDate: '' });
      setShowCountdownForm(false);
      fetchCountdowns();
    } catch (error) {
      console.error('Error creating countdown:', error);
      console.error('Error details:', error.response?.data || error.message);
    }
  };

  const deleteCountdown = async (id) => {
    try {
      await api.delete(`/countdown/${id}`);
      fetchCountdowns();
    } catch (error) {
      console.error('Error deleting countdown:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'confirmed': return 'info';
      case 'preparing': return 'primary';
      case 'out_for_delivery': return 'secondary';
      case 'delivered': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 2, sm: 4 }, mb: { xs: 2, sm: 4 }, px: { xs: 1, sm: 2 } }}>
      <Typography 
        variant="h4" 
        component="h1" 
        gutterBottom
        sx={{ 
          fontSize: { xs: '1.75rem', sm: '2.125rem' },
          textAlign: { xs: 'center', sm: 'left' }
        }}
      >
        Admin Dashboard
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: { xs: 3, sm: 4 } }}>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Typography 
                color="textSecondary" 
                gutterBottom
                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
              >
                Total Orders
              </Typography>
              <Typography 
                variant="h4"
                sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}
              >
                {stats.totalOrders || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Typography 
                color="textSecondary" 
                gutterBottom
                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
              >
                Pending Orders
              </Typography>
              <Typography 
                variant="h4" 
                color="warning.main"
                sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}
              >
                {stats.pendingOrders || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Typography 
                color="textSecondary" 
                gutterBottom
                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
              >
                Total Drinks
              </Typography>
              <Typography 
                variant="h4"
                sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}
              >
                {stats.totalDrinks || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Typography 
                color="textSecondary" 
                gutterBottom
                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
              >
                Available Drinks
              </Typography>
              <Typography 
                variant="h4" 
                color="success.main"
                sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}
              >
                {stats.availableDrinks || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Countdown Management */}
      <Box sx={{ mb: { xs: 3, sm: 4 } }}>
        <Box 
          display="flex" 
          justifyContent="space-between" 
          alignItems="center" 
          sx={{ mb: 2 }}
        >
          <Typography 
            variant="h5" 
            sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
          >
            Countdown Offers
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => setShowCountdownForm(!showCountdownForm)}
            sx={{ 
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              px: { xs: 2, sm: 3 }
            }}
          >
            {showCountdownForm ? 'Cancel' : 'New Countdown'}
          </Button>
        </Box>

        {showCountdownForm && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Create New Countdown
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Offer Title"
                    value={countdownForm.title}
                    onChange={(e) => setCountdownForm({...countdownForm, title: e.target.value})}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    label="Start Date & Time"
                    type="datetime-local"
                    value={countdownForm.startDate}
                    onChange={(e) => setCountdownForm({...countdownForm, startDate: e.target.value})}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    label="End Date & Time"
                    type="datetime-local"
                    value={countdownForm.endDate}
                    onChange={(e) => setCountdownForm({...countdownForm, endDate: e.target.value})}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button 
                    variant="contained" 
                    onClick={createCountdown}
                    disabled={!countdownForm.startDate || !countdownForm.endDate}
                  >
                    Create Countdown
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {countdowns.map((countdown) => (
          <Card key={countdown.id} sx={{ mb: 2 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h6">{countdown.title}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    Start: {new Date(countdown.startDate).toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    End: {new Date(countdown.endDate).toLocaleString()}
                  </Typography>
                  <Chip 
                    label={countdown.isActive ? 'Active' : 'Inactive'} 
                    color={countdown.isActive ? 'success' : 'default'}
                    size="small"
                    sx={{ mt: 1 }}
                  />
                </Box>
                <Button 
                  color="error" 
                  onClick={() => deleteCountdown(countdown.id)}
                  size="small"
                >
                  Delete
                </Button>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Recent Orders */}
      <Box sx={{ mb: { xs: 3, sm: 4 } }}>
        <Typography 
          variant="h5" 
          gutterBottom
          sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
        >
          Recent Orders
        </Typography>
        <Grid container spacing={{ xs: 1, sm: 2 }}>
          {orders.slice(0, 5).map((order) => (
            <Grid item xs={12} key={order.id}>
              <Card>
                <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <Box 
                    display="flex" 
                    flexDirection={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between" 
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    gap={{ xs: 2, sm: 0 }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography 
                        variant="h6"
                        sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
                      >
                        Order #{order.id} - {order.customerName}
                      </Typography>
                      <Typography 
                        variant="body2" 
                        color="textSecondary"
                        sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                      >
                        {order.customerPhone} • {new Date(order.createdAt).toLocaleString()}
                      </Typography>
                      <Typography 
                        variant="body2"
                        sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                      >
                        Total: KES {Number(order.totalAmount).toFixed(2)}
                      </Typography>
                    </Box>
                    <Box 
                      display="flex" 
                      alignItems="center" 
                      gap={{ xs: 1, sm: 2 }}
                      flexDirection={{ xs: 'row', sm: 'row' }}
                      flexWrap="wrap"
                    >
                      <Chip 
                        label={order.status} 
                        color={getStatusColor(order.status)}
                        size="small"
                        sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => updateOrderStatus(order.id, 'confirmed')}
                        disabled={order.status !== 'pending'}
                        sx={{ 
                          fontSize: { xs: '0.7rem', sm: '0.75rem' },
                          px: { xs: 1, sm: 2 }
                        }}
                      >
                        Confirm
                      </Button>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Inventory Management */}
      <Box>
        <Typography 
          variant="h5" 
          gutterBottom
          sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
        >
          Inventory Management
        </Typography>
        <Grid container spacing={{ xs: 1, sm: 2 }}>
          {drinks.map((drink) => (
            <Grid item xs={12} sm={6} md={4} key={drink.id}>
              <Card sx={{ height: '100%' }}>
                <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <Box 
                    display="flex" 
                    flexDirection={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between" 
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    gap={{ xs: 2, sm: 1 }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography 
                        variant="h6"
                        sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
                      >
                        {drink.name}
                      </Typography>
                      <Typography 
                        variant="body2" 
                        color="textSecondary"
                        sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                      >
                        KES {Number(drink.price).toFixed(2)}
                      </Typography>
                    </Box>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={drink.isAvailable}
                          onChange={(e) => updateDrinkAvailability(drink.id, e.target.checked)}
                          size="small"
                        />
                      }
                      label={
                        <Typography 
                          variant="body2"
                          sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
                        >
                          {drink.isAvailable ? "Available" : "Out of Stock"}
                        </Typography>
                      }
                      sx={{ m: 0 }}
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Notification Snackbar */}
      <Snackbar
        open={!!notification}
        autoHideDuration={6000}
        onClose={() => setNotification(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setNotification(null)} 
          severity="success" 
          sx={{ width: '100%' }}
        >
          {notification?.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default AdminDashboard;
