import React from 'react';
import { Container, Typography, Box, Button, Paper } from '@mui/material';
import { CheckCircle, ShoppingCart } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const OrderSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const orderId = location.state?.orderId;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <CheckCircle sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
        
        <Typography variant="h4" gutterBottom>
          Order Placed Successfully!
        </Typography>
        
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Thank you for your order
        </Typography>
        
        {orderId && (
          <Typography variant="body1" sx={{ mb: 3 }}>
            Order ID: #{orderId}
          </Typography>
        )}
        
        <Typography variant="body1" sx={{ mb: 4 }}>
          We've received your order and will start preparing it shortly. 
          You'll receive a confirmation call within the next few minutes.
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="contained"
            startIcon={<ShoppingCart />}
            onClick={() => navigate('/menu')}
            sx={{
              backgroundColor: '#FF6B6B',
              '&:hover': {
                backgroundColor: '#FF5252'
              }
            }}
          >
            Continue Shopping
          </Button>
          
          <Button
            variant="outlined"
            onClick={() => navigate('/')}
          >
            Back to Home
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default OrderSuccess;
