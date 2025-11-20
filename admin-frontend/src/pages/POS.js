import React, { useState, useEffect } from 'react';
import { QrCodeScanner, Link as LinkIcon } from '@mui/icons-material';
import {
  Container,
  Typography,
  Box,
  Card,
  CardMedia,
  CardContent,
  Button,
  Grid,
  TextField,
  Paper,
  Divider,
  Alert,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Select,
  MenuItem,
  InputLabel,
  Pagination,
  InputAdornment
} from '@mui/material';
import {
  ShoppingCart,
  Add,
  Remove,
  Delete,
  Payment,
  AttachMoney,
  PhoneAndroid,
  CheckCircle,
  Cancel,
  Print,
  Search
} from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { fetchProductByBarcode } from '../services/barcode';
import io from 'socket.io-client';

const POS = () => {
  const { isDarkMode, colors } = useTheme();
  const [drinks, setDrinks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [filteredDrinks, setFilteredDrinks] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12; // 3 items per row × 4 rows = 12 items per page
  const [scannerStatus, setScannerStatus] = useState('disconnected'); // disconnected, connected, scanning
  const [scannerError, setScannerError] = useState(null);
  
  // Customer info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [customerLookupLoading, setCustomerLookupLoading] = useState(false);
  const [usedPhoneNumbers, setUsedPhoneNumbers] = useState(new Set()); // Track phone numbers that have been used
  
  // Payment
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [orderError, setOrderError] = useState(null);
  const [pendingMpesaOrder, setPendingMpesaOrder] = useState(null); // Track pending M-Pesa orders

  useEffect(() => {
    fetchData();
    // Start polling for cart updates from Retail Scanner
    const cartPollInterval = setInterval(() => {
      fetchPOSCart();
    }, 2000); // Poll every 2 seconds

    // Initialize socket connection for payment confirmation
    const hostname = window.location.hostname;
    const isLocalHost = ['localhost', '127.0.0.1'].includes(hostname) || hostname.endsWith('.local');
    const isLanHost = /^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])/.test(hostname || '');
    
    let socketUrl;
    if (isLocalHost || isLanHost) {
      socketUrl = 'http://localhost:5001';
    } else {
      const isManagedHost = hostname.includes('onrender.com') || hostname.includes('run.app');
      if (isManagedHost) {
        const apiUrl = process.env.REACT_APP_API_URL;
        socketUrl = apiUrl ? apiUrl.replace('/api', '') : 'https://dialadrink-backend-910510650031.us-central1.run.app';
      } else {
        const apiUrl = process.env.REACT_APP_API_URL;
        socketUrl = apiUrl ? apiUrl.replace('/api', '') : 'https://dialadrink-backend-910510650031.us-central1.run.app';
      }
    }
    
    const socket = io(socketUrl);
    socket.emit('join-admin');
    
    // Listen for payment confirmation for pending M-Pesa orders
    socket.on('payment-confirmed', (data) => {
      if (pendingMpesaOrder && data.orderId === pendingMpesaOrder.orderId) {
        console.log('✅ M-Pesa payment confirmed for POS order:', data);
        setPendingMpesaOrder(null);
        setOrderSuccess({
          orderId: data.orderId,
          message: `Payment confirmed! Receipt: ${data.receiptNumber || 'N/A'}`,
          checkoutRequestID: null
        });
        
        // Clear backend cart and local cart
        api.delete('/pos/cart').catch(err => console.error('Error clearing cart:', err));
        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
        setCustomerEmail('');
        setMpesaPhone('');
        setAmountReceived('');
        setPaymentMethod('cash');
        setProcessing(false);
        setShowPaymentDialog(false);
      }
    });
    
    // Listen for order status updates
    socket.on('order-status-updated', (data) => {
      if (pendingMpesaOrder && data.orderId === pendingMpesaOrder.orderId) {
        if (data.status === 'completed' && data.paymentStatus === 'paid') {
          console.log('✅ POS order completed via socket:', data);
          setPendingMpesaOrder(null);
          setOrderSuccess({
            orderId: data.orderId,
            message: 'Payment confirmed and order completed!',
            checkoutRequestID: null
          });
          
          // Clear backend cart and local cart
          api.delete('/pos/cart').catch(err => console.error('Error clearing cart:', err));
          setCart([]);
          setCustomerName('');
          setCustomerPhone('');
          setCustomerEmail('');
          setMpesaPhone('');
          setAmountReceived('');
          setPaymentMethod('cash');
          setProcessing(false);
          setShowPaymentDialog(false);
        }
      }
    });

    return () => {
      clearInterval(cartPollInterval);
      socket.close();
    };
  }, [pendingMpesaOrder]);

  // Fetch POS cart from backend
  const fetchPOSCart = async () => {
    try {
      const response = await api.get('/pos/cart');
      if (response.data && response.data.cart) {
        // Sync cart with backend
        const backendCart = response.data.cart.map(item => ({
          drinkId: item.drinkId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image
        }));
        
        // Only update if cart has changed
        if (JSON.stringify(backendCart) !== JSON.stringify(cart)) {
          setCart(backendCart);
        }
      }
    } catch (error) {
      // Silently fail - cart polling shouldn't break the UI
      console.error('Error fetching POS cart:', error);
    }
  };

  useEffect(() => {
    // Filter drinks whenever drinks, searchTerm, or selectedCategory changes
    let filtered = drinks.filter(drink => drink.isAvailable !== false);

    // Apply search filter
    if (searchTerm && searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(drink =>
        drink.name.toLowerCase().includes(searchLower)
      );
    }

    // Apply category filter
    if (selectedCategory && selectedCategory !== '') {
      const categoryId = parseInt(selectedCategory);
      filtered = filtered.filter(drink =>
        drink.categoryId === categoryId
      );
    }

    setFilteredDrinks(filtered);
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [drinks, searchTerm, selectedCategory]);

  // Lookup customer by phone number with debouncing
  useEffect(() => {
    if (!customerPhone || customerPhone.trim().length < 9) {
      return;
    }

    const phoneDigits = customerPhone.replace(/\D/g, '');
    if (phoneDigits.length < 9) {
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setCustomerLookupLoading(true);
        const response = await api.get(`/pos/customer/${encodeURIComponent(customerPhone)}`);
        
        console.log('📞 Customer lookup response:', response.data);
        
        if (response.data?.customer && response.data.customer.name) {
          // Customer found - auto-fill name and email
          const customer = response.data.customer;
          console.log('✅ Found customer:', customer.name);
          setCustomerName(customer.name);
          if (customer.email) {
            setCustomerEmail(customer.email);
          }
          // Clear from used phone numbers since this is a real customer
          setUsedPhoneNumbers(prev => {
            const newSet = new Set(prev);
            newSet.delete(phoneDigits);
            return newSet;
          });
        } else {
          console.log('❌ No customer found, using placeholder');
          // Customer not found - use placeholder name
          const phoneKey = phoneDigits;
          setUsedPhoneNumbers(prev => {
            const newSet = new Set(prev);
            if (!newSet.has(phoneKey)) {
              newSet.add(phoneKey);
              // Generate placeholder name based on set size
              const placeholderName = `Customer ${newSet.size}`;
              setCustomerName(placeholderName);
              return newSet;
            } else {
              // Phone number was used before - keep existing name if it's a placeholder
              setCustomerName(prevName => {
                if (!prevName || prevName.startsWith('Customer ')) {
                  // Find which customer number this phone had
                  const phoneArray = Array.from(newSet);
                  const index = phoneArray.indexOf(phoneKey);
                  return index >= 0 ? `Customer ${index + 1}` : prevName;
                }
                return prevName;
              });
              return prev;
            }
          });
        }
      } catch (error) {
        console.error('Error looking up customer:', error);
        // On error, still use placeholder if name is empty
        const phoneKey = phoneDigits;
        setUsedPhoneNumbers(prev => {
          const newSet = new Set(prev);
          if (!newSet.has(phoneKey)) {
            newSet.add(phoneKey);
            setCustomerName(prevName => {
              if (!prevName) {
                return `Customer ${newSet.size}`;
              }
              return prevName;
            });
            return newSet;
          } else {
            // Phone already in set, use its index
            const phoneArray = Array.from(newSet);
            const index = phoneArray.indexOf(phoneKey);
            setCustomerName(prevName => {
              if (!prevName || prevName.startsWith('Customer ')) {
                return `Customer ${index + 1}`;
              }
              return prevName;
            });
            return prev;
          }
        });
      } finally {
        setCustomerLookupLoading(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [customerPhone]);

  const fetchData = async () => {
    try {
      // Try POS endpoint first, fallback to regular drinks endpoint
      let drinksResponse;
      try {
        drinksResponse = await api.get('/pos/drinks');
      } catch (posError) {
        console.warn('POS endpoint failed, trying regular drinks endpoint:', posError);
        // Fallback to regular drinks endpoint
        drinksResponse = await api.get('/drinks');
        // Filter to only available drinks
        if (drinksResponse.data && Array.isArray(drinksResponse.data)) {
          drinksResponse.data = drinksResponse.data.filter(drink => drink.isAvailable !== false);
        }
      }

      const categoriesResponse = await api.get('/categories');
      
      setDrinks(drinksResponse.data || []);
      setCategories(categoriesResponse.data || []);
    } catch (error) {
      console.error('❌ Error fetching POS data:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url,
        baseURL: error.config?.baseURL
      });
      
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load products';
      const details = error.response?.data?.details;
      setOrderError(
        `Failed to load products: ${errorMessage}${details ? ` (${details})` : ''}. Please check your connection and refresh the page.`
      );
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return '/assets/images/placeholder.png';
    if (imagePath.startsWith('http')) return imagePath;
    
    const isHosted = window.location.hostname.includes('run.app');
    const baseUrl = isHosted
      ? 'https://dialadrink-backend-910510650031.us-central1.run.app'
      : 'http://localhost:5001';
    
    return `${baseUrl}${imagePath}`;
  };

  const addToCart = async (drink) => {
    try {
      // Add to backend cart (this will sync with Retail Scanner)
      await api.post('/pos/cart/add', { drinkId: drink.id, quantity: 1 });
    } catch (error) {
      console.error('Error adding to backend cart:', error);
    }
    
    // Update local cart
    const existingItem = cart.find(item => item.drinkId === drink.id);
    
    if (existingItem) {
      setCart(cart.map(item =>
        item.drinkId === drink.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        drinkId: drink.id,
        name: drink.name,
        price: parseFloat(drink.price) || 0,
        quantity: 1,
        image: drink.image
      }]);
    }
  };

  // Handle barcode scan from Android app (via deep link or message)
  useEffect(() => {
    // Listen for messages from Android app
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'BARCODE_SCANNED') {
        handleBarcodeScanned(event.data.barcode);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleBarcodeScanned = async (barcode) => {
    try {
      setScannerError(null);
      setScannerStatus('scanning');
      const product = await fetchProductByBarcode(barcode);
      
      if (product) {
        await addToCart(product);
        setScannerStatus('connected');
      }
    } catch (error) {
      console.error('Error fetching product by barcode:', error);
      setScannerError(error.message || 'Product not found');
      setScannerStatus('connected');
    }
  };

  const updateQuantity = (drinkId, delta) => {
    setCart(cart.map(item => {
      if (item.drinkId === drinkId) {
        const newQuantity = item.quantity + delta;
        return { ...item, quantity: Math.max(1, newQuantity) };
      }
      return item;
    }));
  };

  const removeFromCart = (drinkId) => {
    setCart(cart.filter(item => item.drinkId !== drinkId));
  };

  const getTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const getChange = () => {
    const total = getTotal();
    const received = parseFloat(amountReceived) || 0;
    return received - total;
  };

  const handleCheckout = () => {
    console.log('🛒 handleCheckout called:', {
      cartLength: cart.length,
      customerName,
      customerPhone,
      paymentMethod,
      amountReceived,
      mpesaPhone,
      total: getTotal()
    });

    if (cart.length === 0) {
      setOrderError('Cart is empty');
      return;
    }

    if (!customerName?.trim() || !customerPhone?.trim()) {
      setOrderError('Please enter customer name and phone number');
      return;
    }

    if (paymentMethod === 'cash') {
      const received = parseFloat(amountReceived) || 0;
      const total = getTotal();
      if (!amountReceived || amountReceived.trim() === '' || isNaN(received) || received <= 0) {
        setOrderError('Please enter the amount received from customer');
        return;
      }
      if (received < total) {
        setOrderError(`Amount received (KES ${received.toFixed(2)}) is less than total (KES ${total.toFixed(2)})`);
        return;
      }
    }

    if (paymentMethod === 'mpesa' && !mpesaPhone?.trim()) {
      setOrderError('Please enter M-Pesa phone number');
      return;
    }

    setShowPaymentDialog(true);
  };

  const processPayment = async () => {
    setProcessing(true);
    setOrderError(null);
    setOrderSuccess(null);

    try {
      const orderData = {
        customerName,
        customerPhone,
        customerEmail: customerEmail || null,
        items: cart.map(item => ({
          drinkId: item.drinkId,
          quantity: item.quantity,
          selectedPrice: item.price
        })),
        notes: `POS Order - Payment: ${paymentMethod}${paymentMethod === 'cash' && amountReceived ? ` - Amount Received: KES ${parseFloat(amountReceived).toFixed(2)}, Change: KES ${getChange().toFixed(2)}` : ''}`,
        amountPaid: paymentMethod === 'cash' ? parseFloat(amountReceived) : null
      };

      let response;
      if (paymentMethod === 'cash') {
        response = await api.post('/pos/order/cash', orderData);
      } else {
        response = await api.post('/pos/order/mpesa', {
          ...orderData,
          phoneNumber: mpesaPhone
        });
      }

      // Handle success response
      if (response.data.success) {
        const orderId = response.data.order?.id || response.data.orderId;
        
        if (paymentMethod === 'cash') {
          // Cash payment: complete immediately
          setOrderSuccess({
            orderId: orderId,
            message: 'Order completed successfully!',
            checkoutRequestID: null
          });
          
          // Clear backend cart (this will also clear Retail Scanner cart)
          try {
            await api.delete('/pos/cart');
          } catch (error) {
            console.error('Error clearing cart:', error);
          }
          
          // Clear cart and form
          setCart([]);
          setCustomerName('');
          setCustomerPhone('');
          setCustomerEmail('');
          setMpesaPhone('');
          setAmountReceived('');
          setPaymentMethod('cash');
          setProcessing(false);
          setShowPaymentDialog(false);
        } else {
          // M-Pesa payment: wait for customer confirmation
          setPendingMpesaOrder({
            orderId: orderId,
            checkoutRequestID: response.data.checkoutRequestID,
            startTime: Date.now()
          });
          
          // Don't clear cart yet - wait for payment confirmation
          // Don't close dialog yet - show pending state
          // Keep processing state true to show spinner
          
          // Start polling for order status as fallback (in case socket doesn't work)
          const pollInterval = setInterval(async () => {
            try {
              const orderResponse = await api.get(`/pos/orders/${orderId}`);
              const order = orderResponse.data.order || orderResponse.data;
              
              if (order.status === 'completed' && order.paymentStatus === 'paid') {
                clearInterval(pollInterval);
                setPendingMpesaOrder(null);
                setOrderSuccess({
                  orderId: orderId,
                  message: 'Payment confirmed and order completed!',
                  checkoutRequestID: null
                });
                
                // Clear backend cart and local cart
                api.delete('/pos/cart').catch(err => console.error('Error clearing cart:', err));
                setCart([]);
                setCustomerName('');
                setCustomerPhone('');
                setCustomerEmail('');
                setMpesaPhone('');
                setAmountReceived('');
                setPaymentMethod('cash');
                setProcessing(false);
                setShowPaymentDialog(false);
              }
            } catch (error) {
              console.error('Error polling order status:', error);
            }
          }, 2000); // Poll every 2 seconds
          
          // Stop polling after 5 minutes (timeout)
          setTimeout(() => {
            clearInterval(pollInterval);
            if (pendingMpesaOrder && pendingMpesaOrder.orderId === orderId) {
              setPendingMpesaOrder(null);
              setOrderError('Payment timeout. Please check order status manually.');
              setProcessing(false);
            }
          }, 5 * 60 * 1000); // 5 minutes
        }
      } else {
        // If response doesn't indicate success, show error
        setOrderError(response.data.error || response.data.errorMessage || 'Payment initiation failed');
        setProcessing(false);
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url
      });
      
      // Provide more detailed error messages
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.errorMessage ||
                          error.response?.data?.message ||
                          error.message || 
                          'Failed to process payment';
      
      setOrderError(errorMessage);
      setProcessing(false);
      // Only close dialog if not waiting for M-Pesa confirmation
      if (!pendingMpesaOrder) {
        setShowPaymentDialog(false);
      }
    }
  };

  const handlePrintReceipt = () => {
    // TODO: Implement receipt printing
    window.print();
  };

  if (loading) {
    return (
      <Container>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <>
      {/* Fixed Header */}
      <Box
        sx={{
          position: 'fixed',
          top: 64,
          left: 0,
          right: 0,
          zIndex: 1200,
          backgroundColor: colors.background,
          borderBottom: `2px solid ${colors.border}`,
          boxShadow: 3,
          py: 2
        }}
      >
        <Container maxWidth="xl">
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h4" sx={{ fontWeight: 700, color: colors.textPrimary }}>
              Point of Sale (POS)
            </Typography>
            <Box display="flex" alignItems="center" gap={2}>
              {cart.length > 0 && (
                <Typography variant="h5" sx={{ fontWeight: 700, color: colors.accent }}>
                  Total: KES {getTotal().toFixed(2)}
                </Typography>
              )}
              {orderSuccess && (
                <Chip
                  icon={<CheckCircle />}
                  label={`Order #${orderSuccess.orderId} Completed`}
                  color="success"
                  sx={{ fontSize: '1rem', py: 2 }}
                />
              )}
            </Box>
          </Box>
        </Container>
      </Box>
      
      {/* Spacer for fixed header */}
      <Box sx={{ height: 80, mb: 2 }} />
      
      <Container maxWidth="xl" sx={{ py: 3, width: '100%' }}>

      {orderError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setOrderError(null)}>
          {orderError}
        </Alert>
      )}

      {orderSuccess && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={handlePrintReceipt} startIcon={<Print />}>
              Print Receipt
            </Button>
          }
          onClose={() => setOrderSuccess(null)}
        >
          {orderSuccess.message}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, width: '100%', flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Products Section - Left Half */}
        <Box sx={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Card sx={{ mb: 2, backgroundColor: colors.paper }}>
            <CardContent>
              <Box display="flex" gap={2} mb={2} flexDirection="column">
                <Box display="flex" gap={2}>
                  <TextField
                    fullWidth
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: <Search sx={{ mr: 1, color: colors.textSecondary }} />
                    }}
                    sx={{
                      '& .MuiInputBase-input': { color: colors.textPrimary },
                      '& .MuiInputLabel-root': { color: colors.textSecondary },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border || colors.textSecondary },
                      '& .MuiInputBase-input::placeholder': { color: colors.textSecondary, opacity: 0.7 }
                    }}
                  />
                  <FormControl sx={{ minWidth: 200 }}>
                    <InputLabel sx={{ color: colors.textSecondary }}>Category</InputLabel>
                    <Select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      label="Category"
                      sx={{
                        color: colors.textPrimary,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border || colors.textSecondary },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: colors.accent },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: colors.accent },
                        '& .MuiSvgIcon-root': { color: colors.textSecondary }
                      }}
                      MenuProps={{
                        PaperProps: {
                          sx: {
                            backgroundColor: colors.paper,
                            color: colors.textPrimary,
                            '& .MuiMenuItem-root': {
                              color: colors.textPrimary,
                              '&:hover': {
                                backgroundColor: colors.accent + '20'
                              },
                              '&.Mui-selected': {
                                backgroundColor: colors.accent + '40',
                                '&:hover': {
                                  backgroundColor: colors.accent + '60'
                                }
                              }
                            }
                          }
                        }
                      }}
                    >
                      <MenuItem value="">
                        <em>All Categories</em>
                      </MenuItem>
                      {categories.map(cat => (
                        <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                
                {/* Android App Scanner Launcher */}
                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<QrCodeScanner />}
                    onClick={() => {
                      // Launch Android app via deep link
                      const deepLink = 'retailscanner://pos-scan';
                      window.location.href = deepLink;
                      setScannerStatus('connected');
                    }}
                    sx={{
                      backgroundColor: colors.accent,
                      color: '#000',
                      mb: 1,
                      '&:hover': {
                        backgroundColor: colors.accent,
                        opacity: 0.9
                      }
                    }}
                  >
                    Launch Retail Scanner App
                  </Button>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <Chip
                      label={`Scanner: ${scannerStatus === 'connected' ? 'Connected' : scannerStatus === 'scanning' ? 'Scanning...' : 'Disconnected'}`}
                      color={scannerStatus === 'connected' ? 'success' : scannerStatus === 'scanning' ? 'info' : 'default'}
                      size="small"
                      icon={scannerStatus === 'connected' ? <CheckCircle /> : <LinkIcon />}
                    />
                  </Box>
                  
                  {scannerError && (
                    <Alert severity="error" onClose={() => setScannerError(null)} sx={{ mt: 1 }}>
                      {scannerError}
                    </Alert>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>

          {filteredDrinks.length === 0 ? (
            <Box 
              sx={{ 
                textAlign: 'center', 
                py: 8,
                backgroundColor: colors.paper,
                borderRadius: 2,
                border: `1px solid ${colors.border}`
              }}
            >
              <Typography variant="h6" sx={{ color: colors.textSecondary, mb: 1 }}>
                No products found
              </Typography>
              <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                {searchTerm || selectedCategory 
                  ? 'Try adjusting your search or category filter'
                  : 'No available products in inventory'}
              </Typography>
            </Box>
          ) : (
            <>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 1,
                  '@media (max-width: 900px)': {
                    gridTemplateColumns: 'repeat(2, 1fr)'
                  },
                  '@media (max-width: 600px)': {
                    gridTemplateColumns: 'repeat(2, 1fr)'
                  },
                  '@media (max-width: 400px)': {
                    gridTemplateColumns: 'repeat(1, 1fr)'
                  }
                }}
              >
                {filteredDrinks
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map(drink => (
                <Card
                  key={drink.id}
                  sx={{
                    cursor: 'pointer',
                    height: 180,
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    '&:hover': { 
                      transform: 'scale(1.02)', 
                      transition: 'transform 0.2s',
                      boxShadow: 4
                    },
                    backgroundColor: colors.paper
                  }}
                  onClick={() => addToCart(drink)}
                >
                  <CardMedia
                    component="img"
                    sx={{ 
                      height: 110,
                      width: '100%',
                      objectFit: 'contain',
                      flexShrink: 0,
                      backgroundColor: colors.background,
                      p: 0.5
                    }}
                    image={getImageUrl(drink.image)}
                    alt={drink.name}
                  />
                  <CardContent sx={{ 
                    flexGrow: 1, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'space-between',
                    p: 0.75,
                    '&:last-child': { pb: 0.75 }
                  }}>
                    <Typography 
                      variant="body2" 
                      fontWeight="bold" 
                      noWrap 
                      sx={{ 
                        color: colors.textPrimary,
                        mb: 0.5,
                        fontSize: '0.85rem'
                      }}
                    >
                      {drink.name}
                    </Typography>
                    <Typography variant="body1" color={colors.accent} sx={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
                      KES {parseFloat(drink.price || 0).toFixed(2)}
                    </Typography>
                  </CardContent>
                </Card>
                ))}
              </Box>
              
              {/* Pagination Controls */}
              {Math.ceil(filteredDrinks.length / itemsPerPage) > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
                  <Pagination
                    count={Math.ceil(filteredDrinks.length / itemsPerPage)}
                    page={currentPage}
                    onChange={(event, value) => setCurrentPage(value)}
                    color="primary"
                    sx={{
                      '& .MuiPaginationItem-root': {
                        color: colors.textPrimary,
                        '&.Mui-selected': {
                          backgroundColor: colors.accent,
                          color: colors.accentText,
                          '&:hover': {
                            backgroundColor: colors.accent,
                            opacity: 0.8
                          }
                        },
                        '&:hover': {
                          backgroundColor: colors.accent + '20'
                        }
                      }
                    }}
                  />
                </Box>
              )}
              
              {/* Page Info */}
              {filteredDrinks.length > 0 && (
                <Box sx={{ textAlign: 'center', mt: 1, mb: 2 }}>
                  <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                    Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredDrinks.length)} of {filteredDrinks.length} products
                  </Typography>
                </Box>
              )}
            </>
          )}
        </Box>

        {/* Cart Section - Right Half */}
        <Box sx={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Card sx={{ 
            position: 'sticky',
            top: 20,
            backgroundColor: colors.paper,
            width: '100%',
            height: 'fit-content',
            maxHeight: 'calc(100vh - 100px)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto'
          }}>
            <CardContent sx={{ width: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <Box display="flex" alignItems="center" mb={2} sx={{ width: '100%' }}>
                <ShoppingCart sx={{ mr: 1, color: colors.accent }} />
                <Typography variant="h6" fontWeight="bold">
                  Cart ({cart.length})
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              {cart.length === 0 ? (
                <Box sx={{ 
                  width: '100%',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  py: 3
                }}>
                  <Typography color={colors.textSecondary} textAlign="center">
                    Cart is empty
                  </Typography>
                </Box>
              ) : (
                <>
                  <List>
                    {cart.map(item => (
                      <ListItem key={item.drinkId}>
                        <ListItemText
                          primary={item.name}
                          secondary={`KES ${item.price.toFixed(2)} × ${item.quantity}`}
                        />
                        <ListItemSecondaryAction>
                          <Box display="flex" alignItems="center" gap={1}>
                            <IconButton
                              size="small"
                              onClick={() => updateQuantity(item.drinkId, -1)}
                            >
                              <Remove />
                            </IconButton>
                            <Typography>{item.quantity}</Typography>
                            <IconButton
                              size="small"
                              onClick={() => updateQuantity(item.drinkId, 1)}
                            >
                              <Add />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => removeFromCart(item.drinkId)}
                            >
                              <Delete />
                            </IconButton>
                          </Box>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>

                  <Divider sx={{ my: 2 }} />

                  <Box mb={2}>
                    <Typography variant="h5" fontWeight="bold" textAlign="right">
                      Total: KES {getTotal().toFixed(2)}
                    </Typography>
                  </Box>

                  <Box mb={2}>
                    <TextField
                      fullWidth
                      label="Customer Phone"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      required
                      InputProps={{
                        endAdornment: customerLookupLoading ? (
                          <InputAdornment position="end">
                            <CircularProgress size={20} />
                          </InputAdornment>
                        ) : null
                      }}
                      sx={{
                        mb: 1,
                        '& .MuiInputBase-input': { color: colors.textPrimary },
                        '& .MuiInputLabel-root': { color: colors.textSecondary },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border || colors.textSecondary }
                      }}
                    />
                    <TextField
                      fullWidth
                      label="Customer Name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      required
                      sx={{
                        mb: 1,
                        '& .MuiInputBase-input': { color: colors.textPrimary },
                        '& .MuiInputLabel-root': { color: colors.textSecondary },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border || colors.textSecondary }
                      }}
                    />
                    <TextField
                      fullWidth
                      label="Email (Optional)"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      type="email"
                      sx={{
                        '& .MuiInputBase-input': { color: colors.textPrimary },
                        '& .MuiInputLabel-root': { color: colors.textSecondary },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border || colors.textSecondary }
                      }}
                    />
                  </Box>

                  <FormControl component="fieldset" fullWidth sx={{ mb: 2 }}>
                    <FormLabel component="legend">Payment Method</FormLabel>
                    <RadioGroup
                      value={paymentMethod}
                      onChange={(e) => {
                        setPaymentMethod(e.target.value);
                        if (e.target.value !== 'cash') {
                          setAmountReceived('');
                        }
                      }}
                    >
                      <FormControlLabel
                        value="cash"
                        control={<Radio />}
                        label={
                          <Box display="flex" alignItems="center">
                            <AttachMoney sx={{ mr: 1 }} />
                            Cash
                          </Box>
                        }
                      />
                      <FormControlLabel
                        value="mpesa"
                        control={<Radio />}
                        label={
                          <Box display="flex" alignItems="center">
                            <PhoneAndroid sx={{ mr: 1 }} />
                            M-Pesa
                          </Box>
                        }
                      />
                    </RadioGroup>
                  </FormControl>

                  {paymentMethod === 'cash' && (
                    <Box mb={2}>
                      <TextField
                        fullWidth
                        label="Amount Received"
                        type="number"
                        value={amountReceived}
                        onChange={(e) => setAmountReceived(e.target.value)}
                        placeholder="0.00"
                        InputProps={{
                          startAdornment: <InputAdornment position="start">KES</InputAdornment>
                        }}
                        sx={{
                          mb: 1,
                          '& .MuiInputBase-input': { color: colors.textPrimary },
                          '& .MuiInputLabel-root': { color: colors.textSecondary },
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border || colors.textSecondary },
                          '& .MuiInputBase-input::placeholder': { color: colors.textSecondary, opacity: 0.7 }
                        }}
                      />
                      {amountReceived && parseFloat(amountReceived) > 0 && (
                        <Box
                          sx={{
                            p: 1.5,
                            borderRadius: 1,
                            backgroundColor: getChange() >= 0 ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
                            border: `1px solid ${getChange() >= 0 ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)'}`
                          }}
                        >
                          <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                            Total Due: KES {getTotal().toFixed(2)}
                          </Typography>
                          <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                            Amount Received: KES {parseFloat(amountReceived || 0).toFixed(2)}
                          </Typography>
                          <Typography 
                            variant="h6" 
                            sx={{ 
                              fontWeight: 'bold',
                              color: getChange() >= 0 ? '#4CAF50' : '#F44336'
                            }}
                          >
                            {getChange() >= 0 ? 'Change: ' : 'Short: '}KES {Math.abs(getChange()).toFixed(2)}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}

                  {paymentMethod === 'mpesa' && (
                    <TextField
                      fullWidth
                      label="M-Pesa Phone Number"
                      value={mpesaPhone}
                      onChange={(e) => setMpesaPhone(e.target.value)}
                      placeholder="0712345678"
                      sx={{
                        mb: 2,
                        '& .MuiInputBase-input': { color: colors.textPrimary },
                        '& .MuiInputLabel-root': { color: colors.textSecondary },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border || colors.textSecondary },
                        '& .MuiInputBase-input::placeholder': { color: colors.textSecondary, opacity: 0.7 }
                      }}
                    />
                  )}

                  {(() => {
                    const isDisabled = cart.length === 0 || 
                      !customerName?.trim() || 
                      !customerPhone?.trim() || 
                      (paymentMethod === 'cash' && (!amountReceived || isNaN(parseFloat(amountReceived)) || parseFloat(amountReceived) < getTotal())) ||
                      (paymentMethod === 'mpesa' && !mpesaPhone?.trim()) ||
                      pendingMpesaOrder !== null; // Disable if M-Pesa payment is pending
                    
                    let disabledReason = '';
                    if (pendingMpesaOrder !== null) {
                      disabledReason = 'Waiting for M-Pesa payment confirmation...';
                    } else if (cart.length === 0) {
                      disabledReason = 'Cart is empty';
                    } else if (!customerName?.trim()) {
                      disabledReason = 'Please enter customer name';
                    } else if (!customerPhone?.trim()) {
                      disabledReason = 'Please enter customer phone number';
                    } else if (paymentMethod === 'cash' && (!amountReceived || isNaN(parseFloat(amountReceived)) || parseFloat(amountReceived) < getTotal())) {
                      if (!amountReceived) {
                        disabledReason = 'Please enter amount received';
                      } else if (parseFloat(amountReceived) < getTotal()) {
                        disabledReason = `Amount received (KES ${parseFloat(amountReceived).toFixed(2)}) is less than total (KES ${getTotal().toFixed(2)})`;
                      }
                    } else if (paymentMethod === 'mpesa' && !mpesaPhone?.trim()) {
                      disabledReason = 'Please enter M-Pesa phone number';
                    }
                    
                    return (
                      <Box>
                        <Button
                          fullWidth
                          variant="contained"
                          size="large"
                          startIcon={pendingMpesaOrder !== null ? <CircularProgress size={20} sx={{ color: '#000' }} /> : <Payment />}
                          onClick={handleCheckout}
                          disabled={isDisabled}
                          sx={{
                            backgroundColor: colors.accent,
                            color: '#000',
                            fontWeight: 'bold',
                            py: 1.5,
                            '&:hover': {
                              backgroundColor: colors.accent,
                              opacity: 0.9
                            },
                            '&:disabled': {
                              backgroundColor: colors.textSecondary,
                              color: colors.textPrimary,
                              opacity: 0.6
                            }
                          }}
                        >
                          {pendingMpesaOrder !== null ? 'Waiting for Payment...' : 'Process Payment'}
                        </Button>
                        {isDisabled && disabledReason && (
                          <Typography 
                            variant="caption" 
                            color={pendingMpesaOrder !== null ? 'info.main' : 'error'} 
                            sx={{ mt: 1, display: 'block', textAlign: 'center' }}
                          >
                            {disabledReason}
                          </Typography>
                        )}
                        {pendingMpesaOrder !== null && (
                          <Alert severity="info" sx={{ mt: 2 }}>
                            Waiting for customer to complete M-Pesa payment. Order #{pendingMpesaOrder.orderId} is pending.
                          </Alert>
                        )}
                      </Box>
                    );
                  })()}
                </>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Payment Confirmation Dialog */}
      <Dialog open={showPaymentDialog} onClose={() => !processing && setShowPaymentDialog(false)}>
        <DialogTitle>Confirm Payment</DialogTitle>
        <DialogContent>
          <Typography variant="body1" mb={2}>
            Process payment of <strong>KES {getTotal().toFixed(2)}</strong> via {paymentMethod === 'cash' ? 'Cash' : 'M-Pesa'}?
          </Typography>
          {paymentMethod === 'mpesa' && (
            <>
              <Alert severity="info" sx={{ mt: 2 }}>
                Customer will receive an M-Pesa prompt on {mpesaPhone}
              </Alert>
              {pendingMpesaOrder !== null && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Waiting for customer to complete payment. Order #{pendingMpesaOrder.orderId} is pending confirmation.
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPaymentDialog(false)} disabled={processing || pendingMpesaOrder !== null}>
            Cancel
          </Button>
          <Button
            onClick={processPayment}
            variant="contained"
            disabled={processing || pendingMpesaOrder !== null}
            startIcon={(processing || pendingMpesaOrder !== null) ? <CircularProgress size={20} /> : <Payment />}
          >
            {(processing || pendingMpesaOrder !== null) ? 'Processing...' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
      </Container>
    </>
  );
};

export default POS;

