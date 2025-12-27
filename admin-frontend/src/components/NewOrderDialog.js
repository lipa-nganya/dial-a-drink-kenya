import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Paper,
  IconButton,
  Autocomplete,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import {
  Add,
  Delete,
  ShoppingCart
} from '@mui/icons-material';
import { api } from '../services/api';
import AddressAutocomplete from './AddressAutocomplete';
import { useTheme } from '../contexts/ThemeContext';

const NewOrderDialog = ({ open, onClose, onOrderCreated }) => {
  const { isDarkMode, colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customers, setCustomers] = useState([]);
  const [territories, setTerritories] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [productSuggestions, setProductSuggestions] = useState([]);
  
  // Form state
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedTerritory, setSelectedTerritory] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [cartItems, setCartItems] = useState([]);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [currentQuantity, setCurrentQuantity] = useState(1);
  const [paymentStatus, setPaymentStatus] = useState('unpaid');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [transactionCode, setTransactionCode] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState('pending');
  const [selectedDriver, setSelectedDriver] = useState('');

  useEffect(() => {
    if (open) {
      fetchCustomers();
      fetchTerritories();
      fetchDrivers();
      fetchProducts();
    }
  }, [open]);

  useEffect(() => {
    if (productSearch && productSearch.length >= 2) {
      const filtered = products.filter(p => 
        p.name.toLowerCase().includes(productSearch.toLowerCase())
      ).slice(0, 10);
      setProductSuggestions(filtered);
    } else {
      setProductSuggestions([]);
    }
  }, [productSearch, products]);

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/admin/customers');
      setCustomers(response.data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchTerritories = async () => {
    try {
      const response = await api.get('/territories');
      setTerritories(response.data || []);
    } catch (error) {
      console.error('Error fetching territories:', error);
    }
  };

  const fetchDrivers = async () => {
    try {
      const response = await api.get('/drivers');
      setDrivers(response.data || []);
    } catch (error) {
      console.error('Error fetching drivers:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await api.get('/drinks?available_only=true');
      setProducts(response.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleAddToCart = () => {
    if (!currentProduct || currentQuantity < 1) {
      setError('Please select a product and enter a valid quantity');
      return;
    }

    const existingItemIndex = cartItems.findIndex(item => item.drinkId === currentProduct.id);
    
    if (existingItemIndex >= 0) {
      // Update quantity if item already exists
      const updated = [...cartItems];
      updated[existingItemIndex].quantity += currentQuantity;
      setCartItems(updated);
    } else {
      // Add new item
      const price = parseFloat(currentProduct.price) || 0;
      setCartItems([...cartItems, {
        drinkId: currentProduct.id,
        name: currentProduct.name,
        quantity: currentQuantity,
        price: price
      }]);
    }

    // Reset form
    setCurrentProduct(null);
    setCurrentQuantity(1);
    setProductSearch('');
    setError('');
  };

  const handleRemoveFromCart = (index) => {
    setCartItems(cartItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleSubmit = async () => {
    setError('');

    // Validation
    if (!selectedCustomer) {
      setError('Please select a customer');
      return;
    }

    if (!selectedTerritory) {
      setError('Please select a territory');
      return;
    }

    if (!deliveryLocation || !deliveryLocation.trim()) {
      setError('Please enter a delivery location');
      return;
    }

    if (cartItems.length === 0) {
      setError('Please add at least one item to the cart');
      return;
    }

    if (paymentStatus === 'paid' && !paymentMethod) {
      setError('Please select a payment method when payment status is Paid');
      return;
    }

    if (paymentStatus === 'paid' && paymentMethod === 'mobile_money' && !transactionCode.trim()) {
      setError('Please enter transaction code for mobile money payment');
      return;
    }

    if (deliveryStatus === 'delivered' && !selectedDriver) {
      setError('Please select a driver when delivery status is Delivered');
      return;
    }

    setLoading(true);

    try {
      const orderData = {
        customerName: selectedCustomer.customerName || selectedCustomer.name || '',
        customerPhone: selectedCustomer.phone || '',
        customerEmail: selectedCustomer.email || null,
        deliveryAddress: deliveryLocation,
        items: cartItems.map(item => ({
          drinkId: item.drinkId,
          quantity: item.quantity,
          selectedPrice: item.price
        })),
        paymentType: paymentStatus === 'paid' ? 'pay_now' : 'pay_on_delivery',
        paymentMethod: paymentStatus === 'paid' ? paymentMethod : null,
        paymentStatus: paymentStatus,
        status: deliveryStatus,
        territoryId: parseInt(selectedTerritory),
        adminOrder: true,
        driverId: deliveryStatus === 'delivered' ? parseInt(selectedDriver) : null,
        transactionCode: paymentStatus === 'paid' && paymentMethod === 'mobile_money' ? transactionCode.trim() : null
      };

      const response = await api.post('/orders', orderData);

      // Reset form
      handleClose();
      
      // Notify parent
      if (onOrderCreated) {
        onOrderCreated(response.data);
      }
    } catch (error) {
      console.error('Error creating order:', error);
      setError(error.response?.data?.error || 'Failed to create order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setSelectedTerritory('');
    setDeliveryLocation('');
    setCartItems([]);
    setCurrentProduct(null);
    setCurrentQuantity(1);
    setProductSearch('');
    setPaymentStatus('unpaid');
    setPaymentMethod('');
    setTransactionCode('');
    setDeliveryStatus('pending');
    setSelectedDriver('');
    setError('');
    onClose();
  };

  const filteredCustomers = customers.filter(customer => {
    if (!customerSearch) return true;
    const search = customerSearch.toLowerCase();
    const name = (customer.customerName || customer.name || '').toLowerCase();
    const phone = (customer.phone || '').toLowerCase();
    return name.includes(search) || phone.includes(search);
  });

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: colors.paper,
          color: colors.textPrimary
        }
      }}
    >
      <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>
        Create New Order
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Customer Selection */}
          <Autocomplete
            value={selectedCustomer}
            onChange={(event, newValue) => {
              setSelectedCustomer(newValue);
              // When a customer is selected, update the search to show the selected value
              if (newValue) {
                const name = newValue.customerName || newValue.name || 'Unknown';
                const phone = newValue.phone || '';
                setCustomerSearch(phone ? `${name} - ${phone}` : name);
              } else {
                setCustomerSearch('');
              }
            }}
            inputValue={customerSearch}
            onInputChange={(event, newInputValue, reason) => {
              // Handle different change reasons
              if (reason === 'input') {
                // User is typing - update search and clear selection if different
                setCustomerSearch(newInputValue);
                if (selectedCustomer) {
                  const selectedText = selectedCustomer.customerName || selectedCustomer.name || '';
                  const selectedPhone = selectedCustomer.phone || '';
                  const selectedDisplay = selectedPhone ? `${selectedText} - ${selectedPhone}` : selectedText;
                  if (newInputValue !== selectedDisplay) {
                    setSelectedCustomer(null);
                  }
                }
              } else if (reason === 'clear') {
                setCustomerSearch('');
                setSelectedCustomer(null);
              } else if (reason === 'reset') {
                setCustomerSearch('');
                setSelectedCustomer(null);
              }
            }}
            options={filteredCustomers}
            getOptionLabel={(option) => {
              if (!option) return '';
              const name = option.customerName || option.name || 'Unknown';
              const phone = option.phone || '';
              return phone ? `${name} - ${phone}` : name;
            }}
            renderInput={(params) => {
              // Hide placeholder when customer is selected
              const inputParams = { ...params };
              if (selectedCustomer) {
                inputParams.inputProps = {
                  ...inputParams.inputProps,
                  placeholder: ''
                };
              }
              return (
                <TextField
                  {...inputParams}
                  label="Customer *"
                  placeholder={!selectedCustomer ? "Search by name or phone number" : undefined}
                />
              );
            }}
            renderOption={(props, option) => (
              <li {...props} key={option.id || option.phone || option.email}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {option.customerName || option.name || 'Unknown'}
                  </Typography>
                  {option.phone && (
                    <Typography variant="caption" color="text.secondary">
                      {option.phone}
                    </Typography>
                  )}
                </Box>
              </li>
            )}
          />

          {/* Territory Selection */}
          <FormControl fullWidth>
            <InputLabel>Territory *</InputLabel>
            <Select
              value={selectedTerritory}
              label="Territory *"
              onChange={(e) => setSelectedTerritory(e.target.value)}
            >
              {territories.map((territory) => (
                <MenuItem key={territory.id} value={territory.id}>
                  {territory.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Delivery Location */}
          <AddressAutocomplete
            label="Delivery Location *"
            value={deliveryLocation}
            onChange={(e) => setDeliveryLocation(e.target.value)}
            placeholder="Start typing the delivery address..."
          />

          <Divider />

          {/* Add Items Section */}
          <Box>
            <Typography variant="h6" sx={{ mb: 2, color: colors.accentText }}>
              Add Items
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Autocomplete
                sx={{ flex: 1 }}
                value={currentProduct}
                onChange={(event, newValue) => setCurrentProduct(newValue)}
                inputValue={productSearch}
                onInputChange={(event, newInputValue) => setProductSearch(newInputValue)}
                options={productSuggestions}
                getOptionLabel={(option) => option?.name || ''}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Product"
                    placeholder="Type product name..."
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {option.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        KES {parseFloat(option.price || 0).toFixed(2)}
                      </Typography>
                    </Box>
                  </li>
                )}
              />
              <TextField
                type="number"
                label="Quantity"
                value={currentQuantity}
                onChange={(e) => setCurrentQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                inputProps={{ min: 1 }}
                sx={{ width: 120 }}
              />
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleAddToCart}
                sx={{
                  backgroundColor: colors.accentText,
                  color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                  '&:hover': { backgroundColor: '#00C4A3' }
                }}
              >
                Add
              </Button>
            </Box>
          </Box>

          {/* Cart */}
          {cartItems.length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2, color: colors.accentText }}>
                <ShoppingCart sx={{ mr: 1, verticalAlign: 'middle' }} />
                Cart ({cartItems.length} items)
              </Typography>
              <Paper sx={{ p: 2, backgroundColor: colors.background }}>
                {cartItems.map((item, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      py: 1,
                      borderBottom: index < cartItems.length - 1 ? `1px solid ${colors.border}` : 'none'
                    }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {item.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.quantity} x KES {parseFloat(item.price).toFixed(2)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        KES {(item.price * item.quantity).toFixed(2)}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveFromCart(index)}
                        sx={{ color: '#FF3366' }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                ))}
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Total:
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: colors.accentText }}>
                    KES {calculateTotal().toFixed(2)}
                  </Typography>
                </Box>
              </Paper>
            </Box>
          )}

          <Divider />

          {/* Payment Status */}
          <FormControl fullWidth>
            <InputLabel>Payment Status *</InputLabel>
            <Select
              value={paymentStatus}
              label="Payment Status *"
              onChange={(e) => {
                setPaymentStatus(e.target.value);
                if (e.target.value !== 'paid') {
                  setPaymentMethod('');
                  setTransactionCode('');
                }
              }}
            >
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="paid">Paid</MenuItem>
              <MenuItem value="unpaid">Unpaid</MenuItem>
            </Select>
          </FormControl>

          {/* Payment Method (if Paid) */}
          {paymentStatus === 'paid' && (
            <>
              <FormControl fullWidth>
                <InputLabel>Payment Method *</InputLabel>
                <Select
                  value={paymentMethod}
                  label="Payment Method *"
                  onChange={(e) => {
                    setPaymentMethod(e.target.value);
                    if (e.target.value !== 'mobile_money') {
                      setTransactionCode('');
                    }
                  }}
                >
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="mobile_money">Mobile Money</MenuItem>
                  <MenuItem value="card">Card</MenuItem>
                </Select>
              </FormControl>

              {/* Transaction Code (if Mobile Money) */}
              {paymentMethod === 'mobile_money' && (
                <TextField
                  fullWidth
                  label="Transaction Code *"
                  value={transactionCode}
                  onChange={(e) => setTransactionCode(e.target.value)}
                  placeholder="Enter M-Pesa transaction code"
                />
              )}
            </>
          )}

          {/* Delivery Status */}
          <FormControl fullWidth>
            <InputLabel>Delivery Status *</InputLabel>
            <Select
              value={deliveryStatus}
              label="Delivery Status *"
              onChange={(e) => {
                setDeliveryStatus(e.target.value);
                if (e.target.value !== 'delivered') {
                  setSelectedDriver('');
                }
              }}
            >
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="confirmed">Confirmed</MenuItem>
              <MenuItem value="preparing">Preparing</MenuItem>
              <MenuItem value="out_for_delivery">Out for Delivery</MenuItem>
              <MenuItem value="delivered">Delivered</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
            </Select>
          </FormControl>

          {/* Driver Selection (if Delivered) */}
          {deliveryStatus === 'delivered' && (
            <FormControl fullWidth>
              <InputLabel>Driver *</InputLabel>
              <Select
                value={selectedDriver}
                label="Driver *"
                onChange={(e) => setSelectedDriver(e.target.value)}
              >
                {drivers.map((driver) => (
                  <MenuItem key={driver.id} value={driver.id}>
                    {driver.name} - {driver.phoneNumber}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={handleClose}
          disabled={loading}
          sx={{ color: colors.textSecondary }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          sx={{
            backgroundColor: colors.accentText,
            color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
            '&:hover': { backgroundColor: '#00C4A3' },
            '&.Mui-disabled': {
              backgroundColor: colors.textSecondary
            }
          }}
        >
          {loading ? <CircularProgress size={20} /> : 'Create Order'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NewOrderDialog;

