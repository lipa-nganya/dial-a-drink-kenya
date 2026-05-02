import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Radio,
  Chip
} from '@mui/material';
import {
  Add,
  Delete,
  ShoppingCart,
  Remove,
  PersonAdd
} from '@mui/icons-material';
import { api } from '../services/api';
import { validateSafaricomPhone } from '../utils/mpesaPhone';
import AddressAutocomplete from './AddressAutocomplete';
import { useTheme } from '../contexts/ThemeContext';

const PRODUCTS_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_DROPDOWN_OPTIONS = 120;
let productsCache = { at: 0, data: [] };
let productsFetchPromise = null;
const PRODUCTS_CACHE_KEY = 'adminPosProductsCache:v2';

const getFreshProductsCache = () => {
  const now = Date.now();
  if (Array.isArray(productsCache.data) && productsCache.data.length > 0 && now - productsCache.at < PRODUCTS_CACHE_TTL_MS) {
    return productsCache.data;
  }
  try {
    const raw = localStorage.getItem(PRODUCTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      Number.isFinite(parsed.at) &&
      Array.isArray(parsed.data) &&
      parsed.data.length > 0 &&
      now - parsed.at < PRODUCTS_CACHE_TTL_MS
    ) {
      productsCache = { at: parsed.at, data: parsed.data };
      return parsed.data;
    }
  } catch {
    // Ignore cache parse/storage errors.
  }
  return null;
};

const persistProductsCache = (data, at = Date.now()) => {
  productsCache = { at, data };
  try {
    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify({ at, data }));
  } catch {
    // Ignore storage quota/errors.
  }
};

/** Sequelize JSON fields may arrive as strings; normalize for Array.isArray checks. */
const parseJsonIfStringField = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const getCapacityPricingArray = (product) => {
  const parsed = parseJsonIfStringField(product?.capacityPricing);
  return Array.isArray(parsed) ? parsed : [];
};

