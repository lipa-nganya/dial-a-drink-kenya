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
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';

const formatCurrency = (value) => {
  const n = Number(value || 0);
  if (Number.isNaN(n)) return 'KES 0';
  return `KES ${Math.round(n).toLocaleString()}`;
};

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

const productRequiresCapacity = (product) => getCapacityOptions(product).length > 0;

const normalizePaymentMethod = (v) => {
  if (!v) return '';
  const lower = String(v).toLowerCase();
  if (lower === 'mpesa' || lower === 'm-pesa') return 'Mpesa';
  if (lower === 'cash') return 'Cash';
  if (lower === 'cheque') return 'Cheque';
  return v;
};

const EditPurchase = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { colors } = useTheme();

  const [purchase, setPurchase] = useState(null);
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
  const [deliveryLocation, setDeliveryLocation] = useState('Office');
  const [amountPaid, setAmountPaid] = useState('');

  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({
    productId: '',
    quantity: '1',
    unitPrice: '',
    capacity: ''
  });
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const [subRes, supRes, accRes, prodRes] = await Promise.all([
          api.get(`/driver-wallet/admin/purchases/${id}`),
          api.get('/suppliers'),
          api.get('/admin/accounts'),
          api.get('/admin/drinks')
        ]);
        if (!isMounted) return;

        const submission = subRes.data?.data ?? subRes.data;
        if (!submission || submission.submissionType !== 'purchases') {
          setError('Purchase not found.');
          setLoading(false);
          return;
        }

        setPurchase(submission);
        setSuppliers(Array.isArray(supRes.data) ? supRes.data : []);
        setAccounts(Array.isArray(accRes.data) ? accRes.data : []);
        setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);

        const d = submission.details || {};
        const supplierName = (d.supplier || '').trim();
        const supplier = (Array.isArray(supRes.data) ? supRes.data : []).find(
          (s) => (s.name || '').trim().toLowerCase() === supplierName.toLowerCase()
        );
        setSupplierId(supplier ? supplier.id : '');
        setAccountId(d.assetAccountId != null && d.assetAccountId !== '' ? String(d.assetAccountId) : '');
        setPaymentMethod(normalizePaymentMethod(d.paymentMethod) || '');
        setReference(d.reference ?? '');
        setDeliveryLocation(d.deliveryLocation ?? 'Office');
        setAmountPaid(d.amountPaid != null ? String(d.amountPaid) : '');

        const productsList = Array.isArray(prodRes.data) ? prodRes.data : [];
        const byId = new Map(productsList.map((p) => [p.id, p]));
        const byName = new Map(productsList.map((p) => [(p.name || '').toLowerCase(), p]));

        const detailsItems = Array.isArray(d.items) ? d.items : [];
        const formItems = detailsItems.map((row) => {
          let pid = row.productId != null ? Number(row.productId) : null;
          if (pid == null || Number.isNaN(pid)) {
            const name = (row.item || row.name || '').trim().toLowerCase();
            const match = byName.get(name) || productsList.find((p) => (p.name || '').trim().toLowerCase() === name);
            pid = match ? match.id : null;
          }
          const product = pid != null ? byId.get(pid) : null;
          let capacity = row.capacity ?? '';
          const opts = getCapacityOptions(product);
          if (productRequiresCapacity(product) && !String(capacity).trim() && opts.length === 1) {
            capacity = opts[0];
          }
          return {
            productId: pid,
            quantity: Number(row.quantity) || 1,
            unitPrice: Number(row.price) || 0,
            capacity
          };
        }).filter((i) => (i.productId != null && byId.has(i.productId)) || i.unitPrice > 0);
        setItems(formItems);
      } catch (err) {
        if (!isMounted) return;
        console.error('Error loading purchase for edit', err);
        setError(err.response?.data?.error || err.message || 'Failed to load purchase.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
  }, [id]);

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
      const product = productsById.get(value);
      const options = getCapacityOptions(product);
      const capacity = options.length === 1 ? options[0] : '';
      const next = { ...prev, productId: value, capacity };
      if (product) {
        const defaultPrice =
          product.purchasePrice != null ? Number(product.purchasePrice) : product.price != null ? Number(product.price) : '';
        if (defaultPrice && !Number.isNaN(defaultPrice)) next.unitPrice = String(defaultPrice);
      }
      return next;
    });
  };

  const adjustQuantity = (delta) => {
    setNewItem((prev) => {
      const current = Number(prev.quantity || 0) || 0;
      return { ...prev, quantity: String(Math.max(1, current + delta)) };
    });
  };

  const handleAddItem = () => {
    const productId = newItem.productId;
    const quantityNum = Number(newItem.quantity);
    const unitPriceNum = Number(newItem.unitPrice);
    if (!productId) {
      setError('Please select a product.');
      return;
    }
    if (!quantityNum || quantityNum <= 0 || Number.isNaN(quantityNum)) {
      setError('Enter a valid quantity.');
      return;
    }
    if (!unitPriceNum || unitPriceNum <= 0 || Number.isNaN(unitPriceNum)) {
      setError('Enter a valid unit price.');
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
    setNewItem({ productId: '', quantity: '1', unitPrice: '', capacity: '' });
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

      const details = {
        supplier: supplier.name,
        items: detailsItems,
        deliveryLocation: deliveryLocation.trim() || 'Office',
        paymentMethod: paymentMethod || undefined,
        reference: reference.trim() || undefined
      };
      if (accountId) details.assetAccountId = accountId;
      if (amountPaid.trim() !== '') {
        const num = parseFloat(amountPaid);
        if (!Number.isNaN(num) && num >= 0) details.amountPaid = num;
      }

      await api.patch(`/driver-wallet/admin/cash-submissions/${id}`, {
        details,
        amount: totalAmount
      });
      navigate('/payables/manage', { replace: true, state: { tab: 0 } });
    } catch (err) {
      console.error('Error updating purchase', err);
      setError(err.response?.data?.error || err.message || 'Failed to save purchase.');
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

  if (!purchase) {
    return (
      <Box sx={{ p: 2 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/payables/manage')} sx={{ mb: 2, color: colors.textSecondary }}>
          Back to Payables
        </Button>
        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/payables/manage')}
        sx={{ mb: 2, color: colors.textSecondary }}
      >
        Back to Payables
      </Button>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Typography variant="h5" sx={{ mb: 2, color: colors.textPrimary, fontWeight: 600 }}>
        Edit Purchase
      </Typography>

      <Paper sx={{ p: 2, mb: 3, backgroundColor: colors.paper }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth sx={{ minWidth: 260 }}>
              <InputLabel>Supplier</InputLabel>
              <Select label="Supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                {suppliers.map((s) => (
                  <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth sx={{ minWidth: 260 }}>
              <InputLabel>Account</InputLabel>
              <Select label="Account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <MenuItem value="">— None —</MenuItem>
                {accounts.map((a) => (
                  <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth sx={{ minWidth: 200 }}>
              <InputLabel>Payment Method</InputLabel>
              <Select label="Payment Method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <MenuItem value="">Unselected</MenuItem>
                <MenuItem value="Cheque">Cheque</MenuItem>
                <MenuItem value="Cash">Cash</MenuItem>
                <MenuItem value="Mpesa">Mpesa</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField label="Reference" fullWidth value={reference} onChange={(e) => setReference(e.target.value)} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Delivery location"
              fullWidth
              value={deliveryLocation}
              onChange={(e) => setDeliveryLocation(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Amount paid (optional)"
              fullWidth
              type="number"
              inputProps={{ min: 0, step: 0.01 }}
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              helperText="Set to mark as paid; clear to mark as unpaid"
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
                if (!newInputValue) handleNewItemProductChange('');
              }}
              onChange={(_, value) => handleNewItemProductChange(value ? value.id : '')}
              filterOptions={(options, { inputValue }) => {
                if (!inputValue?.trim()) return options;
                const search = inputValue.toLowerCase().trim();
                return options.filter((o) => o?.name?.toLowerCase().includes(search));
              }}
              renderOption={(props, option) => (
                <li key={option.id} {...props}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{option.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      KES {Math.round(parseFloat(option.purchasePrice || option.price || 0))}
                    </Typography>
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField {...params} placeholder="Search product..." size="small" fullWidth />
              )}
              sx={{ minWidth: 300 }}
            />
          </Grid>
          {getCapacityOptions(productsById.get(newItem.productId)).length > 0 && (
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small" required>
                <InputLabel id="edit-purchase-capacity-label">Capacity *</InputLabel>
                <Select
                  labelId="edit-purchase-capacity-label"
                  label="Capacity *"
                  value={newItem.capacity || ''}
                  onChange={(e) => setNewItem((prev) => ({ ...prev, capacity: e.target.value }))}
                  displayEmpty
                  renderValue={(value) => (value ? value : 'Select capacity')}
                  sx={{
                    minWidth: 220,
                    width: '100%',
                    backgroundColor: colors.paper,
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
                    <MenuItem key={cap} value={cap}>{cap}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton size="small" onClick={() => adjustQuantity(-1)}><Remove fontSize="small" /></IconButton>
              <TextField
                label="Quantity"
                type="number"
                fullWidth
                value={newItem.quantity}
                onChange={(e) => setNewItem((prev) => ({ ...prev, quantity: e.target.value }))}
                inputProps={{ min: 1 }}
                size="small"
              />
              <IconButton size="small" onClick={() => adjustQuantity(1)}><Add fontSize="small" /></IconButton>
            </Box>
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              label="Unit price"
              type="number"
              fullWidth
              value={newItem.unitPrice}
              onChange={(e) => setNewItem((prev) => ({ ...prev, unitPrice: e.target.value }))}
              inputProps={{ min: 0, step: '0.01' }}
            />
          </Grid>
          <Grid item xs={12} md={2} sx={{ display: 'flex', alignItems: 'center' }}>
            <Button variant="contained" startIcon={<Add />} onClick={handleAddItem}>
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
                    No items.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, index) => {
                  const product = productsById.get(item.productId);
                  const lineTotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
                  return (
                    <TableRow key={`${item.productId}-${index}-${item.capacity || ''}`}>
                      <TableCell>{product?.name || '—'}</TableCell>
                      <TableCell sx={{ color: colors.textSecondary }}>{item.capacity || '—'}</TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      <TableCell align="right">{formatCurrency(item.unitPrice)}</TableCell>
                      <TableCell align="right">{formatCurrency(lineTotal)}</TableCell>
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
                  <TableCell colSpan={4} align="right" sx={{ fontWeight: 600 }}>Subtotal</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(subtotal)}</TableCell>
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
          sx={{ fontWeight: 600 }}
        >
          {submitting ? 'Saving…' : 'Save changes'}
        </Button>
      </Box>
    </Box>
  );
};

export default EditPurchase;
