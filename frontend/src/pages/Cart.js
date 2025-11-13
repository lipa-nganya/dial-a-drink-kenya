import React, { useState, useEffect } from 'react';
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
  Alert,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  Card,
  CardContent
} from '@mui/material';
import { Add, Remove, Delete, ShoppingCart, CreditCard, PhoneAndroid, LocalShipping, AccountBalanceWallet } from '@mui/icons-material';
import { useCart } from '../contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import AddressAutocomplete from '../components/AddressAutocomplete';
import { sanitizeCustomerNotes } from '../utils/sanitizeNotes';

const Cart = () => {
  const { items, updateQuantity, removeFromCart, getTotalPrice, clearCart } = useCart();
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    apartmentHouseNumber: '',
    floorNumber: '',
    notes: ''
  });
  const [paymentType, setPaymentType] = useState('pay_on_delivery');
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [mobileMoneyProvider, setMobileMoneyProvider] = useState(null); // 'mpesa' or 'airtel'
  const [mpesaPhoneNumber, setMpesaPhoneNumber] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tipAmount, setTipAmount] = useState(0);
  const [deliverySettings, setDeliverySettings] = useState({
    isTestMode: false,
    deliveryFeeWithAlcohol: 50,
    deliveryFeeWithoutAlcohol: 30
  });
  const navigate = useNavigate();

  const formatPhoneForDisplay = (phone) => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');

    if (!digits) return '';

    if (digits.startsWith('254') && digits.length === 12) {
      return `0${digits.slice(3)}`;
    }

    if (digits.startsWith('0') && digits.length === 10) {
      return digits;
    }

    if (digits.length === 9 && digits.startsWith('7')) {
      return `0${digits}`;
    }

    return digits;
  };

  // Fetch delivery settings
  useEffect(() => {
    const fetchDeliverySettings = async () => {
      try {
        const [testModeRes, withAlcoholRes, withoutAlcoholRes] = await Promise.all([
          api.get('/settings/deliveryTestMode').catch(() => ({ data: { value: 'false' } })),
          api.get('/settings/deliveryFeeWithAlcohol').catch(() => ({ data: { value: '50' } })),
          api.get('/settings/deliveryFeeWithoutAlcohol').catch(() => ({ data: { value: '30' } }))
        ]);

        setDeliverySettings({
          isTestMode: testModeRes.data?.value === 'true',
          deliveryFeeWithAlcohol: parseFloat(withAlcoholRes.data?.value || '50'),
          deliveryFeeWithoutAlcohol: parseFloat(withoutAlcoholRes.data?.value || '30')
        });
      } catch (error) {
        console.error('Error fetching delivery settings:', error);
      }
    };

    fetchDeliverySettings();
    
    // Load saved delivery information from localStorage
    const loadSavedDeliveryInfo = () => {
      try {
        // Helper function to clean notes from technical details
        // First, try to get from customerDeliveryInfo
        const savedDeliveryInfo = localStorage.getItem('customerDeliveryInfo');
        if (savedDeliveryInfo) {
          const parsed = JSON.parse(savedDeliveryInfo);
          setCustomerInfo({
            name: parsed.name || '',
            phone: formatPhoneForDisplay(parsed.phone) || '',
            email: parsed.email || '',
            address: parsed.address || '',
            apartmentHouseNumber: parsed.apartmentHouseNumber || '',
            floorNumber: parsed.floorNumber || '',
            notes: sanitizeCustomerNotes(parsed.notes) // Clean notes from technical details
          });
          return;
        }
        
        // Fallback: try to get from customerOrder
        const savedOrder = localStorage.getItem('customerOrder');
        if (savedOrder) {
          const orderData = JSON.parse(savedOrder);
          setCustomerInfo(prev => ({
            ...prev,
            phone: formatPhoneForDisplay(orderData.phone) || prev.phone,
            email: orderData.email || prev.email,
            name: orderData.customerName || prev.name
          }));
        }
      } catch (error) {
        console.error('Error loading saved delivery info:', error);
      }
    };
    
    loadSavedDeliveryInfo();
  }, []);

  // Calculate delivery fee based on cart contents
  const calculateDeliveryFee = () => {
    if (deliverySettings.isTestMode) {
      return 0;
    }

    // If no items, return default fee
    if (!items || items.length === 0) {
      return deliverySettings.deliveryFeeWithAlcohol;
    }

    // Check if all items are from Soft Drinks category
    const softDrinksCategoryName = 'Soft Drinks';
    
    // Check if we have category info for all items
    const itemsWithCategoryInfo = items.filter(item => item.drink?.category);
    
    // If we don't have category info for all items, default to with-alcohol fee
    if (itemsWithCategoryInfo.length !== items.length) {
      return deliverySettings.deliveryFeeWithAlcohol;
    }

    // Check if all items are soft drinks
    const allSoftDrinks = items.every(item => 
      item.drink?.category?.name === softDrinksCategoryName
    );

    if (allSoftDrinks) {
      return deliverySettings.deliveryFeeWithoutAlcohol;
    }

    return deliverySettings.deliveryFeeWithAlcohol;
  };

  const deliveryFee = calculateDeliveryFee();

  const handleQuantityChange = (drinkId, newQuantity, selectedCapacity = null) => {
    if (newQuantity <= 0) {
      removeFromCart(drinkId, selectedCapacity);
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

  // Validate and format Safaricom phone number
  const formatMpesaPhoneNumber = (phone) => {
    if (!phone) return '';
    
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If starts with 0, replace with 254
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    } else if (!cleaned.startsWith('254')) {
      // If doesn't start with 254 and is 9 digits, add 254
      if (cleaned.length === 9 && cleaned.startsWith('7')) {
        cleaned = '254' + cleaned;
      }
    }
    
    return cleaned;
  };

  // Validate Safaricom phone number format
  const validateSafaricomPhone = (phone) => {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    // Check if it's a valid Safaricom format (07, 2547, or 7XXXXXXXXX)
    return cleaned.length >= 9 && (cleaned.startsWith('07') || cleaned.startsWith('2547') || (cleaned.startsWith('7') && cleaned.length === 9));
  };

  const handleSubmitOrder = async () => {
    if (!customerInfo.name || !customerInfo.phone || !customerInfo.address || !customerInfo.apartmentHouseNumber) {
      setError('Please fill in all required fields');
      return;
    }

    // Validate payment method if paying now
    if (paymentType === 'pay_now' && !paymentMethod) {
      setError('Please select a payment method (Card or Mobile Money)');
      return;
    }

    // Validate M-Pesa phone number if paying with M-Pesa
    if (paymentType === 'pay_now' && paymentMethod === 'mobile_money') {
      if (!mobileMoneyProvider) {
        setError('Please select a mobile money provider (M-Pesa or Airtel)');
        return;
      }
      if (mobileMoneyProvider === 'mpesa') {
        if (!mpesaPhoneNumber || !validateSafaricomPhone(mpesaPhoneNumber)) {
          setError('Please enter a valid Safaricom phone number (e.g., 0712345678)');
          return;
        }
      }
    }

    // Set processing state immediately for M-Pesa payments
    if (paymentType === 'pay_now' && paymentMethod === 'mobile_money' && mobileMoneyProvider === 'mpesa') {
      setIsProcessingPayment(true);
    }
    
    setLoading(true);
    setError('');

    try {
      console.log('🛒 Submitting order with items:', items);
      console.log('🛒 Order payload preview:', {
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        customerEmail: customerInfo.email,
        deliveryAddress: customerInfo.address,
        apartmentHouseNumber: customerInfo.apartmentHouseNumber,
        floorNumber: customerInfo.floorNumber,
        paymentType,
        paymentMethod,
        mobileMoneyProvider,
        mpesaPhoneNumber,
        tipAmount
      });

      // Build complete address
      let completeAddress = customerInfo.address.trim();
      if (customerInfo.apartmentHouseNumber) {
        completeAddress += `, ${customerInfo.apartmentHouseNumber.trim()}`;
      }
      if (customerInfo.floorNumber) {
        completeAddress += `, Floor ${customerInfo.floorNumber.trim()}`;
      }

      const orderData = {
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        customerEmail: customerInfo.email,
        deliveryAddress: completeAddress,
        notes: customerInfo.notes,
        paymentType: paymentType,
        paymentMethod: paymentType === 'pay_now' ? paymentMethod : null,
        tipAmount: tipAmount || 0,
        items: items.map(item => ({
          drinkId: item.drinkId,
          quantity: item.quantity
        }))
      };

      const response = await api.post('/orders', orderData);
      const orderId = response.data.id;
      // Use the totalAmount from the order response to ensure it matches what's stored in the database
      // Note: The backend will include tip in the totalAmount, so we use that
      const totalAmount = parseFloat(response.data.totalAmount);
      
      // Save delivery information for future orders
      localStorage.setItem('customerDeliveryInfo', JSON.stringify({
        name: customerInfo.name,
        phone: customerInfo.phone,
        email: customerInfo.email,
        address: customerInfo.address,
        apartmentHouseNumber: customerInfo.apartmentHouseNumber,
        floorNumber: customerInfo.floorNumber,
        notes: customerInfo.notes
      }));
      
      // Also update customerOrder in localStorage
      const savedOrder = localStorage.getItem('customerOrder');
      if (savedOrder) {
        const orderData = JSON.parse(savedOrder);
        localStorage.setItem('customerOrder', JSON.stringify({
          ...orderData,
          orderId: orderId,
          email: customerInfo.email,
          phone: customerInfo.phone,
          customerName: customerInfo.name
        }));
      } else {
        localStorage.setItem('customerOrder', JSON.stringify({
          orderId: orderId,
          email: customerInfo.email,
          phone: customerInfo.phone,
          customerName: customerInfo.name
        }));
      }

      // If paying with M-Pesa, initiate STK push
      if (paymentType === 'pay_now' && paymentMethod === 'mobile_money' && mobileMoneyProvider === 'mpesa') {
        try {
          // Format phone number before sending (ensure 0 is converted to 254)
          const formattedPhone = formatMpesaPhoneNumber(mpesaPhoneNumber);
          
          console.log('Initiating M-Pesa STK Push:', {
            phoneNumber: formattedPhone,
            amount: totalAmount,
            orderId: orderId
          });
          
          const paymentResponse = await api.post('/mpesa/stk-push', {
            phoneNumber: formattedPhone,
            amount: totalAmount,
            orderId: orderId,
            accountReference: `ORDER-${orderId}`
          });

          console.log('M-Pesa STK Push response:', paymentResponse.data);
          console.log('Response success:', paymentResponse.data.success);
          console.log('Response message:', paymentResponse.data.message);
          console.log('Response error:', paymentResponse.data.error);
          console.log('Response code:', paymentResponse.data.responseCode);
          console.log('Full response:', JSON.stringify(paymentResponse.data, null, 2));

          if (paymentResponse.data.success) {
            // Don't clear cart yet - wait for payment confirmation
            // Don't navigate to success yet - wait for payment confirmation
            setIsProcessingPayment(false);
            setLoading(false);
            
            // Navigate to a waiting page that polls for payment status
            navigate('/order-success', { 
              state: { 
                orderId: orderId,
                paymentPending: true,
                paymentMessage: paymentResponse.data.message || 'STK Push initiated. Please check your phone to enter your M-Pesa PIN. Waiting for payment confirmation...'
              } 
            });
          } else {
            setError(paymentResponse.data.error || paymentResponse.data.message || 'Failed to initiate payment. Please try again.');
            setIsProcessingPayment(false);
            setLoading(false);
          }
        } catch (paymentError) {
          console.error('Payment error:', paymentError);
          console.error('Payment error response:', paymentError.response?.data);
          const errorMessage = paymentError.response?.data?.error || 
                              paymentError.response?.data?.message || 
                              paymentError.message || 
                              'Failed to initiate payment. Please try again.';
          setError(errorMessage);
          setIsProcessingPayment(false);
          setLoading(false);
        }
      } else {
        // For other payment methods or pay on delivery, clear cart and navigate to success
        clearCart();
        navigate('/order-success', { state: { orderId: orderId, paymentPending: false } });
      }
    } catch (error) {
      console.error('Order error:', error);
      console.error('Order error response:', error.response?.data);
      setError(error.response?.data?.error || error.response?.data?.message || 'Failed to place order. Please try again.');
      setIsProcessingPayment(false);
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
      {/* Error Display at Top */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
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
        <Grid size={{ xs: 12, md: 8 }}>
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
                    {item.selectedCapacity && (
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#000000' }}>
                        Capacity: {item.selectedCapacity}
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary">
                      KES {Number(item.price).toFixed(2)} each
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconButton
                      onClick={() => handleQuantityChange(item.drinkId, item.quantity - 1, item.selectedCapacity)}
                      size="small"
                    >
                      <Remove />
                    </IconButton>
                    
                    <Typography variant="h6" sx={{ minWidth: 40, textAlign: 'center' }}>
                      {item.quantity}
                    </Typography>
                    
                    <IconButton
                      onClick={() => handleQuantityChange(item.drinkId, item.quantity + 1, item.selectedCapacity)}
                      size="small"
                    >
                      <Add />
                    </IconButton>
                    
                    <IconButton
                      onClick={() => removeFromCart(item.drinkId, item.selectedCapacity)}
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
        <Grid size={{ xs: 12, md: 4 }}>
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
                <Typography>KES {deliveryFee.toFixed(2)}</Typography>
              </Box>
              
              {/* Tip Section */}
              <Box sx={{ mb: 2, mt: 2 }}>
                <Typography variant="body2" gutterBottom sx={{ fontWeight: 500 }}>
                  Tip Driver (Optional)
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  {[50, 100, 200, 500].map((amount) => (
                    <Button
                      key={amount}
                      variant={tipAmount === amount ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() => setTipAmount(amount)}
                      sx={{
                        minWidth: 'auto',
                        flex: 1,
                        fontSize: '0.75rem',
                        ...(tipAmount === amount && {
                          backgroundColor: '#00E0B8',
                          color: '#0D0D0D',
                          '&:hover': {
                            backgroundColor: '#00C4A3'
                          }
                        })
                      }}
                    >
                      KES {amount}
                    </Button>
                  ))}
                  <Button
                    variant={tipAmount !== 0 && ![50, 100, 200, 500].includes(tipAmount) ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => {
                      const customAmount = prompt('Enter custom tip amount (KES):');
                      if (customAmount && !isNaN(customAmount) && parseFloat(customAmount) >= 0) {
                        setTipAmount(parseFloat(customAmount));
                      }
                    }}
                    sx={{
                      minWidth: 'auto',
                      flex: 1,
                      fontSize: '0.75rem',
                      ...(tipAmount !== 0 && ![50, 100, 200, 500].includes(tipAmount) && {
                        backgroundColor: '#00E0B8',
                        color: '#0D0D0D',
                        '&:hover': {
                          backgroundColor: '#00C4A3'
                        }
                      })
                    }}
                  >
                    Custom
                  </Button>
                </Box>
                {tipAmount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">Tip:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>KES {tipAmount.toFixed(2)}</Typography>
                  </Box>
                )}
                {tipAmount > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic', mt: 0.5 }}>
                    💡 The driver will receive the full tip and will only be notified after delivery.
                  </Typography>
                )}
              </Box>
              
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="h6">Total:</Typography>
                <Typography variant="h6">KES {(getTotalPrice() + deliveryFee + tipAmount).toFixed(2)}</Typography>
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
              <AddressAutocomplete
                label="Delivery Address *"
                value={customerInfo.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="Start typing your address..."
              />
              <TextField
                label="Apartment/House Number *"
                value={customerInfo.apartmentHouseNumber}
                onChange={(e) => handleInputChange('apartmentHouseNumber', e.target.value)}
                fullWidth
                size="small"
                placeholder="e.g., Apartment 4B, House 12"
              />
              <TextField
                label="Floor Number (Optional)"
                value={customerInfo.floorNumber}
                onChange={(e) => handleInputChange('floorNumber', e.target.value)}
                fullWidth
                size="small"
                placeholder="e.g., 3rd Floor"
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

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" gutterBottom>
              Payment Method
            </Typography>

            <FormControl component="fieldset" fullWidth sx={{ mb: 2 }}>
              <RadioGroup
                value={paymentType}
                onChange={(e) => {
                  setPaymentType(e.target.value);
                  if (e.target.value === 'pay_on_delivery') {
                    setPaymentMethod(null);
                    setMobileMoneyProvider(null);
                    setMpesaPhoneNumber('');
                  }
                }}
              >
                <FormControlLabel
                  value="pay_on_delivery"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LocalShipping />
                      <Typography>Pay on Delivery</Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="pay_now"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CreditCard />
                      <Typography>Pay Now</Typography>
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>

            {paymentType === 'pay_now' && (
              <Box sx={{ mb: 2 }}>
                <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.875rem' }}>
                  Select Payment Method:
                </FormLabel>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Card
                    sx={{
                      flex: 1,
                      cursor: 'pointer',
                      border: paymentMethod === 'card' ? 2 : 1,
                      borderColor: paymentMethod === 'card' ? 'primary.main' : 'divider',
                      backgroundColor: paymentMethod === 'card' ? 'action.selected' : 'background.paper',
                      '&:hover': {
                        borderColor: 'primary.main',
                        backgroundColor: 'action.hover'
                      },
                      transition: 'all 0.2s'
                    }}
                    onClick={() => {
                      setPaymentMethod('card');
                      setMobileMoneyProvider(null);
                      setMpesaPhoneNumber('');
                    }}
                  >
                    <CardContent sx={{ textAlign: 'center', py: 2, '&:last-child': { pb: 2 } }}>
                      <CreditCard sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                      <Typography variant="body2" fontWeight="medium">
                        Card
                      </Typography>
                    </CardContent>
                  </Card>
                  <Card
                    sx={{
                      flex: 1,
                      cursor: 'pointer',
                      border: paymentMethod === 'mobile_money' ? 2 : 1,
                      borderColor: paymentMethod === 'mobile_money' ? 'primary.main' : 'divider',
                      backgroundColor: paymentMethod === 'mobile_money' ? 'action.selected' : 'background.paper',
                      '&:hover': {
                        borderColor: 'primary.main',
                        backgroundColor: 'action.hover'
                      },
                      transition: 'all 0.2s'
                    }}
                    onClick={() => setPaymentMethod('mobile_money')}
                  >
                    <CardContent sx={{ textAlign: 'center', py: 2, '&:last-child': { pb: 2 } }}>
                      <PhoneAndroid sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                      <Typography variant="body2" fontWeight="medium">
                        Mobile Money
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
              </Box>
            )}

            {/* Mobile Money Provider Selection */}
            {paymentType === 'pay_now' && paymentMethod === 'mobile_money' && (
              <Box sx={{ mb: 2 }}>
                <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.875rem' }}>
                  Select Mobile Money Provider:
                </FormLabel>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Card
                    sx={{
                      flex: 1,
                      cursor: 'pointer',
                      border: mobileMoneyProvider === 'mpesa' ? 2 : 1,
                      borderColor: mobileMoneyProvider === 'mpesa' ? 'primary.main' : 'divider',
                      backgroundColor: mobileMoneyProvider === 'mpesa' ? 'action.selected' : 'background.paper',
                      '&:hover': {
                        borderColor: 'primary.main',
                        backgroundColor: 'action.hover'
                      },
                      transition: 'all 0.2s'
                    }}
                    onClick={() => setMobileMoneyProvider('mpesa')}
                  >
                    <CardContent sx={{ textAlign: 'center', py: 2, '&:last-child': { pb: 2 } }}>
                      <AccountBalanceWallet sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                      <Typography variant="body2" fontWeight="medium">
                        M-Pesa
                      </Typography>
                    </CardContent>
                  </Card>
                  <Card
                    sx={{
                      flex: 1,
                      cursor: 'not-allowed',
                      border: 1,
                      borderColor: 'divider',
                      backgroundColor: 'action.disabledBackground',
                      opacity: 0.6,
                      position: 'relative'
                    }}
                  >
                    <CardContent sx={{ textAlign: 'center', py: 2, '&:last-child': { pb: 2 } }}>
                      <PhoneAndroid sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                      <Typography variant="body2" fontWeight="medium" color="text.disabled">
                        Airtel
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Coming Soon
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
              </Box>
            )}

            {/* M-Pesa Phone Number Input */}
            {paymentType === 'pay_now' && paymentMethod === 'mobile_money' && mobileMoneyProvider === 'mpesa' && (
              <Box sx={{ mb: 2 }}>
                <TextField
                  label="Safaricom Phone Number *"
                  value={mpesaPhoneNumber}
                  onChange={(e) => {
                    // Allow only digits and common formatting characters
                    const value = e.target.value.replace(/[^\d+\s()-]/g, '');
                    setMpesaPhoneNumber(value);
                  }}
                  placeholder="0712345678"
                  fullWidth
                  size="small"
                  helperText="Enter your Safaricom M-Pesa registered phone number"
                  sx={{ mb: 2 }}
                />
                <Box sx={{ 
                  p: 2, 
                  bgcolor: 'background.default', 
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider'
                }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Amount to Pay:
                  </Typography>
                  <Typography variant="h6" color="primary" fontWeight="bold">
                    KES {(getTotalPrice() + deliveryFee + tipAmount).toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            )}

            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={handleSubmitOrder}
              disabled={loading || isProcessingPayment}
              sx={{
                backgroundColor: '#FF6B6B',
                '&:hover': {
                  backgroundColor: '#FF5252'
                }
              }}
            >
              {isProcessingPayment 
                ? 'Initiating payment...' 
                : paymentType === 'pay_now' && paymentMethod === 'mobile_money' && mobileMoneyProvider === 'mpesa'
                ? 'Make Payment'
                : loading 
                ? 'Placing Order...' 
                : 'Place Order'}
            </Button>
            
            {/* Error Display at Bottom of Button */}
            {error && (
              <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Cart;
