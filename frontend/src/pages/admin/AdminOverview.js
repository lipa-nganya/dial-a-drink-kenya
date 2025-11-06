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
  CircularProgress,
  TextField,
  Chip,
  Switch
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
  Notifications,
  Add,
  Delete,
  LocalOffer,
  Image as ImageIcon,
  Save,
  Edit,
  LocalShipping,
  Warning
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import io from 'socket.io-client';
import { useAdmin } from '../../contexts/AdminContext';

const AdminOverview = () => {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [socket, setSocket] = useState(null);
  const [countdowns, setCountdowns] = useState([]);
  const [showCountdownForm, setShowCountdownForm] = useState(false);
  const [countdownForm, setCountdownForm] = useState({
    title: '',
    startDate: '',
    endDate: ''
  });
  const [heroImage, setHeroImage] = useState('');
  const [heroImageInput, setHeroImageInput] = useState('');
  const [showHeroImageForm, setShowHeroImageForm] = useState(false);
  const [deliverySettings, setDeliverySettings] = useState({
    isTestMode: false,
    deliveryFeeWithAlcohol: 50,
    deliveryFeeWithoutAlcohol: 30
  });
  const [showDeliverySettings, setShowDeliverySettings] = useState(false);
  const [deliverySettingsLoading, setDeliverySettingsLoading] = useState(false);
  const [showTestModeWarning, setShowTestModeWarning] = useState(false);
  const navigate = useNavigate();
  const { fetchPendingOrdersCount } = useAdmin();

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
      // Play notification sound (handled by AdminContext)
      playNotificationSound();
      // Refresh stats
      fetchStats();
      // Refresh pending orders count in context
      fetchPendingOrdersCount();
    });

    setSocket(newSocket);

    // Fetch initial data
    fetchStats();
    fetchCountdowns();
    fetchHeroImage();
    fetchDeliverySettings();

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
      // Convert local datetime to ISO string for backend
      const startDate = new Date(countdownForm.startDate).toISOString();
      const endDate = new Date(countdownForm.endDate).toISOString();
      
      const countdownData = {
        title: countdownForm.title,
        startDate: startDate,
        endDate: endDate
      };
      
      console.log('Creating countdown with data:', countdownData);
      const response = await api.post('/countdown', countdownData);
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

  const fetchHeroImage = async () => {
    try {
      const response = await api.get('/settings/heroImage');
      if (response.data && response.data.value) {
        setHeroImage(response.data.value);
        setHeroImageInput(response.data.value);
      }
    } catch (error) {
      console.error('Error fetching hero image:', error);
    }
  };

  const fetchDeliverySettings = async () => {
    try {
      const [testModeRes, withAlcoholRes, withoutAlcoholRes] = await Promise.all([
        api.get('/settings/deliveryTestMode').catch(() => ({ data: null, status: 404 })),
        api.get('/settings/deliveryFeeWithAlcohol').catch(() => ({ data: null, status: 404 })),
        api.get('/settings/deliveryFeeWithoutAlcohol').catch(() => ({ data: null, status: 404 }))
      ]);

      setDeliverySettings({
        isTestMode: testModeRes.data?.value === 'true' || false,
        deliveryFeeWithAlcohol: parseFloat(withAlcoholRes.data?.value || '50'),
        deliveryFeeWithoutAlcohol: parseFloat(withoutAlcoholRes.data?.value || '30')
      });
    } catch (error) {
      console.error('Error fetching delivery settings:', error);
      // Use defaults if fetch fails
      setDeliverySettings({
        isTestMode: false,
        deliveryFeeWithAlcohol: 50,
        deliveryFeeWithoutAlcohol: 30
      });
    }
  };

  const saveDeliverySettings = async () => {
    try {
      setDeliverySettingsLoading(true);
      await Promise.all([
        api.put('/settings/deliveryTestMode', { value: deliverySettings.isTestMode.toString() }),
        api.put('/settings/deliveryFeeWithAlcohol', { value: deliverySettings.deliveryFeeWithAlcohol.toString() }),
        api.put('/settings/deliveryFeeWithoutAlcohol', { value: deliverySettings.deliveryFeeWithoutAlcohol.toString() })
      ]);
      setNotification({ message: 'Delivery settings saved successfully!' });
      setShowDeliverySettings(false);
    } catch (error) {
      console.error('Error saving delivery settings:', error);
      setError('Failed to save delivery settings');
    } finally {
      setDeliverySettingsLoading(false);
    }
  };

  const handleTestModeToggle = (checked) => {
    if (checked) {
      setShowTestModeWarning(true);
    } else {
      setDeliverySettings(prev => ({ ...prev, isTestMode: false }));
    }
  };

  const confirmTestMode = () => {
    setDeliverySettings(prev => ({ ...prev, isTestMode: true }));
    setShowTestModeWarning(false);
  };

  const updateHeroImage = async () => {
    try {
      await api.put('/settings/heroImage', { value: heroImageInput });
      setHeroImage(heroImageInput);
      setShowHeroImageForm(false);
      alert('Hero image updated successfully!');
    } catch (error) {
      console.error('Error updating hero image:', error);
      alert('Failed to update hero image. Please try again.');
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
      {/* Quick Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
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
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
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
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
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
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
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
        <Grid size={{ xs: 12, md: 6 }}>
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
        <Grid size={{ xs: 12, md: 6 }}>
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

      {/* Hero Image Management */}
      <Box sx={{ mb: 4 }}>
        <Box 
          display="flex" 
          justifyContent="space-between" 
          alignItems="center" 
          sx={{ mb: 2 }}
        >
          <Typography 
            variant="h5" 
            sx={{ color: '#00E0B8', fontWeight: 600 }}
          >
            🖼️ Hero Image Management
          </Typography>
          <Button 
            variant="outlined" 
            onClick={() => setShowHeroImageForm(!showHeroImageForm)}
            startIcon={showHeroImageForm ? <Edit /> : <ImageIcon />}
            sx={{
              borderColor: '#00E0B8',
              color: '#00E0B8',
              '&:hover': { 
                borderColor: '#00C4A3',
                backgroundColor: 'rgba(0, 224, 184, 0.1)'
              }
            }}
          >
            {showHeroImageForm ? 'Cancel' : 'Edit Hero Image'}
          </Button>
        </Box>

        {!showHeroImageForm && (
          <Card sx={{ backgroundColor: '#121212' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <Box>
                  <Typography variant="h6" sx={{ color: '#00E0B8', mb: 1 }}>
                    Current Hero Image
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, wordBreak: 'break-all' }}>
                    {heroImage || '/assets/images/ads/hero-ad.png'}
                  </Typography>
                  {heroImage && (
                    <Box 
                      sx={{ 
                        mt: 2, 
                        width: '100%', 
                        maxWidth: '400px',
                        borderRadius: '8px',
                        overflow: 'hidden'
                      }}
                    >
                      <img 
                        src={heroImage} 
                        alt="Current Hero Image" 
                        style={{ 
                          width: '100%', 
                          height: 'auto',
                          display: 'block'
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </Box>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
        )}

        {showHeroImageForm && (
          <Card sx={{ backgroundColor: '#121212' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: '#00E0B8' }}>
                Update Hero Image
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Enter the URL or path to the hero image. This will replace the hero image on the home page.
              </Typography>
              <TextField
                fullWidth
                label="Hero Image URL or Path"
                value={heroImageInput}
                onChange={(e) => setHeroImageInput(e.target.value)}
                placeholder="/assets/images/ads/hero-ad.png"
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: '#00E0B8' },
                    '&:hover fieldset': { borderColor: '#00E0B8' },
                    '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
                  }
                }}
              />
              {heroImageInput && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Preview:
                  </Typography>
                  <Box 
                    sx={{ 
                      width: '100%', 
                      maxWidth: '400px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '2px solid #00E0B8'
                    }}
                  >
                    <img 
                      src={heroImageInput} 
                      alt="Hero Image Preview" 
                      style={{ 
                        width: '100%', 
                        height: 'auto',
                        display: 'block'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = '<div style="padding: 40px; text-align: center; color: #999;">Image not found</div>';
                      }}
                    />
                  </Box>
                </Box>
              )}
              <Button 
                variant="contained" 
                onClick={updateHeroImage}
                disabled={!heroImageInput}
                startIcon={<Save />}
                sx={{
                  backgroundColor: '#00E0B8',
                  color: '#0D0D0D',
                  '&:hover': { backgroundColor: '#00C4A3' }
                }}
              >
                Save Hero Image
              </Button>
            </CardContent>
          </Card>
        )}
      </Box>

      {/* Countdown Management */}
      <Box sx={{ mb: 4 }}>
        <Box 
          display="flex" 
          justifyContent="space-between" 
          alignItems="center" 
          sx={{ mb: 2 }}
        >
          <Typography 
            variant="h5" 
            sx={{ color: '#00E0B8', fontWeight: 600 }}
          >
            ⏰ Countdown Offers
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => setShowCountdownForm(!showCountdownForm)}
            startIcon={<Add />}
            sx={{
              backgroundColor: '#00E0B8',
              color: '#0D0D0D',
              '&:hover': { backgroundColor: '#00C4A3' }
            }}
          >
            {showCountdownForm ? 'Cancel' : 'New Countdown'}
          </Button>
        </Box>

        {showCountdownForm && (
          <Card sx={{ mb: 3, backgroundColor: '#121212' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ color: '#00E0B8' }}>
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
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { borderColor: '#00E0B8' },
                        '&:hover fieldset': { borderColor: '#00E0B8' },
                        '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
                      }
                    }}
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
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { borderColor: '#00E0B8' },
                        '&:hover fieldset': { borderColor: '#00E0B8' },
                        '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
                      }
                    }}
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
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { borderColor: '#00E0B8' },
                        '&:hover fieldset': { borderColor: '#00E0B8' },
                        '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button 
                    variant="contained" 
                    onClick={createCountdown}
                    disabled={!countdownForm.startDate || !countdownForm.endDate}
                    startIcon={<LocalOffer />}
                    sx={{
                      backgroundColor: '#00E0B8',
                      color: '#0D0D0D',
                      '&:hover': { backgroundColor: '#00C4A3' }
                    }}
                  >
                    Create Countdown
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {countdowns.map((countdown) => (
          <Card key={countdown.id} sx={{ mb: 2, backgroundColor: '#121212' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h6" sx={{ color: '#00E0B8', fontWeight: 600 }}>
                    {countdown.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Start: {new Date(countdown.startDate).toLocaleString('en-GB', {
                      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    End: {new Date(countdown.endDate).toLocaleString('en-GB', {
                      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
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
                  startIcon={<Delete />}
                  sx={{
                    color: '#FF3366',
                    '&:hover': { backgroundColor: 'rgba(255, 51, 102, 0.1)' }
                  }}
                >
                  Delete
                </Button>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Delivery Fee Settings */}
      <Card sx={{ mt: 4, backgroundColor: '#121212' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <LocalShipping sx={{ fontSize: 32, color: '#00E0B8' }} />
              <Box>
                <Typography variant="h5" sx={{ color: '#00E0B8', fontWeight: 600 }}>
                  Delivery Fee Settings
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Configure delivery fees and terms
                </Typography>
              </Box>
            </Box>
            <Button
              variant="outlined"
              onClick={() => setShowDeliverySettings(!showDeliverySettings)}
              startIcon={showDeliverySettings ? <Edit /> : <Edit />}
              sx={{
                borderColor: '#00E0B8',
                color: '#00E0B8',
                '&:hover': { borderColor: '#00C4A3', backgroundColor: 'rgba(0, 224, 184, 0.1)' }
              }}
            >
              {showDeliverySettings ? 'Hide Settings' : 'Edit Settings'}
            </Button>
          </Box>

          {showDeliverySettings && (
            <Box sx={{ mt: 3 }}>
              <Alert severity="info" sx={{ mb: 3 }}>
                Test Mode sets delivery fee to 0. Production Mode uses configured fees based on order type.
              </Alert>

              {/* Test Mode Warning Dialog */}
              {showTestModeWarning && (
                <Alert 
                  severity="warning" 
                  sx={{ mb: 3 }}
                  action={
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        color="inherit"
                        size="small"
                        onClick={() => setShowTestModeWarning(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        color="inherit"
                        size="small"
                        onClick={confirmTestMode}
                        variant="contained"
                      >
                        Confirm
                      </Button>
                    </Box>
                  }
                >
                  <Box>
                    <Typography variant="body2" fontWeight="bold" gutterBottom>
                      <Warning sx={{ verticalAlign: 'middle', mr: 1 }} />
                      Warning: Test Mode
                    </Typography>
                    <Typography variant="body2">
                      Enabling Test Mode will set delivery fee to KES 0.00 for all orders. 
                      This should only be used for testing purposes. Are you sure you want to continue?
                    </Typography>
                  </Box>
                </Alert>
              )}

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Box>
                      <Typography variant="body1" fontWeight="medium">
                        Test Mode
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Set delivery fee to 0 (for testing only)
                      </Typography>
                    </Box>
                    <Chip
                      label={deliverySettings.isTestMode ? 'ON' : 'OFF'}
                      color={deliverySettings.isTestMode ? 'warning' : 'default'}
                      sx={{ mr: 2 }}
                    />
                    <Switch
                      checked={deliverySettings.isTestMode}
                      onChange={(e) => handleTestModeToggle(e.target.checked)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: '#FF9800',
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: '#FF9800',
                        },
                      }}
                    />
                  </Box>
                </Grid>

                {!deliverySettings.isTestMode && (
                  <>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        label="Delivery Fee (With Alcohol)"
                        type="number"
                        value={deliverySettings.deliveryFeeWithAlcohol}
                        onChange={(e) => setDeliverySettings(prev => ({
                          ...prev,
                          deliveryFeeWithAlcohol: parseFloat(e.target.value) || 0
                        }))}
                        inputProps={{ min: 0, step: 0.01 }}
                        helperText="Applied when order contains alcohol items"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            '& fieldset': { borderColor: '#00E0B8' },
                            '&:hover fieldset': { borderColor: '#00E0B8' },
                            '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
                          }
                        }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        label="Delivery Fee (Without Alcohol)"
                        type="number"
                        value={deliverySettings.deliveryFeeWithoutAlcohol}
                        onChange={(e) => setDeliverySettings(prev => ({
                          ...prev,
                          deliveryFeeWithoutAlcohol: parseFloat(e.target.value) || 0
                        }))}
                        inputProps={{ min: 0, step: 0.01 }}
                        helperText="Applied when order only contains soft drinks"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            '& fieldset': { borderColor: '#00E0B8' },
                            '&:hover fieldset': { borderColor: '#00E0B8' },
                            '&.Mui-focused fieldset': { borderColor: '#00E0B8' }
                          }
                        }}
                      />
                    </Grid>
                  </>
                )}

                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setShowDeliverySettings(false);
                        fetchDeliverySettings(); // Reset to saved values
                      }}
                      sx={{
                        borderColor: '#666',
                        color: '#F5F5F5',
                        '&:hover': { borderColor: '#888' }
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="contained"
                      onClick={saveDeliverySettings}
                      disabled={deliverySettingsLoading}
                      startIcon={deliverySettingsLoading ? <CircularProgress size={20} /> : <Save />}
                      sx={{
                        backgroundColor: '#00E0B8',
                        color: '#0D0D0D',
                        '&:hover': { backgroundColor: '#00C4A3' }
                      }}
                    >
                      {deliverySettingsLoading ? 'Saving...' : 'Save Settings'}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}

          {!showDeliverySettings && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary" component="span">
                  Mode:
                </Typography>
                <Chip label={deliverySettings.isTestMode ? 'Test (KES 0)' : 'Production'} size="small" color={deliverySettings.isTestMode ? 'warning' : 'default'} />
              </Box>
              {!deliverySettings.isTestMode && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  With Alcohol: KES {deliverySettings.deliveryFeeWithAlcohol.toFixed(2)} | 
                  Without Alcohol: KES {deliverySettings.deliveryFeeWithoutAlcohol.toFixed(2)}
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

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