/** JSON column sometimes double-encoded; normalize to a plain object or null. */
const parseStockByCapacityObject = (value) => {
  let v = parseJsonIfStringField(value);
  if (typeof v === 'string') {
    v = parseJsonIfStringField(v);
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  return null;
};

/**
 * Normalize capacity labels so inventory keys match pricing (e.g. "750ML." vs "750ML").
 */
const normalizeCapacityKey = (value) =>
  (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[.,;]+$/g, '');

/** Map spelling variants so pricing vs inventory keys align (e.g. "1 litre" vs "1l"). */
const normalizeCapacityKeyForMatch = (value) =>
  normalizeCapacityKey(value).replace(/(litre|liter|ltr)/g, 'l');

const toStockNumber = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const isCanPackSharedStockProduct = (parsedCapacityPricing) => {
  const values = Array.isArray(parsedCapacityPricing)
    ? parsedCapacityPricing.map((p) => p?.capacity || p?.size).filter(Boolean)
    : [];
  const normalized = values.map((v) => normalizeCapacityKey(v));
  const hasPack = normalized.some(
    (v) => /(^|\b)\d+(pack|pk)\b/.test(v) || v.includes('pack') || v.includes('pk')
  );
  const hasCan = normalized.some((v) => v.includes('can') || v === 'single');
  return hasPack && hasCan;
};

const countPricedCapacityTiers = (parsedCapacityPricing) => {
  const labels = new Set();
  if (!Array.isArray(parsedCapacityPricing)) return 0;
  parsedCapacityPricing.forEach((pricing) => {
    if (!pricing || typeof pricing !== 'object') return;
    const capacity = pricing.capacity || pricing.size;
    if (!capacity || typeof capacity !== 'string' || !capacity.trim()) return;
    const currentPrice = pricing.currentPrice != null ? parseFloat(pricing.currentPrice) : null;
    const originalPrice = pricing.originalPrice != null ? parseFloat(pricing.originalPrice) : null;
    const priceField = pricing.price != null ? parseFloat(pricing.price) : null;
    const price =
      currentPrice != null && !Number.isNaN(currentPrice) && currentPrice > 0
        ? currentPrice
        : originalPrice != null && !Number.isNaN(originalPrice) && originalPrice > 0
        ? originalPrice
        : priceField != null && !Number.isNaN(priceField) && priceField > 0
        ? priceField
        : 0;
    if (price > 0) labels.add(normalizeCapacityKey(capacity.trim()));
  });
  return labels.size;
};

/**
 * Per-capacity stock from stockByCapacity vs aggregate. Never assigns aggregate to every tier when multiple buckets exist.
 */
const resolveCapacityStockFromBuckets = (
  capacityLabel,
  normalizedStockByCapacity,
  aggregateStock,
  parsedCapacityPricing
) => {
  const tierCount = countPricedCapacityTiers(parsedCapacityPricing);
  const agg = toStockNumber(aggregateStock);

  if (!normalizedStockByCapacity || Object.keys(normalizedStockByCapacity).length === 0) {
    // Repeating aggregate on each priced tier double-counts in dropdown totals (e.g. 22+22).
    if (tierCount > 1) return 0;
    return agg;
  }

  const entries = Object.entries(normalizedStockByCapacity);
  const target = normalizeCapacityKey(capacityLabel);
  let entry = entries.find(([cap]) => normalizeCapacityKey(cap) === target);
  if (!entry) {
    const canon = normalizeCapacityKeyForMatch(capacityLabel);
    entry = entries.find(([cap]) => normalizeCapacityKeyForMatch(cap) === canon);
  }
  if (entry) {
    return toStockNumber(entry[1]);
  }
  if (isCanPackSharedStockProduct(parsedCapacityPricing)) {
    return agg;
  }
  const bucketSum = Object.values(normalizedStockByCapacity).reduce((s, v) => s + toStockNumber(v), 0);
  if (tierCount === 1 && agg > 0) return agg;
  if (bucketSum === 0 && agg > 0) return agg;
  return 0;
};

const NewOrderDialog = ({ open, onClose, onOrderCreated, mobileSize = false, initialIsStop = false }) => {
  const { isDarkMode, colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dialogContentRef = useRef(null);
  const errorAlertRef = useRef(null);
  const [customers, setCustomers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [territories, setTerritories] = useState([]);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productOptionsLoading, setProductOptionsLoading] = useState(false);
  const productSearchRequestSeqRef = useRef(0);
  
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
  const [sendSmsToCustomer, setSendSmsToCustomer] = useState(false);
  const [isStaffPurchase, setIsStaffPurchase] = useState(false);
  /** Matches backend/admin delivery settings (same logic as driver POS). */
  const [convenienceFeeEstimate, setConvenienceFeeEstimate] = useState(0);

  // Deferred customer creation state:
  // when "Create new customer" is selected from autocomplete, we auto-create on order submit.
  const [pendingCreateCustomerPhone, setPendingCreateCustomerPhone] = useState('');

  // Debounce customer search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setCustomerSearchQuery(customerSearch);
    }, 500); // 500ms debounce delay

    return () => clearTimeout(timer);
  }, [customerSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setProductSearchQuery(productSearch);
    }, 250);
    return () => clearTimeout(timer);
  }, [productSearch]);

  // Fetch customers when search query changes
  useEffect(() => {
    if (open) {
      fetchCustomers();
      fetchBranches();
      fetchDrivers();
      fetchTerritories();
      setProducts([]);
      // Reset isStop based on initialIsStop prop
      setIsStop(initialIsStop);
      // Reset order type to delivery
      setOrderType('delivery');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialIsStop]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const [feeModeRes, withAlcoholRes, perKmWithRes] = await Promise.all([
          api.get('/settings/deliveryFeeMode').catch(() => ({ data: null })),
          api.get('/settings/deliveryFeeWithAlcohol').catch(() => ({ data: null })),
          api.get('/settings/deliveryFeePerKmWithAlcohol').catch(() => ({ data: null }))
        ]);
        if (cancelled) return;
        const mode = feeModeRes.data?.value || 'fixed';
        const withAlc = parseFloat(withAlcoholRes.data?.value || '50');
        const perKmWith = parseFloat(perKmWithRes.data?.value || '20');
        const safeWith = Number.isFinite(withAlc) ? withAlc : 50;
        const safePerKm = Number.isFinite(perKmWith) ? perKmWith : 20;
        const est = mode === 'perKm' ? Math.ceil(5 * safePerKm) : safeWith;
        setConvenienceFeeEstimate(est);
      } catch {
        if (!cancelled) setConvenienceFeeEstimate(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Keep the latest error visible without forcing the admin to scroll.
  useEffect(() => {
    if (!open) return;
    if (!error) return;
    if (dialogContentRef.current) {
      dialogContentRef.current.scrollTop = 0;
    }
    if (errorAlertRef.current) {
      errorAlertRef.current.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    }
  }, [error, open]);

  // Fetch customers with search query
  useEffect(() => {
    if (open && customerSearchQuery) {
      fetchCustomers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerSearchQuery, open]);

  // No need to pre-filter - Material-UI Autocomplete's filterOptions will handle it

  useEffect(() => {
    // Set current price and capacity when product is selected
    if (currentProduct) {
      const capPricing = getCapacityPricingArray(currentProduct);
      if (capPricing.length > 0) {
        const firstPricing = capPricing[0];
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
    const capPricing = currentProduct ? getCapacityPricingArray(currentProduct) : [];
    if (currentProduct && capPricing.length > 0) {
      const target = normalizeCapacityKey(capacity);

      const pricing = capPricing.find((p) => {
        const raw = (p && (p.capacity || p.size)) || '';
        return normalizeCapacityKey(raw) === target;
      });

      if (pricing) {
        const currentPrice =
          pricing.currentPrice != null ? parseFloat(pricing.currentPrice) : null;
        const originalPrice =
          pricing.originalPrice != null ? parseFloat(pricing.originalPrice) : null;
        const priceField = pricing.price != null ? parseFloat(pricing.price) : null;
        const price =
          (currentPrice != null && !Number.isNaN(currentPrice) && currentPrice > 0
            ? currentPrice
            : originalPrice != null && !Number.isNaN(originalPrice) && originalPrice > 0
            ? originalPrice
            : priceField != null && !Number.isNaN(priceField) && priceField > 0
            ? priceField
            : parseFloat(currentProduct.price) || 0);

        if (!Number.isNaN(price) && price > 0) {
          setCurrentPrice(Math.round(price).toString());
        }
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

  const fetchProducts = async ({ forceRefresh = false, query = '', limit = null } = {}) => {
    const trimmedQuery = String(query || '').trim();
    if (trimmedQuery.length >= 2) {
      const reqSeq = productSearchRequestSeqRef.current + 1;
      productSearchRequestSeqRef.current = reqSeq;
      setProductOptionsLoading(true);
      try {
        const response = await api.get('/admin/drinks', {
          params: {
            q: trimmedQuery,
            limit: limit || MAX_DROPDOWN_OPTIONS
          }
        });
        if (reqSeq !== productSearchRequestSeqRef.current) return;
        const raw = response.data;
        const productsData = Array.isArray(raw) ? raw : (raw?.data || raw?.drinks || []);
        setProducts(productsData);
      } catch (error) {
        if (reqSeq === productSearchRequestSeqRef.current) {
          console.error('Error searching products:', error);
          setProducts([]);
        }
      } finally {
        if (reqSeq === productSearchRequestSeqRef.current) {
          setProductOptionsLoading(false);
        }
      }
      return;
    }

    const cachedProducts = !forceRefresh ? getFreshProductsCache() : null;
    if (cachedProducts) {
      setProducts(cachedProducts);
      return;
    }
    if (productsFetchPromise) {
      const shared = await productsFetchPromise;
      if (Array.isArray(shared)) setProducts(shared);
      return;
    }
    try {
      productsFetchPromise = (async () => {
        // Use admin drinks endpoint so we get purchasePrice for profit/loss calculation
        const response = await api.get('/admin/drinks');
        const raw = response.data;
        const productsData = Array.isArray(raw) ? raw : (raw?.data || raw?.drinks || []);
        persistProductsCache(productsData);
        return productsData;
      })();
      const productsData = await productsFetchPromise;
      setProducts(productsData);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      productsFetchPromise = null;
    }
  };

  useEffect(() => {
    if (!open) return;
    const term = String(productSearchQuery || '').trim();
    if (term.length >= 2) {
      fetchProducts({ query: term, limit: MAX_DROPDOWN_OPTIONS, forceRefresh: true });
      return;
    }
    setProducts([]);
    setProductOptionsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productSearchQuery]);

  const handleAddToCart = () => {
    if (!currentProduct || currentQuantity < 1) {
      setError('Please select a product and enter a valid quantity');
      return;
    }

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
    const capacityUnitMultiplier = (capacityLabel) => {
      const raw = String(capacityLabel || '').trim().toLowerCase();
      if (!raw) return 1;
      const compact = raw.replace(/\s+/g, '');
      const match = compact.match(/^(\d+)(pack|pk).*/);
      const n = match ? parseInt(match[1], 10) : NaN;
      return Number.isFinite(n) && n > 0 ? n : 1;
    };
    const parsedCapacityPricing = getCapacityPricingArray(currentProduct);
    const normalizedStockByCapacity = parseStockByCapacityObject(currentProduct?.stockByCapacity);
    let availableStock = toStockNumber(currentProduct.stock);
    if (normalizedStockByCapacity && Object.keys(normalizedStockByCapacity).length > 0) {
      if (selectedCapacity) {
        availableStock = resolveCapacityStockFromBuckets(
          selectedCapacity,
          normalizedStockByCapacity,
          currentProduct.stock,
          parsedCapacityPricing
        );
      } else {
        availableStock = Object.values(normalizedStockByCapacity).reduce(
          (sum, qty) => sum + toStockNumber(qty),
          0
        );
      }
    }
    // For pack capacities, stock is pooled in base units (cans) so compute max packs.
    if (selectedCapacity) {
      const multiplier = capacityUnitMultiplier(selectedCapacity);
      if (multiplier > 1) {
        availableStock = Math.floor(availableStock / multiplier);
      }
    }

    const existingQtyInCart = cartItems
      .filter(
        (item) =>
          item.drinkId === currentProduct.id &&
          (item.capacity || '') === (selectedCapacity || '')
      )
      .reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 0), 0);

    if (existingQtyInCart + currentQuantity > availableStock) {
      const suffix = selectedCapacity ? ` (${selectedCapacity})` : '';
      setError(
        `Insufficient stock for ${currentProduct.name}${suffix}. Please reduce quantity and try again.`
      );
      return;
    }

    // Determine reference/original price based on selected capacity (if any)
    let originalPrice = Math.round(parseFloat(currentProduct.price) || 0);
    if (
      selectedCapacity &&
      currentProduct &&
      Array.isArray(parsedCapacityPricing) &&
      parsedCapacityPricing.length > 0
    ) {
      const target = normalizeCapacityKey(selectedCapacity);

      const match = parsedCapacityPricing.find((p) => {
        const raw = (p && (p.capacity || p.size)) || '';
        return normalizeCapacityKey(raw) === target;
      });

      if (match) {
        const currentP =
          match.currentPrice != null ? parseFloat(match.currentPrice) : null;
        const originalP =
          match.originalPrice != null ? parseFloat(match.originalPrice) : null;
        const priceField =
          match.price != null ? parseFloat(match.price) : null;
        const effective =
          (currentP != null && !Number.isNaN(currentP) && currentP > 0
            ? currentP
            : originalP != null && !Number.isNaN(originalP) && originalP > 0
            ? originalP
            : priceField != null && !Number.isNaN(priceField) && priceField > 0
            ? priceField
            : originalPrice);
        if (!Number.isNaN(effective) && effective > 0) {
          originalPrice = Math.round(effective);
        }
      }
    }
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
    const existingItemIndex = cartItems.findIndex(
      (item) =>
        item.drinkId === currentProduct.id &&
        (item.capacity || '') === (selectedCapacity || '')
    );
    
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
        capacity: selectedCapacity || null,
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
        let originalPrice = Math.round(parseFloat(currentProduct.price) || 0);
        if (selectedCapacity && getCapacityPricingArray(currentProduct).length > 0) {
          const target = normalizeCapacityKey(selectedCapacity);
          const match = getCapacityPricingArray(currentProduct).find((p) => {
            const raw = (p && (p.capacity || p.size)) || '';
            return normalizeCapacityKey(raw) === target;
          });
          if (match) {
            const currentP =
              match.currentPrice != null ? parseFloat(match.currentPrice) : null;
            const originalP =
              match.originalPrice != null ? parseFloat(match.originalPrice) : null;
            const priceField =
              match.price != null ? parseFloat(match.price) : null;
            const effective =
              (currentP != null && !Number.isNaN(currentP) && currentP > 0
                ? currentP
                : originalP != null && !Number.isNaN(originalP) && originalP > 0
                ? originalP
                : priceField != null && !Number.isNaN(priceField) && priceField > 0
                ? priceField
                : originalPrice);
            if (!Number.isNaN(effective) && effective > 0) {
              originalPrice = Math.round(effective);
            }
          }
        }
        setCurrentPrice(originalPrice.toString());
      }
    }
    setPriceChangeDialog({ open: false, itemIndex: null, newPrice: '', oldPrice: '', drinkId: null, drinkName: '', originalPrice: '', quantity: null });
  };

  const handleRemoveFromCart = (index) => {
    setCartItems(cartItems.filter((_, i) => i !== index));
  };

  const itemsSubtotalRounded = useMemo(
    () => Math.round(cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)),
    [cartItems]
  );

  const convenienceFeeLine = useMemo(
    () => (isWalkIn ? 0 : Math.round(Number(convenienceFeeEstimate) || 0)),
    [isWalkIn, convenienceFeeEstimate]
  );

  const customerChargeSubtotal = useMemo(
    () => itemsSubtotalRounded + convenienceFeeLine,
    [itemsSubtotalRounded, convenienceFeeLine]
  );

  // Profit/loss: total selling price - total cost (purchase price × qty). Only when we have purchase prices.
  const { totalCost, profitLoss, hasPurchasePriceData } = useMemo(() => {
    let cost = 0;
    let hasAny = false;
    cartItems.forEach((item) => {
      const product = products.find((p) => p.id === item.drinkId);
      const pp = product?.purchasePrice != null && product?.purchasePrice !== '' ? parseFloat(product.purchasePrice) : null;
      if (pp != null && !Number.isNaN(pp) && pp >= 0) {
        cost += pp * (item.quantity || 0);
        hasAny = true;
      }
    });
    const total = cartItems.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
    return {
      totalCost: cost,
      profitLoss: hasAny ? total - cost : null,
      hasPurchasePriceData: hasAny
    };
  }, [cartItems, products]);

  const selectedTerritoryDeliveryFee = useMemo(() => {
    if (isWalkIn || !selectedTerritory) return null;
    const t = territories.find((x) => String(x.id) === String(selectedTerritory));
    if (!t) return null;
    return Math.round(Number(t.deliveryFromCBD ?? 0));
  }, [isWalkIn, selectedTerritory, territories]);

  /** Dark menu surface so dropdown lists are readable on mobile (theme default paper is white). */
  const selectMenuProps = useMemo(
    () => ({
      disablePortal: false,
      anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
      transformOrigin: { vertical: 'top', horizontal: 'left' },
      PaperProps: {
        sx: {
          maxHeight: 300,
          zIndex: '1400 !important',
          ...(isDarkMode
            ? {
                backgroundColor: '#1A1A1A',
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                '& .MuiMenuItem-root': {
                  color: colors.textPrimary,
                  '&:hover': {
                    backgroundColor: 'rgba(0, 224, 184, 0.12)'
                  },
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(0, 224, 184, 0.22)',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 224, 184, 0.28)'
                    }
                  }
                }
              }
            : {})
        }
      }
    }),
    [isDarkMode, colors.textPrimary, colors.border]
  );

  const handleSubmit = async () => {
    setError('');

    // Validation: only order type/payment and cart items are required.
    // Customer, phone, delivery location, branch, and territory are optional and can be edited after creation.
    let finalCustomer = selectedCustomer || {};

    if (cartItems.length === 0) {
      setError('Please add at least one item to the cart');
      return;
    }

    if (!paymentMethod) {
      setError('Please select a payment type');
      return;
    }

    if (isWalkIn && isStaffPurchase && !selectedDriver) {
      setError('Please select a rider for staff purchase');
      return;
    }

    // For M-Pesa, allow creating order without transaction code (can prompt later)
    // Transaction code is optional - admin can prompt customer later

    setLoading(true);

    try {
      // Walk-in orders are not delivery; use placeholder. Delivery orders may have TBD address initially.
      let finalDeliveryAddress = isWalkIn ? 'In-Store Purchase' : (deliveryLocation && deliveryLocation.trim() ? deliveryLocation : 'TBD');
      let branchId = null;

      if (isWalkIn && selectedBranch) {
        const branch = branches.find(b => b.id === parseInt(selectedBranch));
        if (branch) branchId = branch.id;
      } else if (!isWalkIn && branches.length > 0) {
        // For non-walk-in orders, use first active branch (usually branch 4) for distance calculation
        const activeBranch = branches.find(b => b.isActive) || branches[0];
        if (activeBranch) {
          branchId = activeBranch.id;
        }
      }
      
      // Find "1Default" territory for walk-in orders
      let defaultTerritoryId = null;
      if (isWalkIn) {
        const defaultTerritory = territories.find(t => t.name === '1Default' || t.name === '1 Default');
        if (defaultTerritory) {
          defaultTerritoryId = defaultTerritory.id;
        }
      }

      // For walk-in (POS) orders, disallow pay_on_delivery at data level as well.
      // Also, only allow cash_at_hand when it's a staff purchase.
      const effectivePaymentMethod = isWalkIn && paymentMethod === 'pay_on_delivery'
        ? 'cash'
        : (isWalkIn && paymentMethod === 'cash_at_hand' && !isStaffPurchase ? 'cash' : paymentMethod);

      const orderData = {
        orderType: isWalkIn ? 'walk_in' : 'delivery',
        isWalkIn: isWalkIn,
        customerName: isWalkIn ? 'POS' : (finalCustomer.customerName || finalCustomer.name || ''),
        customerPhone: isWalkIn ? null : (effectivePaymentMethod === 'mobile_money' && mpesaPhoneNumber.trim() ? mpesaPhoneNumber.trim() : (finalCustomer.phone || null)),
        customerEmail: isWalkIn ? null : (finalCustomer.email || null),
        deliveryAddress: finalDeliveryAddress,
        items: cartItems.map(item => ({
          drinkId: item.drinkId,
          quantity: item.quantity,
          selectedPrice: item.price,
          selectedCapacity: item.capacity || null
        })),
        paymentType: effectivePaymentMethod === 'cash'
          ? 'pay_now'
          : (effectivePaymentMethod === 'pay_on_delivery'
            ? 'pay_on_delivery'
            : (effectivePaymentMethod === 'mobile_money'
              ? 'pay_on_delivery'
              : (effectivePaymentMethod === 'card'
                ? 'pay_now'
                : 'pay_on_delivery'))),
        paymentMethod: effectivePaymentMethod || null,
        paymentStatus: isWalkIn 
          ? (
              // Walk-in: cash/card/cash_at_hand are immediately received; M-Pesa is only paid once confirmed.
              (effectivePaymentMethod === 'cash' || effectivePaymentMethod === 'card' || effectivePaymentMethod === 'cash_at_hand')
                ? 'paid'
                : (effectivePaymentMethod === 'mobile_money'
                  ? (transactionCode.trim() ? 'paid' : 'unpaid')
                  : 'unpaid')
            )
          : ((effectivePaymentMethod === 'mobile_money' && !transactionCode.trim()) ? 'unpaid' : (effectivePaymentMethod === 'pay_on_delivery' ? 'unpaid' : (effectivePaymentMethod ? 'paid' : 'unpaid'))),
        status: isWalkIn 
          ? (
              (effectivePaymentMethod === 'cash' || effectivePaymentMethod === 'card' || effectivePaymentMethod === 'cash_at_hand')
                ? 'completed'
                : (effectivePaymentMethod === 'mobile_money'
                  ? (transactionCode.trim() ? 'completed' : 'in_progress')
                  : 'in_progress')
            ) // Walk-in: do not complete until actually paid
          : deliveryStatus,
        adminOrder: true,
        branchId: branchId,
        // Walk-in staff purchase uses a purchaser rider, not a delivery assignment.
        staffPurchaseDriverId: isWalkIn && isStaffPurchase && selectedDriver ? parseInt(selectedDriver) : null,
        // Delivery orders may still be assigned to a driver.
        driverId: !isWalkIn && selectedDriver ? parseInt(selectedDriver) : null,
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
    // For M-Pesa we need a phone number to send the STK push to (walk-in: payer's phone; delivery: customer phone)
    if (!mpesaPhoneNumber || !mpesaPhoneNumber.trim()) {
      setError(isWalkIn
        ? 'Please enter the phone number to send the M-Pesa payment request to'
        : 'Please enter customer phone number');
      return;
    }

    if (!validateSafaricomPhone(mpesaPhoneNumber)) {
      setError('Please enter a valid Safaricom number (e.g. 0712345678 or 254712345678)');
      return;
    }

    const totalAmount = customerChargeSubtotal;

    if (totalAmount <= 0) {
      setError('Order total must be greater than 0');
      return;
    }

    setPromptingPayment(true);
    setError('');
    setPaymentSuccess(null);

    try {
      // First, create the order without transaction code (pending payment)
      // Walk-in orders are not delivery; use placeholder. Branch is for reference only.
      let finalDeliveryAddress = isWalkIn ? 'In-Store Purchase' : deliveryLocation;
      let branchId = null;
      if (isWalkIn && selectedBranch) {
        const branch = branches.find(b => b.id === parseInt(selectedBranch));
        if (branch) branchId = branch.id;
      }

      if (!finalDeliveryAddress || !finalDeliveryAddress.trim()) {
        setError('Delivery address is required');
        setPromptingPayment(false);
        return;
      }

      // Get final customer
      let finalCustomer = selectedCustomer;
      if (!isWalkIn && !selectedCustomer) {
        try {
          finalCustomer = await resolveFinalCustomer();
        } catch (resolveError) {
          setError(resolveError.message || 'Please select a customer or enter a valid phone number');
          setPromptingPayment(false);
          return;
        }
      }

      // For walk-in orders, always use 'POS' as customer name
      const customerNameForOrder = isWalkIn
        ? 'POS'
        : (finalCustomer?.customerName || finalCustomer?.name || 'Customer');
      
      // Backend treats order as walk-in when customerPhone === 'POS' or deliveryAddress === 'In-Store Purchase'. Send 'POS' for walk-in so backend does not require a real phone.
      const customerPhoneForOrder = isWalkIn
        ? 'POS'
        : (finalCustomer?.phone || mpesaPhoneNumber.trim() || null);

      // Default territory for walk-in (backend may use for delivery fee logic)
      let defaultTerritoryId = null;
      if (isWalkIn) {
        const defaultTerritory = territories.find(t => t.name === '1Default' || t.name === '1 Default');
        if (defaultTerritory) defaultTerritoryId = defaultTerritory.id;
      }

      const orderData = {
        orderType: isWalkIn ? 'walk_in' : 'delivery',
        isWalkIn: isWalkIn,
        customerName: customerNameForOrder,
        customerPhone: customerPhoneForOrder,
        customerEmail: isWalkIn ? null : (finalCustomer?.email || null),
        deliveryAddress: finalDeliveryAddress,
        items: cartItems.map(item => ({
          drinkId: item.drinkId,
          quantity: item.quantity,
          selectedPrice: item.price,
          selectedCapacity: item.capacity || null
        })),
        paymentType: 'pay_on_delivery', // Set as pay_on_delivery so prompt-payment endpoint accepts it
        paymentMethod: 'mobile_money',
        paymentStatus: 'unpaid',
        status: isWalkIn ? 'in_progress' : deliveryStatus, // Walk-in orders: 'in_progress' if unpaid, will be 'completed' when paid
        adminOrder: true,
        branchId: branchId,
        staffPurchaseDriverId: isWalkIn && isStaffPurchase && selectedDriver ? parseInt(selectedDriver) : null,
        driverId: !isWalkIn && selectedDriver ? parseInt(selectedDriver) : null,
        territoryId: isWalkIn ? defaultTerritoryId : (selectedTerritory ? parseInt(selectedTerritory) : null),
        transactionCode: null, // Will be populated after payment
        isStop: isStop,
        stopDeductionAmount: isStop ? parseFloat(stopDeductionAmount) || 100 : null,
        sendSmsToCustomer: sendSmsToCustomer
      };

      // Create order first (pending payment)
      const orderResponse = await api.post('/orders', orderData);
      const orderId = orderResponse.data.id;

      // Now prompt for payment. For walk-in, order.customerPhone is 'POS' so backend requires customerPhone in body (payer's phone for STK push).
      const promptPayload = mpesaPhoneNumber.trim()
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
    const totalAmount = customerChargeSubtotal;

    if (totalAmount <= 0) {
      setError('Order total must be greater than 0');
      return;
    }

    setPromptingPayment(true);
    setError('');
    setPaymentSuccess(null);

    try {
      // First, create the order without transaction code (pending payment)
      // Walk-in orders are not delivery; use placeholder. Branch is for reference only.
      let finalDeliveryAddress = isWalkIn ? 'In-Store Purchase' : deliveryLocation;
      let branchId = null;
      if (isWalkIn && selectedBranch) {
        const branch = branches.find(b => b.id === parseInt(selectedBranch));
        if (branch) branchId = branch.id;
      }

      if (!finalDeliveryAddress || !finalDeliveryAddress.trim()) {
        setError('Delivery address is required');
        setPromptingPayment(false);
        return;
      }

      // Get final customer
      let finalCustomer = selectedCustomer;
      if (!isWalkIn && !selectedCustomer) {
        try {
          finalCustomer = await resolveFinalCustomer();
        } catch (resolveError) {
          setError(resolveError.message || 'Please select a customer or enter a valid phone number');
          setPromptingPayment(false);
          return;
        }
      }

      // For walk-in orders, always use 'POS' as customer name
      const customerNameForOrder = isWalkIn
        ? 'POS'
        : (finalCustomer?.customerName || finalCustomer?.name || 'Customer');
      
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
          selectedPrice: item.price,
          selectedCapacity: item.capacity || null
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

  const resolveFinalCustomer = async () => {
    if (isWalkIn) return null;
    if (selectedCustomer) return selectedCustomer;

    const phoneMatch = customerSearch.match(/(\+?\d{9,15})/);
    const phoneNumber = (pendingCreateCustomerPhone || phoneMatch?.[1] || '').trim();
    if (!phoneNumber) {
      throw new Error('Please select a customer or enter a valid phone number');
    }

    const createResponse = await api.post('/admin/customers', {
      phone: phoneNumber,
      customerName: phoneNumber
    });

    if (!(createResponse.data?.success && createResponse.data?.customer)) {
      throw new Error('Please select a customer or enter a valid phone number');
    }

    const createdCustomer = createResponse.data.customer;
    setSelectedCustomer(createdCustomer);
    setPendingCreateCustomerPhone('');
    const createdName = createdCustomer.customerName || createdCustomer.name || phoneNumber;
    setCustomerSearch(createdCustomer.phone ? `${createdName} - ${createdCustomer.phone}` : createdName);
    await fetchCustomers();
    return createdCustomer;
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
      // Walk-in orders are not delivery; use placeholder. Branch is for reference only.
      let finalDeliveryAddress = isWalkIn ? 'In-Store Purchase' : deliveryLocation;
      let branchId = null;
      if (isWalkIn && selectedBranch) {
        const branch = branches.find(b => b.id === parseInt(selectedBranch));
        if (branch) branchId = branch.id;
      }

      if (!finalDeliveryAddress || !finalDeliveryAddress.trim()) {
        setError('Delivery address is required');
        setProcessingPdqPayment(false);
        return;
      }

      // Get final customer
      let finalCustomer = selectedCustomer;
      if (!isWalkIn && !selectedCustomer) {
        try {
          finalCustomer = await resolveFinalCustomer();
        } catch (resolveError) {
          setError(resolveError.message || 'Please select a customer or enter a valid phone number');
          setProcessingPdqPayment(false);
          return;
        }
      }

      const customerNameForOrder = isWalkIn
        ? 'POS'
        : (finalCustomer?.customerName || finalCustomer?.name || 'Customer');
      
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
          selectedPrice: item.price,
          selectedCapacity: item.capacity || null
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
      disableScrollLock={true}
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
      <DialogContent
        ref={dialogContentRef}
        sx={{ 
        overflowY: 'auto',
        overflowX: 'hidden',
        maxHeight: mobileSize ? 'calc(90vh - 180px)' : 'calc(90vh - 120px)',
        padding: mobileSize ? 1.8 : 3,
        '& .MuiSelect-root': {
          '& .MuiMenu-paper': {
            zIndex: '1400 !important'
          }
        }
      }}>
        {error && (
          <Alert 
            severity="error" 
            ref={errorAlertRef}
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
          <FormControl fullWidth sx={{ mt: '20px' }}>
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
                  setIsStaffPurchase(false);
                  // Pay on delivery is not valid for walk-in/POS orders
                  if (paymentMethod === 'pay_on_delivery') {
                    setPaymentMethod('cash');
                  }
                } else {
                  setSelectedBranch('');
                  setDeliveryLocation('');
                  setDeliveryStatus('confirmed');
                }
              }}
              MenuProps={selectMenuProps}
            >
              <MenuItem value="delivery">Delivery</MenuItem>
              <MenuItem value="walk-in">Walk-in</MenuItem>
            </Select>
          </FormControl>

          {/* Staff Purchase (walk-in only) */}
          {isWalkIn && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={isStaffPurchase}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsStaffPurchase(checked);
                    if (!checked) {
                      setSelectedDriver('');
                      if (paymentMethod === 'cash_at_hand') setPaymentMethod('cash');
                    }
                  }}
                />
              }
              label="Staff purchase"
            />
          )}

          {/* Rider dropdown (staff purchase only) */}
          {isWalkIn && isStaffPurchase && (
            <FormControl fullWidth>
              <InputLabel>Select Rider</InputLabel>
              <Select
                value={selectedDriver}
                label="Select Rider"
                onChange={(e) => setSelectedDriver(e.target.value)}
                MenuProps={selectMenuProps}
              >
                <MenuItem value="">
                  <em>Select rider</em>
                </MenuItem>
                {drivers.map((driver) => (
                  <MenuItem key={driver.id} value={driver.id}>
                    {driver.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Territory Selection - Only shown for delivery orders (optional) */}
          {!isWalkIn && (
            <Autocomplete
              value={territories.find((t) => String(t.id) === String(selectedTerritory)) || null}
              onChange={(_, newValue) => {
                setSelectedTerritory(newValue ? String(newValue.id) : '');
              }}
              options={territories}
              isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
              getOptionLabel={(option) => {
                if (!option) return '';
                return `${option.name} (KES ${Math.round(Number(option.deliveryFromCBD ?? 0))})`;
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Territory"
                  placeholder="Search territory..."
                />
              )}
              clearOnEscape
              fullWidth
            />
          )}

          {/* Customer Selection - Hidden when walk-in is enabled (optional for admin orders) */}
          {!isWalkIn && (
            <Autocomplete
              value={selectedCustomer}
              onChange={async (event, newValue) => {
                // Handle create customer option
                if (newValue && newValue.isCreateOption) {
                  const phone = String(newValue.phone || customerSearch || '').trim();
                  setSelectedCustomer(null);
                  setPendingCreateCustomerPhone(phone);
                  setCustomerSearch(phone);
                  return;
                }
                
                setPendingCreateCustomerPhone('');
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
                  setPendingCreateCustomerPhone('');
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
                  setPendingCreateCustomerPhone('');
                  setDeliveryLocation('');
                } else if (reason === 'reset') {
                  setCustomerSearch('');
                  setSelectedCustomer(null);
                  setPendingCreateCustomerPhone('');
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
                    label="Customer"
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

          {/* Branch Selection - Only shown when walk-in is enabled (optional) */}
          {isWalkIn && (
            <FormControl fullWidth>
              <InputLabel>Branch</InputLabel>
              <Select
                value={selectedBranch}
                label="Branch"
                onChange={(e) => setSelectedBranch(e.target.value)}
                MenuProps={selectMenuProps}
              >
                {branches.map((branch) => (
                  <MenuItem key={branch.id} value={branch.id}>
                    {branch.name} - {branch.address}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}


          {/* Delivery Location - Only shown when walk-in is disabled (optional, can be set later) */}
          {!isWalkIn && (
            <AddressAutocomplete
              label="Delivery Location"
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
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: mobileSize ? 1.6 : 1.8,
                mb: mobileSize ? 1.8 : 2
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'flex-end',
                  gap: mobileSize ? 1 : 1.25
                }}
              >
                <Autocomplete
                  value={currentProduct}
                  onChange={(event, newValue) => setCurrentProduct(newValue)}
                  inputValue={productSearch}
                  onInputChange={(event, newInputValue, reason) => {
                    setProductSearch(newInputValue);
                    // Clear selection if input is cleared
                    if (!newInputValue) {
                      setCurrentProduct(null);
                    }
                  }}
                  options={products}
                  loading={productOptionsLoading}
                  getOptionLabel={(option) => {
                    if (!option) return '';
                    return option.name || '';
                  }}
                  isOptionEqualToValue={(option, value) => {
                    if (!option || !value) return false;
                    return option.id === value.id;
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
                  noOptionsText={productOptionsLoading ? 'Loading products...' : 'No products found'}
                  forcePopupIcon={false}
                  openOnFocus={false}
                  open={String(productSearch || '').trim().length >= 2}
                  disablePortal={false}
                  ListboxProps={{
                    style: { maxHeight: '300px' }
                  }}
                  sx={{
                    flex: mobileSize ? '1 1 100%' : '1 1 320px',
                    maxWidth: mobileSize ? '100%' : 420
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      label="Product"
                      placeholder="Type product name..."
                    />
                  )}
                  renderOption={(props, option) => {
                  const { key, ...restProps } = props;

                  const totalStock =
                    option.stock !== undefined && option.stock !== null ? option.stock : 0;

                  const stockByCapacity = parseStockByCapacityObject(option.stockByCapacity);
                  const parsedCapacityPricing = getCapacityPricingArray(option);
                  const capacityUnitMultiplier = (capacityLabel) => {
                    const raw = String(capacityLabel || '').trim().toLowerCase();
                    if (!raw) return 1;
                    const compact = raw.replace(/\s+/g, '');
                    const match = compact.match(/^(\d+)(pack|pk).*/);
                    const n = match ? parseInt(match[1], 10) : NaN;
                    return Number.isFinite(n) && n > 0 ? n : 1;
                  };

                  const rows = [];

                  if (Array.isArray(parsedCapacityPricing) && parsedCapacityPricing.length > 0) {
                    parsedCapacityPricing.forEach((pricing) => {
                      if (!pricing || typeof pricing !== 'object') return;

                      const rawCapacity = pricing.capacity || pricing.size;
                      if (!rawCapacity || typeof rawCapacity !== 'string' || !rawCapacity.trim())
                        return;
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

                      let capStock = resolveCapacityStockFromBuckets(
                        capacity,
                        stockByCapacity,
                        totalStock,
                        parsedCapacityPricing
                      );
                      const multiplier = capacityUnitMultiplier(capacity);
                      if (multiplier > 1) {
                        capStock = Math.floor(capStock / multiplier);
                      }

                      rows.push({
                        capacity,
                        price,
                        stock: capStock
                      });
                    });
                  }

                  if (rows.length === 0 && stockByCapacity && Object.keys(stockByCapacity).length > 0) {
                    Object.entries(stockByCapacity).forEach(([capacity, stock]) => {
                      rows.push({
                        capacity,
                        price: parseFloat(option.price || 0) || 0,
                        stock
                      });
                    });
                  }

                  // Blue label = combined total; sum per-line unless can+pack shared pool.
                  // If per-line resolved to 0 (missing buckets) but aggregate has stock, show aggregate.
                  const rowSum = rows.reduce((s, r) => s + (Number(r.stock) || 0), 0);
                  let headerStock = Number(totalStock) || 0;
                  if (rows.length > 0) {
                    headerStock = isCanPackSharedStockProduct(parsedCapacityPricing)
                      ? Number(totalStock) || 0
                      : rowSum > 0
                        ? rowSum
                        : Number(totalStock) || 0;
                  }
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
                          {rows.length > 0 && (
                            <Box sx={{ mt: 0.5 }}>
                              {rows.map((row, idx) => (
                                <Typography
                                  key={idx}
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: 'block' }}
                                >
                                    {row.capacity} - KES {Math.round(row.price)} (Stock: {row.stock})
                                </Typography>
                              ))}
                            </Box>
                          )}
                          {rows.length === 0 && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: 'block' }}
                            >
                              KES {Math.round(parseFloat(option.price || 0))} (Stock: {totalStock})
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
                          Stock: {headerStock}
                        </Typography>
                      </Box>
                    </li>
                  );
                }}
                />

                {/* Unit Price (editable) */}
                {currentProduct && (
                  <TextField
                    type="number"
                    label="Unit Price"
                    size="small"
                    value={currentPrice}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only allow whole numbers
                      if (value === '' || /^\d+$/.test(value)) {
                        setCurrentPrice(value);
                      }
                    }}
                    inputProps={{ min: 0, step: 1 }}
                    sx={{ width: mobileSize ? '100%' : 160 }}
                  />
                )}

                {/* Quantity */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1
                  }}
                >
                  <IconButton
                    size="small"
                    onClick={() => setCurrentQuantity(Math.max(1, currentQuantity - 1))}
                    disabled={currentQuantity <= 1}
                    sx={{
                      backgroundColor: colors.accentText,
                      color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                      width: mobileSize ? '34px' : '36px',
                      height: mobileSize ? '34px' : '36px',
                      '&:hover': {
                        backgroundColor: '#00C4A3'
                      },
                      '&:disabled': {
                        backgroundColor: colors.border,
                        color: colors.textSecondary
                      }
                    }}
                  >
                    <Remove sx={{ fontSize: mobileSize ? '1.1rem' : '1.25rem' }} />
                  </IconButton>
                  <TextField
                    type="number"
                    label="Qty"
                    size="small"
                    value={currentQuantity}
                    onChange={(e) => setCurrentQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    inputProps={{ min: 1 }}
                    sx={{
                      width: mobileSize ? 110 : 120,
                      '& .MuiInputBase-input': { textAlign: 'center' }
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => setCurrentQuantity(currentQuantity + 1)}
                    sx={{
                      backgroundColor: colors.accentText,
                      color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                      width: mobileSize ? '34px' : '36px',
                      height: mobileSize ? '34px' : '36px',
                      '&:hover': {
                        backgroundColor: '#00C4A3'
                      }
                    }}
                  >
                    <Add sx={{ fontSize: mobileSize ? '1.1rem' : '1.25rem' }} />
                  </IconButton>
                </Box>

                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={handleAddToCart}
                  sx={{
                    backgroundColor: colors.accentText,
                    color: isDarkMode ? '#0D0D0D' : '#FFFFFF',
                    fontSize: mobileSize ? '0.85rem' : '0.9rem',
                    padding: mobileSize ? '5px 12px' : '5px 12px',
                    height: 36,
                    minWidth: mobileSize ? '100%' : 96,
                    '&:hover': { backgroundColor: '#00C4A3' }
                  }}
                >
                  Add
                </Button>
              </Box>

              {/* Capacity Selection with Radio Buttons */}
              {currentProduct && getCapacityPricingArray(currentProduct).length > 0 && (
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
                      const seen = new Set();
                      const parsedCapacityPricing = getCapacityPricingArray(currentProduct);
                      const normalizedStockByCapacity = parseStockByCapacityObject(
                        currentProduct?.stockByCapacity
                      );
                      const capacityUnitMultiplier = (capacityLabel) => {
                        const raw = String(capacityLabel || '').trim().toLowerCase();
                        if (!raw) return 1;
                        const compact = raw.replace(/\s+/g, '');
                        const match = compact.match(/^(\d+)(pack|pk).*/);
                        const n = match ? parseInt(match[1], 10) : NaN;
                        return Number.isFinite(n) && n > 0 ? n : 1;
                      };
                      const uniquePricingSource = Array.isArray(parsedCapacityPricing)
                        ? parsedCapacityPricing
                        : [];
                      const uniquePricing = uniquePricingSource.filter((pricing) => {
                        if (!pricing || typeof pricing !== 'object') return false;
                        const capacity = pricing.capacity || pricing.size;
                        if (!capacity || typeof capacity !== 'string' || !capacity.trim()) return false;
                        const currentPrice = pricing.currentPrice != null ? parseFloat(pricing.currentPrice) : null;
                        const originalPrice = pricing.originalPrice != null ? parseFloat(pricing.originalPrice) : null;
                        const priceField = pricing.price != null ? parseFloat(pricing.price) : null;
                        const price =
                          currentPrice != null && !Number.isNaN(currentPrice) && currentPrice > 0
                            ? currentPrice
                            : originalPrice != null && !Number.isNaN(originalPrice) && originalPrice > 0
                            ? originalPrice
                            : priceField != null && !Number.isNaN(priceField) && priceField > 0
                            ? priceField
                            : 0;
                        if (price <= 0) return false;
                        const capacityKey = normalizeCapacityKey(capacity);
                        if (seen.has(capacityKey)) return false;
                        seen.add(capacityKey);
                        return true;
                      });

                      const getCapacityStock = (capacity) => {
                        let availableStock = resolveCapacityStockFromBuckets(
                          capacity,
                          normalizedStockByCapacity,
                          currentProduct?.stock,
                          parsedCapacityPricing
                        );
                        const multiplier = capacityUnitMultiplier(capacity);
                        if (multiplier > 1) {
                          availableStock = Math.floor(availableStock / multiplier);
                        }
                        return availableStock;
                      };

                      return uniquePricing.map((pricing, index) => {
                        const capacity = (pricing.capacity || pricing.size || '').trim();
                        const price = parseFloat(pricing.currentPrice) || parseFloat(pricing.originalPrice) || parseFloat(pricing.price) || 0;
                        const capacityStock = getCapacityStock(capacity);
                        const isOutOfStock = capacityStock <= 0;
                        
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
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, width: '100%' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between', width: '100%' }}>
                                  <Typography variant="body2" sx={{ color: colors.textPrimary, fontWeight: 'bold' }}>
                                    {capacity}
                                  </Typography>
                                  <Typography variant="body2" sx={{ color: colors.accentText, fontWeight: 'bold' }}>
                                    KES {Math.round(price)}
                                  </Typography>
                                  {isOutOfStock && (
                                    <Typography variant="caption" sx={{ color: '#d32f2f', fontWeight: 700 }}>
                                      Out of stock
                                    </Typography>
                                  )}
                                </Box>
                                <Typography variant="caption" sx={{ color: colors.textSecondary }}>
                                  Stock: {capacityStock}
                                </Typography>
                              </Box>
                            }
                            sx={{
                              border: `1px solid ${isOutOfStock ? '#d32f2f' : colors.border}`,
                              borderRadius: 1,
                              backgroundColor: selectedCapacity === capacity
                                ? (isDarkMode ? 'rgba(0, 224, 184, 0.2)' : 'rgba(0, 224, 184, 0.1)')
                                : (isOutOfStock
                                  ? (isDarkMode ? 'rgba(211, 47, 47, 0.16)' : 'rgba(211, 47, 47, 0.08)')
                                  : 'transparent'),
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
                          {item.name}{item.capacity ? ` (${item.capacity})` : ''}
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
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                    Items
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    KES {itemsSubtotalRounded}
                  </Typography>
                </Box>
                {!isWalkIn && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                      Convenience fee
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      KES {convenienceFeeLine}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Subtotal
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: colors.accentText }}>
                    KES {customerChargeSubtotal}
                  </Typography>
                </Box>
                {!isWalkIn && selectedTerritoryDeliveryFee != null && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                    <Typography variant="body2" sx={{ color: colors.textSecondary }}>
                      Territory delivery fee
                    </Typography>
                    <Typography variant="body2" sx={{ color: colors.textSecondary, fontWeight: 600 }}>
                      KES {selectedTerritoryDeliveryFee}
                    </Typography>
                  </Box>
                )}
                {hasPurchasePriceData && (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                      <Typography variant="body2" sx={{ color: colors.textSecondary }}>Total purchase cost:</Typography>
                      <Typography variant="body2" sx={{ color: colors.textSecondary }}>KES {Math.round(totalCost)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mt: 0.5 }}>
                      {profitLoss != null && (
                        <Chip
                          size="small"
                          label={profitLoss >= 0 ? `PROFIT +KES ${Math.round(profitLoss)}` : `LOSS -KES ${Math.round(Math.abs(profitLoss))}`}
                          sx={{
                            backgroundColor: profitLoss >= 0 ? 'rgba(76, 175, 80, 0.2)' : '#e0e0e0',
                            color: profitLoss >= 0 ? '#2e7d32' : '#000000',
                            fontWeight: 600
                          }}
                        />
                      )}
                    </Box>
                  </>
                )}
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
              MenuProps={selectMenuProps}
            >
              <MenuItem value="cash">Cash Received</MenuItem>
              {!isWalkIn && (
                <MenuItem value="pay_on_delivery">Pay on Delivery</MenuItem>
              )}
              <MenuItem value="mobile_money">Mpesa</MenuItem>
              {isWalkIn && isStaffPurchase && (
                <MenuItem value="cash_at_hand">Cash at Hand</MenuItem>
              )}
              <MenuItem value="card">Card</MenuItem>
            </Select>
          </FormControl>

          {/* M-Pesa Payment Section */}
          {paymentMethod === 'mobile_money' && (
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
              {isWalkIn && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Walk-in M-Pesa orders are not completed until payment is confirmed. Use the button above to send the STK prompt.
                </Alert>
              )}
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
                  MenuProps={selectMenuProps}
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
                    setPdqPaymentData(prev => ({ ...prev, amount: customerChargeSubtotal }));
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
                MenuProps={selectMenuProps}
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
              disabled={loading || promptingPayment}
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

      
    </>
  );
};

export default NewOrderDialog;

