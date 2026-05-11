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

const MAX_DROPDOWN_OPTIONS = 100;

const parseJsonIfString = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

// Capacity options from product: capacity array or capacityPricing effective capacity
const getCapacityOptions = (product) => {
  if (!product) return [];
  const cap = parseJsonIfString(product.capacity);
  const pricing = parseJsonIfString(product.capacityPricing);
  if (Array.isArray(pricing) && pricing.length > 0) {
    return pricing
      .map((p) => p.capacity || p.size || p.effectiveCapacity)
      .filter(Boolean)
      .filter((c, i, a) => a.indexOf(c) === i);
  }
  if (Array.isArray(cap) && cap.length > 0) return cap;
  if (typeof cap === 'string' && cap.trim()) return [cap.trim()];
  return [];
};

/** True when this product has at least one capacity variant — purchase must specify which. */
const productRequiresCapacity = (product) => getCapacityOptions(product).length > 0;

const getProductOptionRows = (product) => {
  if (!product) return [];
  const pricing = parseJsonIfString(product.capacityPricing);
  const byCapacityRaw = parseJsonIfString(product.stockByCapacity);
  const byCapacity =
    byCapacityRaw && typeof byCapacityRaw === 'object' && !Array.isArray(byCapacityRaw)
      ? byCapacityRaw
      : {};

  if (Array.isArray(pricing) && pricing.length > 0) {
    return pricing
      .map((p) => {
        if (!p || typeof p !== 'object') return null;
        const capacity = String(p.capacity || p.size || p.effectiveCapacity || '').trim();
        if (!capacity) return null;
        const current = p.currentPrice != null ? parseFloat(p.currentPrice) : null;
        const original = p.originalPrice != null ? parseFloat(p.originalPrice) : null;
        const legacy = p.price != null ? parseFloat(p.price) : null;
        const price =
          current != null && !Number.isNaN(current) && current > 0
            ? current
            : original != null && !Number.isNaN(original) && original > 0
            ? original
            : legacy != null && !Number.isNaN(legacy) && legacy > 0
            ? legacy
            : parseFloat(product.price || 0) || 0;

        const directStock = byCapacity[capacity];
        const normalizedStock = Object.entries(byCapacity).find(
          ([key]) => String(key || '').trim().toLowerCase() === capacity.toLowerCase()
        )?.[1];
        const stock = Number(directStock ?? normalizedStock ?? 0) || 0;
        return { capacity, price, stock };
      })
      .filter(Boolean);
  }

  if (Object.keys(byCapacity).length > 0) {
    return Object.entries(byCapacity).map(([capacity, stock]) => ({
      capacity,
      price: parseFloat(product.price || 0) || 0,
      stock: Number(stock) || 0
    }));
  }

  return [];
};

