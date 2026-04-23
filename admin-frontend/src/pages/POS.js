import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Autocomplete,
  Alert,
  CircularProgress,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormControlLabel,
  RadioGroup,
  Radio
} from '@mui/material';
import {
  Add,
  Delete,
  CheckCircle,
  PersonAdd
} from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const POS = () => {
  const { isDarkMode, colors } = useTheme();
  const [drinks, setDrinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  
  // Account and Customer
  const [accountId, setAccountId] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  
  // Create customer dialog
  const [createCustomerDialogOpen, setCreateCustomerDialogOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  
  // Product entry
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productQty, setProductQty] = useState(1);
  const [productPrice, setProductPrice] = useState('');
  const [selectedCapacity, setSelectedCapacity] = useState('');
  
  // Cart/Items
  const [items, setItems] = useState([]);
  
  // Order processing
  const [processing, setProcessing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchProducts(productSearch);
    }, 250);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productSearch]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchCustomers(customerSearch);
    }, 250);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerSearch]);

  const fetchProducts = async (searchTerm = '') => {
    try {
      setProductsLoading(true);
      const response = await api.get('/pos/drinks', {
        params: {
          search: searchTerm || undefined,
          limit: searchTerm && searchTerm.trim() ? 50 : 30,
          offset: 0
        }
      });

      const drinksData = response.data;
      const drinksArray = Array.isArray(drinksData)
        ? drinksData
        : (drinksData?.products || []);
      setDrinks(drinksArray);
    } catch (err) {
      console.error('Error fetching POS products:', err);
      setError(err.response?.data?.error || 'Failed to load products');
    } finally {
      setProductsLoading(false);
    }
  };

  const fetchCustomers = async (searchTerm = '') => {
    const term = (searchTerm || '').trim();
    if (term.length < 3) {
      setCustomers([]);
      return;
    }

    try {
      setCustomersLoading(true);
      const response = await api.get('/pos/customers/search', {
        params: { q: term }
      });
      const results = Array.isArray(response?.data?.data) ? response.data.data : [];
      setCustomers(results);
    } catch (err) {
      console.error('Error searching POS customers:', err);
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const accountsResponse = await api.get('/admin/accounts').catch(() => ({ data: [] }));
      setAccounts(accountsResponse.data || []);
    } catch (err) {
      console.error('Error fetching POS data:', err);
      setError(err.response?.data?.error || 'Failed to load POS data');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSearch = async (searchValue) => {
    setCustomerSearch(searchValue);
    setCustomerPhone(searchValue || '');
    
    // If search value looks like a phone number and no customer is selected, check if customer exists
    if (searchValue && !selectedCustomer) {
      const phoneMatch = searchValue.match(/(\+?\d{9,15})/);
      if (phoneMatch) {
        const phoneNumber = phoneMatch[1];
        // Check if customer exists
        const existingCustomer = customers.find(c => 
          c.phone === phoneNumber || 
          c.phone === phoneNumber.replace(/^\+/, '') ||
          c.phone === phoneNumber.replace(/^254/, '0') ||
          c.username === phoneNumber
        );
        
        if (!existingCustomer) {
          // Customer doesn't exist - will show create option
          setNewCustomerPhone(phoneNumber);
        }
      }
    }
  };

  const handleCreateCustomer = async () => {
    if (!newCustomerPhone || !newCustomerPhone.trim()) {
      setError('Phone number is required');
      return;
    }

    setCreatingCustomer(true);
    setError(null);

    try {
      const response = await api.post('/admin/customers', {
        phone: newCustomerPhone.trim(),
        customerName: newCustomerName.trim() || undefined
      });

      if (response.data?.success && response.data?.customer) {
        // Add new customer to list
        setCustomers([...customers, response.data.customer]);
        // Select the newly created customer
        setSelectedCustomer(response.data.customer);
        setCustomerPhone(response.data.customer.phone);
        setCustomerSearch(`${response.data.customer.customerName || response.data.customer.name} - ${response.data.customer.phone}`);
        // Close dialog
        setCreateCustomerDialogOpen(false);
        setNewCustomerName('');
        setNewCustomerPhone('');
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

  const openCreateCustomerDialog = () => {
    // Extract phone number from search if available
    const phoneMatch = customerSearch.match(/(\+?\d{9,15})/);
    if (phoneMatch) {
      setNewCustomerPhone(phoneMatch[1]);
    }
    setCreateCustomerDialogOpen(true);
  };

  const handleProductSelect = (product) => {
    if (product) {
      setSelectedProduct(product);
      // Set default capacity and price if capacityPricing exists
      if (Array.isArray(product.capacityPricing) && product.capacityPricing.length > 0) {
        const firstPricing = product.capacityPricing[0];
        const defaultPrice = parseFloat(firstPricing.currentPrice) || parseFloat(firstPricing.originalPrice) || parseFloat(firstPricing.price) || parseFloat(product.price) || 0;
        setSelectedCapacity((firstPricing.capacity || firstPricing.size || '').trim());
        setProductPrice(defaultPrice.toString());
      } else {
        setSelectedCapacity('');
        setProductPrice(product.price || '');
      }
      setProductQty(1);
    } else {
      setSelectedProduct(null);
      setProductPrice('');
      setSelectedCapacity('');
      setProductQty(1);
    }
  };

  const handleCapacityChange = (capacity) => {
    setSelectedCapacity(capacity);
    if (selectedProduct && Array.isArray(selectedProduct.capacityPricing)) {
      const normalizeCapacity = (value) =>
        (value || '')
          .toString()
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '');

      const target = normalizeCapacity(capacity);

      const pricing = selectedProduct.capacityPricing.find((p) => {
        const raw = (p && (p.capacity || p.size)) || '';
        return normalizeCapacity(raw) === target;
      });

      if (pricing) {
        const price =
          parseFloat(pricing.currentPrice) ||
          parseFloat(pricing.originalPrice) ||
          parseFloat(pricing.price) ||
          parseFloat(selectedProduct.price) ||
          0;
        if (!Number.isNaN(price) && price > 0) {
          setProductPrice(price.toString());
        }
      }
    }
  };

  const normalizeCapacityKey = (value) =>
    (value || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');

  const parseStockByCapacity = (value) => {
    if (!value) return null;
    if (typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value !== 'string') return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const capacityUnitMultiplier = (capacityLabel) => {
    const raw = String(capacityLabel || '').trim().toLowerCase();
    if (!raw) return 1;
    const compact = raw.replace(/\s+/g, '');
    const match = compact.match(/^(\d+)(pack|pk).*/);
    const n = match ? parseInt(match[1], 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 1;
  };

  const isCanPackSharedStockProduct = (product) => {
    const values = Array.isArray(product?.capacityPricing)
      ? product.capacityPricing.map((p) => p?.capacity || p?.size).filter(Boolean)
      : [];
    const normalized = values.map((v) => normalizeCapacityKey(v));
    const hasPack = normalized.some((v) => /(^|\b)\d+(pack|pk)\b/.test(v) || v.includes('pack') || v.includes('pk'));
    const hasCan = normalized.some((v) => v.includes('can') || v === 'single');
    return hasPack && hasCan;
  };

  const getCapacityStock = (product, capacity) => {
    const stockByCapacity = parseStockByCapacity(product?.stockByCapacity);

    const exactStock =
      stockByCapacity && stockByCapacity[capacity] != null
        ? stockByCapacity[capacity]
        : null;

    const normalizedCapacity = normalizeCapacityKey(capacity);
    const normalizedMatch = stockByCapacity
      ? Object.entries(stockByCapacity).find(([key]) => normalizeCapacityKey(key) === normalizedCapacity)
      : null;

    let capStock =
      exactStock != null
        ? exactStock
        : (normalizedMatch ? normalizedMatch[1] : (product?.stock ?? 0));

    if (
      stockByCapacity &&
      stockByCapacity[capacity] == null &&
      isCanPackSharedStockProduct(product)
    ) {
      const multiplier = capacityUnitMultiplier(capacity);
      const totalStock = Number(product?.stock ?? 0) || 0;
      capStock = multiplier > 1 ? Math.floor(totalStock / multiplier) : totalStock;
    }

    const parsed = Number(capStock);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const handleAddItem = () => {
    if (!selectedProduct) {
      setError('Please select a product');
      return;
    }

    const qty = parseInt(productQty) || 1;
    const price = parseFloat(productPrice) || parseFloat(selectedProduct.price) || 0;
    
    if (qty <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    if (price <= 0) {
      setError('Price must be greater than 0');
      return;
    }

    const selectedCapacityValue = selectedCapacity && String(selectedCapacity).trim() !== ''
      ? String(selectedCapacity).trim()
      : null;

    // Check if same product + same capacity already exists in cart
    const existingIndex = items.findIndex(item =>
      item.drinkId === selectedProduct.id &&
      ((item.selectedCapacity || null) === selectedCapacityValue)
    );
    
    if (existingIndex >= 0) {
      // Update existing item
      const updatedItems = [...items];
      updatedItems[existingIndex].quantity += qty;
      updatedItems[existingIndex].price = price; // Update price
      updatedItems[existingIndex].subTotal = updatedItems[existingIndex].quantity * price;
      setItems(updatedItems);
    } else {
      // Add new item
      setItems([...items, {
        drinkId: selectedProduct.id,
        name: selectedProduct.name,
        selectedCapacity: selectedCapacityValue,
        quantity: qty,
        price: price,
        subTotal: qty * price
      }]);
    }

    // Reset product entry
    setSelectedProduct(null);
    setProductSearch('');
    setProductPrice('');
    setProductQty(1);
    setError(null);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateQuantity = (index, newQty) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    
    const updatedItems = [...items];
    updatedItems[index].quantity = newQty;
    updatedItems[index].subTotal = updatedItems[index].quantity * updatedItems[index].price;
    setItems(updatedItems);
  };

  const getTotal = () => {
    return items.reduce((sum, item) => sum + item.subTotal, 0);
  };

  const handlePostOfficeSale = async () => {
    if (items.length === 0) {
      setError('Please add at least one item');
      return;
    }

    setProcessing(true);
    setError(null);
    setOrderSuccess(null);

    try {
      // Determine customer info
      let finalCustomerName = 'POS';
      let finalCustomerPhone = '';
      
      if (selectedCustomer) {
        finalCustomerName = selectedCustomer.customerName || selectedCustomer.name || 'POS';
        finalCustomerPhone = selectedCustomer.phone || '';
      } else if (customerPhone) {
        // Use entered phone number
        finalCustomerPhone = customerPhone.trim();
        finalCustomerName = 'POS Customer';
      }

      // Create order data
      const orderData = {
        customerName: finalCustomerName,
        customerPhone: finalCustomerPhone,
        items: items.map(item => ({
          drinkId: item.drinkId,
          quantity: item.quantity,
          selectedPrice: item.price,
          selectedCapacity: item.selectedCapacity || null
        })),
        notes: `Office POS Sale${accountId ? ` - Account ID: ${accountId}` : ''}`,
        amountPaid: getTotal(),
        branchId: accountId || null
      };

      const response = await api.post('/pos/order/cash', orderData);

      if (response.data.success) {
        setOrderSuccess({
          orderId: response.data.order?.id,
          message: 'Office sale posted successfully!'
        });

        // Clear form
        setItems([]);
        setCustomerPhone('');
        setCustomerSearch('');
        setSelectedCustomer(null);
        setAccountId('');
        setSelectedAccount(null);
        setSelectedProduct(null);
        setProductSearch('');
        setProductPrice('');
        setProductQty(1);
      } else {
        setError(response.data.error || 'Failed to post sale');
      }
    } catch (err) {
      console.error('Error posting office sale:', err);
      setError(err.response?.data?.error || 'Failed to post office sale');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading POS...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 700, color: colors.accentText }}>
        Point of Sale
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {orderSuccess && (
        <Alert 
          severity="success" 
          sx={{ mb: 3 }} 
          onClose={() => setOrderSuccess(null)}
          icon={<CheckCircle />}
        >
          {orderSuccess.message} Order ID: #{orderSuccess.orderId}
        </Alert>
      )}

      {/* Customer and Account Section */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: colors.paper }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Customer Phone</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Account</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <Autocomplete
                      freeSolo
                      options={customers}
                    loading={customersLoading}
                      getOptionLabel={(option) => {
                        if (typeof option === 'string') return option;
                        const name = option.customerName || option.name || 'Unknown';
                        const phone = option.phone || '';
                        return phone ? `${name} - ${phone}` : name;
                      }}
                      value={selectedCustomer}
                      onChange={(event, newValue) => {
                        if (typeof newValue === 'string') {
                          // User typed a phone number
                          setSelectedCustomer(null);
                          setCustomerPhone(newValue);
                          handleCustomerSearch(newValue);
                        } else if (newValue) {
                          // Customer selected
                          setSelectedCustomer(newValue);
                          setCustomerPhone(newValue.phone || '');
                          setCustomerSearch(`${newValue.customerName || newValue.name} - ${newValue.phone}`);
                        } else {
                          // Cleared
                          setSelectedCustomer(null);
                          setCustomerPhone('');
                          setCustomerSearch('');
                        }
                      }}
                      inputValue={customerSearch}
                      onInputChange={(event, newInputValue) => {
                        handleCustomerSearch(newInputValue);
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Enter customer phone number"
                          size="small"
                          fullWidth
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                              '& fieldset': { borderColor: colors.border },
                              '&:hover fieldset': { borderColor: colors.accentText },
                              '&.Mui-focused fieldset': { borderColor: colors.accentText }
                            },
                            '& .MuiInputBase-input': {
                              color: colors.textPrimary
                            },
                            '& .MuiInputLabel-root': {
                              color: colors.textSecondary
                            },
                            '& .MuiInputLabel-root.Mui-focused': {
                              color: colors.accentText
                            }
                          }}
                        />
                      )}
                      sx={{ 
                        flex: 1,
                        '& .MuiAutocomplete-popper': {
                          '& .MuiPaper-root': {
                            backgroundColor: colors.paper,
                            border: `1px solid ${colors.border}`
                          },
                          '& .MuiAutocomplete-option': {
                            color: colors.textPrimary,
                            '&:hover': {
                              backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : 'rgba(0, 0, 0, 0.04)'
                            },
                            '&[aria-selected="true"]': {
                              backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.2)' : 'rgba(0, 224, 184, 0.1)'
                            }
                          }
                        }
                      }}
                    />
                    {customerPhone && !selectedCustomer && (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<PersonAdd />}
                        onClick={openCreateCustomerDialog}
                        sx={{
                          borderColor: colors.accentText,
                          color: colors.accentText,
                          '&:hover': {
                            borderColor: colors.accentText,
                            backgroundColor: colors.accentText + '10'
                          }
                        }}
                      >
                        Create
                      </Button>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Autocomplete
                    options={accounts}
                    value={selectedAccount}
                    onChange={(event, newValue) => {
                      setSelectedAccount(newValue);
                      const id = newValue?.id ?? '';
                      setAccountId(id ? String(id) : '');
                    }}
                    getOptionLabel={(option) => {
                      if (!option) return '';
                      const id = option.id != null ? `#${option.id}` : '';
                      const name = option.name || option.accountName || option.title || 'Account';
                      return `${id} ${name}`.trim();
                    }}
                    isOptionEqualToValue={(option, value) => option?.id === value?.id}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder={accounts.length ? 'Select account (optional)' : 'No accounts yet'}
                        helperText={accounts.length ? 'Optional: select an account for the sale' : 'Create an account first, or leave blank'}
                        size="small"
                        fullWidth
                        sx={{
                          minWidth: 220,
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                            '& fieldset': { borderColor: colors.border },
                            '&:hover fieldset': { borderColor: colors.accentText },
                            '&.Mui-focused fieldset': { borderColor: colors.accentText }
                          },
                          '& .MuiInputBase-input': { color: colors.textPrimary },
                          '& .MuiFormHelperText-root': { color: colors.textSecondary }
                        }}
                      />
                    )}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="contained"
                    onClick={handlePostOfficeSale}
                    disabled={processing || items.length === 0 || (!selectedCustomer && !customerPhone)}
                    sx={{
                      backgroundColor: '#4CAF50',
                      color: '#FFFFFF',
                      '&:hover': { backgroundColor: '#45a049' },
                      '&:disabled': { backgroundColor: colors.textSecondary }
                    }}
                  >
                    {processing ? <CircularProgress size={20} /> : 'POST OFFICE SALE'}
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Create Customer Dialog */}
      <Dialog
        open={createCustomerDialogOpen}
        onClose={() => {
          setCreateCustomerDialogOpen(false);
          setNewCustomerName('');
          setNewCustomerPhone('');
          setError(null);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: colors.paper,
            border: `1px solid ${colors.border}`
          }
        }}
      >
        <DialogTitle sx={{ color: colors.accentText, fontWeight: 700 }}>Create New Customer</DialogTitle>
        <DialogContent sx={{ backgroundColor: colors.paper }}>
          <TextField
            fullWidth
            label="Phone Number *"
            value={newCustomerPhone}
            onChange={(e) => setNewCustomerPhone(e.target.value)}
            margin="normal"
            placeholder="e.g., 0712345678"
            disabled={creatingCustomer}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                '& fieldset': { borderColor: colors.border },
                '&:hover fieldset': { borderColor: colors.accentText },
                '&.Mui-focused fieldset': { borderColor: colors.accentText }
              },
              '& .MuiInputBase-input': {
                color: colors.textPrimary
              },
              '& .MuiInputLabel-root': {
                color: colors.textSecondary
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: colors.accentText
              }
            }}
          />
          <TextField
            fullWidth
            label="Customer Name (Optional)"
            value={newCustomerName}
            onChange={(e) => setNewCustomerName(e.target.value)}
            margin="normal"
            placeholder="Enter customer name"
            disabled={creatingCustomer}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                '& fieldset': { borderColor: colors.border },
                '&:hover fieldset': { borderColor: colors.accentText },
                '&.Mui-focused fieldset': { borderColor: colors.accentText }
              },
              '& .MuiInputBase-input': {
                color: colors.textPrimary
              },
              '& .MuiInputLabel-root': {
                color: colors.textSecondary
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: colors.accentText
              }
            }}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
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
              setError(null);
            }}
            disabled={creatingCustomer}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateCustomer}
            variant="contained"
            disabled={creatingCustomer || !newCustomerPhone}
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

      {/* Product Entry Section */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: colors.paper }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Product</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Qty</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Unit Price</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Add or Remove</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>
                  <Autocomplete
                    options={drinks}
                    loading={productsLoading}
                    getOptionLabel={(option) => option.name || ''}
                    isOptionEqualToValue={(option, value) => option?.id === value?.id}
                    value={selectedProduct}
                    onChange={(event, newValue) => handleProductSelect(newValue)}
                    inputValue={productSearch}
                    onInputChange={(event, newInputValue) => {
                      setProductSearch(newInputValue);
                      if (!newInputValue) {
                        setSelectedProduct(null);
                      }
                    }}
                    filterOptions={(options, { inputValue }) => {
                      // Custom filter that handles case-insensitive partial matching
                      // This ensures products with special characters (like hyphens) are found
                      if (!inputValue || inputValue.trim().length === 0) {
                        return options;
                      }
                      const searchTerm = inputValue.toLowerCase().trim();
                      return options.filter(option => {
                        if (!option || !option.name) return false;
                        return option.name.toLowerCase().includes(searchTerm);
                      });
                    }}
                    noOptionsText={productSearch.trim().length < 2 ? 'Type at least 2 letters to search products' : 'No products found'}
                    renderOption={(props, option) => {
                      const { key, ...restProps } = props;

                      // Build capacity-level rows with price and stock (if available)
                      const rows = [];
                      if (Array.isArray(option.capacityPricing) && option.capacityPricing.length > 0) {
                        option.capacityPricing.forEach((pricing) => {
                          if (!pricing || typeof pricing !== 'object') return;

                          const rawCapacity = pricing.capacity || pricing.size;
                          if (!rawCapacity || typeof rawCapacity !== 'string' || !rawCapacity.trim()) return;
                          const capacity = rawCapacity.trim();

                          const currentPrice =
                            pricing.currentPrice != null ? parseFloat(pricing.currentPrice) : null;
                          const originalPrice =
                            pricing.originalPrice != null ? parseFloat(pricing.originalPrice) : null;
                          const priceField =
                            pricing.price != null ? parseFloat(pricing.price) : null;
                          const price =
                            (currentPrice != null && !Number.isNaN(currentPrice) && currentPrice > 0
                              ? currentPrice
                              : originalPrice != null && !Number.isNaN(originalPrice) && originalPrice > 0
                              ? originalPrice
                              : priceField != null && !Number.isNaN(priceField) && priceField > 0
                              ? priceField
                              : 0);

                          if (price <= 0) return;

                          const capStock = getCapacityStock(option, capacity);

                          rows.push({
                            capacity,
                            price,
                            stock: capStock,
                            outOfStock: capStock <= 0
                          });
                        });
                      }

                      return (
                        <li key={option.id} {...restProps}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {option.name}
                            </Typography>
                            {rows.length > 0 && (
                              <Box sx={{ mt: 0.5 }}>
                                {rows.map((row, idx) => (
                                  <Typography
                                    key={idx}
                                    variant="caption"
                                    color={row.outOfStock ? 'error.main' : 'text.secondary'}
                                    sx={{ display: 'block' }}
                                  >
                                    {row.capacity} - KES {Math.round(row.price)} (Stock: {row.stock})
                                    {row.outOfStock ? ' - Out of stock' : ''}
                                  </Typography>
                                ))}
                              </Box>
                            )}
                            {rows.length === 0 && (
                              <Typography
                                variant="caption"
                                color={(Number(option.stock ?? 0) <= 0) ? 'error.main' : 'text.secondary'}
                                sx={{ display: 'block' }}
                              >
                                KES {Math.round(parseFloat(option.price || 0))} (Stock:{' '}
                                {option.stock ?? 0})
                                {(Number(option.stock ?? 0) <= 0) ? ' - Out of stock' : ''}
                              </Typography>
                            )}
                          </Box>
                        </li>
                      );
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Search product..."
                        size="small"
                        fullWidth
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                            '& fieldset': { borderColor: colors.border },
                            '&:hover fieldset': { borderColor: colors.accentText },
                            '&.Mui-focused fieldset': { borderColor: colors.accentText }
                          },
                          '& .MuiInputBase-input': {
                            color: colors.textPrimary
                          },
                          '& .MuiInputLabel-root': {
                            color: colors.textSecondary
                          },
                          '& .MuiInputLabel-root.Mui-focused': {
                            color: colors.accentText
                          }
                        }}
                      />
                    )}
                    sx={{ 
                      minWidth: 300,
                      '& .MuiAutocomplete-popper': {
                        '& .MuiPaper-root': {
                          backgroundColor: colors.paper,
                          border: `1px solid ${colors.border}`
                        },
                        '& .MuiAutocomplete-option': {
                          color: colors.textPrimary,
                          '&:hover': {
                            backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : 'rgba(0, 0, 0, 0.04)'
                          },
                          '&[aria-selected="true"]': {
                            backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.2)' : 'rgba(0, 224, 184, 0.1)'
                          }
                        }
                      }
                    }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    type="number"
                    value={productQty}
                    onChange={(e) => setProductQty(e.target.value)}
                    size="small"
                    inputProps={{ min: 1 }}
                    sx={{ 
                      width: 100,
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                        '& fieldset': { borderColor: colors.border },
                        '&:hover fieldset': { borderColor: colors.accentText },
                        '&.Mui-focused fieldset': { borderColor: colors.accentText }
                      },
                      '& .MuiInputBase-input': {
                        color: colors.textPrimary
                      },
                      '& .MuiInputLabel-root': {
                        color: colors.textSecondary
                      },
                      '& .MuiInputLabel-root.Mui-focused': {
                        color: colors.accentText
                      }
                    }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    type="number"
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                    placeholder={selectedProduct?.price || '0.00'}
                    size="small"
                    InputProps={{
                      startAdornment: <InputAdornment position="start" sx={{ color: colors.textSecondary }}>KES</InputAdornment>
                    }}
                    sx={{ 
                      width: 150,
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                        '& fieldset': { borderColor: colors.border },
                        '&:hover fieldset': { borderColor: colors.accentText },
                        '&.Mui-focused fieldset': { borderColor: colors.accentText }
                      },
                      '& .MuiInputBase-input': {
                        color: colors.textPrimary
                      },
                      '& .MuiInputLabel-root': {
                        color: colors.textSecondary
                      },
                      '& .MuiInputLabel-root.Mui-focused': {
                        color: colors.accentText
                      }
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={handleAddItem}
                    disabled={!selectedProduct}
                    sx={{
                      backgroundColor: '#FF9800',
                      color: '#FFFFFF',
                      '&:hover': { backgroundColor: '#F57C00' },
                      '&:disabled': { backgroundColor: colors.textSecondary }
                    }}
                  >
                    Add Item
                  </Button>
                </TableCell>
              </TableRow>
              {/* Capacity Selection Row */}
              {selectedProduct && Array.isArray(selectedProduct.capacityPricing) && selectedProduct.capacityPricing.length > 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Box sx={{ py: 2 }}>
                      <Typography variant="body2" sx={{ mb: 1.5, color: colors.textPrimary, fontWeight: 600 }}>
                        Select Capacity & Price:
                      </Typography>
                      <FormControl component="fieldset" sx={{ width: '100%' }}>
                        <RadioGroup
                          value={selectedCapacity}
                          onChange={(e) => handleCapacityChange(e.target.value)}
                          row
                          sx={{ gap: 2, flexWrap: 'wrap' }}
                        >
                          {(() => {
                            // Deduplicate by capacity, keeping the first occurrence, and filter by valid price
                            const seen = new Set();
                            const uniquePricing = selectedProduct.capacityPricing
                              .filter(pricing => {
                                if (!pricing || typeof pricing !== 'object') return false;
                                // Handle both 'capacity' and 'size' field names
                                const capacity = pricing.capacity || pricing.size;
                                if (!capacity || typeof capacity !== 'string' || !capacity.trim()) return false;
                                
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
                                
                                // Only include if price > 0
                                if (price <= 0) return false;
                                
                                const capacityKey = capacity.trim();
                                if (seen.has(capacityKey)) return false;
                                seen.add(capacityKey);
                                return true;
                              });
                            
                            return uniquePricing.map((pricing, index) => {
                              const capacity = (pricing.capacity || pricing.size || '').trim();
                              const price = parseFloat(pricing.currentPrice) || parseFloat(pricing.originalPrice) || parseFloat(pricing.price) || 0;
                              const capStock = getCapacityStock(selectedProduct, capacity);
                              const isOutOfStock = capStock <= 0;
                              
                              return (
                                <FormControlLabel
                                  key={`${selectedProduct.id}-${capacity}-${index}`}
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
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Typography variant="body2" sx={{ color: isOutOfStock ? '#d32f2f' : colors.textPrimary, fontWeight: 'bold' }}>
                                        {capacity}
                                      </Typography>
                                      <Typography variant="body2" sx={{ color: colors.accentText, fontWeight: 'bold' }}>
                                        KES {Math.round(price)}
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: isOutOfStock ? '#d32f2f' : colors.textSecondary, fontWeight: 600 }}>
                                        Stock: {capStock}{isOutOfStock ? ' (Out of stock)' : ''}
                                      </Typography>
                                    </Box>
                                  }
                                  sx={{
                                    border: `1px solid ${isOutOfStock ? '#d32f2f' : colors.border}`,
                                    borderRadius: 1,
                                    backgroundColor: selectedCapacity === capacity ? (isDarkMode ? 'rgba(0, 224, 184, 0.2)' : 'rgba(0, 224, 184, 0.1)') : 'transparent',
                                    px: 2,
                                    py: 0.5,
                                    '&:hover': {
                                      backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.1)' : 'rgba(0, 0, 0, 0.04)'
                                    }
                                  }}
                                />
                              );
                            });
                          })()}
                        </RadioGroup>
                      </FormControl>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Sales Summary Table */}
      <Paper sx={{ p: 3, backgroundColor: colors.paper }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: colors.accentText + '20' }}>
                <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Product</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Price</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Qty</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Sub Total</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography variant="body1" color="text.secondary">
                      No items added yet
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {items.map((item, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        {item.name}{item.selectedCapacity ? ` (${item.selectedCapacity})` : ''}
                      </TableCell>
                      <TableCell>KES {Math.round(item.price)}</TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleUpdateQuantity(index, parseInt(e.target.value) || 0)}
                          size="small"
                          inputProps={{ min: 1 }}
                          sx={{ 
                            width: 80,
                            '& .MuiOutlinedInput-root': {
                              backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                              '& fieldset': { borderColor: colors.border },
                              '&:hover fieldset': { borderColor: colors.accentText },
                              '&.Mui-focused fieldset': { borderColor: colors.accentText }
                            },
                            '& .MuiInputBase-input': {
                              color: colors.textPrimary
                            },
                            '& .MuiInputLabel-root': {
                              color: colors.textSecondary
                            },
                            '& .MuiInputLabel-root.Mui-focused': {
                              color: colors.accentText
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>KES {Math.round(item.subTotal)}</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemoveItem(index)}
                        >
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3} align="right" sx={{ fontWeight: 'bold' }}>
                      <Typography variant="h6">Total:</Typography>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                      KES {Math.round(getTotal())}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Container>
  );
};

export default POS;
