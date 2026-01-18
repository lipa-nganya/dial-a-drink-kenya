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
  Divider,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import {
  Add,
  Delete,
  ShoppingCart,
  Remove
} from '@mui/icons-material';
import { api } from '../services/api';
import AddressAutocomplete from './AddressAutocomplete';
import { useTheme } from '../contexts/ThemeContext';

const NewOrderDialog = ({ open, onClose, onOrderCreated, mobileSize = false, initialIsStop = false }) => {
  const { isDarkMode, colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [productSuggestions, setProductSuggestions] = useState([]);
  
  // Form state
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [currentQuantity, setCurrentQuantity] = useState(1);
  const [currentPrice, setCurrentPrice] = useState('');
  const [priceChangeDialog, setPriceChangeDialog] = useState({ open: false, itemIndex: null, newPrice: '', oldPrice: '', drinkId: null, drinkName: '', originalPrice: '', quantity: null });
  const [paymentMethod, setPaymentMethod] = useState('');
  const [transactionCode, setTransactionCode] = useState('');
  const [mpesaPhoneNumber, setMpesaPhoneNumber] = useState('');
  const [promptingPayment, setPromptingPayment] = useState(false);
  const [paymentCheckoutRequestID, setPaymentCheckoutRequestID] = useState(null);
  const [paymentPollingInterval, setPaymentPollingInterval] = useState(null);
  const [deliveryStatus, setDeliveryStatus] = useState('pending');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [isStop, setIsStop] = useState(initialIsStop);
  const [stopDeductionAmount, setStopDeductionAmount] = useState('100');

  useEffect(() => {
    if (open) {
      fetchCustomers();
      fetchBranches();
      fetchDrivers();
      fetchProducts();
      // Reset isStop based on initialIsStop prop
      setIsStop(initialIsStop);
    }
  }, [open, initialIsStop]);

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

  useEffect(() => {
    // Set current price when product is selected
    if (currentProduct) {
      setCurrentPrice(Math.round(parseFloat(currentProduct.price || 0)).toString());
    } else {
      setCurrentPrice('');
    }
  }, [currentProduct]);

  useEffect(() => {
    // Auto-set delivery status to completed when walk-in is enabled
    if (isWalkIn) {
      setDeliveryStatus('completed');
    }
    // Update delivery location when branch is selected for walk-in
    if (isWalkIn && selectedBranch) {
      const branch = branches.find(b => b.id === parseInt(selectedBranch));
      if (branch) {
        setDeliveryLocation(`${branch.name}, ${branch.address}`);
      }
    }
  }, [isWalkIn, selectedBranch, branches]);

  // Auto-populate M-Pesa phone number when customer is selected
  useEffect(() => {
    if (selectedCustomer?.phone && !isWalkIn && paymentMethod === 'mobile_money' && !mpesaPhoneNumber) {
      setMpesaPhoneNumber(selectedCustomer.phone);
    }
  }, [selectedCustomer, isWalkIn, paymentMethod]);

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/admin/customers');
      setCustomers(response.data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await api.get('/branches?activeOnly=true');
      setBranches(response.data || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
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

    const originalPrice = Math.round(parseFloat(currentProduct.price) || 0);
    const newPrice = currentPrice ? Math.round(parseFloat(currentPrice)) : originalPrice;

    // If price is different from original, show confirmation dialog
    if (newPrice !== originalPrice) {
      setPriceChangeDialog({
        open: true,
        itemIndex: null, // null means we're adding a new item
        newPrice: newPrice,
        oldPrice: originalPrice,
        drinkId: currentProduct.id,
        drinkName: currentProduct.name,
        originalPrice: originalPrice,
        quantity: currentQuantity
      });
    } else {
      // Price is same as original, add directly to cart
      addItemToCart(newPrice, originalPrice);
    }
  };

  const addItemToCart = (price, originalPrice) => {
    const existingItemIndex = cartItems.findIndex(item => item.drinkId === currentProduct.id);
    
    if (existingItemIndex >= 0) {
      // Update quantity if item already exists
      const updated = [...cartItems];
      updated[existingItemIndex].quantity += currentQuantity;
      setCartItems(updated);
    } else {
      // Add new item
      setCartItems([...cartItems, {
        drinkId: currentProduct.id,
        name: currentProduct.name,
        quantity: currentQuantity,
        price: price,
        originalPrice: originalPrice
      }]);
    }

    // Reset form
    setCurrentProduct(null);
    setCurrentQuantity(1);
    setCurrentPrice('');
    setProductSearch('');
    setError('');
  };

  const handlePriceChangeConfirm = async (applyToInventory) => {
    const { itemIndex, newPrice, drinkId, drinkName, originalPrice, quantity } = priceChangeDialog;
    
    try {
      if (applyToInventory) {
        // Update price in inventory - need categoryId which is required
        setLoading(true);
        
        // Try to get categoryId from products list first (more efficient)
        let categoryId = null;
        const productData = products.find(p => p.id === drinkId);
        if (productData) {
          categoryId = productData.categoryId || productData.category?.id;
        }
        
        // If not found in products list, fetch the drink
        if (!categoryId) {
          try {
            const drinkResponse = await api.get(`/drinks/${drinkId}`);
            const drink = drinkResponse.data;
            categoryId = drink.categoryId || drink.category?.id;
          } catch (fetchError) {
            console.error('Error fetching drink details:', fetchError);
            throw new Error('Failed to fetch drink category. Please try again.');
          }
        }
        
        if (!categoryId) {
          throw new Error('Category ID not found for this product.');
        }
        
        await api.put(`/admin/drinks/${drinkId}`, {
          price: newPrice,
          name: drinkName,
          categoryId: categoryId // Include categoryId which is required
        });
        setLoading(false);
      }

      if (itemIndex === null) {
        // Adding new item to cart
        addItemToCart(applyToInventory ? newPrice : newPrice, applyToInventory ? newPrice : originalPrice);
      } else {
        // Updating existing cart item price
        const updated = [...cartItems];
        updated[itemIndex].price = newPrice;
        // If applied to inventory, also update originalPrice
        if (applyToInventory) {
          updated[itemIndex].originalPrice = newPrice;
        }
        setCartItems(updated);
      }

      setPriceChangeDialog({ open: false, itemIndex: null, newPrice: '', oldPrice: '', drinkId: null, drinkName: '', originalPrice: '', quantity: null });
      setError('');
    } catch (error) {
      console.error('Error updating price:', error);
      setError(error.response?.data?.error || 'Failed to update price. Please try again.');
      setLoading(false);
    }
  };

  const handlePriceChangeCancel = () => {
    // Revert to old price when canceling
    const { itemIndex, oldPrice } = priceChangeDialog;
    if (itemIndex !== null && itemIndex !== undefined) {
      const updated = [...cartItems];
      updated[itemIndex].price = oldPrice;
      setCartItems(updated);
    } else {
      // If canceling while adding new item, revert price to original
      if (currentProduct) {
        setCurrentPrice(Math.round(parseFloat(currentProduct.price || 0)).toString());
      }
    }
    setPriceChangeDialog({ open: false, itemIndex: null, newPrice: '', oldPrice: '', drinkId: null, drinkName: '', originalPrice: '', quantity: null });
  };

  const handleRemoveFromCart = (index) => {
    setCartItems(cartItems.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleSubmit = async () => {
    setError('');

    // Validation and auto-create customer if phone number doesn't exist
    let finalCustomer = selectedCustomer;
    if (!isWalkIn && !selectedCustomer) {
      // Check if customerSearch contains a phone number
      const phoneMatch = customerSearch.match(/(\+?\d{9,15})/);
      if (phoneMatch) {
        const phoneNumber = phoneMatch[1];
        try {
          // Try to create customer with phone number
          const createResponse = await api.post('/admin/customers', {
            phone: phoneNumber,
            customerName: 'Online Customer'
          });
          
          if (createResponse.data?.success && createResponse.data?.customer) {
            finalCustomer = createResponse.data.customer;
            // Refresh customers list
            await fetchCustomers();
          } else {
            setError('Please select a customer or enter a valid phone number');
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error('Error creating customer:', error);
          setError('Please select a customer or enter a valid phone number');
          setLoading(false);
          return;
        }
      } else {
        setError('Please select a customer');
        setLoading(false);
        return;
      }
    }

    if (isWalkIn && !selectedBranch) {
      setError('Please select a branch for walk-in order');
      return;
    }

    if (!isWalkIn && (!deliveryLocation || !deliveryLocation.trim())) {
      setError('Please enter a delivery location');
      return;
    }

    if (cartItems.length === 0) {
      setError('Please add at least one item to the cart');
      return;
    }

    if (!paymentMethod) {
      setError('Please select a payment type');
      return;
    }

    // For M-Pesa, allow creating order without transaction code (can prompt later)
    // Transaction code is optional - admin can prompt customer later

    // Only require driver if status is delivered on desktop
    // On mobile, driver can be assigned regardless of status
    const isMobile = window.innerWidth < 600;
    if (deliveryStatus === 'delivered' && !selectedDriver && !isMobile) {
      setError('Please select a driver when delivery status is Delivered');
      return;
    }

    setLoading(true);

    try {
      // Get branch info for walk-in orders
      let finalDeliveryAddress = deliveryLocation;
      let branchId = null;
      
      // For non-walk-in orders, still assign a branch for proper distance calculation
      if (isWalkIn && selectedBranch) {
        const branch = branches.find(b => b.id === parseInt(selectedBranch));
        if (branch) {
          finalDeliveryAddress = `${branch.name}, ${branch.address}`;
          branchId = branch.id;
        } else {
          // Fallback if branch not found
          finalDeliveryAddress = 'In-Store Purchase';
        }
      } else if (!isWalkIn && branches.length > 0) {
        // For non-walk-in orders, use first active branch (usually branch 4) for distance calculation
        const activeBranch = branches.find(b => b.isActive) || branches[0];
        if (activeBranch) {
          branchId = activeBranch.id;
        }
      }
      
      // Ensure deliveryAddress is never empty
      if (!finalDeliveryAddress || !finalDeliveryAddress.trim()) {
        setError('Delivery address is required');
        setLoading(false);
        return;
      }

      const orderData = {
        customerName: isWalkIn ? 'POS' : (finalCustomer.customerName || finalCustomer.name || ''),
        customerPhone: isWalkIn ? 'POS' : (paymentMethod === 'mobile_money' && mpesaPhoneNumber.trim() ? mpesaPhoneNumber.trim() : (finalCustomer.phone || '')),
        customerEmail: isWalkIn ? null : (finalCustomer.email || null),
        deliveryAddress: finalDeliveryAddress,
        items: cartItems.map(item => ({
          drinkId: item.drinkId,
          quantity: item.quantity,
          selectedPrice: item.price
        })),
        paymentType: paymentMethod === 'cash' ? 'pay_now' : (paymentMethod === 'mobile_money' ? 'pay_on_delivery' : (paymentMethod === 'card' ? 'pay_now' : 'pay_on_delivery')),
        paymentMethod: paymentMethod || null,
        paymentStatus: (paymentMethod === 'mobile_money' && !transactionCode.trim()) ? 'unpaid' : (paymentMethod ? 'paid' : 'unpaid'),
        status: deliveryStatus,
        adminOrder: true,
        branchId: branchId,
        driverId: selectedDriver ? parseInt(selectedDriver) : null,
        transactionCode: paymentMethod === 'mobile_money' && transactionCode ? transactionCode.trim() : null,
        isStop: isStop,
        stopDeductionAmount: isStop ? parseFloat(stopDeductionAmount) || 100 : null
      };

      console.log('📦 Order data being sent:', JSON.stringify(orderData, null, 2));
      console.log('💳 Payment Method:', paymentMethod);
      console.log('💳 Payment Type:', orderData.paymentType);

      const response = await api.post('/orders', orderData);

      // Reset form
      handleClose();
      
      // Notify parent
      if (onOrderCreated) {
        onOrderCreated(response.data);
      }
    } catch (error) {
      console.error('Error creating order:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Full error:', JSON.stringify(error.response?.data, null, 2));
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create order. Please try again.';
      console.error('Error message:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setSelectedBranch('');
    setDeliveryLocation('');
    setIsWalkIn(false);
    setCartItems([]);
    setCurrentProduct(null);
    setCurrentQuantity(1);
    setProductSearch('');
    setPaymentMethod('');
    setTransactionCode('');
    setMpesaPhoneNumber('');
    setPromptingPayment(false);
    setPaymentCheckoutRequestID(null);
    if (paymentPollingInterval) {
      clearInterval(paymentPollingInterval);
      setPaymentPollingInterval(null);
    }
    setDeliveryStatus('pending');
    setSelectedDriver('');
    setError('');
    onClose();
  };

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (paymentPollingInterval) {
        clearInterval(paymentPollingInterval);
      }
    };
  }, [paymentPollingInterval]);

  const handlePromptPayment = async () => {
    if (!mpesaPhoneNumber || !mpesaPhoneNumber.trim()) {
      setError('Please enter customer phone number');
      return;
    }

    // Validate phone number format (basic validation)
    const cleanedPhone = mpesaPhoneNumber.replace(/\D/g, '');
    if (cleanedPhone.length < 9) {
      setError('Please enter a valid phone number');
      return;
    }

    // Calculate total amount
    const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    if (totalAmount <= 0) {
      setError('Order total must be greater than 0');
      return;
    }

    setPromptingPayment(true);
    setError('');

    try {
      // First, create the order without transaction code
      let finalDeliveryAddress = deliveryLocation;
      let branchId = null;
      if (isWalkIn && selectedBranch) {
        const branch = branches.find(b => b.id === parseInt(selectedBranch));
        if (branch) {
          finalDeliveryAddress = `${branch.name}, ${branch.address}`;
          branchId = branch.id;
        } else {
          finalDeliveryAddress = 'In-Store Purchase';
        }
      }

      if (!finalDeliveryAddress || !finalDeliveryAddress.trim()) {
        setError('Delivery address is required');
        setPromptingPayment(false);
        return;
      }

      // Get final customer
      let finalCustomer = selectedCustomer;
      if (!isWalkIn && !selectedCustomer) {
        const phoneMatch = customerSearch.match(/(\+?\d{9,15})/);
        if (phoneMatch) {
          const phoneNumber = phoneMatch[1];
          try {
            const createResponse = await api.post('/admin/customers', {
              phone: phoneNumber,
              customerName: 'Online Customer'
            });
            
            if (createResponse.data?.success && createResponse.data?.customer) {
              finalCustomer = createResponse.data.customer;
              await fetchCustomers();
            } else {
              setError('Please select a customer or enter a valid phone number');
              setPromptingPayment(false);
              return;
            }
          } catch (error) {
            console.error('Error creating customer:', error);
            setError('Please select a customer or enter a valid phone number');
            setPromptingPayment(false);
            return;
          }
        } else {
          setError('Please select a customer');
          setPromptingPayment(false);
          return;
        }
      }

      const orderData = {
        customerName: isWalkIn ? 'POS' : (finalCustomer.customerName || finalCustomer.name || ''),
        customerPhone: isWalkIn ? 'POS' : (finalCustomer.phone || mpesaPhoneNumber.trim()),
        customerEmail: isWalkIn ? null : (finalCustomer.email || null),
        deliveryAddress: finalDeliveryAddress,
        items: cartItems.map(item => ({
          drinkId: item.drinkId,
          quantity: item.quantity,
          selectedPrice: item.price
        })),
        paymentType: 'pay_on_delivery', // Set as pay_on_delivery so prompt-payment endpoint accepts it
        paymentMethod: 'mobile_money',
        paymentStatus: 'unpaid',
        status: deliveryStatus,
        adminOrder: true,
        branchId: branchId,
        driverId: selectedDriver ? parseInt(selectedDriver) : null,
        transactionCode: null, // Will be populated after payment
        isStop: isStop,
        stopDeductionAmount: isStop ? parseFloat(stopDeductionAmount) || 100 : null
      };

      // Create order first
      const orderResponse = await api.post('/orders', orderData);
      const orderId = orderResponse.data.id;

      // Update order with M-Pesa phone number if different from customer phone
      if (!isWalkIn && mpesaPhoneNumber.trim() && finalCustomer.phone !== mpesaPhoneNumber.trim()) {
        await api.patch(`/admin/orders/${orderId}`, {
          customerPhone: mpesaPhoneNumber.trim()
        });
      }

      // Now prompt for payment
      const promptResponse = await api.post(`/admin/orders/${orderId}/prompt-payment`);
      
      const checkoutRequestID = promptResponse.data.checkoutRequestID || promptResponse.data.CheckoutRequestID;
      if (promptResponse.data.success || checkoutRequestID) {
        setPaymentCheckoutRequestID(checkoutRequestID);
        
        // Start polling for payment status
        const interval = setInterval(async () => {
          try {
            const statusResponse = await api.get(`/mpesa/poll-transaction/${checkoutRequestID}`);
            
            if (statusResponse.data.success && statusResponse.data.status === 'completed' && statusResponse.data.receiptNumber) {
              // Payment completed!
              setTransactionCode(statusResponse.data.receiptNumber);
              setPromptingPayment(false);
              clearInterval(interval);
              setPaymentPollingInterval(null);
              
              // Update order with transaction code
              await api.patch(`/admin/orders/${orderId}`, {
                transactionCode: statusResponse.data.receiptNumber,
                paymentStatus: 'paid'
              });
              
              // Close dialog and notify parent
              handleClose();
              if (onOrderCreated) {
                onOrderCreated(orderResponse.data);
              }
            } else if (statusResponse.data.status === 'failed' || statusResponse.data.status === 'cancelled') {
              // Payment failed or cancelled
              setError(statusResponse.data.message || 'Payment was cancelled or failed');
              setPromptingPayment(false);
              clearInterval(interval);
              setPaymentPollingInterval(null);
            }
          } catch (pollError) {
            console.error('Error polling payment status:', pollError);
            // Continue polling on error
          }
        }, 3000); // Poll every 3 seconds
        
        setPaymentPollingInterval(interval);
        
        // Stop polling after 5 minutes
        setTimeout(() => {
          if (interval) {
            clearInterval(interval);
            setPaymentPollingInterval(null);
            if (!transactionCode) {
              setError('Payment timeout. Please check payment status manually.');
              setPromptingPayment(false);
            }
          }
        }, 300000); // 5 minutes
      } else {
        setError(promptResponse.data.error || 'Failed to initiate payment request');
        setPromptingPayment(false);
      }
    } catch (error) {
      console.error('Error prompting payment:', error);
      setError(error.response?.data?.error || error.message || 'Failed to prompt customer for payment');
      setPromptingPayment(false);
    }
  };

  const filteredCustomers = customers.filter(customer => {
    if (!customerSearch) return true;
    const search = customerSearch.toLowerCase();
    const name = (customer.customerName || customer.name || '').toLowerCase();
    const phone = (customer.phone || '').toLowerCase();
    return name.includes(search) || phone.includes(search);
  });

  return (
    <>
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth={false}
      fullWidth={false}
      PaperProps={{
        sx: {
          backgroundColor: colors.paper,
          color: colors.textPrimary,
          width: mobileSize ? 'calc(90vw - 28.8px)' : '900px',
          maxWidth: mobileSize ? 'calc(90vw - 28.8px)' : '900px',
          maxHeight: mobileSize ? 'calc(90vh - 28.8px)' : '90vh',
          margin: mobileSize ? '14.4px' : 'auto',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }
      }}
    >
      <DialogTitle sx={{ 
        color: colors.accentText, 
        fontWeight: 700,
        fontSize: mobileSize ? '1.08rem' : '1.2rem',
        padding: mobileSize ? '1.35rem' : '1.5rem'
      }}>
        Create New Order
      </DialogTitle>
      <DialogContent sx={{ 
        overflowY: 'auto',
        maxHeight: mobileSize ? 'calc(90vh - 180px)' : 'calc(90vh - 120px)',
        padding: mobileSize ? 1.8 : 3
      }}>
        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: mobileSize ? 1.8 : 2,
              fontSize: mobileSize ? '0.9rem' : '1rem',
              padding: mobileSize ? '0.9rem' : '1rem'
            }}
          >
            {error}
          </Alert>
        )}

        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: mobileSize ? 2.7 : 3,
          '& .MuiFormControl-root': {
            '& .MuiInputLabel-root': {
              fontSize: mobileSize ? '0.9rem' : '1rem'
            },
            '& .MuiSelect-select, & .MuiInputBase-input': {
              fontSize: mobileSize ? '0.9rem' : '1rem',
              padding: mobileSize ? '13.5px 14px' : '15px 14px'
            }
          },
          '& .MuiMenuItem-root': {
            fontSize: mobileSize ? '0.9rem' : '1rem'
          },
          '& .MuiTypography-root': {
            fontSize: mobileSize ? '0.9em' : '1em'
          },
          '& .MuiButton-root': {
            fontSize: mobileSize ? '0.9rem' : '1rem',
            padding: mobileSize ? '4.5px 18px' : '5px 20px'
          },
          '& .MuiTextField-root': {
            '& .MuiInputLabel-root': {
              fontSize: mobileSize ? '0.9rem' : '1rem'
            },
            '& .MuiInputBase-input': {
              fontSize: mobileSize ? '0.9rem' : '1rem',
              padding: mobileSize ? '13.5px 14px' : '15px 14px'
            }
          }
        }}>
          {/* Walk-in Order Checkbox */}
          <FormControlLabel
            control={
              <Checkbox
                checked={isWalkIn}
                onChange={(e) => {
                  setIsWalkIn(e.target.checked);
                  if (e.target.checked) {
                    setSelectedCustomer(null);
                    setCustomerSearch('');
                    setDeliveryStatus('completed');
                  } else {
                    setSelectedBranch('');
                    setDeliveryLocation('');
                    setDeliveryStatus('pending');
                  }
                }}
                sx={{
                  color: colors.accentText,
                  '&.Mui-checked': {
                    color: colors.accentText
                  }
                }}
              />
            }
            label={
              <Typography sx={{ fontSize: mobileSize ? '0.9rem' : '1rem' }}>
                Walk-in Order
              </Typography>
            }
          />

          {/* Customer Selection - Hidden when walk-in is enabled */}
          {!isWalkIn && (
            <Autocomplete
              value={selectedCustomer}
              onChange={async (event, newValue) => {
                setSelectedCustomer(newValue);
                // When a customer is selected, update the search to show the selected value
                if (newValue) {
                  const name = newValue.customerName || newValue.name || 'Unknown';
                  const phone = newValue.phone || '';
                  setCustomerSearch(phone ? `${name} - ${phone}` : name);
                  
                  // Fetch and autopopulate delivery address from most recent order
                  try {
                    const addressResponse = await api.get(`/admin/customers/${newValue.id}/latest-address`);
                    if (addressResponse.data?.deliveryAddress) {
                      setDeliveryLocation(addressResponse.data.deliveryAddress);
                    }
                  } catch (error) {
                    console.error('Error fetching customer address:', error);
                    // Don't show error to user, just continue without autopopulating
                  }
                } else {
                  setCustomerSearch('');
                  setDeliveryLocation('');
                }
              }}
              inputValue={customerSearch}
              onInputChange={async (event, newInputValue, reason) => {
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
                      setDeliveryLocation('');
                    }
                  }
                  
                } else if (reason === 'clear') {
                  setCustomerSearch('');
                  setSelectedCustomer(null);
                  setDeliveryLocation('');
                } else if (reason === 'reset') {
                  setCustomerSearch('');
                  setSelectedCustomer(null);
                  setDeliveryLocation('');
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
                    sx={{
                      '& .MuiInputLabel-root': {
                        fontSize: mobileSize ? '0.9rem' : '1rem'
                      },
                      '& .MuiInputBase-input': {
                        fontSize: mobileSize ? '0.9rem' : '1rem',
                        padding: mobileSize ? '13.5px 14px' : '15px 14px'
                      }
                    }}
                  />
                );
              }}
              renderOption={(props, option) => (
                <li {...props} key={option.id || option.phone || option.email}>
                  <Box>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 600,
                        fontSize: mobileSize ? '0.9rem' : '0.875rem'
                      }}
                    >
                      {option.customerName || option.name || 'Unknown'}
                    </Typography>
                    {option.phone && (
                      <Typography 
                        variant="caption" 
                        color="text.secondary"
                        sx={{ fontSize: mobileSize ? '0.72rem' : '0.8rem' }}
                      >
                        {option.phone}
                      </Typography>
                    )}
                  </Box>
                </li>
              )}
            />
          )}

          {/* Branch Selection - Only shown when walk-in is enabled */}
          {isWalkIn && (
            <FormControl fullWidth>
              <InputLabel>Branch *</InputLabel>
              <Select
                value={selectedBranch}
                label="Branch *"
                onChange={(e) => setSelectedBranch(e.target.value)}
              >
                {branches.map((branch) => (
                  <MenuItem key={branch.id} value={branch.id}>
                    {branch.name} - {branch.address}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Delivery Location - Only shown when walk-in is disabled */}
          {!isWalkIn && (
            <AddressAutocomplete
              label="Delivery Location *"
              value={deliveryLocation}
              onChange={(e) => setDeliveryLocation(e.target.value)}
              placeholder="Start typing the delivery address..."
            />
          )}

          <Divider />

          {/* Add Items Section */}
          <Box>
            <Typography 
              variant="h6" 
              sx={{ 
                mb: mobileSize ? 1.8 : 2,
                color: colors.accentText,
                fontSize: mobileSize ? '1.08rem' : '1.2rem'
              }}
            >
              Add Items
            </Typography>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              gap: mobileSize ? 1.8 : 2,
              mb: mobileSize ? 1.8 : 2
            }}>
              <Autocomplete
                fullWidth
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
                        KES {Math.round(parseFloat(option.price || 0))}
                      </Typography>
                    </Box>
                  </li>
                )}
              />
              {/* Unit Price Display */}
              {currentProduct && (
                <TextField
                  type="number"
                  label="Unit Price (KES)"
                  value={currentPrice}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Only allow whole numbers
                    if (value === '' || /^\d+$/.test(value)) {
                      setCurrentPrice(value);
                    }
                  }}
                  inputProps={{ min: 0, step: 1 }}
                  fullWidth
                  sx={{
                    mb: mobileSize ? 1.8 : 2,
                    '& .MuiInputLabel-root': {
                      fontSize: mobileSize ? '0.9rem' : '1rem'
                    },
                    '& .MuiInputBase-input': {
                      fontSize: mobileSize ? '0.9rem' : '1rem',
                      padding: mobileSize ? '13.5px 14px' : '15px 14px'
                    }
                  }}
                  helperText={`Original price: KES ${Math.round(parseFloat(currentProduct.price || 0))}`}
                />
              )}
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: 1 
              }}>
                <IconButton
                  onClick={() => setCurrentQuantity(Math.max(1, currentQuantity - 1))}
                  disabled={currentQuantity <= 1}
                  sx={{
                    backgroundColor: colors.accentText,
                    color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                    width: mobileSize ? '36px' : '40px',
                    height: mobileSize ? '36px' : '40px',
                    '&:hover': {
                      backgroundColor: '#00C4A3'
                    },
                    '&:disabled': {
                      backgroundColor: colors.border,
                      color: colors.textSecondary
                    }
                  }}
                >
                  <Remove sx={{ fontSize: mobileSize ? '1.2rem' : '1.5rem' }} />
                </IconButton>
                <TextField
                  type="number"
                  label="Quantity"
                  value={currentQuantity}
                  onChange={(e) => setCurrentQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  inputProps={{ min: 1 }}
                  sx={{ 
                    maxWidth: mobileSize ? '120px' : '150px',
                    '& .MuiInputLabel-root': {
                      fontSize: mobileSize ? '0.9rem' : '1rem'
                    },
                    '& .MuiInputBase-input': {
                      fontSize: mobileSize ? '0.9rem' : '1rem',
                      padding: mobileSize ? '13.5px 14px' : '15px 14px',
                      textAlign: 'center'
                    }
                  }}
                />
                <IconButton
                  onClick={() => setCurrentQuantity(currentQuantity + 1)}
                  sx={{
                    backgroundColor: colors.accentText,
                    color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                    width: mobileSize ? '36px' : '40px',
                    height: mobileSize ? '36px' : '40px',
                    '&:hover': {
                      backgroundColor: '#00C4A3'
                    }
                  }}
                >
                  <Add sx={{ fontSize: mobileSize ? '1.2rem' : '1.5rem' }} />
                </IconButton>
              </Box>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={handleAddToCart}
                fullWidth
                sx={{
                  backgroundColor: colors.accentText,
                  color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                  fontSize: mobileSize ? '0.9rem' : '1rem',
                  padding: mobileSize ? '4.5px 18px' : '5px 20px',
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
              <Typography 
                variant="h6" 
                sx={{ 
                  mb: mobileSize ? 1.8 : 2,
                  color: colors.accentText,
                  fontSize: mobileSize ? '1.08rem' : '1.2rem'
                }}
              >
                <ShoppingCart sx={{ 
                  mr: mobileSize ? 0.9 : 1,
                  verticalAlign: 'middle',
                  fontSize: mobileSize ? '1.8rem' : '2rem'
                }} />
                Cart ({cartItems.length} items)
              </Typography>
              <Paper sx={{ 
                p: mobileSize ? 1.8 : 2,
                backgroundColor: colors.background 
              }}>
                {cartItems.map((item, index) => (
                  <Box
                    key={index}
                    sx={{
                      py: 1,
                      borderBottom: index < cartItems.length - 1 ? `1px solid ${colors.border}` : 'none'
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {item.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Quantity: {item.quantity}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        KES {Math.round(parseFloat(item.price || 0) * item.quantity)}
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
                    <Typography variant="body2" sx={{ color: colors.textSecondary, mt: 0.5 }}>
                      Unit Price: KES {Math.round(parseFloat(item.price || 0))}
                      {Math.round(parseFloat(item.price || 0)) !== Math.round(parseFloat(item.originalPrice || 0)) && (
                        <span style={{ color: colors.accentText, marginLeft: 8 }}>
                          (Original: KES {Math.round(parseFloat(item.originalPrice || 0))})
                        </span>
                      )}
                    </Typography>
                  </Box>
                ))}
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Total:
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: colors.accentText }}>
                    KES {Math.round(calculateTotal())}
                  </Typography>
                </Box>
              </Paper>
            </Box>
          )}

          <Divider />

          {/* Payment Type */}
          <FormControl fullWidth>
            <InputLabel>Payment Type *</InputLabel>
            <Select
              value={paymentMethod}
              label="Payment Type *"
              onChange={(e) => {
                setPaymentMethod(e.target.value);
                if (e.target.value !== 'mobile_money') {
                  setTransactionCode('');
                }
              }}
            >
              <MenuItem value="cash">Cash</MenuItem>
              <MenuItem value="mobile_money">Mpesa</MenuItem>
              <MenuItem value="card">Card</MenuItem>
            </Select>
          </FormControl>

          {/* M-Pesa Payment Section */}
          {paymentMethod === 'mobile_money' && (
            <Box>
              <TextField
                fullWidth
                label="Customer Phone Number *"
                value={mpesaPhoneNumber || (selectedCustomer?.phone && !isWalkIn ? selectedCustomer.phone : '')}
                onChange={(e) => setMpesaPhoneNumber(e.target.value)}
                placeholder="e.g., 0712345678 or 254712345678"
                sx={{ mb: 2 }}
                helperText={selectedCustomer?.phone && !isWalkIn ? "Customer phone number (can be edited)" : "Enter customer's M-Pesa registered phone number"}
              />
              <Button
                fullWidth
                variant="contained"
                onClick={handlePromptPayment}
                disabled={promptingPayment || !mpesaPhoneNumber.trim() || cartItems.length === 0}
                sx={{
                  backgroundColor: colors.accentText,
                  color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                  mb: 2,
                  '&:hover': {
                    backgroundColor: '#00C4A3'
                  },
                  '&:disabled': {
                    backgroundColor: colors.border,
                    color: colors.textSecondary
                  }
                }}
              >
                {promptingPayment ? 'Prompting Customer...' : 'Prompt Customer for Payment'}
              </Button>
              {promptingPayment && (
                <Box sx={{ mb: 2, p: 2, backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 0, 0, 0.05)', borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>
                    Waiting for customer to complete payment...
                  </Typography>
                  <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                    Customer should receive an M-Pesa prompt on their phone. Transaction code will be populated automatically when payment is completed.
                  </Typography>
                </Box>
              )}
              {transactionCode && (
                <TextField
                  fullWidth
                  label="Transaction Code"
                  value={transactionCode}
                  disabled
                  sx={{
                    mb: 2,
                    '& .MuiInputBase-input': {
                      color: colors.accentText,
                      fontWeight: 600
                    }
                  }}
                  helperText="Payment received! Transaction code populated automatically."
                />
              )}
              <TextField
                fullWidth
                label="Transaction Code (Manual Entry)"
                value={transactionCode}
                onChange={(e) => setTransactionCode(e.target.value)}
                placeholder="Or enter transaction code manually"
                sx={{ mb: 2 }}
                helperText="You can also enter transaction code manually if payment was completed outside this flow"
              />
            </Box>
          )}

          {/* Stop Checkbox */}
          <FormControlLabel
            control={
              <Checkbox
                checked={isStop}
                onChange={(e) => {
                  setIsStop(e.target.checked);
                  if (!e.target.checked) {
                    setStopDeductionAmount('100');
                  }
                }}
                sx={{
                  color: colors.accentText,
                  '&.Mui-checked': {
                    color: colors.accentText
                  }
                }}
              />
            }
            label="This is a stop (deducts from driver savings)"
            sx={{ color: colors.textPrimary }}
          />

          {/* Stop Deduction Amount - Only shown when stop is enabled */}
          {isStop && (
            <TextField
              fullWidth
              label="Stop Deduction Amount (KES)"
              type="number"
              value={stopDeductionAmount}
              onChange={(e) => setStopDeductionAmount(e.target.value)}
              inputProps={{ min: 0, step: 0.01 }}
              helperText="Amount to deduct from driver savings upon successful delivery completion"
            />
          )}

          {/* Driver Selection - Always visible on mobile */}
          <FormControl 
            fullWidth
            sx={{
              display: { xs: 'block', sm: 'none' }, // Only show on mobile
              width: '100%' // Ensure full width like Payment Status
            }}
          >
            <InputLabel>Assign Driver</InputLabel>
            <Select
              value={selectedDriver}
              label="Assign Driver"
              sx={{
                width: '100%' // Match Payment Status width
              }}
              onChange={(e) => setSelectedDriver(e.target.value)}
            >
              <MenuItem value="">None</MenuItem>
              {drivers.map((driver) => (
                <MenuItem key={driver.id} value={driver.id}>
                  {driver.name} - {driver.phoneNumber}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Delivery Status */}
          <FormControl fullWidth>
            <InputLabel>Delivery Status *</InputLabel>
            <Select
              value={deliveryStatus}
              label="Delivery Status *"
              onChange={(e) => {
                setDeliveryStatus(e.target.value);
                // Only clear driver on desktop when status is not delivered
                if (e.target.value !== 'delivered') {
                  // Don't clear driver on mobile - allow assignment regardless of status
                  const isMobile = window.innerWidth < 600;
                  if (!isMobile) {
                    setSelectedDriver('');
                  }
                }
              }}
              disabled={isWalkIn}
            >
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="confirmed">Confirmed</MenuItem>
              <MenuItem value="out_for_delivery">Out for Delivery</MenuItem>
              <MenuItem value="delivered">Delivered</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
            </Select>
          </FormControl>

          {/* Driver Selection (only if delivered) - Desktop only */}
          {deliveryStatus === 'delivered' && (
            <FormControl 
              fullWidth
              sx={{
                display: { xs: 'none', sm: 'block' } // Only show on desktop
              }}
            >
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

    {/* Price Change Confirmation Dialog */}
    <Dialog
      open={priceChangeDialog.open}
      onClose={handlePriceChangeCancel}
      PaperProps={{
        sx: {
          backgroundColor: colors.paper,
          color: colors.textPrimary
        }
      }}
    >
      <DialogTitle>Update Price</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          You're changing the price for <strong>{priceChangeDialog.drinkName}</strong>.
        </Typography>
        <Box sx={{ mb: 2, p: 1.5, backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 0, 0, 0.05)', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Original Price:</strong> KES {Math.round(parseFloat(priceChangeDialog.originalPrice || 0))}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Current Price:</strong> KES {Math.round(parseFloat(priceChangeDialog.oldPrice || 0))}
          </Typography>
          <Typography variant="body2" sx={{ color: colors.accentText, fontWeight: 600 }}>
            <strong>New Price:</strong> KES {Math.round(parseFloat(priceChangeDialog.newPrice || 0))}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ mb: 2, color: colors.textSecondary }}>
          How would you like to apply this price change?
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={handlePriceChangeCancel}
          sx={{ color: colors.textSecondary }}
        >
          Cancel
        </Button>
        <Button
          onClick={() => handlePriceChangeConfirm(false)}
          variant="outlined"
          sx={{
            borderColor: colors.accentText,
            color: colors.accentText,
            '&:hover': {
              borderColor: colors.accent,
              backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 224, 184, 0.05)'
            }
          }}
        >
          One-Time Only
        </Button>
        <Button
          onClick={() => handlePriceChangeConfirm(true)}
          variant="contained"
          sx={{
            backgroundColor: colors.accentText,
            color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
            '&:hover': {
              backgroundColor: colors.accent
            }
          }}
        >
          Apply to Inventory
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
};

export default NewOrderDialog;

