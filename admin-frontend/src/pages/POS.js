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
  InputAdornment
} from '@mui/material';
import {
  Add,
  Delete,
  CheckCircle
} from '@mui/icons-material';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const POS = () => {
  const { isDarkMode, colors } = useTheme();
  const [drinks, setDrinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Account and Reference
  const [accountId, setAccountId] = useState('');
  const [reference, setReference] = useState('');
  const [accounts, setAccounts] = useState([]);
  
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
      const [drinksResponse, accountsResponse] = await Promise.all([
        api.get('/pos/drinks').catch(() => api.get('/drinks')),
        api.get('/admin/accounts').catch(() => ({ data: [] }))
      ]);
      
      setDrinks(drinksResponse.data || []);
      setAccounts(accountsResponse.data || []);
    } catch (err) {
      console.error('Error fetching POS data:', err);
      setError(err.response?.data?.error || 'Failed to load POS data');
    } finally {
      setLoading(false);
    }
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

    if (!reference || !reference.trim()) {
      setError('Please enter a reference');
      return;
    }

    setProcessing(true);
    setError(null);
    setOrderSuccess(null);

    try {
      // Create order data
      const orderData = {
        customerName: reference, // Use reference as customer name for office sales
        customerPhone: reference, // Use reference as phone for office sales
        items: items.map(item => ({
          drinkId: item.drinkId,
          quantity: item.quantity,
          selectedPrice: item.price
        })),
        notes: `Office POS Sale - Reference: ${reference}${accountId ? `, Account ID: ${accountId}` : ''}`,
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
        setReference('');
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

      {/* Reference Section */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: colors.paper }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Account</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: colors.accentText }}>Reference</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>
                  <TextField
                    type="number"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    placeholder="Account ID"
                    size="small"
                    sx={{ width: 150 }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    fullWidth
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Enter reference"
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="contained"
                    onClick={handlePostOfficeSale}
                    disabled={processing || items.length === 0 || !reference}
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
                      />
                    )}
                    sx={{ minWidth: 300 }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    type="number"
                    value={productQty}
                    onChange={(e) => setProductQty(e.target.value)}
                    size="small"
                    inputProps={{ min: 1 }}
                    sx={{ width: 100 }}
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
                      startAdornment: <InputAdornment position="start">KES</InputAdornment>
                    }}
                    sx={{ width: 150 }}
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
                      <TableCell>KES {item.price.toFixed(2)}</TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleUpdateQuantity(index, parseInt(e.target.value) || 0)}
                          size="small"
                          inputProps={{ min: 1 }}
                          sx={{ width: 80 }}
                        />
                      </TableCell>
                      <TableCell>KES {item.subTotal.toFixed(2)}</TableCell>
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
                      KES {getTotal().toFixed(2)}
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
