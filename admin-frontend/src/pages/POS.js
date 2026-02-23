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
  DialogActions
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
  
  // Account and Customer
  const [accountId, setAccountId] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [accounts, setAccounts] = useState([]);
  
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
  
  // Cart/Items
  const [items, setItems] = useState([]);
  
  // Order processing
  const [processing, setProcessing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [drinksResponse, accountsResponse, customersResponse] = await Promise.all([
        api.get('/pos/drinks').catch(() => api.get('/drinks')),
        api.get('/admin/accounts').catch(() => ({ data: [] })),
        api.get('/admin/customers').catch(() => ({ data: { customers: [] } }))
      ]);
      
      setDrinks(drinksResponse.data || []);
      setAccounts(accountsResponse.data || []);
      
      // Handle paginated response from /admin/customers
      let customersArray = [];
      if (customersResponse.data) {
        if (Array.isArray(customersResponse.data)) {
          // Direct array (legacy format)
          customersArray = customersResponse.data;
        } else if (customersResponse.data.customers && Array.isArray(customersResponse.data.customers)) {
          // Paginated response: { customers: [...], total: ... }
          customersArray = customersResponse.data.customers;
        }
      }
      setCustomers(customersArray);
    } catch (err) {
      console.error('Error fetching POS data:', err);
      setError(err.response?.data?.error || 'Failed to load POS data');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSearch = async (searchValue) => {
    setCustomerSearch(searchValue);
    
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

    if (!newCustomerName || !newCustomerName.trim()) {
      setError('Customer name is required');
      return;
    }

    setCreatingCustomer(true);
    setError(null);

    try {
      const response = await api.post('/admin/customers', {
        phone: newCustomerPhone.trim(),
        customerName: newCustomerName.trim()
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
      setProductPrice(product.price || '');
      setProductQty(1);
    } else {
      setSelectedProduct(null);
      setProductPrice('');
      setProductQty(1);
    }
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

    // Check if item already exists in cart
    const existingIndex = items.findIndex(item => item.drinkId === selectedProduct.id);
    
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

    if (!selectedCustomer && !customerPhone) {
      setError('Please select or enter a customer phone number');
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
          selectedPrice: item.price
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
                  <TextField
                    type="number"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    placeholder="Account ID"
                    size="small"
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
            label="Customer Name *"
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
                    getOptionLabel={(option) => option.name || ''}
                    value={selectedProduct}
                    onChange={(event, newValue) => handleProductSelect(newValue)}
                    inputValue={productSearch}
                    onInputChange={(event, newInputValue) => {
                      setProductSearch(newInputValue);
                      if (!newInputValue) {
                        setSelectedProduct(null);
                      }
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
                      <TableCell>{item.name}</TableCell>
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
                      KES {getTotal()Math.round(}
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
