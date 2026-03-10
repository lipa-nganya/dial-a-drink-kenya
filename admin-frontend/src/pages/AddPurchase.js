import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Alert,
  CircularProgress,
  Autocomplete
} from '@mui/material';
import { Add, Delete, ArrowBack, Remove } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';

const formatCurrency = (value) => {
  const n = Number(value || 0);
  if (Number.isNaN(n)) return 'KES 0';
  return `KES ${Math.round(n).toLocaleString()}`;
};

const AddPurchase = () => {
  const navigate = useNavigate();
  const { colors, isDarkMode } = useTheme();

  const [suppliers, setSuppliers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [supplierId, setSupplierId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [reference, setReference] = useState('');

  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({
    productId: '',
    quantity: '1',
    unitPrice: ''
  });
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [supRes, accRes, prodRes] = await Promise.all([
          api.get('/suppliers'),
          api.get('/admin/accounts'),
          api.get('/admin/drinks')
        ]);

        if (!isMounted) return;

        setSuppliers(Array.isArray(supRes.data) ? supRes.data : []);
        setAccounts(Array.isArray(accRes.data) ? accRes.data : []);
        setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
      } catch (err) {
        if (!isMounted) return;
        console.error('Error loading purchase form data', err);
        setError(err.response?.data?.error || err.message || 'Failed to load data for purchase.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const productsById = useMemo(() => {
    const map = new Map();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  const subtotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const qty = Number(item.quantity || 0);
        const unit = Number(item.unitPrice || 0);
        return sum + (Number.isNaN(qty) || Number.isNaN(unit) ? 0 : qty * unit);
      }, 0),
    [items]
  );

  const handleNewItemProductChange = (value) => {
    setNewItem((prev) => {
      const next = { ...prev, productId: value };
      const product = productsById.get(value);
      if (product) {
        const defaultPrice =
          product.purchasePrice != null
            ? Number(product.purchasePrice)
            : product.price != null
            ? Number(product.price)
            : '';
        if (defaultPrice && !Number.isNaN(defaultPrice)) {
          next.unitPrice = String(defaultPrice);
        }
      }
      return next;
    });
  };

  const adjustQuantity = (delta) => {
    setNewItem((prev) => {
      const current = Number(prev.quantity || 0) || 0;
      const next = Math.max(1, current + delta);
      return { ...prev, quantity: String(next) };
    });
  };

  const handleAddItem = () => {
    const productId = newItem.productId;
    const quantityNum = Number(newItem.quantity);
    const unitPriceNum = Number(newItem.unitPrice);

    if (!productId) {
      setError('Please select a product before adding an item.');
      return;
    }
    if (!quantityNum || quantityNum <= 0 || Number.isNaN(quantityNum)) {
      setError('Please enter a valid quantity greater than 0.');
      return;
    }
    if (!unitPriceNum || unitPriceNum <= 0 || Number.isNaN(unitPriceNum)) {
      setError('Please enter a valid unit price greater than 0.');
      return;
    }

    setError(null);
    setItems((prev) => [
      ...prev,
      {
        productId,
        quantity: quantityNum,
        unitPrice: unitPriceNum
      }
    ]);
    setNewItem({
      productId: '',
      quantity: '1',
      unitPrice: ''
    });
  };

  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!supplierId) {
      setError('Please select a supplier.');
      return;
    }
    if (items.length === 0) {
      setError('Please add at least one purchase item.');
      return;
    }

    const supplier = suppliers.find((s) => s.id === supplierId || s.id === Number(supplierId));
    if (!supplier) {
      setError('Selected supplier not found.');
      return;
    }

    const totalAmount = subtotal;
    if (!totalAmount || totalAmount <= 0) {
      setError('Total amount must be greater than 0.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const detailsItems = items.map((item) => {
        const product = productsById.get(item.productId);
        const name = product?.name || 'Item';
        return {
          item: name,
          price: Number(item.unitPrice),
          quantity: Number(item.quantity),
          productId: Number(item.productId)
        };
      });

      const payload = {
        submissionType: 'purchases',
        amount: totalAmount,
        details: {
          supplier: supplier.name,
          items: detailsItems,
          deliveryLocation: 'Office',
          ...(accountId ? { assetAccountId: accountId } : {}),
          ...(paymentMethod ? { paymentMethod } : {}),
          reference: reference || null
        }
      };

      await api.post('/driver-wallet/admin/cash-submissions', payload);
      navigate('/payables/purchases', { replace: true });
    } catch (err) {
      console.error('Error posting purchase', err);
      setError(err.response?.data?.error || err.message || 'Failed to post purchase.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress sx={{ color: colors.accent }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/payables/purchases')}
        sx={{ mb: 2, color: colors.textSecondary }}
      >
        Back to Purchases
      </Button>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Typography variant="h5" sx={{ mb: 2, color: colors.textPrimary, fontWeight: 600 }}>
        Add Purchase
      </Typography>

      <Paper sx={{ p: 2, mb: 3, backgroundColor: colors.paper }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth sx={{ minWidth: 260 }}>
              <InputLabel>Supplier</InputLabel>
              <Select
                label="Supplier"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                {suppliers.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth sx={{ minWidth: 260 }}>
              <InputLabel>Account</InputLabel>
              <Select
                label="Account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth sx={{ minWidth: 200 }}>
              <InputLabel>Payment Method</InputLabel>
              <Select
                label="Payment Method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <MenuItem value="">Unselected</MenuItem>
                <MenuItem value="Cheque">Cheque</MenuItem>
                <MenuItem value="Cash">Cash</MenuItem>
                <MenuItem value="Mpesa">Mpesa</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Reference"
              fullWidth
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2, mb: 3, backgroundColor: colors.paper }}>
        <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 600, color: colors.textPrimary }}>
          Purchase Items
        </Typography>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={5}>
            <Autocomplete
              options={products}
              getOptionLabel={(option) => option?.name || ''}
              isOptionEqualToValue={(option, value) => option?.id === value?.id}
              value={productsById.get(newItem.productId) || null}
              inputValue={productSearch}
              onInputChange={(_, newInputValue) => {
                setProductSearch(newInputValue);
                if (!newInputValue) {
                  handleNewItemProductChange('');
                }
              }}
              onChange={(_, value) => handleNewItemProductChange(value ? value.id : '')}
              filterOptions={(options, { inputValue }) => {
                if (!inputValue || inputValue.trim().length === 0) {
                  return options;
                }
                const searchTerm = inputValue.toLowerCase().trim();
                return options.filter((option) => {
                  if (!option || !option.name) return false;
                  return option.name.toLowerCase().includes(searchTerm);
                });
              }}
              renderOption={(props, option) => {
                const { key, ...restProps } = props;
                return (
                  <li key={option.id} {...restProps}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {option.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        KES {Math.round(parseFloat(option.purchasePrice || option.price || 0))}
                      </Typography>
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
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton
                size="small"
                onClick={() => adjustQuantity(-1)}
                sx={{ mr: 1 }}
              >
                <Remove fontSize="small" />
              </IconButton>
              <TextField
                label="Quantity"
                type="number"
                fullWidth
                value={newItem.quantity}
                onChange={(e) => setNewItem((prev) => ({ ...prev, quantity: e.target.value }))}
                inputProps={{ min: 1 }}
                size="small"
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
              <IconButton
                size="small"
                onClick={() => adjustQuantity(1)}
                sx={{ ml: 1 }}
              >
                <Add fontSize="small" />
              </IconButton>
            </Box>
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              label="Purchase price (per unit)"
              type="number"
              fullWidth
              value={newItem.unitPrice}
              onChange={(e) => setNewItem((prev) => ({ ...prev, unitPrice: e.target.value }))}
              inputProps={{ min: 0, step: '0.01' }}
              helperText="Updates product cost in inventory"
            />
          </Grid>
          <Grid item xs={12} md={2} sx={{ display: 'flex', alignItems: 'center' }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAddItem}
              sx={{
                backgroundColor: colors.accentText,
                color: '#FFFFFF',
                whiteSpace: 'nowrap',
                px: 2
              }}
            >
              Add Item
            </Button>
          </Grid>
        </Grid>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Product</TableCell>
                <TableCell align="right">Quantity</TableCell>
                <TableCell align="right">Purchase price</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 2, color: colors.textSecondary }}>
                    No items added yet.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, index) => {
                  const product = productsById.get(item.productId);
                  const lineTotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
                  return (
                    <TableRow key={`${item.productId}-${index}`}>
                      <TableCell sx={{ color: colors.textPrimary }}>
                        {product?.name || '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>
                        {item.quantity}
                      </TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>
                        {formatCurrency(item.unitPrice)}
                      </TableCell>
                      <TableCell align="right" sx={{ color: colors.textPrimary }}>
                        {formatCurrency(lineTotal)}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" color="error" onClick={() => handleRemoveItem(index)}>
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
              {items.length > 0 && (
                <TableRow>
                  <TableCell colSpan={3} align="right" sx={{ fontWeight: 600, color: colors.textPrimary }}>
                    Subtotal
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: colors.accentText }}>
                    {formatCurrency(subtotal)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting}
          sx={{ backgroundColor: colors.accentText, color: '#FFFFFF', fontWeight: 600 }}
        >
          {submitting ? 'Posting Purchase…' : 'Post Purchase'}
        </Button>
      </Box>
    </Box>
  );
};

export default AddPurchase;