const AddPurchase = () => {
  const navigate = useNavigate();
  const { colors, isDarkMode } = useTheme();

  const [suppliers, setSuppliers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
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
    unitPrice: '',
    capacity: ''
  });
  const [productSearch, setProductSearch] = useState('');
  /** Separate from filter length so the list closes after pick (controlled open + long query would stay open). */
  const [productMenuOpen, setProductMenuOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [supRes, accRes] = await Promise.all([
          api.get('/suppliers'),
          api.get('/admin/accounts')
        ]);

        if (!isMounted) return;

        setSuppliers(Array.isArray(supRes.data) ? supRes.data : []);
        setAccounts(Array.isArray(accRes.data) ? accRes.data : []);
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

  const ensureProductsLoaded = async () => {
    if (productsLoading) return;
    if (Array.isArray(products) && products.length > 0) return;
    setProductsLoading(true);
    try {
      // Slim catalog (no joins), same fields POS needs including purchasePrice.
      const prodRes = await api.get('/admin/drinks', { params: { light: 1 } });
      setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
    } catch (err) {
      // Fallback to slim paged fetch only if primary POS-like endpoint fails.
      try {
        const all = [];
        const pageSize = 500;
        let offset = 0;
        let keepLoading = true;

        while (keepLoading) {
          // eslint-disable-next-line no-await-in-loop
          const prodRes = await api.get('/admin/drinks', {
            params: { light: 1, summary: 1, limit: pageSize, offset }
          });
          const chunk = Array.isArray(prodRes.data) ? prodRes.data : [];
          if (chunk.length === 0) {
            keepLoading = false;
            break;
          }
          all.push(...chunk);
          offset += chunk.length;
          keepLoading = chunk.length === pageSize;
        }

        setProducts(all);
      } catch (fallbackErr) {
        console.error('Error loading products for purchase', fallbackErr);
        setError((prev) => prev || fallbackErr.response?.data?.error || fallbackErr.message || 'Failed to load products.');
      }
    } finally {
      setProductsLoading(false);
    }
  };

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
    const product = value ? productsById.get(value) : null;
    setProductSearch(product ? String(product.name || '') : '');
    setNewItem((prev) => {
      const options = getCapacityOptions(product || null);
      // Single capacity: pre-select so stock updates the correct bucket without an extra click.
      // Multiple capacities: user must choose explicitly.
      const capacity =
        options.length === 1 ? options[0] : '';
      const next = { ...prev, productId: value, capacity };
      if (product && value) {
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

    const product = productsById.get(productId);
    if (productRequiresCapacity(product) && !String(newItem.capacity || '').trim()) {
      setError('Please select a capacity for this product.');
      return;
    }

    setError(null);
    setItems((prev) => [
      ...prev,
      {
        productId,
        quantity: quantityNum,
        unitPrice: unitPriceNum,
        ...(String(newItem.capacity || '').trim() ? { capacity: String(newItem.capacity).trim() } : {})
      }
    ]);
    setNewItem({
      productId: '',
      quantity: '1',
      unitPrice: '',
      capacity: ''
    });
    setProductSearch('');
    setProductMenuOpen(false);
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

    for (let i = 0; i < items.length; i++) {
      const line = items[i];
      const p = productsById.get(line.productId);
      if (productRequiresCapacity(p) && !String(line.capacity || '').trim()) {
        setError(
          `Line ${i + 1}: "${p?.name || 'Product'}" requires a capacity. Remove the line and add it again with a capacity selected.`
        );
        return;
      }
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
        const out = {
          item: name,
          price: Number(item.unitPrice),
          quantity: Number(item.quantity),
          productId: Number(item.productId)
        };
        if (productRequiresCapacity(product)) {
          out.capacity = String(item.capacity || '').trim();
        } else if (item.capacity) {
          out.capacity = item.capacity;
        }
        return out;
      });

      const payload = {
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

      await api.post('/driver-wallet/admin/purchases', payload);
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
          <Grid item xs={12} sm={6} md={3}>
            <Autocomplete
              options={suppliers}
              getOptionLabel={(option) => option?.name || ''}
              isOptionEqualToValue={(option, value) => option?.id === value?.id}
              value={suppliers.find((s) => String(s.id) === String(supplierId)) || null}
              onChange={(_, value) => setSupplierId(value ? value.id : '')}
              sx={{ minWidth: 240 }}
              ListboxProps={{ style: { maxHeight: 320 } }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Supplier"
                  placeholder="Type to search supplier…"
                  size="small"
                  fullWidth
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Autocomplete
              options={accounts}
              getOptionLabel={(option) => option?.name || ''}
              isOptionEqualToValue={(option, value) => option?.id === value?.id}
              value={accounts.find((a) => String(a.id) === String(accountId)) || null}
              onChange={(_, value) => setAccountId(value ? value.id : '')}
              sx={{ minWidth: 240 }}
              ListboxProps={{ style: { maxHeight: 320 } }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Account"
                  placeholder="Type to search account…"
                  size="small"
                  fullWidth
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small" sx={{ minWidth: 200 }}>
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
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Reference"
              fullWidth
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              size="small"
            />
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2, mb: 3, backgroundColor: colors.paper }}>
        <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 600, color: colors.textPrimary }}>
          Purchase Items
        </Typography>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={4}>
            <Autocomplete
              options={products}
              getOptionLabel={(option) => option?.name || ''}
              isOptionEqualToValue={(option, value) => option?.id === value?.id}
              value={productsById.get(newItem.productId) || null}
              inputValue={productSearch}
              onOpen={() => {
                ensureProductsLoaded();
                setProductMenuOpen(true);
              }}
              onClose={() => setProductMenuOpen(false)}
              onInputChange={(event, newInputValue, reason) => {
                if (reason === 'reset') {
                  setProductSearch(newInputValue);
                  setProductMenuOpen(false);
                  return;
                }
                if (reason === 'input' && newItem.productId) {
                  const selected = productsById.get(newItem.productId);
                  const label = String(selected?.name || '');
                  if (newInputValue !== label) {
                    handleNewItemProductChange('');
                    setProductSearch(newInputValue);
                    setProductMenuOpen(true);
                    return;
                  }
                }
                setProductSearch(newInputValue);
                if (!newInputValue) {
                  handleNewItemProductChange('');
                  setProductMenuOpen(true);
                }
              }}
              onChange={(_, value) => {
                handleNewItemProductChange(value ? value.id : '');
                setProductMenuOpen(false);
              }}
              filterOptions={(options, { inputValue }) => {
                const source = Array.isArray(options) ? options : [];
                const term = String(inputValue || '').toLowerCase().trim();
                if (!term) return source.slice(0, MAX_DROPDOWN_OPTIONS);
                const tokens = term.split(/[\s\-_]+/).filter(Boolean);
                const filtered = source.filter((option) => {
                  const name = String(option?.name || '').toLowerCase();
                  if (!name) return false;
                  if (tokens.length > 1) return tokens.some((t) => name.includes(t));
                  return name.includes(term);
                });
                return filtered.slice(0, MAX_DROPDOWN_OPTIONS);
              }}
              noOptionsText={productsLoading ? 'Loading products...' : 'No products found'}
              forcePopupIcon={false}
              openOnFocus
              open={productMenuOpen}
              ListboxProps={{ style: { maxHeight: '300px' } }}
              renderOption={(props, option) => {
                const { key, ...restProps } = props;
                const rows = getProductOptionRows(option);
                const totalStock = Number(option?.stock || 0);
                const rowSum = rows.reduce((sum, row) => sum + (Number(row.stock) || 0), 0);
                const headerStock = rows.length > 0 ? rowSum : totalStock;
                const stockColor = headerStock > 0 ? '#2196F3' : '#F44336';
                return (
                  <li key={option.id} {...restProps}>
                    <Box
                      sx={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start'
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {option.name}
                        </Typography>
                        {rows.length > 0 ? (
                          <Box sx={{ mt: 0.5 }}>
                            {rows.map((row, idx) => (
                              <Typography key={`${row.capacity}-${idx}`} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                {row.capacity} - KES {Math.round(row.price)} (Stock: {row.stock})
                              </Typography>
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            KES {Math.round(parseFloat(option.price || 0))} (Stock: {totalStock})
                          </Typography>
                        )}
                      </Box>
                      <Typography variant="caption" sx={{ color: stockColor, fontWeight: 600, ml: 2 }}>
                        Stock: {headerStock}
                      </Typography>
                    </Box>
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Product"
                  placeholder="Type product name..."
                  size="small"
                  fullWidth
                  onFocus={() => {
                    ensureProductsLoaded();
                  }}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {productsLoading ? <CircularProgress color="inherit" size={18} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    )
                  }}
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
          {getCapacityOptions(productsById.get(newItem.productId)).length > 0 && (
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small" required>
                <InputLabel id="purchase-capacity-label" shrink>
                  Capacity *
                </InputLabel>
                <Select
                  labelId="purchase-capacity-label"
                  label="Capacity *"
                  value={newItem.capacity || ''}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, capacity: e.target.value }))}
                  displayEmpty
                  notched
                  renderValue={(value) => (value ? value : 'Select capacity')}
                  sx={{
                    backgroundColor: isDarkMode ? 'rgba(0, 224, 184, 0.12)' : colors.paper,
                    minWidth: 220,
                    width: '100%',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: colors.border },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: colors.accentText },
                    '& .MuiInputBase-input': { color: colors.textPrimary },
                    '& .MuiInputLabel-root': { color: colors.textSecondary }
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: { minWidth: 220 }
                    }
                  }}
                >
                  {getCapacityOptions(productsById.get(newItem.productId)).length > 1 && (
                    <MenuItem value="" disabled>
                      Select capacity
                    </MenuItem>
                  )}
                  {getCapacityOptions(productsById.get(newItem.productId)).map((cap) => (
                    <MenuItem key={cap} value={cap}>
                      {cap}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
          <Grid item xs={12} md={2}>
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
          <Grid item xs={12} md={2}>
            <TextField
              label="Purchase price (per unit)"
              type="number"
              fullWidth
              value={newItem.unitPrice}
              onChange={(e) => setNewItem((prev) => ({ ...prev, unitPrice: e.target.value }))}
              inputProps={{ min: 0, step: '0.01' }}
              helperText="Updates product cost in inventory"
              size="small"
            />
          </Grid>
          <Grid item xs={12} md={2} sx={{ display: 'flex', alignItems: 'center' }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAddItem}
              fullWidth
              sx={{
                backgroundColor: colors.accentText,
                color: '#FFFFFF',
                whiteSpace: 'nowrap',
                px: 2,
                height: 40
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
                <TableCell>Capacity</TableCell>
                <TableCell align="right">Quantity</TableCell>
                <TableCell align="right">Purchase price</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 2, color: colors.textSecondary }}>
                    No items added yet.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, index) => {
                  const product = productsById.get(item.productId);
                  const lineTotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
                  return (
                    <TableRow key={`${item.productId}-${index}-${item.capacity || ''}`}>
                      <TableCell sx={{ color: colors.textPrimary }}>
                        {product?.name || '—'}
                      </TableCell>
                      <TableCell sx={{ color: colors.textSecondary }}>
                        {item.capacity || '—'}
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
                  <TableCell colSpan={4} align="right" sx={{ fontWeight: 600, color: colors.textPrimary }}>
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

