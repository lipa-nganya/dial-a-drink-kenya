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
  Checkbox,
  RadioGroup,
  Radio
} from '@mui/material';
import {
  Add,
  Delete,
  ShoppingCart,
  Remove,
  PersonAdd
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
  const [territories, setTerritories] = useState([]);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [productSuggestions, setProductSuggestions] = useState([]);
  
  // Form state
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState(''); // Debounced search query
  const [selectedBranch, setSelectedBranch] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [orderType, setOrderType] = useState('delivery'); // 'delivery' or 'walk-in'
  const [selectedTerritory, setSelectedTerritory] = useState('');
  // Keep isWalkIn for backward compatibility, derived from orderType
  const isWalkIn = orderType === 'walk-in';
  const [cartItems, setCartItems] = useState([]);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [currentQuantity, setCurrentQuantity] = useState(1);
  const [currentPrice, setCurrentPrice] = useState('');
  const [selectedCapacity, setSelectedCapacity] = useState('');
  const [priceChangeDialog, setPriceChangeDialog] = useState({ open: false, itemIndex: null, newPrice: '', oldPrice: '', drinkId: null, drinkName: '', originalPrice: '', quantity: null });
  const [paymentMethod, setPaymentMethod] = useState('');
  const [transactionCode, setTransactionCode] = useState('');
  const [mpesaPhoneNumber, setMpesaPhoneNumber] = useState('');
  const [promptingPayment, setPromptingPayment] = useState(false);
  const [, setPaymentCheckoutRequestID] = useState(null);
  const [paymentPollingInterval, setPaymentPollingInterval] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(null); // { customerName, phoneNumber, transactionCode, orderId }
  const [cardPaymentType, setCardPaymentType] = useState('pesapal'); // 'pesapal' or 'pdq'
  const [pdqDialogOpen, setPdqDialogOpen] = useState(false);
  const [pdqPaymentData, setPdqPaymentData] = useState({
    receiptNumber: '',
    cardLast4: '',
    cardType: '',
    authorizationCode: '',
    amount: ''
  });
  const [processingPdqPayment, setProcessingPdqPayment] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState('pending');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [isStop, setIsStop] = useState(initialIsStop);
  const [stopDeductionAmount, setStopDeductionAmount] = useState('100');
  const [sendSmsToCustomer, setSendSmsToCustomer] = useState(true); // Default to sending SMS
  
  // Create customer dialog state
  const [createCustomerDialogOpen, setCreateCustomerDialogOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  // Debounce customer search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setCustomerSearchQuery(customerSearch);
    }, 500); // 500ms debounce delay

    return () => clearTimeout(timer);
  }, [customerSearch]);

  // Fetch customers when search query changes
  useEffect(() => {
    if (open) {
      fetchCustomers();
      fetchBranches();
      fetchDrivers();
      fetchTerritories();
      fetchProducts();
      // Reset isStop based on initialIsStop prop
      setIsStop(initialIsStop);
      // Reset order type to delivery
      setOrderType('delivery');
    }
  }, [open, initialIsStop, fetchCustomers, fetchBranches, fetchDrivers, fetchTerritories, fetchProducts]);

  // Fetch customers with search query
  useEffect(() => {
    if (open && customerSearchQuery) {
      fetchCustomers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerSearchQuery, open]);

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
    // Set current price and capacity when product is selected
    if (currentProduct) {
      if (Array.isArray(currentProduct.capacityPricing) && currentProduct.capacityPricing.length > 0) {
        const firstPricing = currentProduct.capacityPricing[0];
        const defaultPrice = parseFloat(firstPricing.currentPrice) || parseFloat(firstPricing.originalPrice) || parseFloat(firstPricing.price) || parseFloat(currentProduct.price) || 0;
        setSelectedCapacity((firstPricing.capacity || firstPricing.size || '').trim());
        setCurrentPrice(Math.round(defaultPrice).toString());
      } else {
        setSelectedCapacity('');
        setCurrentPrice(Math.round(parseFloat(currentProduct.price || 0)).toString());
      }
    } else {
      setCurrentPrice('');
      setSelectedCapacity('');
    }
  }, [currentProduct]);

  const handleCapacityChange = (capacity) => {
    setSelectedCapacity(capacity);
    if (currentProduct && Array.isArray(currentProduct.capacityPricing)) {
      const pricing = currentProduct.capacityPricing.find(p => {
        const pCapacity = (p.capacity || p.size || '').trim();
        return pCapacity === capacity;
      });
      if (pricing) {
        const price = parseFloat(pricing.currentPrice) || parseFloat(pricing.originalPrice) || parseFloat(pricing.price) || parseFloat(currentProduct.price) || 0;
        setCurrentPrice(Math.round(price).toString());
      }
    }
  };

  useEffect(() => {
    // Auto-set delivery status: confirmed for walk-in (pending payment), confirmed for regular orders
    if (isWalkIn) {
      setDeliveryStatus('confirmed');
    } else {
      setDeliveryStatus('confirmed');
    }
    // Update delivery location when branch is selected for walk-in
    if (isWalkIn && selectedBranch) {
      const branch = branches.find(b => b.id === parseInt(selectedBranch));
      if (branch) {
        setDeliveryLocation(`${branch.name}, ${branch.address}`);
      }
    }
  }, [orderType, selectedBranch, branches, isWalkIn]);

  // Auto-populate M-Pesa phone number when customer is selected
  useEffect(() => {
    if (selectedCustomer?.phone && !isWalkIn && paymentMethod === 'mobile_money' && !mpesaPhoneNumber) {
      setMpesaPhoneNumber(selectedCustomer.phone);
    }
  }, [selectedCustomer, isWalkIn, paymentMethod, mpesaPhoneNumber]);

  const fetchCustomers = async () => {
    try {
      const params = {};
      // Add search query if provided
      if (customerSearchQuery && customerSearchQuery.trim() !== '') {
        params.search = customerSearchQuery.trim();
      }
      
      const response = await api.get('/admin/customers', { params });
      // Ensure we always set an array
      const customersData = response.data;
      if (Array.isArray(customersData)) {
        setCustomers(customersData);
      } else if (customersData && Array.isArray(customersData.customers)) {
        setCustomers(customersData.customers);
      } else if (customersData && customersData.data && Array.isArray(customersData.data)) {
        setCustomers(customersData.data);
      } else {
        setCustomers([]);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      setCustomers([]);
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
      // Ensure response.data is an array
      const driversData = response.data;
      if (Array.isArray(driversData)) {
        setDrivers(driversData);
      } else if (driversData && Array.isArray(driversData.data)) {
        // Handle wrapped response format
        setDrivers(driversData.data);
      } else {
        console.warn('Drivers response is not an array:', driversData);
        setDrivers([]);
      }
    } catch (error) {
      console.error('Error fetching drivers:', error);
      setDrivers([]);
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
    const { itemIndex, newPrice, drinkId, drinkName, originalPrice } = priceChangeDialog;
    
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

    if (!isWalkIn && !selectedTerritory) {
      setError('Please select a territory for delivery orders');
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

      // Find "1Default" territory for walk-in orders
      let defaultTerritoryId = null;
      if (isWalkIn) {
        const defaultTerritory = territories.find(t => t.name === '1Default' || t.name === '1 Default');
        if (defaultTerritory) {
          defaultTerritoryId = defaultTerritory.id;
        }
      }

      const orderData = {
        customerName: isWalkIn ? 'POS' : (finalCustomer.customerName || finalCustomer.name || ''),
        customerPhone: isWalkIn ? null : (paymentMethod === 'mobile_money' && mpesaPhoneNumber.trim() ? mpesaPhoneNumber.trim() : (finalCustomer.phone || null)),
        customerEmail: isWalkIn ? null : (finalCustomer.email || null),
        deliveryAddress: finalDeliveryAddress,
        items: cartItems.map(item => ({
          drinkId: item.drinkId,
          quantity: item.quantity,
          selectedPrice: item.price
        })),
        paymentType: paymentMethod === 'cash' ? 'pay_now' : (paymentMethod === 'pay_on_delivery' ? 'pay_on_delivery' : (paymentMethod === 'mobile_money' ? 'pay_on_delivery' : (paymentMethod === 'card' ? 'pay_now' : 'pay_on_delivery'))),
        paymentMethod: paymentMethod || null,
        paymentStatus: isWalkIn 
          ? ((paymentMethod === 'cash' || paymentMethod === 'card') ? 'paid' : 'unpaid')
          : ((paymentMethod === 'mobile_money' && !transactionCode.trim()) ? 'unpaid' : (paymentMethod === 'pay_on_delivery' ? 'unpaid' : (paymentMethod ? 'paid' : 'unpaid'))),
        status: isWalkIn 
          ? ((paymentMethod === 'cash' || paymentMethod === 'card') ? 'completed' : 'in_progress') // Walk-in: 'completed' if paid, 'in_progress' if unpaid
          : deliveryStatus,
        adminOrder: true,
        branchId: branchId,
        driverId: selectedDriver ? parseInt(selectedDriver) : null,
        territoryId: isWalkIn ? defaultTerritoryId : (selectedTerritory ? parseInt(selectedTerritory) : null),
        transactionCode: paymentMethod === 'mobile_money' && transactionCode ? transactionCode.trim() : null,
        isStop: isStop,
        stopDeductionAmount: isStop ? parseFloat(stopDeductionAmount) || 100 : null,
        sendSmsToCustomer: sendSmsToCustomer
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
    setOrderType('delivery');
    setCartItems([]);
    setCurrentProduct(null);
    setCurrentQuantity(1);
    setProductSearch('');
    setPaymentMethod('');
    setTransactionCode('');
    setMpesaPhoneNumber('');
    setPromptingPayment(false);
    setPaymentCheckoutRequestID(null);
    setPaymentSuccess(null);
    if (paymentPollingInterval) {
      clearInterval(paymentPollingInterval);
      setPaymentPollingInterval(null);
    }
    setDeliveryStatus('confirmed');
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
    setPaymentSuccess(null);

    try {
      // First, create the order without transaction code (pending payment)
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

      // For walk-in orders, always use 'POS' as customer name
      const customerNameForOrder = isWalkIn 
        ? 'POS'
        : (finalCustomer?.customerName || finalCustomer?.name || '');
      
      const customerPhoneForOrder = isWalkIn 
        ? null
        : (finalCustomer?.phone || mpesaPhoneNumber.trim() || null);

      const orderData = {
        customerName: customerNameForOrder,
        customerPhone: customerPhoneForOrder,
        customerEmail: isWalkIn ? null : (finalCustomer?.email || null),
        deliveryAddress: finalDeliveryAddress,
        items: cartItems.map(item => ({
          drinkId: item.drinkId,
          quantity: item.quantity,
          selectedPrice: item.price
        })),
        paymentType: 'pay_on_delivery', // Set as pay_on_delivery so prompt-payment endpoint accepts it
        paymentMethod: 'mobile_money',
        paymentStatus: 'unpaid',
        status: isWalkIn ? 'in_progress' : deliveryStatus, // Walk-in orders: 'in_progress' if unpaid, will be 'completed' when paid
        adminOrder: true,
        branchId: branchId,
        driverId: selectedDriver ? parseInt(selectedDriver) : null,
        transactionCode: null, // Will be populated after payment
        isStop: isStop,
        stopDeductionAmount: isStop ? parseFloat(stopDeductionAmount) || 100 : null,
        sendSmsToCustomer: sendSmsToCustomer
      };

      // Create order first (pending payment)
      const orderResponse = await api.post('/orders', orderData);
      const orderId = orderResponse.data.id;

      // Now prompt for payment
      // For walk-in orders, send customerPhone in request body if provided
      const promptPayload = !isWalkIn && mpesaPhoneNumber.trim() 
        ? { customerPhone: mpesaPhoneNumber.trim() }
        : {};
      const promptResponse = await api.post(`/admin/orders/${orderId}/prompt-payment`, promptPayload);
      
      const checkoutRequestID = promptResponse.data.checkoutRequestID || promptResponse.data.CheckoutRequestID;
      if (promptResponse.data.success || checkoutRequestID) {
        setPaymentCheckoutRequestID(checkoutRequestID);
        
        // Start polling for payment status
        const interval = setInterval(async () => {
          try {
            // Poll transaction status, order status, and transaction status by order ID for redundancy
            const [statusResponse, orderResponse, transactionStatusResponse] = await Promise.all([
              api.get(`/mpesa/poll-transaction/${checkoutRequestID}`).catch((err) => {
                console.log('Transaction poll error:', err);
                return { data: {} };
              }),
              api.get(`/orders/${orderId}`).catch((err) => {
                console.log('Order poll error:', err);
                return { data: {} };
              }),
              api.get(`/mpesa/transaction-status/${orderId}`).catch((err) => {
                console.log('Transaction status by order error:', err);
                return { data: {} };
              })
            ]);
            
            // Log responses for debugging
            const order = orderResponse.data;
            console.log('🔍 Polling payment status:', {
              checkoutRequestID,
              orderId,
              transactionStatus: statusResponse.data?.status,
              transactionSuccess: statusResponse.data?.success,
              transactionReceipt: statusResponse.data?.receiptNumber,
              orderPaymentStatus: order?.paymentStatus,
              orderTransactionCode: order?.transactionCode,
              orderStatus: order?.status,
              fullOrderData: JSON.stringify(order, null, 2)
            });
            
            // Check if payment completed via transaction status
            const receiptFromTransaction = statusResponse.data?.receiptNumber;
            const isTransactionCompleted = statusResponse.data?.success && 
                                          statusResponse.data?.status === 'completed' && 
                                          receiptFromTransaction;
            
            // Check if payment completed via order status (callback might have updated it)
            // Check multiple possible field names for paymentStatus
            const orderPaymentStatus = order?.paymentStatus || order?.payment_status;
            const orderTransactionCode = order?.transactionCode || order?.transaction_code;
            const isOrderPaid = orderPaymentStatus === 'paid' && orderTransactionCode;
            const receiptFromOrder = orderTransactionCode;
            
            // Also check if order has paymentStatus 'paid' even without transactionCode (callback might have updated it)
            const isOrderPaidWithoutCode = orderPaymentStatus === 'paid';
            
            // Also check if order status is 'completed' which indicates payment was successful
            const isOrderCompleted = order?.status === 'completed' && orderPaymentStatus === 'paid';
            
            // Check transaction status by order ID (more reliable)
            const transactionStatus = transactionStatusResponse.data;
            const isTransactionStatusPaid = transactionStatus?.status === 'completed' && transactionStatus?.receiptNumber;
            const receiptFromTransactionStatus = transactionStatus?.receiptNumber;
            
            console.log('🔍 Payment detection:', {
              isTransactionCompleted,
              isOrderPaid,
              isOrderPaidWithoutCode,
              isOrderCompleted,
              isTransactionStatusPaid,
              orderPaymentStatus,
              orderTransactionCode,
              orderStatus: order?.status,
              transactionStatusData: transactionStatus
            });
            
            // Payment is completed if any method confirms it
            if (isTransactionCompleted || isOrderPaid || isOrderPaidWithoutCode || isOrderCompleted || isTransactionStatusPaid) {
              // Payment completed!
              const receiptNumber = receiptFromTransaction || receiptFromTransactionStatus || receiptFromOrder || 'Pending';
              console.log('✅ Payment confirmed! Receipt:', receiptNumber, {
                isTransactionCompleted,
                isOrderPaid,
                isOrderPaidWithoutCode
              });
              
              setTransactionCode(receiptNumber);
              setPromptingPayment(false);
              clearInterval(interval);
              setPaymentPollingInterval(null);
              
              // Update order with transaction code and mark as paid (if not already done)
              if (!isOrderPaid && receiptNumber !== 'Pending') {
                try {
                  await api.patch(`/admin/orders/${orderId}`, {
                    transactionCode: receiptNumber,
                    paymentStatus: 'paid'
                  });
                } catch (updateError) {
                  console.error('Error updating order:', updateError);
                }
              }
              
              // Get final order data
              let finalOrder = order;
              if (!finalOrder || !finalOrder.customerName) {
                try {
                  const finalOrderResponse = await api.get(`/orders/${orderId}`);
                  finalOrder = finalOrderResponse.data;
                } catch (fetchError) {
                  console.error('Error fetching final order:', fetchError);
                  // Use order data we already have
                }
              }
              
              // Set payment success information to display in modal
              setPaymentSuccess({
                customerName: finalOrder?.customerName || customerNameForOrder || 'POS',
                phoneNumber: finalOrder?.customerPhone || customerPhoneForOrder || mpesaPhoneNumber.trim(),
                transactionCode: receiptNumber,
                orderId: orderId
              });
              
              if (onOrderCreated) {
                onOrderCreated(finalOrder || order);
              }
            } else if (statusResponse.data?.status === 'failed' || statusResponse.data?.status === 'cancelled') {
              // Payment failed or cancelled
              setError(statusResponse.data?.message || 'Payment was cancelled or failed. Order remains unpaid.');
              setPromptingPayment(false);
              clearInterval(interval);
              setPaymentPollingInterval(null);
              // Order remains in database with paymentStatus='unpaid' - admin can retry or manually update
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
            if (!transactionCode && !paymentSuccess) {
              setError('Payment timeout. Order remains unpaid. Please check payment status manually.');
              setPromptingPayment(false);
              // Order remains in database with paymentStatus='unpaid' - admin can check and update manually
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

  const handlePromptCardPayment = async () => {
    // Calculate total amount
    const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    if (totalAmount <= 0) {
      setError('Order total must be greater than 0');
      return;
    }

    setPromptingPayment(true);
    setError('');
    setPaymentSuccess(null);

    try {
      // First, create the order without transaction code (pending payment)
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

      // For walk-in orders, always use 'POS' as customer name
      const customerNameForOrder = isWalkIn 
        ? 'POS'
        : (finalCustomer?.customerName || finalCustomer?.name || '');
      
      const customerPhoneForOrder = isWalkIn 
        ? null
        : (finalCustomer?.phone || null);

      const orderData = {
        customerName: customerNameForOrder,
        customerPhone: customerPhoneForOrder,
        customerEmail: isWalkIn ? null : (finalCustomer?.email || null),
        deliveryAddress: finalDeliveryAddress,
        items: cartItems.map(item => ({
          drinkId: item.drinkId,
          quantity: item.quantity,
          selectedPrice: item.price
        })),
        paymentType: 'pay_now',
        paymentMethod: 'card',
        paymentStatus: 'unpaid',
        status: isWalkIn ? 'in_progress' : deliveryStatus, // Walk-in orders: 'in_progress' if unpaid, will be 'completed' when paid
        adminOrder: true,
        branchId: branchId,
        driverId: selectedDriver ? parseInt(selectedDriver) : null,
        transactionCode: null, // Will be populated after payment
        isStop: isStop,
        stopDeductionAmount: isStop ? parseFloat(stopDeductionAmount) || 100 : null,
        sendSmsToCustomer: sendSmsToCustomer
      };

      // Create order first (pending payment)
      const orderResponse = await api.post('/orders', orderData);
      const orderId = orderResponse.data.id;

      // Get current URL for callbacks
      const currentUrl = window.location.origin;
      const callbackUrl = `${currentUrl}/payment-success?orderId=${orderId}`;
      const cancellationUrl = `${currentUrl}/payment-cancelled?orderId=${orderId}`;

      // Initiate PesaPal payment
      const paymentResponse = await api.post('/pesapal/initiate-payment', {
        orderId: orderId,
        callbackUrl: callbackUrl,
        cancellationUrl: cancellationUrl
      });

      if (paymentResponse.data.success && paymentResponse.data.redirectUrl) {
        // Open payment page in new window/tab
        const paymentWindow = window.open(
          paymentResponse.data.redirectUrl,
          'PesaPalPayment',
          'width=800,height=600,scrollbars=yes,resizable=yes'
        );

        // Poll for payment status
        const interval = setInterval(async () => {
          try {
            // Check if payment window was closed (user might have completed payment)
            if (paymentWindow && paymentWindow.closed) {
              // Check payment status
              const statusResponse = await api.get(`/pesapal/transaction-status/${orderId}`);
              
              if (statusResponse.data.success && statusResponse.data.status === 'completed') {
                // Payment completed
                clearInterval(interval);
                setPaymentPollingInterval(null);
                setPromptingPayment(false);

                // Get final order data
                const finalOrderResponse = await api.get(`/orders/${orderId}`);
                const finalOrder = finalOrderResponse.data;

                setPaymentSuccess({
                  customerName: finalOrder?.customerName || customerNameForOrder || 'POS',
                  phoneNumber: finalOrder?.customerPhone || customerPhoneForOrder || 'N/A',
                  transactionCode: statusResponse.data.receiptNumber || 'PESAPAL-' + orderId,
                  orderId: orderId
                });

                if (onOrderCreated) {
                  onOrderCreated(finalOrder);
                }
              }
            }

            // Also check payment status directly
            const statusResponse = await api.get(`/pesapal/transaction-status/${orderId}`);
            
            if (statusResponse.data.success && statusResponse.data.status === 'completed') {
              // Payment completed
              if (paymentWindow && !paymentWindow.closed) {
                paymentWindow.close();
              }
              clearInterval(interval);
              setPaymentPollingInterval(null);
              setPromptingPayment(false);

              // Get final order data
              const finalOrderResponse = await api.get(`/orders/${orderId}`);
              const finalOrder = finalOrderResponse.data;

              setPaymentSuccess({
                customerName: finalOrder?.customerName || customerNameForOrder || 'POS',
                phoneNumber: finalOrder?.customerPhone || customerPhoneForOrder || 'N/A',
                transactionCode: statusResponse.data.receiptNumber || 'PESAPAL-' + orderId,
                orderId: orderId
              });

              if (onOrderCreated) {
                onOrderCreated(finalOrder);
              }
            }
          } catch (pollError) {
            console.error('Error polling card payment status:', pollError);
            // Continue polling on error
          }
        }, 3000); // Poll every 3 seconds

        setPaymentPollingInterval(interval);

        // Stop polling after 5 minutes
        setTimeout(() => {
          if (interval) {
            clearInterval(interval);
            setPaymentPollingInterval(null);
            if (!paymentSuccess) {
              setError('Payment timeout. Order remains unpaid. Please check payment status manually.');
              setPromptingPayment(false);
            }
          }
        }, 300000); // 5 minutes
      } else {
        setError(paymentResponse.data.error || 'Failed to initiate card payment');
        setPromptingPayment(false);
      }
    } catch (error) {
      console.error('Error initiating card payment:', error);
      setError(error.response?.data?.error || error.message || 'Failed to initiate card payment');
      setPromptingPayment(false);
    }
  };

  // Use customers directly from API (already filtered by backend)
  const filteredCustomers = Array.isArray(customers) ? customers : [];

  // Check if customerSearch looks like a phone number and no customer matches
  const phoneMatch = customerSearch.match(/(\+?\d{9,15})/);
  const isPhoneNumber = phoneMatch && phoneMatch[1].length >= 9;
  const hasNoMatches = filteredCustomers.length === 0 && customerSearch.trim().length > 0;
  const showCreateOption = isPhoneNumber && hasNoMatches && !selectedCustomer;

  const handleCreateCustomer = async () => {
    if (!newCustomerPhone || !newCustomerPhone.trim()) {
      setError('Phone number is required');
      return;
    }

    if (!newCustomerName || !newCustomerName.trim()) {
      setError('Customer name is required');
      return;
    }

    setCreatingCustomer(true);
    setError('');

    try {
      const response = await api.post('/admin/customers', {
        phone: newCustomerPhone.trim(),
        customerName: newCustomerName.trim()
      });

      if (response.data?.success && response.data?.customer) {
        // Add new customer to list
        setCustomers([...(Array.isArray(customers) ? customers : []), response.data.customer]);
        // Select the newly created customer
        setSelectedCustomer(response.data.customer);
        const name = response.data.customer.customerName || response.data.customer.name || 'Unknown';
        const phone = response.data.customer.phone || '';
        setCustomerSearch(phone ? `${name} - ${phone}` : name);
        // Close dialog
        setCreateCustomerDialogOpen(false);
        setNewCustomerName('');
        setNewCustomerPhone('');
        // Fetch delivery address for new customer
        try {
          const addressResponse = await api.get(`/admin/customers/${response.data.customer.id}/latest-address`);
          if (addressResponse.data?.deliveryAddress) {
            setDeliveryLocation(addressResponse.data.deliveryAddress);
          }
        } catch (error) {
          console.error('Error fetching customer address:', error);
        }
      } else {
        setError('Failed to create customer');
      }
    } catch (err) {
      console.error('Error creating customer:', err);
      setError(err.response?.data?.error || 'Failed to create customer');
    } finally {
      setCreatingCustomer(false);
    }
  };

  const handleProcessPdqPayment = async () => {
    if (!pdqPaymentData.receiptNumber || !pdqPaymentData.amount) {
      setError('Please enter receipt number and amount');
      return;
    }

    setProcessingPdqPayment(true);
    setError('');

    try {
      // First, create the order
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
        setProcessingPdqPayment(false);
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
              setProcessingPdqPayment(false);
              return;
            }
          } catch (error) {
            console.error('Error creating customer:', error);
            setError('Please select a customer or enter a valid phone number');
            setProcessingPdqPayment(false);
            return;
          }
        } else {
          setError('Please select a customer');
          setProcessingPdqPayment(false);
          return;
        }
      }

      const customerNameForOrder = isWalkIn 
        ? 'POS'
        : (finalCustomer?.customerName || finalCustomer?.name || '');
      
      const customerPhoneForOrder = isWalkIn 
        ? null
        : (finalCustomer?.phone || null);

      const orderData = {
        customerName: customerNameForOrder,
        customerPhone: customerPhoneForOrder,
        customerEmail: isWalkIn ? null : (finalCustomer?.email || null),
        deliveryAddress: finalDeliveryAddress,
        items: cartItems.map(item => ({
          drinkId: item.drinkId,
          quantity: item.quantity,
          selectedPrice: item.price
        })),
        paymentType: 'pay_now',
        paymentMethod: 'card',
        paymentStatus: 'unpaid', // Will be updated after PDQ payment
        status: isWalkIn ? 'in_progress' : deliveryStatus, // Walk-in orders: 'in_progress' if unpaid, will be 'completed' when paid
        adminOrder: true,
        branchId: branchId,
        driverId: selectedDriver ? parseInt(selectedDriver) : null,
        isStop: isStop,
        stopDeductionAmount: isStop ? parseFloat(stopDeductionAmount) || 100 : null,
        sendSmsToCustomer: sendSmsToCustomer
      };

      // Create order first
      const orderResponse = await api.post('/orders', orderData);
      const orderId = orderResponse.data.id;

      // Process PDQ payment
      const pdqResponse = await api.post('/pdq-payment/process', {
        orderId: orderId,
        amount: pdqPaymentData.amount,
        receiptNumber: pdqPaymentData.receiptNumber,
        cardLast4: pdqPaymentData.cardLast4,
        cardType: pdqPaymentData.cardType,
        authorizationCode: pdqPaymentData.authorizationCode
      });

      if (pdqResponse.data.success) {
        setPaymentSuccess({
          customerName: customerNameForOrder || 'POS',
          phoneNumber: customerPhoneForOrder || 'N/A',
          transactionCode: pdqPaymentData.receiptNumber,
          orderId: orderId
        });
        setPdqDialogOpen(false);
        
        if (onOrderCreated) {
          onOrderCreated(pdqResponse.data.order);
        }
      } else {
        setError(pdqResponse.data.error || 'Failed to process PDQ payment');
      }
    } catch (error) {
      console.error('Error processing PDQ payment:', error);
      setError(error.response?.data?.error || error.message || 'Failed to process PDQ payment');
    } finally {
      setProcessingPdqPayment(false);
    }
  };

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
        POS
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
          {/* Order Type Dropdown */}
          <FormControl fullWidth>
            <InputLabel>Order Type *</InputLabel>
            <Select
              value={orderType}
              label="Order Type *"
              onChange={(e) => {
                const newOrderType = e.target.value;
                setOrderType(newOrderType);
                if (newOrderType === 'walk-in') {
                  setSelectedCustomer(null);
                  setCustomerSearch('');
                  setDeliveryStatus('completed');
                  setSelectedDriver(''); // Clear driver assignment for walk-in orders
                } else {
                  setSelectedBranch('');
                  setDeliveryLocation('');
                  setDeliveryStatus('confirmed');
                }
              }}
            >
              <MenuItem value="delivery">Delivery</MenuItem>
              <MenuItem value="walk-in">Walk-in</MenuItem>
            </Select>
          </FormControl>

          {/* Territory Selection - Only shown for delivery orders */}
          {!isWalkIn && (
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
          )}

          {/* Customer Selection - Hidden when walk-in is enabled */}
          {!isWalkIn && (
            <Autocomplete
              value={selectedCustomer}
              onChange={async (event, newValue) => {
                // Handle create customer option
                if (newValue && newValue.isCreateOption) {
                  setNewCustomerPhone(newValue.phone || customerSearch);
                  setCreateCustomerDialogOpen(true);
                  return;
                }
                
                setSelectedCustomer(newValue);
                // When a customer is selected, update the search to show the selected value
                if (newValue) {
                  const name = newValue.customerName || newValue.name || 'Unknown';
                  const phone = newValue.phone || '';
                  setCustomerSearch(phone ? `${name} - ${phone}` : name);
                  
                  // Always fetch and autopopulate delivery address from most recent order
                  // This will populate the field when a customer is selected
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
              options={showCreateOption ? [{ isCreateOption: true, phone: phoneMatch?.[1] || customerSearch }, ...filteredCustomers] : filteredCustomers}
              getOptionLabel={(option) => {
                if (!option) return '';
                if (option.isCreateOption) {
                  return `Create new customer: ${option.phone}`;
                }
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
              renderOption={(props, option) => {
                if (option.isCreateOption) {
                  return (
                    <li {...props} key="create-customer">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PersonAdd sx={{ color: colors.accentText, fontSize: '1.2rem' }} />
                        <Box>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: 600,
                              fontSize: mobileSize ? '0.9rem' : '0.875rem',
                              color: colors.accentText
                            }}
                          >
                            Create new customer
                          </Typography>
                          <Typography 
                            variant="caption" 
                            color="text.secondary"
                            sx={{ fontSize: mobileSize ? '0.72rem' : '0.8rem' }}
                          >
                            {option.phone}
                          </Typography>
                        </Box>
                      </Box>
                    </li>
                  );
                }
                return (
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
                );
              }}
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
                renderOption={(props, option) => {
                  const stock = option.stock !== undefined && option.stock !== null ? option.stock : 0;
                  const stockColor = stock > 0 ? '#2196F3' : '#F44336';
                  // Get capacities with pricing - only show capacities that have a price
                  const capacitiesWithPricing = [];
                  
                  if (Array.isArray(option.capacityPricing) && option.capacityPricing.length > 0) {
                    option.capacityPricing.forEach(pricing => {
                      if (!pricing || typeof pricing !== 'object') return;
                      
                      const capacity = pricing.capacity;
                      // Backend stores currentPrice and originalPrice - use currentPrice first, fallback to originalPrice
                      // Handle both string and number types
                      const currentPrice = pricing.currentPrice != null ? parseFloat(pricing.currentPrice) : null;
                      const originalPrice = pricing.originalPrice != null ? parseFloat(pricing.originalPrice) : null;
                      const price = (currentPrice != null && !isNaN(currentPrice) && currentPrice > 0) 
                        ? currentPrice 
                        : (originalPrice != null && !isNaN(originalPrice) && originalPrice > 0) 
                          ? originalPrice 
                          : 0;
                      
                      if (capacity && typeof capacity === 'string' && capacity.trim() && price > 0) {
                        capacitiesWithPricing.push({
                          capacity: capacity.trim(),
                          price: price
                        });
                      }
                    });
                  }
                  
                  return (
                    <li key={option.id} {...props}>
                      <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {option.name}
                          </Typography>
                          {capacitiesWithPricing.length > 0 && (
                            <Box sx={{ mt: 0.5 }}>
                              {capacitiesWithPricing.map((cap, idx) => (
                                <Typography 
                                  key={idx} 
                                  variant="caption" 
                                  color="text.secondary" 
                                  sx={{ display: 'block' }}
                                >
                                  {cap.capacity} | {Math.round(cap.price)}
                                </Typography>
                              ))}
                            </Box>
                          )}
                          {capacitiesWithPricing.length === 0 && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              KES {Math.round(parseFloat(option.price || 0))}
                            </Typography>
                          )}
                        </Box>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: stockColor,
                            fontWeight: 600,
                            ml: 2
                          }}
                        >
                          Stock: {stock}
                        </Typography>
                      </Box>
                    </li>
                  );
                }}
              />
              {/* Capacity Selection with Radio Buttons */}
              {currentProduct && Array.isArray(currentProduct.capacityPricing) && currentProduct.capacityPricing.length > 0 && (
                <FormControl component="fieldset" fullWidth sx={{ mb: mobileSize ? 1.8 : 2 }}>
                  <Typography variant="body2" sx={{ mb: 1, color: colors.textPrimary, fontWeight: 600 }}>
                    Select Capacity & Price:
                  </Typography>
                  <RadioGroup
                    value={selectedCapacity}
                    onChange={(e) => handleCapacityChange(e.target.value)}
                    sx={{ gap: 1 }}
                  >
                    {(() => {
                      // Debug: Log the raw capacityPricing data
                      console.log('[NewOrderDialog] Product:', currentProduct.name);
                      console.log('[NewOrderDialog] Raw capacityPricing:', JSON.stringify(currentProduct.capacityPricing, null, 2));
                      console.log('[NewOrderDialog] capacityPricing length:', currentProduct.capacityPricing?.length);
                      
                      // Deduplicate by capacity, keeping the first occurrence, and filter by valid price
                      const seen = new Set();
                      const uniquePricing = currentProduct.capacityPricing
                        .filter((pricing, idx) => {
                          console.log(`[NewOrderDialog] Processing pricing ${idx}:`, JSON.stringify(pricing));
                          
                          if (!pricing || typeof pricing !== 'object') {
                            console.log(`[NewOrderDialog] Pricing ${idx}: Not an object, skipping`);
                            return false;
                          }
                          
                          // Handle both 'capacity' and 'size' field names
                          const capacity = pricing.capacity || pricing.size;
                          if (!capacity || typeof capacity !== 'string' || !capacity.trim()) {
                            console.log(`[NewOrderDialog] Pricing ${idx}: Invalid capacity, skipping`);
                            return false;
                          }
                          
                          // Handle both 'currentPrice'/'originalPrice' and 'price' field names
                          const currentPrice = pricing.currentPrice != null ? parseFloat(pricing.currentPrice) : null;
                          const originalPrice = pricing.originalPrice != null ? parseFloat(pricing.originalPrice) : null;
                          const priceField = pricing.price != null ? parseFloat(pricing.price) : null;
                          const price = (currentPrice != null && !isNaN(currentPrice) && currentPrice > 0) 
                            ? currentPrice 
                            : (originalPrice != null && !isNaN(originalPrice) && originalPrice > 0) 
                              ? originalPrice 
                              : (priceField != null && !isNaN(priceField) && priceField > 0)
                                ? priceField
                                : 0;
                          
                          console.log(`[NewOrderDialog] Pricing ${idx}: capacity="${capacity}", currentPrice=${currentPrice}, originalPrice=${originalPrice}, finalPrice=${price}`);
                          
                          // Only include if price > 0
                          if (price <= 0) {
                            console.log(`[NewOrderDialog] Pricing ${idx}: Price is 0 or invalid, skipping`);
                            return false;
                          }
                          
                          const capacityKey = capacity.trim();
                          if (seen.has(capacityKey)) {
                            console.log(`[NewOrderDialog] Pricing ${idx}: Duplicate capacity "${capacityKey}", skipping`);
                            return false;
                          }
                          seen.add(capacityKey);
                          console.log(`[NewOrderDialog] Pricing ${idx}: INCLUDED`);
                          return true;
                        });
                      
                      // Debug: Log filtered results
                      console.log('[NewOrderDialog] Filtered uniquePricing:', JSON.stringify(uniquePricing, null, 2));
                      console.log('[NewOrderDialog] Final count:', uniquePricing.length);
                      
                      return uniquePricing.map((pricing, index) => {
                        const capacity = (pricing.capacity || pricing.size || '').trim();
                        const price = parseFloat(pricing.currentPrice) || parseFloat(pricing.originalPrice) || parseFloat(pricing.price) || 0;
                        
                        return (
                          <FormControlLabel
                            key={`${currentProduct.id}-${capacity}-${index}`}
                            value={capacity}
                            control={
                              <Radio
                                sx={{
                                  color: colors.textPrimary,
                                  '&.Mui-checked': { color: colors.accentText }
                                }}
                              />
                            }
                            label={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between', width: '100%' }}>
                                <Typography variant="body2" sx={{ color: colors.textPrimary, fontWeight: 'bold' }}>
                                  {capacity}
                                </Typography>
                                <Typography variant="body2" sx={{ color: colors.accentText, fontWeight: 'bold' }}>
                                  KES {Math.round(price)}
                                </Typography>
                              </Box>
                            }
                            sx={{
                              border: `1px solid ${colors.border}`,
                              borderRadius: 1,
                              backgroundColor: selectedCapacity === capacity ? (isDarkMode ? 'rgba(0, 224, 184, 0.2)' : 'rgba(0, 224, 184, 0.1)') : 'transparent',
                              px: 2,
                              py: 0.5,
                              m: 0,
                              width: '100%',
                              '&:hover': {
                                backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 0, 0, 0.04)'
                              },
                              '& .MuiFormControlLabel-label': {
                                width: '100%',
                                marginLeft: '8px'
                              }
                            }}
                          />
                        );
                      });
                    })()}
                  </RadioGroup>
                </FormControl>
              )}
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
                  helperText={Array.isArray(currentProduct.capacityPricing) && currentProduct.capacityPricing.length > 0 
                    ? 'Price updates when you select a capacity above'
                    : `Original price: KES ${Math.round(parseFloat(currentProduct.price || 0))}`}
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
              <MenuItem value="cash">Cash Received</MenuItem>
              <MenuItem value="pay_on_delivery">Pay on Delivery</MenuItem>
              <MenuItem value="mobile_money">Mpesa</MenuItem>
              <MenuItem value="card">Card</MenuItem>
            </Select>
          </FormControl>

          {/* M-Pesa Payment Section - Hidden for walk-in orders */}
          {paymentMethod === 'mobile_money' && !isWalkIn && (
            <Box>
              <TextField
                fullWidth
                label="Customer Phone Number *"
                value={mpesaPhoneNumber || (selectedCustomer?.phone ? selectedCustomer.phone : '')}
                onChange={(e) => setMpesaPhoneNumber(e.target.value)}
                placeholder="e.g., 0712345678 or 254712345678"
                sx={{ mb: 2 }}
                helperText={
                  selectedCustomer?.phone 
                    ? "Customer phone number (can be edited)" 
                    : "Enter customer's M-Pesa registered phone number"
                }
                required
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
              {promptingPayment && !paymentSuccess && (
                <Box sx={{ mb: 2, p: 2, backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 0, 0, 0.05)', borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>
                    Waiting for customer to complete payment...
                  </Typography>
                  <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                    Customer should receive an M-Pesa prompt on their phone. Order will be created after successful payment.
                  </Typography>
                </Box>
              )}
              {paymentSuccess && (
                <Box sx={{ mb: 2, p: 2, backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.15)' : 'rgba(0, 224, 184, 0.1)', borderRadius: 1, border: `2px solid ${colors.accentText}` }}>
                  <Typography variant="h6" sx={{ color: colors.accentText, mb: 2, fontWeight: 700 }}>
                    ✅ Payment Successful!
                  </Typography>
                  <Box sx={{ mb: 1.5 }}>
                    <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                      Customer Name:
                    </Typography>
                    <Typography variant="body1" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                      {paymentSuccess.customerName}
                    </Typography>
                  </Box>
                  <Box sx={{ mb: 1.5 }}>
                    <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                      Phone Number:
                    </Typography>
                    <Typography variant="body1" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                      {paymentSuccess.phoneNumber}
                    </Typography>
                  </Box>
                  <Box sx={{ mb: 1.5 }}>
                    <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                      Transaction Code:
                    </Typography>
                    <Typography variant="body1" sx={{ color: colors.accentText, fontWeight: 700, fontSize: '1.1rem' }}>
                      {paymentSuccess.transactionCode}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                      Order ID:
                    </Typography>
                    <Typography variant="body1" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                      #{paymentSuccess.orderId}
                    </Typography>
                  </Box>
                </Box>
              )}
              {transactionCode && !paymentSuccess && (
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

          {/* Card Payment Section */}
          {paymentMethod === 'card' && (
            <Box>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Card Payment Method</InputLabel>
                <Select
                  value={cardPaymentType}
                  label="Card Payment Method"
                  onChange={(e) => setCardPaymentType(e.target.value)}
                >
                  <MenuItem value="pesapal">PesaPal (Online)</MenuItem>
                  <MenuItem value="pdq">PDQ Machine</MenuItem>
                </Select>
              </FormControl>

              {cardPaymentType === 'pesapal' && (
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handlePromptCardPayment}
                  disabled={promptingPayment || cartItems.length === 0}
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
                  {promptingPayment ? 'Initiating Payment...' : 'Charge Customer via Card (PesaPal)'}
                </Button>
              )}

              {cardPaymentType === 'pdq' && (
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => {
                    const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    setPdqPaymentData(prev => ({ ...prev, amount: Math.round(totalAmount) }));
                    setPdqDialogOpen(true);
                  }}
                  disabled={cartItems.length === 0}
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
                  Process PDQ Payment
                </Button>
              )}
              {promptingPayment && !paymentSuccess && (
                <Box sx={{ mb: 2, p: 2, backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 0, 0, 0.05)', borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1 }}>
                    Redirecting customer to payment page...
                  </Typography>
                  <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                    Customer will be redirected to PesaPal to complete card payment. Order will be created after successful payment.
                  </Typography>
                </Box>
              )}
              {paymentSuccess && (
                <Box sx={{ mb: 2, p: 2, backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.15)' : 'rgba(0, 224, 184, 0.1)', borderRadius: 1, border: `2px solid ${colors.accentText}` }}>
                  <Typography variant="h6" sx={{ color: colors.accentText, mb: 2, fontWeight: 700 }}>
                    ✅ Payment Successful!
                  </Typography>
                  <Box sx={{ mb: 1.5 }}>
                    <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                      Customer Name:
                    </Typography>
                    <Typography variant="body1" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                      {paymentSuccess.customerName}
                    </Typography>
                  </Box>
                  <Box sx={{ mb: 1.5 }}>
                    <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                      Phone Number:
                    </Typography>
                    <Typography variant="body1" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                      {paymentSuccess.phoneNumber}
                    </Typography>
                  </Box>
                  <Box sx={{ mb: 1.5 }}>
                    <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                      Transaction Code:
                    </Typography>
                    <Typography variant="body1" sx={{ color: colors.accentText, fontWeight: 700, fontSize: '1.1rem' }}>
                      {paymentSuccess.transactionCode}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 0.5 }}>
                      Order ID:
                    </Typography>
                    <Typography variant="body1" sx={{ color: colors.textPrimary, fontWeight: 600 }}>
                      #{paymentSuccess.orderId}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {/* Stop Checkbox - Hidden for walk-in orders */}
          {!isWalkIn && (
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
          )}

          {/* Send SMS to Customer Checkbox - Hidden for walk-in orders */}
          {!isWalkIn && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={sendSmsToCustomer}
                  onChange={(e) => setSendSmsToCustomer(e.target.checked)}
                  sx={{
                    color: colors.accentText,
                    '&.Mui-checked': {
                      color: colors.accentText
                    }
                  }}
                />
              }
              label="Send SMS notification to customer"
              sx={{ color: colors.textPrimary }}
            />
          )}

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

          {/* Assign Driver - Always visible for non-walk-in orders */}
          {!isWalkIn && (
            <FormControl fullWidth>
              <InputLabel>Assign Driver</InputLabel>
              <Select
                value={selectedDriver}
                label="Assign Driver"
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
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        {paymentSuccess ? (
          <Button
            onClick={handleClose}
            variant="contained"
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              '&:hover': { backgroundColor: '#00C4A3' }
            }}
          >
            Close
          </Button>
        ) : (
          <>
            <Button
              onClick={handleClose}
              disabled={loading || promptingPayment}
              sx={{ color: colors.textSecondary }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={loading || promptingPayment || (paymentMethod === 'mobile_money' && isWalkIn)}
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
          </>
        )}
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

      {/* PDQ Payment Dialog */}
      <Dialog
        open={pdqDialogOpen}
        onClose={() => !processingPdqPayment && setPdqDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>
          Process PDQ Payment
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: colors.textSecondary }}>
            Enter payment details from the PDQ machine:
          </Typography>
          
          <TextField
            fullWidth
            label="Receipt Number *"
            value={pdqPaymentData.receiptNumber}
            onChange={(e) => setPdqPaymentData(prev => ({ ...prev, receiptNumber: e.target.value }))}
            sx={{ mb: 2 }}
            required
            disabled={processingPdqPayment}
          />

          <TextField
            fullWidth
            label="Amount (KES) *"
            type="number"
            value={pdqPaymentData.amount}
            onChange={(e) => setPdqPaymentData(prev => ({ ...prev, amount: e.target.value }))}
            sx={{ mb: 2 }}
            required
            disabled={processingPdqPayment}
            inputProps={{ step: 0.01, min: 0 }}
          />

          <TextField
            fullWidth
            label="Card Last 4 Digits"
            value={pdqPaymentData.cardLast4}
            onChange={(e) => setPdqPaymentData(prev => ({ ...prev, cardLast4: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
            sx={{ mb: 2 }}
            disabled={processingPdqPayment}
            inputProps={{ maxLength: 4 }}
            helperText="Last 4 digits of the card used"
          />

          <TextField
            fullWidth
            label="Card Type"
            value={pdqPaymentData.cardType}
            onChange={(e) => setPdqPaymentData(prev => ({ ...prev, cardType: e.target.value }))}
            sx={{ mb: 2 }}
            disabled={processingPdqPayment}
            placeholder="e.g., Visa, Mastercard"
          />

          <TextField
            fullWidth
            label="Authorization Code"
            value={pdqPaymentData.authorizationCode}
            onChange={(e) => setPdqPaymentData(prev => ({ ...prev, authorizationCode: e.target.value }))}
            sx={{ mb: 2 }}
            disabled={processingPdqPayment}
            helperText="Authorization code from PDQ machine (optional)"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setPdqDialogOpen(false)}
            disabled={processingPdqPayment}
            sx={{ color: colors.textSecondary }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleProcessPdqPayment}
            variant="contained"
            disabled={processingPdqPayment || !pdqPaymentData.receiptNumber || !pdqPaymentData.amount}
            sx={{
              backgroundColor: colors.accentText,
              color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
              '&:hover': {
                backgroundColor: '#00C4A3'
              }
            }}
          >
            {processingPdqPayment ? 'Processing...' : 'Process Payment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Customer Dialog */}
      <Dialog
        open={createCustomerDialogOpen}
        onClose={() => {
          setCreateCustomerDialogOpen(false);
          setNewCustomerName('');
          setNewCustomerPhone('');
          setError('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Customer</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Phone Number *"
            value={newCustomerPhone}
            onChange={(e) => setNewCustomerPhone(e.target.value)}
            margin="normal"
            placeholder="e.g., 0712345678"
            disabled={creatingCustomer}
          />
          <TextField
            fullWidth
            label="Customer Name *"
            value={newCustomerName}
            onChange={(e) => setNewCustomerName(e.target.value)}
            margin="normal"
            placeholder="Enter customer name"
            disabled={creatingCustomer}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setCreateCustomerDialogOpen(false);
              setNewCustomerName('');
              setNewCustomerPhone('');
              setError('');
            }}
            disabled={creatingCustomer}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateCustomer}
            variant="contained"
            disabled={creatingCustomer || !newCustomerPhone || !newCustomerName}
            sx={{
              backgroundColor: colors.accentText,
              color: '#FFFFFF',
              '&:hover': { backgroundColor: colors.accentText, opacity: 0.9 }
            }}
          >
            {creatingCustomer ? <CircularProgress size={20} /> : 'Create Customer'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default NewOrderDialog;

