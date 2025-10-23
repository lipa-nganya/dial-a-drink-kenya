import React, { useState } from 'react';
import {
  Container,
  Typography,
  Grid,
  Box,
  Paper,
  Button,
  TextField,
  Divider,
  IconButton,
  Alert
} from '@mui/material';
import { Add, Remove, Delete, ShoppingCart } from '@mui/icons-material';
import { useCart } from '../contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const Cart = () => {
  const { items, updateQuantity, removeFromCart, getTotalPrice, clearCart } = useCart();
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleQuantityChange = (drinkId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(drinkId);
    } else {
      updateQuantity(drinkId, newQuantity);
    }
  };

  const handleInputChange = (field, value) => {
    setCustomerInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmitOrder = async () => {
    if (!customerInfo.name || !customerInfo.phone || !customerInfo.address) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const orderData = {
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        customerEmail: customerInfo.email,
        deliveryAddress: customerInfo.address,
        notes: customerInfo.notes,
        items: items.map(item => ({
          drinkId: item.drinkId,
          quantity: item.quantity
        }))
      };

      const response = await api.post('/orders', orderData);
      clearCart();
      navigate('/order-success', { state: { orderId: response.data.id } });
    } catch (error) {
      setError('Failed to place order. Please try again.');
      console.error('Order error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1, sm: 2 } }}>
        <Box textAlign="center">
          <ShoppingCart sx={{ fontSize: { xs: 60, sm: 80 }, color: 'text.secondary', mb: 2 }} />
          <Typography 
            variant="h5" 
            gutterBottom
            sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
          >
            Your cart is empty
          </Typography>
          <Typography 
            variant="body1" 
            color="text.secondary" 
            sx={{ mb: 3, fontSize: { xs: '0.9rem', sm: '1rem' } }}
          >
            Add some drinks to get started!
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/menu')}
            sx={{ px: { xs: 3, sm: 4 } }}
          >
            Browse Menu
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1, sm: 2 } }}>
      <Typography 
        variant="h4" 
        component="h1" 
        gutterBottom
        sx={{ 
          fontSize: { xs: '1.75rem', sm: '2.125rem' },
          textAlign: { xs: 'center', sm: 'left' }
        }}
      >
        Your Cart
      </Typography>

      <Grid container spacing={{ xs: 2, sm: 4 }}>
        {/* Cart Items */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Cart Items ({items.length})
            </Typography>
            
            {items.map((item) => (
              <Box key={item.drinkId}>
                <Box sx={{ display: 'flex', alignItems: 'center', py: 2 }}>
                  <Box
                    component="img"
                    src={item.drink.image}
                    alt={item.drink.name}
                    sx={{
                      width: 80,
                      height: 80,
                      objectFit: 'cover',
                      borderRadius: 1,
                      mr: 2
                    }}
                  />
                  
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6">
                      {item.drink.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      KES {Number(item.price).toFixed(2)} each
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconButton
                      onClick={() => handleQuantityChange(item.drinkId, item.quantity - 1)}
                      size="small"
                    >
                      <Remove />
                    </IconButton>
                    
                    <Typography variant="h6" sx={{ minWidth: 40, textAlign: 'center' }}>
                      {item.quantity}
                    </Typography>
                    
                    <IconButton
                      onClick={() => handleQuantityChange(item.drinkId, item.quantity + 1)}
                      size="small"
                    >
                      <Add />
                    </IconButton>
                    
                    <IconButton
                      onClick={() => removeFromCart(item.drinkId)}
                      color="error"
                      size="small"
                    >
                      <Delete />
                    </IconButton>
                  </Box>

                  <Typography variant="h6" sx={{ minWidth: 80, textAlign: 'right' }}>
                    KES {(Number(item.price) * item.quantity).toFixed(2)}
                  </Typography>
                </Box>
                <Divider />
              </Box>
            ))}
          </Paper>
        </Grid>

        {/* Order Summary & Checkout */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, position: 'sticky', top: 20 }}>
            <Typography variant="h6" gutterBottom>
              Order Summary
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>Subtotal:</Typography>
                <Typography>KES {getTotalPrice().toFixed(2)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>Delivery:</Typography>
                <Typography>KES 50.00</Typography>
              </Box>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="h6">Total:</Typography>
                <Typography variant="h6">KES {(getTotalPrice() + 50).toFixed(2)}</Typography>
              </Box>
            </Box>

            <Typography variant="h6" gutterBottom>
              Delivery Information
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
              <TextField
                label="Full Name *"
                value={customerInfo.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                fullWidth
                size="small"
              />
              <TextField
                label="Phone Number *"
                value={customerInfo.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                fullWidth
                size="small"
              />
              <TextField
                label="Email (Optional)"
                value={customerInfo.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                fullWidth
                size="small"
              />
              <TextField
                label="Delivery Address *"
                value={customerInfo.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                fullWidth
                multiline
                rows={3}
                size="small"
              />
              <TextField
                label="Special Instructions (Optional)"
                value={customerInfo.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                fullWidth
                multiline
                rows={2}
                size="small"
              />
            </Box>

            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={handleSubmitOrder}
              disabled={loading}
              sx={{
                backgroundColor: '#FF6B6B',
                '&:hover': {
                  backgroundColor: '#FF5252'
                }
              }}
            >
              {loading ? 'Placing Order...' : 'Place Order'}
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Cart;
